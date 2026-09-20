/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { merge } from '../util/lang';
import {
  MIRROR_PROTOCOL_VERSION,
  MirrorCommand,
  MirrorEvent,
  MirrorOp,
  isValidOp,
  sanitizeTransferable,
} from './mirror-protocol';

/** 消息出口：宿主接到 `worker.postMessage` 上（也方便测试直接收数组）。 */
export type MirrorSend = (msg: MirrorCommand) => void;

export type MirrorBridgeOptions = {
  /** 消息出口。也可以之后用 `setSend()` 再装（例如先拿 `worker` 再建桥） */
  send?: MirrorSend;
  /**
   * 结构变更（增删子节点）时是否自动排一次全量重同步，默认 true。
   *
   * 关掉它请自己想清楚：v1 的 op 只有状态补丁，**结构对不上时镜像会画错东西**（不是不画）。
   */
  resyncOnStructureChange?: boolean;
  /** worker 回传的事件（ready / rendered / missing / error）——宿主做统计或重试策略用。 */
  onEvent?: (evt: MirrorEvent) => void;
};

/**
 * 主线程侧的**镜像桥**：把「组件树与状态」这一侧的变化，翻译成 worker 能执行的协议消息。
 *
 * 用法（主线程）：
 * ```ts
 * const bridge = new MirrorBridge(ice, { send: (msg) => worker.postMessage(msg) });
 * bridge.captureScene();          // 首次全量
 * // 之后每帧：bridge.frame(performance.now()) —— 它先 flush 增量，再发节拍
 * worker.onmessage = (e) => bridge.handleEvent(e.data);
 * ```
 *
 * 三条策略：
 * 1. **状态增量、结构全量**：`setState` 变成 `['state', id, patch]` 排队；增删子节点只把桥标成
 *    `pendingScene`，下一次 flush 直接重发整份文档（结构变更低频，不值得先上子树增量协议）。
 * 2. **同组件的连续补丁就地合并**：一帧里对同一个组件写 10 次（动画很常见）只发 1 条 op，
 *    合并用的是 `setState` 自己那套 `merge`，语义逐字一致。
 * 3. **消失/重复的依赖要能自愈**：worker 回 `missing`（镜像里找不到某些 id）时自动重排一次
 *    全量场景 —— 只重试**一次**，连续失败说明是别的问题（比如类型没注册），不该无限重发。
 */
export default class MirrorBridge {
  public ice: any;
  /** 协议版本（宿主可读，用于握手时对齐） */
  public readonly version = MIRROR_PROTOCOL_VERSION;
  /** 累计发出的消息数（含 scene / ops / frame / resize） */
  public sent = 0;
  /** 累计被丢弃的不可克隆值（路径） */
  public dropped: string[] = [];

  private send_: MirrorSend | null = null;
  private onEvent_: ((evt: MirrorEvent) => void) | null = null;
  private readonly resyncOnStructureChange: boolean;
  private ops: MirrorOp[] = [];
  /** 待发的选择状态（undefined = 没有变化；空数组 = 明确"取消选择"） */
  private selectionIds: string[] | null = null;
  /**
   * 最近一次已知的选择。
   *
   * 用途只有一个：**全量场景重建之后要把它补发一遍** —— 否则 worker 的镜像树是新的、
   * 选择是空的，"结构一变手柄就消失"。它与 `selectionIds` 的区别是前者"待发"，后者"现状"。
   */
  private lastSelectionIds: string[] | null = null;
  /** 待发的视口（null = 无变化）；与选择一样，`scene` 重建之后要补发 */
  private viewport: { scale: number; tx: number; ty: number } | null = null;
  /** 最近一次已知视口（"现状"，scene 重建后补发用） */
  private lastViewport: { scale: number; tx: number; ty: number } | null = null;
  /** 组件 id → 在 `ops` 里的下标（补丁合并用） */
  private opIndex = new Map<string, number>();
  private seq = 0;
  private pendingScene = true;
  /** 上一次"因为 missing 而重发全量"的时刻：镜像错位时别每帧重发（见 handleEvent）。 */
  private lastResyncAt = 0;
  private lastStats: MirrorEvent | null = null;

