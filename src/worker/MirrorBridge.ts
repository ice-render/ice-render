/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { merge } from '../util/lang';
import { isMirroredComponent } from './mirror-hooks';
import {
  MIRROR_PROTOCOL_VERSION,
  MIRROR_ROOT_ID,
  MirrorCommand,
  MirrorEvent,
  MirrorFontSource,
  MirrorOp,
  isValidOp,
  sanitizeTransferable,
} from './mirror-protocol';

/** 消息出口：宿主接到 `worker.postMessage` 上（也方便测试直接收数组）。第二个参数是 transfer 列表。 */
export type MirrorSend = (msg: MirrorCommand, transfer?: any[]) => void;

export type MirrorBridgeOptions = {
  /** 消息出口。也可以之后用 `setSend()` 再装（例如先拿 `worker` 再建桥） */
  send?: MirrorSend;
  /**
   * 结构变更（增删子节点）时**强制**走"重发整份文档"，默认 `false`。
   *
   * 默认行为是**结构增量**：`add` / `remove` 各一条 op（见 `recordStructureChange`）。
   * 传 `true` 就退回老口径（v1 时代只有状态补丁，结构一变重发全量）—— 留给"结构变更极频繁、
   * 增量 op 反而更碎"或"我在排查结构错位"的宿主。
   *
   * 注意：**拿不到可寻址信息时（无 id / 编码失败）无论如何都会退回全量**，这个开关关不掉。
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
  /**
   * 最后一条发出的 `frame` 的 `seq`。
   *
   * 宿主验收/截图时用它对齐"静止态"：worker 在 `rendered` 里回传它画的是哪一帧
   *（见 `mirror-protocol.ts` 的 `frame`）。位图是**背压**的 —— worker 一帧要几毫秒，而主线程
   * 每帧都发，"收到一张新位图"不等于"这张位图已经是当前状态"（真实踩坑：静止态几何对账里
   * 读出"镜像落后一帧"，差点被当成状态分叉）。
   */
  public lastFrameSeq = 0;
  /** 累计被丢弃的不可克隆值（路径） */
  public dropped: string[] = [];
  /**
   * 累计**没有镜像过去**的写入条数：主线程给"派生部件"（不进序列化文档的内部子件）写的状态。
   *
   * 不是错误、也不该静默：它说明这条写入**只存在于主线程**（镜像里那个部件是容器按 state
   * 重建出来的另一份）。容器自己的补丁会把它一起重算（`applyPatch` 重放，见 MirrorTarget），
   * 但宿主应当有办法看到这个数 —— 例如排查"应用只改派生部件、容器状态没动"这种越界写法。
   */
  public skippedDerived = 0;

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
  /**
   * 待发的**文本语言**与**字体**（一次性的初始化消息，见 `MirrorOp` 上方协议表）。
   *
   * 只发一次、不做"现状/补发"：它们落在 worker 那台 ICE 的 `ctx` 与 `fonts` 上，
   * 而 `applyScene`（clearAll + 反序列化）**不会**换掉 ctx、也不会清掉已注册的字体 ——
   * 只有 worker 被重建（宿主重新 `start()`）时才需要再发一次，而那正是 `prime()` 的场景。
   */
  private textLanguage: { lang: string; dir: string } | null = null;
  private fonts: MirrorFontSource[] | null = null;
  /**
   * 待**转移**给 worker 的可见画布（直绘模式）。与 text/fonts 一样排进 `flush()` 的固定顺序，
   * 且必须在 `scene` 之后 —— worker 是先收到 scene 才 boot 出 ICE 的，早到的画布没有接收者。
   */
  private canvasToAttach: any = null;
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
    this.resyncOnStructureChange = options.resyncOnStructureChange === true;
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
    return (
      this.pendingScene ||
      this.selectionIds !== null ||
      this.viewport !== null ||
      this.textLanguage !== null ||
      this.fonts !== null ||
      this.canvasToAttach !== null ||
      this.ops.length > 0
    );
  }

  /**
   * 排一次**文本语言**下发（`lang` / `dir`）。
   *
   * 宿主 `MirrorHost.start()` 会从主画布元素读一次（或由 `textLanguage` 选项显式指定）。
   * 拼进 `flush()` 的固定顺序里：**scene → text → fonts → selection → viewport → ops → frame** ——
   * worker 是先收到 `scene` 才 boot 出 ICE 的，语言必须落在它画第一笔之前。
   */
  public recordTextLanguage(text: { lang?: string; dir?: string }): void {
    const lang = typeof text.lang === 'string' ? text.lang : '';
    const dir = typeof text.dir === 'string' ? text.dir : '';
    if (!lang && !dir) {
      return;
    }
    this.textLanguage = { lang, dir };
  }

  /**
   * 取下一个消息序号。
   *
   * 宿主自己发一次性消息时（例如直绘模式的 `attach-canvas` 要带 transfer 列表，走不了桥的
   * `send_`）用它，保证整条通道的序号连续 —— 排查时序问题时不用区分"这条是谁发的"。
   */
  public nextSeq(): number {
    return ++this.seq;
  }

  /**
   * 排一次**画布转移**（直绘模式）。
   *
   * 画布走 transfer 列表（零拷贝；转移后主线程再也拿不到它）—— 所以这条消息只能由桥发，
   * 宿主把"什么时候"交给桥的固定顺序决定（scene → canvas → text → fonts → ops → frame）。
   */
  public recordCanvasAttachment(canvas: any): void {
    if (canvas) {
      this.canvasToAttach = canvas;
    }
  }

  /** 排一次**字体**下发（字节由宿主在主线程取好，见 `MirrorFontSource`）。 */
  public recordFonts(fonts: MirrorFontSource[]): void {
    if (!Array.isArray(fonts) || !fonts.length) {
      return;
    }
    this.fonts = fonts.slice();
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
    /**
     * 派生部件（容器内部按 state 重建、不进文档的子件）在镜像里**没有对应节点**。
     *
     * 发过去只会换来 `missing` → 全量重同步（每批补丁一次），而全量重建也**不会**把它改对
     * （它的状态本来就不在文档里）。真正把镜像改对的是**容器自己那条补丁**：镜像侧重放容器的
     * `applyPatch` 时会重算派生部件。所以这里只计数、不产生 op。
     */
    if (!isMirroredComponent(component)) {
      this.skippedDerived++;
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
   * v2 起走**结构增量**：`add` / `remove` 各一条 op（见 `MirrorOp`），不再重发整份文档 ——
   * 实测（IED 200 节点 / 799 组件）"加一个节点"从 473KB 文档 + worker 一次冷启动全量重绘
   * 降到一条几 KB 的 op。三种情况下仍退回全量（`markSceneNeeded()`）：
   * 宿主显式要求（`resyncOnStructureChange: true`）、父/子**拿不到可寻址的 id**、
   * 子树编码失败（`serializer.encodeSubtree()` 返回空）。
   */
  public recordStructureChange(kind: 'add' | 'remove', _parent: any, _child: any): void {
    // 工具层的结构变更（面板挂上/摘下、手柄按需创建）同样不镜像，理由见 recordStateChange
    if (this.__isToolNode(_parent) || this.__isToolNode(_child)) return;
    /**
     * 派生子树内部的结构变更同样不镜像。
     *
     * 为什么：复合组件**重建自己**（`__buildShape()` 这类）在主线程上就是一次
     * "移除旧部件 + 挂上新部件"，若按 v1 的"结构变更 → 全量重同步"处理，应用每改一次类型 /
     * 配色就要重发整份文档；而 worker 侧本来就会在重放该组件的补丁时重建自己那份部件。
     * 判据与状态补丁一致：**变更的父子至少有一端是派生部件** → 文档里看不到这次变更。
     */
    if (!isMirroredComponent(_parent) || !isMirroredComponent(_child)) return;
    if (this.resyncOnStructureChange) {
      this.markSceneNeeded();
      return;
    }
    const op = kind === 'add' ? this.__buildAddOp(_parent, _child) : this.__buildRemoveOp(_child);
    if (!op) {
      // 无法寻址：宁可重发整份文档，也不能让镜像的结构错位
      this.markSceneNeeded();
      return;
    }
    /**
     * 直接进队列，**不走 `opIndex` 合并**：那个表是"同一个组件的连续状态补丁就地合并"用的，
     * 结构 op 与状态补丁的顺序必须逐条保留（先 add 再给它写 state，或先写 state 再 remove，
     * worker 侧的结果都与主线程的事件顺序一致）。
     */
    this.ops.push(op);
  }

  /** `['add', 父 id, 子树文档]`；拿不到父 id / 编码不出子树时返回 null（调用方退回全量） */
  private __buildAddOp(parent: any, child: any): MirrorOp | null {
    /**
     * **子组件自己也必须有 id**：镜像树是按 id 寻址的（后续状态补丁、删除、选中都靠它），
     * 挂一个没有 id 的组件上去，之后谁也找不到它 —— 那属于"结构已经错位"，
     * 必须当场退回全量重同步，而不是发一条注定对不上的 op。（单测抓到的：只查父 id 不够。）
     */
    if (!componentIdOf(child)) {
      return null;
    }
    const parentId = parent === this.ice ? MIRROR_ROOT_ID : componentIdOf(parent);
    if (!parentId) {
      return null;
    }
    const serializer: any = this.ice && this.ice.serializer;
    if (!serializer || typeof serializer.encodeSubtree !== 'function') {
      return null;
    }
    const nodeDoc = serializer.encodeSubtree(child);
    if (!nodeDoc) {
      return null;
    }
    const clean = sanitizeTransferable(nodeDoc, this.dropped, `add[${componentIdOf(child)}]`);
    return clean ? ['add', parentId, clean] : null;
  }

  /** `['remove', 组件 id]`；拿不到 id 时返回 null（调用方退回全量） */
  private __buildRemoveOp(child: any): MirrorOp | null {
    const id = componentIdOf(child);
    return id ? ['remove', id] : null;
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
    /**
     * **文本语言 → 字体**：必须排在 `scene` 之后（worker 收到 scene 才 boot 出 ICE，
     * 早发的消息在 worker 侧没有接收者）、`ops` 之前（第一笔绘制就要用对字形）。
     */
    if (this.canvasToAttach) {
      const canvas = this.canvasToAttach;
      this.canvasToAttach = null;
      this.send_({ t: 'attach-canvas', v: MIRROR_PROTOCOL_VERSION, seq: ++this.seq, canvas }, [canvas]);
      this.sent++;
      sent++;
    }
    if (this.textLanguage) {
      const msg: MirrorCommand = {
        t: 'text',
        v: MIRROR_PROTOCOL_VERSION,
        seq: ++this.seq,
        ...this.textLanguage,
      };
      this.textLanguage = null;
      this.send_(msg);
      this.sent++;
      sent++;
    }
    if (this.fonts) {
      const msg: MirrorCommand = {
        t: 'fonts',
        v: MIRROR_PROTOCOL_VERSION,
        seq: ++this.seq,
        fonts: this.fonts,
      };
      this.fonts = null;
      this.send_(msg);
      this.sent++;
      sent++;
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
    const msg: MirrorCommand = {
      t: 'frame',
      v: MIRROR_PROTOCOL_VERSION,
      seq: ++this.seq,
      time,
      ...(full ? { full: true } : {}),
    };
    this.lastFrameSeq = msg.seq;
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
