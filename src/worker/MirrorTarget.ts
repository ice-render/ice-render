/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { MIRROR_PROTOCOL_VERSION, MIRROR_ROOT_ID, MirrorCommand, MirrorOp, isValidOp } from './mirror-protocol';

export type ApplyOpsResult = {
  /** 收到的 op 条数 */
  received: number;
  /** 真正应用上的 op 条数 */
  applied: number;
  /** 镜像里找不到的组件 id（主线程收到后应当重发全量场景） */
  missing: string[];
  /** 形状不合法的 op（协议/数据坏了，必须报出来，不能静默改坏镜像） */
  invalid: number;
  /**
   * 本批里**新**出现的未注册类型（有的话说明镜像少挂了组件，宿主应当提示）——只报增量，
   * 避免每批补丁都把同一个类型名重复上报一次。
   */
  unknownTypes?: string[];
};

export type ApplySceneResult = {
  /** 镜像里的组件总数（含容器） */
  components: number;
  /** 反序列化时被跳过的类型（worker 侧没注册的自定义类型） */
  unknownTypes: string[];
};

/**
 * worker 侧的**镜像目标**：把协议消息落成一棵能渲染的 `ICE` 树。
 *
 * 职责刻意很小 —— 只有三件事：
 * 1. `applyScene(doc)`：整份文档 → `ice.fromJSONObject()`（复用引擎自己的反序列化器与类型注册表）；
 * 2. `applyOps(ops)`：状态补丁 → 对应组件的 `setState()`（复用引擎自己的状态语义）；
 * 3. **维护 id 索引**并如实报告"找不到的 id"（引擎没有 id→组件的反查表，这里是最省的一份）。
 *
 * 明确不做：不碰事件、不做命中检测、不回传状态 —— 那些留在主线程（见 10-worker-offscreen.md §3）。
 *
 * ⚠️ 类型注册：`fromJSONObject` 靠**类型注册表**还原组件（`ice-render:ICERect` 这类 typeId）。
 * 应用自定义的组件必须在 worker 侧也注册过一次（同一个 `ICE` 类导出在两边是同一份代码，
 * 但**注册动作要两边各做**）；没注册的类型会被反序列化器跳过并记进 `unknownTypes` ——
 * 这正是"镜像里少了东西"最容易被忽略的一种，所以这里把它显式回传给主线程。
 */
export default class MirrorTarget {
  public ice: any;
  /** 组件 id → 组件（v1 只在应用场景与补丁时增量维护） */
  private index = new Map<string, any>();
  /** 累计应用成功的 op 条数（上报给主线程做对账） */
  public appliedOps = 0;
  /** 累计应用的**结构增量**：加子树 / 删子树各多少条（宿主对账"结构是不是走增量"用） */
  public appliedAdds = 0;
  public appliedRemoves = 0;
  /** 累计应用的选择状态条数 */
  public appliedSelections = 0;
  /** 累计应用的视口变更条数 */
  public appliedViewports = 0;
  /** 累计收到的全量场景数 */
  public appliedScenes = 0;

  constructor(ice: any) {
    if (!ice) {
      throw new Error('[ice-render] MirrorTarget: 需要一个已经 init 的 ICE 实例。');
    }
    this.ice = ice;
  }

  /** 当前镜像里的组件数。 */
  public get size(): number {
    return this.index.size;
  }

  public has(id: string): boolean {
    return this.index.has(id);
  }

  public get(id: string): any {
    return this.index.get(id);
  }

  /** 全量应用一份场景文档（`{version, childNodes:[...]}`），并重建 id 索引。 */
  public applyScene(doc: any): ApplySceneResult {
    /**
     * 刻意**不用** `ice.fromJSONObject()`：它会在前后停/起一整套 Manager（`FrameManager` 是
     * **全局单例**，`renderer.stop()/start()` 也会被牵连），那是"主线程换文档"的语义。
     * 镜像只需要两件事：清空旧树 + 用引擎自己的反序列化器重建（类型注册表、版本迁移、主题还原
     * 都在它里面，不用另写一份）。
     */
    this.ice.clearAll();
    this.ice.deserializer.fromJSONObject(doc);
    this.appliedScenes++;
    this.reindex();
    const deserializer: any = this.ice.deserializer;
    const unknownTypes: string[] = (deserializer && deserializer.unknownTypes) || [];
    return { components: this.index.size, unknownTypes: unknownTypes.slice() };
  }