  constructor(ice: any, options: MirrorBridgeOptions = {}) {
    if (!ice) {
      throw new Error('[ice-render] MirrorBridge: 需要一个 ICE 实例。');
    }
    this.ice = ice;
    this.resyncOnStructureChange = options.resyncOnStructureChange !== false;
    if (options.send) this.send_ = options.send;
    if (options.onEvent) this.onEvent_ = options.onEvent;
    // 装到实例上：引擎的四处钩子按 `ice.__mirrorBridge` 找桥（见 mirror-hooks.ts）
    ice.__mirrorBridge = this;
  }

  /** 换消息出口（例如先建桥、后拿到 worker）。 */
  public setSend(send: MirrorSend | null): this {
    this.send_ = send;
    return this;
  }

  public setEventHandler(handler: ((evt: MirrorEvent) => void) | null): this {
    this.onEvent_ = handler;
    return this;
  }

  /** 卸下桥：引擎钩子立刻回到零成本（`ice.__mirrorBridge` 清空）。 */
  public detach(): void {
    if (this.ice && this.ice.__mirrorBridge === this) {
      this.ice.__mirrorBridge = null;
    }
  }

  /** 排一次全量场景（首次、结构变了、worker 报告镜像错位时都走这里）。 */
  public markSceneNeeded(): void {
    this.pendingScene = true;
  }

  /**
   * **对齐"当前状态"**：把此刻的视口 / 选择 / 全量场景一次排进待发队列。
   *
   * 为什么必须有这一步：桥只采得到"建立之后的变更"。而宿主（`MirrorHost`）通常是在应用已经跑了一阵
   * 之后才接上 worker 的 —— 那一刻 ICE 的视口可能已经被用户缩放/平移过、也可能有选中项。
   * 不补这一下，新起的镜像会从**默认视口**出发，主线程与 worker 看的是不同区域
   * （症状：接上 worker 的瞬间画面"跳"一下；之后没人再动视口，它就永远错着）。
   */
  public prime(): this {
    const ice: any = this.ice;
    if (ice && ice.viewport) {
      this.recordViewportChange(ice.viewport);
    }
    if (ice && Array.isArray(ice.selectionList) && ice.selectionList.length) {
      this.recordSelectionChange(ice.selectionList);
    }
    this.markSceneNeeded();
    return this;
  }

  /** 上次 worker 回传的统计（宿主做 FPS/耗时面板用）。 */
  public get lastEvent(): MirrorEvent | null {
    return this.lastStats;
  }

  /** 还没发出去的 op 条数。 */
  public get pendingOps(): number {
    return this.ops.length;
  }

  /**
   * 有没有"必须发出去"的东西（全量场景 / 选择 / 状态补丁）。
   *
   * 宿主用它做**空闲门控**：场景静止时不要以 60fps 空发 `frame` 消息 —— 那既费主线程的
   * postMessage，也让 worker 白白渲染同一帧（真实场景里"用户没操作"占了绝大多数时间）。
   */
  public hasPending(): boolean {
    return this.pendingScene || this.selectionIds !== null || this.viewport !== null || this.ops.length > 0;
  }

  /**
   * 采集一次状态变更（由 `ICEComponent.setState` 的钩子调用）。
   *
   * `patch` 就是调用方交给 `setState` 的那个对象，语义完全一致（浅层 + 引擎的 `merge`）。
   */
  public recordStateChange(component: any, patch: any): void {
    if (!patch || typeof patch !== 'object') return;
    /**
     * **工具层的一切都不镜像**（状态与结构都不）。
     *
     * 工具组件（控制面板 / 缩放旋转手柄 / 端点手柄 / 对齐辅助线）在两边 **id 不同、实例不同**：
     * 主线程的面板是它自己那套，worker 侧由 `ICEControlPanelManager` 造另一套，靠 `selection`
     * 消息同步"显示给谁"。若把主线程手柄的 `setState({ display: false })` 也当 ops 发过去，
     * worker 里根本没有这些 id → 每次都报 `missing` → 触发全量重同步风暴。
     */
    if (this.__isToolNode(component)) return;
    const id = componentIdOf(component);
    if (!id) {
      // 没有 id 的组件（应用自己造的宿主对象）无法寻址：整个镜像对不上，只能全量重同步
      this.markSceneNeeded();
      return;
    }
    const clean = sanitizeTransferable(patch, this.dropped, `state[${id}]`);
    if (!clean || !Object.keys(clean).length) return;
    const existing = this.opIndex.get(id);
    if (existing === undefined) {
      this.opIndex.set(id, this.ops.length);
      this.ops.push(['state', id, clean]);
      return;
    }
    // 同组件的连续补丁就地合并：与 `setState` 逐次合并**语义等价**（用的就是它那把 merge）
    const target = this.ops[existing];
    target[2] = merge(target[2], clean);
  }

  /**
   * 采集一次结构变更（增删子节点）。
   *
   * v1 不产生子树增量，直接标全量 —— 见类注释第 1 条。`kind` 目前只为可读性留着（日志/断言）。
   */
  public recordStructureChange(kind: 'add' | 'remove', _parent: any, _child: any): void {
    // 工具层的结构变更（面板挂上/摘下、手柄按需创建）同样不镜像，理由见 recordStateChange
    if (this.__isToolNode(_parent) || this.__isToolNode(_child)) return;
    if (this.resyncOnStructureChange) {
      this.markSceneNeeded();
    } else {
      // 明确的"我知道自己在做什么"：宿主自己保证镜像结构不变（例如只镜像一棵静态子树）
      void kind;
    }
  }

  /**
   * 采集一次选择变更（由 `ICE.setSelection` 的钩子调用）。
   *
   * 只保留**最后一次**：一帧里连点几次，worker 只需要知道最终选中了谁（选择是状态，不是事件流）。
   */
  public recordSelectionChange(components: any[]): void {
    const ids: string[] = [];
    for (let i = 0; i < components.length; i++) {
      const id = componentIdOf(components[i]);
      if (id) ids.push(id);
    }
    this.selectionIds = ids;
    this.lastSelectionIds = ids.slice();
  }

  /** 还没发出去的选择状态（null = 无变化）。 */
  public get pendingSelection(): string[] | null {
    return this.selectionIds;
  }

  /**
   * 采集一次视口变更（`ICE.setViewport` 的钩子）。
   *
   * 只保留最后一次（缩放动画一帧里可能调多次），并像选择那样记进"现状" ——
   * 全量场景重建后 worker 的视口会回到默认值，必须补发一次，否则整套画面错位。
   */
  public recordViewportChange(viewport: any): void {
    if (!viewport) return;
    this.lastViewport = {
      scale: Number(viewport.scale) || 1,
      tx: Number(viewport.tx) || 0,
      ty: Number(viewport.ty) || 0,
    };
    this.viewport = {
      scale: Number(viewport.scale) || 1,
      tx: Number(viewport.tx) || 0,
      ty: Number(viewport.ty) || 0,
    };
  }

  /** 待发视口（null = 无变化）。 */
  public get pendingViewport(): { scale: number; tx: number; ty: number } | null {
    return this.viewport;
  }

  /** 把排队的增量/全量发出去；返回实际发出的消息条数（0 = 没有变化）。 */
  public flush(): number {
    if (!this.send_) return 0;
    let sent = 0;
    /**
     * 一条 flush 里可能发多条消息，顺序固定：**scene → selection → ops**。
     *
     * - scene 重建了 worker 的整棵树（选择也随之丢失）→ 后面必须补发一次选择，
     *   否则"结构一变、手柄就消失"，而这正是最容易被忽略的那种半残状态；
     * - ops 放在最后：它们描述的是"当前状态"，必须落在重建/选择之后的树上。
     */
    if (this.pendingScene) {
      this.ops.length = 0;
      this.opIndex.clear();
      this.pendingScene = false;
      this.send_(this.buildSceneMessage());
      this.sent++;
      sent++;
      // 新树没有选择、视口回到默认 —— 把"现状"重新排进待发队列（同一条 flush 里跟在 scene 后面）
      if (this.lastSelectionIds) {
        this.selectionIds = this.lastSelectionIds.slice();
      }
      if (this.lastViewport) {
        this.viewport = { ...this.lastViewport };
      }
    }
    if (this.selectionIds) {
      const msg: MirrorCommand = {
        t: 'selection',
        v: MIRROR_PROTOCOL_VERSION,
        seq: ++this.seq,
        ids: this.selectionIds,
      };
      this.selectionIds = null;
      this.send_(msg);
      this.sent++;
      sent++;
    }
    if (this.viewport) {
      const msg: MirrorCommand = {
        t: 'viewport',
        v: MIRROR_PROTOCOL_VERSION,
        seq: ++this.seq,
        ...this.viewport,
      };
      this.viewport = null;
      this.send_(msg);
      this.sent++;
      sent++;
    }
    if (this.ops.length) {
      const msg: MirrorCommand = {
        t: 'ops',
        v: MIRROR_PROTOCOL_VERSION,
        seq: ++this.seq,
        ops: this.ops,
      };
      this.ops = [];
      this.opIndex.clear();
      this.send_(msg);
      this.sent++;
      sent++;
    }
    return sent;
  }