  /**
   * 应用一批状态补丁。
   *
   * 语义与主线程的 `setState` 一致：**浅合并 + 引擎的 merge**。找不到的 id 不抛异常 ——
   * 一次结构错位不该让整批补丁全部作废，把 missing 清单交回主线程重放全量即可。
   */
  public applyOps(ops: MirrorOp[]): ApplyOpsResult {
    const received = Array.isArray(ops) ? ops.length : 0;
    const missing: string[] = [];
    let applied = 0;
    let invalid = 0;
    const deserializer: any = this.ice.deserializer;
    /** 本批开始时的未注册类型数：只把**新增**的那些报回去（否则每批补丁都重复上报一次） */
    const unknownBefore =
      deserializer && Array.isArray(deserializer.unknownTypes) ? deserializer.unknownTypes.length : 0;
    /** 本批里有没有动到"当前选中项" —— 动了就要让控制面板重新跟随（见下面的说明） */
    let touchedSelection = false;
    const selectedIds = new Set<string>();
    const selection: any[] = (this.ice.selectionList as any[]) || [];
    for (let i = 0; i < selection.length; i++) {
      const id = idOf(selection[i]);
      if (id) selectedIds.add(id);
    }
    for (let i = 0; i < received; i++) {
      const op = ops[i];
      if (!isValidOp(op)) {
        invalid++;
        continue;
      }
      const kind = op[0];
      /**
       * 结构增量：加子树。父容器找不到 → 进 `missing`（主线程据此重发全量，结构自愈）。
       * 子树文档的类型没注册 → `decodeInto()` 返回 null 并记进 `deserializer.unknownTypes`，
       * 这与整份场景加载的口径一致（跳过 + 上报，不抛错打断整批）。
       */
      if (kind === 'add') {
        const parent = op[1] === MIRROR_ROOT_ID ? this.ice : this.index.get(op[1]);
        if (!parent) {
          if (missing.indexOf(op[1]) === -1) missing.push(op[1]);
          continue;
        }
        const instance =
          deserializer && typeof deserializer.decodeInto === 'function' ? deserializer.decodeInto(parent, op[2]) : null;
        if (!instance) {
          invalid++;
          continue;
        }
        this.__indexSubtree(instance);
        applied++;
        this.appliedOps++;
        this.appliedAdds++;
        continue;
      }
      /** 结构增量：删子树。先按 id 把整棵子树的索引清掉，再摘除（摘除会 destory，之后遍历不到）。 */
      if (kind === 'remove') {
        const doomed = this.index.get(op[1]);
        if (!doomed) {
          if (missing.indexOf(op[1]) === -1) missing.push(op[1]);
          continue;
        }
        this.__unindexSubtree(doomed);
        this.__detach(doomed);
        applied++;
        this.appliedOps++;
        this.appliedRemoves++;
        continue;
      }
      // 状态补丁
      const target = this.index.get(op[1]);
      if (!target) {
        if (missing.indexOf(op[1]) === -1) missing.push(op[1]);
        continue;
      }
      this.__applyPatch(target, op[2]);
      applied++;
      this.appliedOps++;
      if (selectedIds.has(op[1])) {
        touchedSelection = true;
      }
    }
    /**
     * 被选中的组件动了 → 让控制面板重新跟随。
     *
     * 主线程上这件事是**事件驱动**的：拖动走 `moveGlobalPosition()`，它会触发 `AFTER_MOVE`，
     * 面板监听到之后自己 `updatePanel()`。而镜像收到的只是 `setState` 补丁 —— 没有那个事件，
     * 面板就会停在原地（症状：手柄画在旧位置、和组件脱开）。这里显式补一次跟随，
     * 复用引擎自己那条公开入口，判定语义与主线程一致。
     */
    if (touchedSelection) {
      const manager: any = this.ice.controlPanelManager;
      if (manager && typeof manager.applySelection === 'function') {
        manager.applySelection((this.ice.selectionList as any[])[0] || null, false);
      }
    }
    const unknownTypes: string[] =
      deserializer && Array.isArray(deserializer.unknownTypes) && deserializer.unknownTypes.length > unknownBefore
        ? deserializer.unknownTypes.slice(unknownBefore)
        : [];
    return { received, applied, missing, invalid, ...(unknownTypes.length ? { unknownTypes } : {}) };
  }

  /** 把一棵新挂上的子树里的所有 id 记进索引（与 `reindex()` 同一套遍历口径）。 */
  private __indexSubtree(node: any): void {
    if (!node) {
      return;
    }
    const id = idOf(node);
    if (id) {
      this.index.set(id, node);
    }
    const children: any[] = node.childNodes || [];
    for (let i = 0; i < children.length; i++) {
      this.__indexSubtree(children[i]);
    }
  }

  /** 把一棵即将摘除的子树里的所有 id 从索引里删掉。 */
  private __unindexSubtree(node: any): void {
    if (!node) {
      return;
    }
    const id = idOf(node);
    if (id) {
      this.index.delete(id);
    }
    const children: any[] = node.childNodes || [];
    for (let i = 0; i < children.length; i++) {
      this.__unindexSubtree(children[i]);
    }
  }

  /** 从它当前的父容器上摘掉（根级组件的 `parentNode` 是 null，走 ICE 的入口）。 */
  private __detach(component: any): void {
    const parent = component.parentNode;
    if (parent && typeof parent.removeChild === 'function') {
      parent.removeChild(component);
      return;
    }
    if (this.ice && typeof this.ice.removeChild === 'function') {
      this.ice.removeChild(component);
    }
  }