  /** 走一帧：先补发状态，再发节拍（顺序反了 worker 会拿旧状态画这一帧）。 */
  public frame(time: number, full = false): number {
    let messages = this.flush();
    if (!this.send_) return messages;
    const msg: MirrorCommand = { t: 'frame', v: MIRROR_PROTOCOL_VERSION, time, ...(full ? { full: true } : {}) };
    this.send_(msg);
    this.sent++;
    messages++;
    return messages;
  }

  public resize(width: number, height: number): void {
    if (!this.send_) return;
    this.send_({ t: 'resize', v: MIRROR_PROTOCOL_VERSION, width, height });
    this.sent++;
  }

  /** 组装全量场景消息（不发送，测试/调试可以直接读）。 */
  public buildSceneMessage(): MirrorCommand {
    const doc =
      this.ice && typeof this.ice.toJSONObject === 'function'
        ? this.ice.toJSONObject()
        : { version: 0, childNodes: [] };
    const droppedStart = this.dropped.length;
    const cleanDoc = sanitizeTransferable(doc, this.dropped, 'scene');
    const dropped = this.dropped.length > droppedStart ? this.dropped.slice(droppedStart) : undefined;
    return { t: 'scene', v: MIRROR_PROTOCOL_VERSION, seq: ++this.seq, doc: cleanDoc, ...(dropped ? { dropped } : {}) };
  }

  /**
   * 这个组件是不是工具层的（含其后代）？
   *
   * 判定方式：沿父链走到 ICE 为止，看有没有命中 `ice.toolNodes`。刻意**不用**打标/缓存集合：
   * 手柄是 `enable()` 时**按需创建**的（`resizeControlInstanceCache`），打标会漏；而 `toolNodes`
   * 通常只有个位数，`indexOf` 的代价可以忽略，换来的是"永远与当前工具树一致"。
   */
  private __isToolNode(component: any): boolean {
    const ice = this.ice;
    const tools: any[] = ice && ice.toolNodes;
    if (!component || !tools || !tools.length) return false;
    let node: any = component;
    while (node && node !== ice) {
      if (tools.indexOf(node) !== -1) return true;
      node = node.parentNode;
    }
    return false;
  }

  /**
   * 处理 worker 回传的事件。
   *
   * `missing` = 镜像里找不到某些 id：唯一正确的反应是**重发全量**（镜像缺失的组件画不出来，
   * 补一条状态也救不回结构）。只自动重试一次，再失败就把决定权交回宿主（`onEvent` 里能拿到）。
   */
  public handleEvent(evt: MirrorEvent): void {
    if (!evt || (evt as any).v !== MIRROR_PROTOCOL_VERSION) {
      // 版本不一致：拒绝（不去猜老格式），并如实上报
      this.onEvent_ &&
        this.onEvent_({
          t: 'error',
          v: MIRROR_PROTOCOL_VERSION,
          message: '镜像协议版本不匹配',
          code: 'MIRROR_VERSION_MISMATCH',
        });
      return;
    }
    this.lastStats = evt;
    if (evt.t === 'missing') {
      /**
       * 镜像缺组件 → 重发全量。
       *
       * 但要**限流**：如果 worker 一直在报缺失（例如某个自定义类型没在 worker 侧注册，反序列化时
       * 整棵子树被跳过），每帧重发整份文档就是自己给自己制造风暴 —— 限流到 500ms 一次，
       * 同时每次 `missing` 都如实上报给宿主（`onEvent`），让宿主能提示/降级。
       */
      const now = Date.now();
      if (now - this.lastResyncAt > 500) {
        this.lastResyncAt = now;
        this.markSceneNeeded();
      }
    }
    this.onEvent_ && this.onEvent_(evt);
  }
}

/** 组件的寻址 id（`props.id` 是权威；序列化文档里它落在 `state.id` 上）。 */
function componentIdOf(component: any): string {
  if (!component) return '';
  const props = component.props;
  if (props && props.id) return String(props.id);
  const state = component.state;
  if (state && state.id) return String(state.id);
  return '';
}

/** 供测试与外部工具复用。 */
export { componentIdOf, isValidOp };