  /**
   * 把一条状态补丁落到镜像里的组件上 —— **走应用层自己的补丁入口**。
   *
   * 为什么不能直接 `setState`：`setState` 只改数据，应用层的**派生结果**要另外做一遍 ——
   * 按 state 重建内部部件、重算连线走线、把老属性规范化到新位置（IED 的 16 个组件都实现了
   * `applyPatch`）。主线程是"通过应用入口改的"，镜像若只落 `setState`，同一份状态在两边会长出
   * 不同的画面：真实症状是**拖动节点时 worker 里的连线不跟手**（主线程派发了 `AFTER_MOVE`、
   * 镜像侧没有），以及把节点标题改了、镜像里的标题还是旧的。
   *
   * 两侧**同一份代码、同一个入口**，派生逻辑就不需要跨线程搬运 —— 这是"镜像保真边界 =
   * 序列化保真边界"之外唯一还要补的一条：**派生逻辑跟着代码走，不跟着数据走**。
   *
   * 兜底：第三方/老组件没有 `applyPatch`（引擎基类有默认实现，等于 `setState`）时按 `setState` 落。
   */
  private __applyPatch(component: any, patch: any): void {
    if (component && typeof component.applyPatch === 'function') {
      component.applyPatch(patch);
      return;
    }
    component.setState(patch);
  }

  /**
   * 收一条协议消息并落到镜像上。
   *
   * 返回 `null` 表示"这条消息不用应用"（`frame` / `resize` 由宿主的渲染循环处理）；
   * 返回结果对象表示已应用（调用方据此决定是否要重发全量 / 上报）。
   */
  public applyCommand(msg: MirrorCommand): any {
    if (!msg || (msg as any).v !== MIRROR_PROTOCOL_VERSION) {
      return { error: 'MIRROR_VERSION_MISMATCH' };
    }
    if (msg.t === 'scene') {
      return this.applyScene(msg.doc);
    }
    if (msg.t === 'ops') {
      return this.applyOps(msg.ops);
    }
    if (msg.t === 'selection') {
      return this.applySelection(msg.ids);
    }
    if (msg.t === 'viewport') {
      return this.applyViewport(msg);
    }
    return null;
  }

  /**
   * 应用渲染视口（缩放 / 平移）。
   *
   * 直接调引擎自己的 `setViewport`：缩放/平移的所有后续处理（缓存按新栅格重建、静态层失效、
   * 跟随者同步）都由引擎负责 —— 镜像侧不另写一套。
   */
  public applyViewport(viewport: { scale: number; tx: number; ty: number }): { scale: number } {
    if (typeof this.ice.setViewport === 'function') {
      this.ice.setViewport(viewport.scale, viewport.tx, viewport.ty);
      this.appliedViewports++;
    }
    return { scale: viewport.scale };
  }

  /**
   * 应用选择状态：把 id 解析成镜像里的组件，交给引擎自己的选择机制。
   *
   * 为什么这么做：控制面板 / 手柄由 `ICEControlPanelManager` 按选中项**自己造**，
   * 工具层不进序列化。把选择推过去，worker 侧就会用同一套逻辑画出手柄 ——
   * 既不用序列化工具对象，也不会出现"主线程与 worker 各画一套面板"。
   *
   * 找不到的 id 照旧进 `missing`（与状态补丁同一套自愈路径）。
   */
  public applySelection(ids: any[]): { selected: number; missing: string[] } {
    const list: any[] = [];
    const missing: string[] = [];
    const source = Array.isArray(ids) ? ids : [];
    for (let i = 0; i < source.length; i++) {
      const id = String(source[i]);
      const component = this.index.get(id);
      if (component) {
        list.push(component);
      } else if (missing.indexOf(id) === -1) {
        missing.push(id);
      }
    }
    if (typeof this.ice.setSelection === 'function') {
      this.ice.setSelection(list);
      this.appliedSelections++;
    }
    /**
     * 控制面板不是插件注册的，是 `ICEControlPanelManager` 在 mousedown 时**直接**挂的；
     * worker 里没有 DOM 事件，所以这里显式调它那条公开入口 —— 语义与主线程点选完全一致
     *（含 `transformable` / `linkEditable` 的门控），不另写一套判定。
     */
    const manager: any = this.ice.controlPanelManager;
    if (manager && typeof manager.applySelection === 'function') {
      manager.applySelection(list[0] || null, false);
    }
    return { selected: list.length, missing };
  }

  /** 重建 id 索引（全量）：沿 `ice.childNodes` 深度遍历，读 `props.id`（序列化文档里是 `state.id`）。 */
  public reindex(): void {
    this.index.clear();
    const walk = (nodes: any[]) => {
      if (!nodes || !nodes.length) return;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const id = idOf(node);
        if (id) this.index.set(id, node);
        if (node.childNodes && node.childNodes.length) walk(node.childNodes);
      }
    };
    walk(this.ice.childNodes);
  }
}

function idOf(node: any): string {
  if (!node) return '';
  if (node.props && node.props.id) return String(node.props.id);
  if (node.state && node.state.id) return String(node.state.id);
  return '';
}
