/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE_EVENT_NAME_CONSTS from '../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from '../event/ICEEvent';
import ICEEventTarget from '../event/ICEEventTarget';
import ICE from '../ICE';
import { flattenTree, zIndexOf } from '../util/data-util';
import root from '../cross-platform/root';
import {
  stylePaintPad,
  unionBoxes,
  intersects,
  emptyBox,
  integerAlign,
  regionsAreaRatio,
  coalesceRegions,
  mergeBox,
  mapBoxToRender,
  isFiniteBox,
  isOpaqueDrawing,
} from './dirty-rect-util';
import ObjectCache from './ObjectCache';

/** 脏组件占可见组件比例超过该值时回退全量重绘。 */
const FULL_FALLBACK_DIRTY_RATIO = 0.2;
/** 脏区域占画布面积比例超过该值时回退全量重绘。 */
const FULL_FALLBACK_AREA_RATIO = 0.35;
/**
 * 局部重绘最多切成几块裁剪区。
 * 每块区都要独立跑一遍组件 pass，太多反而亏；超出的块按下述策略并成代价最小的一组。
 */
const MAX_DIRTY_REGIONS = 6;

/**
 * 静态层位图的下限：连续干净段至少这么多成员才值得做成一层。
 * 一层的固定开销是「清屏 + 贴一张位图」（1600×1000 下约 0.2~0.4ms），
 * 而每个成员逐组件重画约 1.5~2µs —— 少于 256 个时两者打平，不划算。
 */
const MIN_LAYER_MEMBERS = 256;

/**
 * 静态层最多做几段（2026-09-21）。
 *
 * 为什么从「一段」放宽到「两段」：层只能整段贴回，而成员与非成员在 z 序上交错会画错，
 * 所以此前只挑**最长的一段连续干净组件**。于是「被拖动的组件落在队列中部」时，
 * 最长干净段只剩一半 —— 另外一半（10 万图元场景里约 5 万个组件）每帧逐组件重画，
 * 实测 **99.9ms/帧（10fps）**；而拖动靠队首/队尾的组件（最长段覆盖 99.99%）只要 **16.6ms（60fps）**。
 *
 * 两段层是 z 序安全的：贴图层时**按队列顺序**遍历，第 i 段在自己的 start 位置贴回，
 * 其余组件照旧在队列位置上逐个画 —— 叠放次序与全量重绘一致。
 * 上限取 2 是因为收益集中在「前段 + 后段」，再多段会成倍吃位图内存与贴图次数。
 */
const MAX_LAYER_RUNS = 2;

/** 静态层位图的运行时状态。 */
interface StaticLayer {
  canvas: any;
  ctx: any;
  /** 贴图落点（整数设备像素）。 */
  dx: number;
  dy: number;
  /** 位图尺寸（设备像素，四周各留 1px 余量，与离屏缓存同口径）。 */
  pw: number;
  ph: number;
  /** 建位图时的渲染视口；视口一变即失效。 */
  rs: number;
  ox: number;
  oy: number;
  /** 这一层包含的组件（队列里的连续一段，顺序即 z 序）。 */
  members: any[];
  /** 这一段在渲染队列里的起止下标（贴回时要按队列顺序落在自己的位置上）。 */
  start?: number;
  end?: number;
}

/**
 * @class CanvasRenderer Canvas 渲染器
 *
 * - 一个 ICE 实例上，只能有一个渲染器实例。
 * - 默认渲染策略为「脏矩形局部重绘」（renderMode: 'dirty-rect'）：
 *   只 clear 脏区域、按 z 序重画与区域相交的组件；不满足局部条件时自动回退全量重绘
 *   （结构变更 / 未 prime / 脏占比过高 / 区域过大 / 折线或文本等特殊类别 / 能力缺失）。
 *   两种模式像素一致（组件 render 已做 ctx 泄漏属性归位，见 ICEComponent.__resetLeakyCtxState）。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class CanvasRenderer extends ICEEventTarget {
  private ice: ICE;
  private stopped: boolean = false;
  private renderMode: 'full' | 'dirty-rect' = 'dirty-rect';
  /** @internal 内部测试钩子：强制走全量路径（对比/调试用，非公开 API）。 */
  public __forceFullRender = false;

  private componentQueue = []; //等待渲染的组件队列，FIFO
  private toolsQueue = []; //等待渲染的工具组件队列，FIFO
  //@perf: 渲染队列缓存。组件树结构未变化时，跳过递归 flattenTree + sort，仅做 O(n) 的 zIndex 稳
  // 定性比对，避免每帧重建队列（zIndex 仅在顺序真的改变时才重新排序）。
  private __queueDirty: boolean = true;
  private __zSnap: number[] = []; //复用的 zIndex 快照，与 componentQueue+toolsQueue 顺序一致

  /**
   * 每个「曾上屏」组件的世界轴对齐包围盒快照（[minX,minY,maxX,maxY]，已含 paint pad）。
   * WeakMap：不污染组件 state/props（序列化安全）、对 zIndex 重排免疫、组件 GC 自动回收。
   * 用于：部分重绘帧的旧区域擦除 + 未变组件的「是否与本帧区域相交」判断。
   */
  private __snap = new WeakMap<object, Float64Array>();
  /** 距离最近一次队列重建后，是否已完成过至少一次「全量/prime」渲染（快照就绪）。 */
  private __primed: boolean = false;
  /** 组件级离屏缓存（v1 缓存 ICEText），与快照一样不污染组件 state/props。 */
  private cache: ObjectCache;
  /** @internal 上一帧被视口裁剪掉的组件数（仅供性能观测与测试断言）。 */
  public __lastFrameCulled = 0;
  /** @internal 静态层位图的构建次数（仅供性能观测与测试断言）。 */
  public __layerBuilds = 0;
  /**
   * 静态层位图：把「本帧不需要重画」的**连续一段**组件整体光栅化成一张位图，
   * 之后每帧只清屏 + 贴一张图 + 画剩下的那几个（脏的）。见 `__renderWithStaticLayer`。
   */
  /** 当前生效的静态层（最多 `MAX_LAYER_RUNS` 段，按队列顺序排列）。 */
  private __layers: StaticLayer[] = [];
  /**
   * 上一次建层时的渲染缩放值。
   *
   * 用途：视口变化帧默认"不建层"（重建位图比重画还贵），但**平移手势**里值得破例一次 ——
   * 建好之后后续每一帧都能靠 `__shiftLayer()` 整体平移复用（见那里的注释）。
   * 只有 `rs` 没变（= 纯平移，不是缩放）才允许这次重建。
   */
  private __layerRs = 0;
  /** @internal 静态层开关（默认开）；关掉即完全回到「逐组件重画」的旧行为，供 A/B 与像素对比。 */
  private __layerEnabled = true;

  constructor(ice: ICE, options: { renderMode?: 'full' | 'dirty-rect' } = {}) {
    super();
    this.ice = ice;
    this.cache = new ObjectCache(ice);
    if (options.renderMode === 'full' || options.renderMode === 'dirty-rect') {
      this.renderMode = options.renderMode;
    }
  }

  /**
   * @method markQueueDirty 标记组件树结构已变化，下一次渲染需重建渲染队列。
   * 由 ICE / ICEGroup 在 addChild / removeChild 等结构性变更时调用。
   * 结构变更必然回退全量重绘（并重新 prime 快照）。
   */
  public markQueueDirty(): void {
    this.__queueDirty = true;
  }

  public setRenderMode(mode: 'full' | 'dirty-rect'): void {
    this.renderMode = mode;
  }

  public getRenderMode(): 'full' | 'dirty-rect' {
    return this.renderMode;
  }

  public start() {
    this.stopped = false;
    this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
    return this;
  }

  public stop() {
    this.stopped = true;
    this.ice.evtBus.off(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
    return this;
  }

  private frameEvtHandler(evt: ICEEvent) {
    if (this.ice.dirty) {
      this.refreshQueue();
      // 先让离屏缓存知道「本帧视口是否变过」：视口一变，位图栅格与设备栅格错位，
      // 本帧一律退回直接绘制（见 ObjectCache.beginFrame）。
      this.cache.beginFrame();
      // dirty-rect：能构造出局部重绘计划就走局部；否则回退全量。
      if (this.renderMode === 'dirty-rect' && !this.__forceFullRender) {
        const plan = this.__collect();
        if (plan) {
          this.__renderDirtyRect(plan);
          return;
        }
      }
      // 局部重绘不成立（例如脏区分散成一堆小块、被合并预算 / 面积门挡下）时，
      // 先用「静态层位图」兜一层：把连续一大段不需要重画的组件整层贴回去，
      // 只逐组件重画剩下的那几个。这一条把「1 万静态 + 少量分散动画」从全量重绘里救出来。
      if (this.__renderWithStaticLayer()) {
        return;
      }
      this.doRenderFull();
    }
  }

  /**
   * @internal 开关静态层位图（默认开）。关掉后完全回到「逐组件重画」的旧行为，
   * 供像素对比测试与 A/B 性能对比使用。
   */
  public setStaticLayerEnabled(enabled: boolean): void {
    this.__layerEnabled = !!enabled;
    if (!this.__layerEnabled) {
      this.__layers = [];
    }
  }

  /** @internal 静态层位图当前是否开启。 */
  public isStaticLayerEnabled(): boolean {
    return this.__layerEnabled;
  }

  /**
   * **作废"画进位图"的那两层缓存**：组件级离屏缓存（`ObjectCache`）+ 静态层位图（`__layer`）。
   *
   * 什么时候必须调：任何改变**"画出来是什么"**的全局状态。第一个用例是**换主题** ——
   * 样式里的主题引用（`token('ui.colors.text')`）是 paint 时解析的，但这两层位图是
   * **"内容没变就贴旧图"**，而主题根本不在它们的内容指纹里（引用对象前后同值）。
   * 不作废的表现：换主题后**文本贴旧位图** —— 浅色主题烤进去的深字压在深底上。
   *
   * 为什么两层要一起作废：
   * - 组件级缓存：静态命中只判 `!component.dirty && cache && 视口一致`，**不比较主题/指纹**
   *   （而且只要 `!dirty` 就直接贴图返回，连指纹那一段都不会执行）；
   * - 静态层：成员集合 / 渲染视口 / 队列结构三者之一变了才重建，换主题**三者都没变**
   *   —— 它会一直贴那张烤着旧主题色的整段位图。
   *
   * 都是 O(1) 丢弃（WeakMap 换新 + 置 null），而换主题是低频操作，直接全丢最省心。
   */
  public invalidateObjectCache(): this {
    if (this.cache) {
      this.cache.clear();
    }
    // ⚠️ 显式丢静态层，**不要**依赖 `markQueueDirty()` → `__rebuildQueue()` 的副作用：
    // 哪天那条路径被优化掉，这里会静默退化成"换了主题、整段位图还是旧的"。
    this.__layers = [];
    return this;
  }

  private refreshQueue() {
    if (this.__queueDirty) {
      this.__rebuildQueue();
      return;
    }
    //结构未变：仅检查 zIndex 是否真的发生变化（O(n) 整数比对，无数组分配）。
    // 变了就**整队重建**（重建走的是"树序 + 兄弟按 zIndex"，见 flattenTree）——
    // 不能在这里对已展平的数组再排一次：那会把"只排兄弟"重新变成"全局排序"，
    // 父容器就会反超自己的子树（渲染顺序铁律，2026-09-17）。
    if (this.__zOrderChanged()) {
      /**
       * 数值变了 ≠ 次序变了 —— 先花 O(n) 判一次"队列是不是**已经有序**"：
       *
       * 「把一批子件的 zIndex 重写成同一组值」「动画把 zIndex 从 1 缓动到 2 但没跨过邻居」
       * 都属于这一类：次序没动，检出的差异只是数值本身。这种情况下整队重建（走完整棵树 +
       * 每个父容器各自排序）纯属白干 —— 10000 个组件实测每次重建 0.4~0.7ms。
       * 次序**真的**变了才重建。
       */
      if (this.__zOrderStillSorted()) {
        this.__snapshotZ(); // 次序没变：只刷新快照，免得下一帧又比出来一次
      } else {
        // 只换了次序、成员没变 → **上屏快照仍然有效**，别清掉：清了本帧就得回退全量。
        // 局部重绘路径本身就是"与该区域相交者按新序重画"，叠放次序变化能正确落地（见 __renderDirtyRect）。
        this.__rebuildQueue(true);
      }
    }
  }

  /**
   * 队列**是否已经是有序的**：每个父容器下的兄弟按 `zIndex` 非降序排列。
   *
   * 判据只用展平时写下的 `_pid`/`_level`（`flattenTree` 的产物）：**同一个父容器的兄弟 =
   * 同一层 + 同一 pid**，且只比**相邻**两个同组节点。不用 Map、不回读 `parentNode`。
   *
   * 为什么"只看相邻"就够了：展平是 DFS 前序，同组兄弟之间只会夹着更深层的后代
   * （`_level` 不同，会被跳过），所以组内一旦有逆序对，必然表现为**相邻同组节点逆序**。
   * 相等值算有序（稳定排序下"后加入的在后"本来就是正确次序）。
   *
   * 实测（10000 组件、真帧内）：这一版 0.28ms/次，上一版按 pid 建 Map 的写法 0.41ms/次。
   * （同一条循环放进紧循环里只有 0.07ms —— 差距在于真帧要遍历 1 万个分散在堆上的组件对象，
   *   是内存访问的代价，不是判据本身的代价；所以别再抠循环体，那不是一个量级。）
   */
  private __zOrderStillSorted(): boolean {
    const stillSorted = (nodes: any[]) => {
      if (nodes.length < 2) {
        return true;
      }
      // 上一个节点 + 它的 zIndex 都缓存下来：循环里每个节点只取一次数（1 万组件实测省掉一半取数）
      let prev = nodes[0];
      let prevZ = zIndexOf(prev);
      for (let i = 1; i < nodes.length; i++) {
        const cur = nodes[i];
        const z = zIndexOf(cur);
        // 不同组（父容器不同 / 层不同）本来就不可比，跳过；同组逆序才算乱序
        if (cur._level === prev._level && cur._pid === prev._pid && z < prevZ) {
          return false;
        }
        prev = cur;
        prevZ = z;
      }
      return true;
    };
    // 两个队列分开判：各自的顶层节点 `_pid` 都是 null，混在一起比会串味
    return stillSorted(this.componentQueue) && stillSorted(this.toolsQueue);
  }

  /**
   * 重建渲染队列。
   *
   * @param keepSnapshots 仅**次序**变化（成员集合没变）时传 true：保留上屏快照与 prime 状态，
   *   让 dirty-rect 路径继续局部重绘；树结构变化时必须为 false（成员进出，旧快照不再可信）。
   */
  private __rebuildQueue(keepSnapshots: boolean = false) {
    /**
     * **不要再全局 sort 一次**：`flattenTree` 给出的已经是最终绘制顺序
     * （先父后子 + 兄弟按 zIndex，见 `util/data-util.ts` 的渲染顺序铁律）。
     */
    this.componentQueue = flattenTree([], this.ice.childNodes);
    this.toolsQueue = flattenTree([], this.ice.toolNodes);
    this.__queueDirty = false;
    this.__snapshotZ();
    if (!keepSnapshots) {
      // 结构变了：快照整体失效，下一次渲染必须先全量 prime。
      this.__snap = new WeakMap();
      this.__primed = false;
    }
    // 结构变了：静态层的成员集合/次序也失效（成员是队列里的连续一段）。
    this.__layers = [];
  }

  /**
   * 把当前 componentQueue + toolsQueue 的 zIndex 快照到复用的 __zSnap 数组，
   * 供下一帧做稳定性比对，避免每帧分配新数组。
   *
   * ⚠️ 存的是**原值**、比对也是原值的 `!==`（不是 `zIndexOf()` 归一化后的键）—— 这条路径
   * 每帧都要走一遍全队列，**必须保持"一次属性读 + 一次全等"**：实测改成归一化取键之后，
   * `refreshQueue` 的稳态比对从 0.011ms 涨到 0.053ms（2000 组件，4.8×，bench 门禁直接红）。
   * 代价只是：`'auto'` ↔ 显式 `0` 这种"排序结果不变、原值变了"的写法会多跑一次判序
   * （`__zOrderStillSorted` 判完发现仍有序，顺手刷新快照），不影响正确性。
   */
  private __snapshotZ() {
    const total = this.componentQueue.length + this.toolsQueue.length;
    if (this.__zSnap.length !== total) this.__zSnap = new Array(total);
    let idx = 0;
    for (let i = 0; i < this.componentQueue.length; i++) {
      this.__zSnap[idx++] = this.componentQueue[i].state.zIndex;
    }
    for (let i = 0; i < this.toolsQueue.length; i++) {
      this.__zSnap[idx++] = this.toolsQueue[i].state.zIndex;
    }
  }

  /**
   * 对比当前队列的 zIndex 与上次快照，任一不同（或长度变化）即认为顺序已变。
   */
  private __zOrderChanged(): boolean {
    const total = this.componentQueue.length + this.toolsQueue.length;
    if (this.__zSnap.length !== total) return true;
    let idx = 0;
    for (let i = 0; i < this.componentQueue.length; i++) {
      if (this.__zSnap[idx++] !== this.componentQueue[i].state.zIndex) return true;
    }
    for (let i = 0; i < this.toolsQueue.length; i++) {
      if (this.__zSnap[idx++] !== this.toolsQueue[i].state.zIndex) return true;
    }
    return false;
  }

  // ===================== 全量路径（旧行为，保留为参考 & 回退） =====================

  private doRenderFull() {
    // 清屏前必须回到单位变换：上一帧组件/视口会残留 CTM，否则 clearRect 清不干净，出现重影。
    this.ice.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);
    //可见世界区域（视口裁剪用）。单位视口时即 [0,0,canvasWidth,canvasHeight]。
    const visible = this.__visibleWorldRect();
    let culled = 0;

    //渲染组件
    for (let i = 0; i < this.componentQueue.length; i++) {
      const component = this.componentQueue[i];
      //@perf 视口裁剪：非脏 + 已有上屏快照 + 与可见区不相交 → 整组件跳过（不画、不捕获）。
      // 脏组件一律照画：它可能正从屏外移入，快照仍是旧位置，用旧盒判定会误裁。
      // 无快照（从未上屏）也照画：没有可靠盒子可判定。
      if (visible && component.isEffectivelyVisible() && !component.dirty) {
        const snap = this.__snap.get(component);
        if (snap && !intersects(snap as any, visible)) {
          culled++;
          continue;
        }
      }
      //@perf: 仅在引用不一致时才重新注入（首帧 / 跨 ICE 切换），稳态下跳过 4 次属性写入
      this.__ensureContext(component);
      this.__renderComponent(component);
      if (component.isEffectivelyVisible()) {
        this.__capture(component);
      }
    }
    this.__lastFrameCulled = culled;

    //渲染工具节点
    for (let i = 0; i < this.toolsQueue.length; i++) {
      const tool = this.toolsQueue[i];
      this.__ensureContext(tool);
      tool.render();
      if (tool.isEffectivelyVisible()) {
        this.__capture(tool);
      }
    }

    //插件渲染钩子（世界坐标，与组件同一坐标系）
    this.__invokePluginRender(null);

    this.__finalizeHidden(this.componentQueue);
    this.__finalizeHidden(this.toolsQueue);
    this.__primed = true;

    //完成一轮渲染时，在总线上触发一个 ROUND_FINISH 事件。
    this.ice.dirty = false;
    this.ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH);
  }

  // ===================== 脏矩形局部重绘路径 =====================

  // ===================== 静态层位图路径 =====================

  /**
   * 组件能否进静态层。
   *
   * 保守判据（任一不满足就排除在层外，回到逐组件重画）：
   * - 本帧不脏（脏组件必须现画，且它一动整层就得重建）；
   * - 可见（`display:false` 的组件在上屏快照里有旧墨迹要擦，不能打进层里）；
   * - 没有 `clipChildren` 祖先 —— 位图里没有那层裁剪，除非祖先也在同一层内（这里不做特判，一律排除）；
   * - 落墨不是 `globalCompositeOperation` 混合模式：位图会先与层内的透明底合成，
   *   再整体贴回主画布，`destination-out` 这类依赖「画布已有内容」的算子会算出不同结果。
   */
  private __layerEligible(c: any): boolean {
    if (c.dirty || !c.isEffectivelyVisible()) return false;
    const style = c.state && c.state.style;
    const op = style && style.globalCompositeOperation;
    if (op && op !== 'source-over') return false;
    if (typeof c.hasClippingAncestor === 'function' && c.hasClippingAncestor()) return false;
    return true;
  }

  /**
   * 在 z 序队列里挑出**至多 `MAX_LAYER_RUNS` 段连续可入层组件**（按规模优先）。
   *
   * 为什么必须是「连续」：队列是全局 zIndex 排序，位图只能整段贴回；
   * 成员与非成员在 z 序上交错的话，叠放次序会变（画错）。所以只认连续段。
   *
   * 为什么是多段（2026-09-21）：只挑「最长的一段」时，被拖动的组件落在队列中部会把干净区
   * 切成前后两半，最长的一半之外还有一半要逐组件重画（10 万图元实测 99.9ms/帧）。
   * 取前 2 段即可覆盖「前段 + 后段」，把这一档拉回 60fps。
   * 多段本身不破坏 z 序：合成时按队列顺序遍历，每段在自己的 start 位置贴回。
   */
  private __pickLayerRuns(queue: any[]): { start: number; end: number }[] {
    const runs: { start: number; end: number }[] = [];
    let i = 0;
    while (i < queue.length) {
      if (!this.__layerEligible(queue[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j < queue.length && this.__layerEligible(queue[j])) {
        j++;
      }
      runs.push({ start: i, end: j });
      i = j;
    }
    if (!runs.length) return [];
    // 按成员数从多到少取前 MAX_LAYER_RUNS 段（规模优先：多覆盖一个成员就少重画一个）
    runs.sort((a, b) => b.end - b.start - (a.end - a.start));
    const picked = runs.filter((r, idx) => idx < MAX_LAYER_RUNS && r.end - r.start >= MIN_LAYER_MEMBERS);
    if (!picked.length) {
      // 没有任何一段够长：退化到「最长的一段」也要满足下限，否则不做层
      const best = runs[0];
      return best.end - best.start >= MIN_LAYER_MEMBERS ? [best] : [];
    }
    // 合成本身要按队列顺序（z 序）
    picked.sort((a, b) => a.start - b.start);
    return picked;
  }

  /**
   * 静态层位图路径：命中并渲染成功返回 true（调用方直接结束本帧）。
   *
   * 收益量级：1 万个静态组件逐组件重画约 20ms，整层贴回约 0.3ms —— 实测这一档场景 24ms → 1.3ms。
   * 只在「局部重绘不成立」之后才走这里：小范围损伤时脏矩形仍然是更便宜的那条路。
   */
  private __renderWithStaticLayer(): boolean {
    if (!this.__layerEnabled || this.__forceFullRender) return false;
    // 视口变化帧一律不建静态层 —— 与组件级离屏缓存同一条纪律（见 `ObjectCache.beginFrame`）。
    //
    // 为什么：位图的栅格是**按当时的渲染视口**对齐的，视口一变整层就作废；这一帧「重建位图 + 贴回」
    // 比重画一遍还贵（多一次整层 blit），而下一帧视口再变又要重建 —— 实测拖拽平移/滚轮缩放时
    // 每帧慢约 35%（13.0ms → 17.6ms）。所以手势期间直接逐组件画，手势停下后的第一帧再统一重建一次。
    //
    // ⚠️ **2026-09-21 起有一条例外：纯平移（缩放值不变 + 设备像素位移是整数）**。
    // 这种情况下把已有的层位图**整体平移**贴回即可 —— 内容与世界盒都没变，只是视口挪了整数设备像素，
    // 1:1 drawImage 仍然逐像素精确。10 万图元实测：平移期间走全量重绘约 225ms/帧（4.6fps），
    // 复用层只要几毫秒。缩放（rs 变了）仍然按原纪律回退全量。
    const vpChanged = this.cache.viewportChangedThisFrame();
    const runs = this.__pickLayerRuns(this.componentQueue);
    if (!runs.length) return false;

    const vp = this.__renderViewport();
    const rs = vp.scale;
    const ox = vp.tx;
    const oy = vp.ty;
    if (!(rs > 0)) return false;

    const queue = this.componentQueue;
    const ready: StaticLayer[] = [];
    for (const run of runs) {
      const cached = this.__layers.find((l) => l.start === run.start && l.end === run.end);
      if (cached && this.__layerMatches(cached, queue, run, rs, ox, oy)) {
        ready.push(cached);
        continue;
      }
      // 纯平移：把已有层整体挪一个整数设备像素位移（内容与世界盒都没变，1:1 贴图仍然精确）
      if (cached && this.__shiftLayer(cached, queue, run, rs, ox, oy)) {
        ready.push(cached);
        continue;
      }
      if (vpChanged) {
        // 视口变了又不满足"纯平移复用"：
        // - 缩放（rs 变了）→ 本帧不做层，退回逐组件重画（位图栅格已作废，重建也只白建）；
        // - 平移（rs 没变）→ **允许建这一次**：建好之后本手势的后续帧都能整体平移复用。
        if (rs !== this.__layerRs) return false;
      }
      const built = this.__buildLayer(queue, run, rs, ox, oy);
      if (!built) {
        // 建不出来（运行时没有离屏 canvas / 位图超预算）：这一段不做层，其余段照旧。
        // 注意这里**不清空**已缓存的层 —— 下一帧视口/成员没变时还能命中（省一次重建）。
        continue;
      }
      built.start = run.start;
      built.end = run.end;
      this.__layerBuilds++;
      ready.push(built);
    }
    if (!ready.length) {
      this.__layers = [];
      return false;
    }
    this.__layers = ready;
    this.__layerRs = rs;
    this.__compositeLayer(ready);
    return true;
  }

  /** 缓存的层是否还能用：成员逐个同一、渲染视口一致（栅格对齐的前提）。 */
  private __layerMatches(
    layer: StaticLayer,
    queue: any[],
    run: { start: number; end: number },
    rs: number,
    ox: number,
    oy: number
  ): boolean {
    return layer.rs === rs && layer.ox === ox && layer.oy === oy && this.__layerSameMembers(layer, queue, run);
  }

  /** 层的成员是否还是队列里的那一段（同起点、同长度、逐个同一）。 */
  private __layerSameMembers(layer: StaticLayer, queue: any[], run: { start: number; end: number }): boolean {
    if ((layer.start ?? -1) !== run.start) return false;
    if (layer.members.length !== run.end - run.start) return false;
    for (let i = run.start; i < run.end; i++) {
      if (layer.members[i - run.start] !== queue[i]) return false;
    }
    return true;
  }

  /**
   * **纯平移复用**：缩放没变、成员没变，而渲染视口只平移了整数设备像素时，
   * 把已有层位图的贴图落点整体挪一下就能逐像素精确地跟过去（内容与世界盒都没动）。
   *
   * 为什么要求整数：`drawImage` 只有落在整数设备像素上才是 1:1 零重采样；
   * 半像素位移会引入双线性重采样 → 与全量重绘不再逐像素一致。
   */
  private __shiftLayer(
    layer: StaticLayer,
    queue: any[],
    run: { start: number; end: number },
    rs: number,
    ox: number,
    oy: number
  ): boolean {
    if (layer.rs !== rs) return false; // 缩放变了：位图栅格作废，不能挪
    if (!this.__layerSameMembers(layer, queue, run)) return false;
    const dx = ox - layer.ox;
    const dy = oy - layer.oy;
    if (!Number.isInteger(dx) || !Number.isInteger(dy)) return false;
    layer.dx += dx;
    layer.dy += dy;
    layer.ox = ox;
    layer.oy = oy;
    return true;
  }

  /** 队列下标 i 是否落在某一段层的成员区间里（层最多两段，循环开销可忽略）。 */
  private __isLayerMember(layers: StaticLayer[], i: number): boolean {
    for (let k = 0; k < layers.length; k++) {
      const s = layers[k].start ?? -1;
      const e = layers[k].end ?? -1;
      if (i >= s && i < e) return true;
    }
    return false;
  }

  /** 把成员整体光栅化到一张离屏位图（栅格对齐纪律与 `ObjectCache.build` 完全一致）。 */
  private __buildLayer(
    queue: any[],
    run: { start: number; end: number },
    rs: number,
    ox: number,
    oy: number
  ): StaticLayer | null {
    const members: any[] = [];
    const box: number[] = [Infinity, Infinity, -Infinity, -Infinity];
    const tmp: number[] = [0, 0, 0, 0];
    for (let i = run.start; i < run.end; i++) {
      const c = queue[i];
      c.__paintWorldBox(tmp);
      const pad = stylePaintPad(c.state, rs);
      tmp[0] -= pad;
      tmp[1] -= pad;
      tmp[2] += pad;
      tmp[3] += pad;
      unionBoxes(box, tmp);
      members.push(c);
    }
    if (!isFiniteBox(box)) return null;

    // 贴图落点取整到设备像素栅格，四周各留 1px 余量（与离屏缓存同口径）。
    const dx = Math.floor(box[0] * rs + ox) - 1;
    const dy = Math.floor(box[1] * rs + oy) - 1;
    const pw = Math.max(1, Math.ceil(box[2] * rs + ox) - dx + 1);
    const ph = Math.max(1, Math.ceil(box[3] * rs + oy) - dy + 1);
    // 位图预算：允许到「画布设备像素的 2 倍」与 4M 像素的较大者；超了就退回逐组件重画。
    const canvasPx = (Number(this.ice.canvasWidth) || 0) * (Number(this.ice.canvasHeight) || 0);
    if (pw * ph > Math.max(4 * 1024 * 1024, canvasPx * 2)) return null;

    let off: { canvas: any; ctx: any };
    try {
      // 第三个参数：静态层要跟随主画布的文本语言（汉字字形随 lang 变，见 root.createOffscreenCanvas）
      off = root.createOffscreenCanvas(pw, ph, this.ice && this.ice.canvasEl);
    } catch (err) {
      return null; // 运行时没有离屏 canvas（极简 headless / 测试桩）：静默退回逐组件重画
    }
    const base = [rs, 0, 0, rs, ox - dx, oy - dy];
    try {
      for (let i = 0; i < members.length; i++) {
        const c = members[i];
        c.renderTo(off.ctx, base);
        // 位图建好了：这些组件的「上屏快照」正好是这一帧的盒子（供下一帧的裁剪/相交判定用）。
        this.__capture(c);
      }
    } catch (err) {
      // 渲染进离屏位图时抛异常 —— 原因是这个运行时的离屏 ctx 能力不全（极简 headless /
      // 测试替身缺方法）。**绝不能把异常抛出去**：这里在帧回调里，抛出去就是未捕获异常，
      // 宿主页面直接白屏。整个会话关掉静态层，退回逐组件重画（与 ObjectCache
      // 遇到 `createOffscreenCanvas` 不可用时的降级口径一致）。
      this.__layerEnabled = false;
      this.__layers = [];
      return null;
    }
    return { canvas: off.canvas, ctx: off.ctx, dx, dy, pw, ph, rs, ox, oy, members };
  }

  /**
   * 清屏 → 按**队列顺序**把每一段层贴回它在 z 序里的位置 → 逐组件画非成员（脏组件与段外组件）。
   *
   * 多段的顺序语义：`layers` 已按 start 升序排列，遍历队列时在每段的 start 处贴它，
   * 段内成员跳过 —— 与全量重绘的叠放次序逐条一致（段与段之间的组件照常逐个画）。
   */
  private __compositeLayer(layers: StaticLayer[]): void {
    const ctx = this.ice.ctx;
    // 清屏前回到单位变换：上一帧残留的 CTM 会让 clearRect 擦不干净。
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);
    const visible = this.__visibleWorldRect();
    const queue = this.componentQueue;
    let culled = 0;
    let layerIdx = 0;

    for (let i = 0; i < queue.length; i++) {
      if (layerIdx < layers.length && i === (layers[layerIdx].start ?? -1)) {
        // 整数设备像素 1:1 贴回，零重采样（与离屏缓存同口径）。
        // 注意：位图的 dx/dy 是**设备像素**偏移，贴之前必须把 CTM 归回单位变换 ——
        // 组件渲染不会还原 CTM（每个组件自己 setTransform），沿用上一个组件的矩阵会把整层画歪。
        const layer = layers[layerIdx];
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layer.canvas, layer.dx, layer.dy);
        layerIdx++;
      }
      if (this.__isLayerMember(layers, i)) continue; // 成员已经在位图里
      const component = queue[i];
      if (visible && component.isEffectivelyVisible() && !component.dirty) {
        const snap = this.__snap.get(component);
        if (snap && !intersects(snap as any, visible)) {
          culled++;
          continue;
        }
      }
      this.__ensureContext(component);
      this.__renderComponent(component);
      if (component.isEffectivelyVisible()) {
        this.__capture(component);
      }
    }
    this.__lastFrameCulled = culled;

    for (let i = 0; i < this.toolsQueue.length; i++) {
      const tool = this.toolsQueue[i];
      this.__ensureContext(tool);
      tool.render();
      if (tool.isEffectivelyVisible()) {
        this.__capture(tool);
      }
    }

    this.__invokePluginRender(null);
    this.__finalizeHidden(this.componentQueue);
    this.__finalizeHidden(this.toolsQueue);
    this.__primed = true;
    this.ice.dirty = false;
    this.ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH);
  }

  /**
   * 收集脏区域并做局部重绘可行性判定。
   * 返回 null = 不满足局部条件（由调用方回退全量）；否则返回本帧脏区域 [minX,minY,maxX,maxY]。
   *
   * 区域来源：
   * - 可见且 dirty 的组件/工具：旧快照盒 ∪ 新几何盒（可能移动/变形）。
   * - display:false 且 dirty 且曾上屏的组件/工具：旧快照盒（仅擦除）。
   *
   * 判定顺序（性能关键）：先做**零开销预检**（只读 display/dirty 标志），
   * 能确定要回退全量的情况（无可见脏组件 / 脏占比超阈）绝不进入
   * 「场景门控 + 逐组件算包围盒」的昂贵路径——否则动画全量帧会被重复 compose 翻倍。
   */
  private __collect(): { regions: number[][]; renderRegions: number[][]; bounding: number[] } | null {
    if (!this.__primed) return null;
    const ctx = this.ice.ctx;
    const cw = this.ice.canvasWidth || 0;
    const ch = this.ice.canvasHeight || 0;
    if (!cw || !ch) return null;
    if (!ctx || typeof ctx.save !== 'function' || typeof ctx.clip !== 'function' || typeof ctx.restore !== 'function') {
      return null;
    }

    const preComp = this.__preCount(this.componentQueue);
    // 局部重绘必须由「可见组件变脏」驱动；纯工具/纯隐藏帧（如 disable 面板只改工具 display）
    // 回退全量，保持与全量路径语义完全一致。
    if (preComp.dirty === 0) return null;
    // 脏组件占比过高 → 相交裁剪收益小
    if (preComp.visible > 0 && preComp.dirty / preComp.visible > FULL_FALLBACK_DIRTY_RATIO) return null;

    const boxes: number[][] = [];
    if (!this.__collectDirtyBoxes(boxes, this.componentQueue)) return null;
    if (!this.__collectDirtyBoxes(boxes, this.toolsQueue)) return null;

    // 聚合：相邻脏区并为一块，分散脏区各自成块 —— 不再并成唯一的「大盒」，
    // 否则画布对角两处小脏点会把中间大片干净区域一起圈进来，直接撞面积阈值回退全量。
    const regions = coalesceRegions(boxes, MAX_DIRTY_REGIONS);
    if (!regions.length) return null;

    // 世界盒 → 渲染坐标（乘渲染视口，即 dpr·viewport）：clip/clearRect 必须用渲染坐标，
    // 而区域收集、与上屏快照盒的相交判定仍在世界坐标里做（快照盒是世界盒）。
    const rvp = this.__renderViewport();
    const renderRegions: number[][] = [];
    for (let i = 0; i < regions.length; i++) {
      integerAlign(regions[i]);
      renderRegions.push(mapBoxToRender(regions[i], rvp));
    }
    if (regionsAreaRatio(renderRegions, cw, ch) > FULL_FALLBACK_AREA_RATIO) return null;

    // 相交级门控（替代原先的「整场景」门控）：clip 边界与半透明落墨 / 字形 / 点集路径的
    // 抗锯齿边缘相交会产生与全量不一致的接缝，但**只有真正与本次脏区域相交的那些组件**
    // 才有风险。屏外的同类组件不影响本区域，因此按「盒是否与区域相交」逐个判定即可。
    // 这样含文本/星形/控制面板的编辑器场景也能真正用上局部重绘。
    if (this.__riskyIntersectsRegions(regions, this.componentQueue)) return null;
    if (this.__riskyIntersectsRegions(regions, this.toolsQueue)) return null;

    // 插件渲染钩子仍只接收一个盒（既有 API），给所有脏区的并集（世界坐标）
    const bounding = emptyBox();
    for (let i = 0; i < regions.length; i++) {
      unionBoxes(bounding, regions[i]);
    }

    return { regions, renderRegions, bounding };
  }

  /** 渲染视口（dpr·viewport）。ICE 侧有缓存，dpr===1 时直接返回 viewport 本身。 */
  private __renderViewport(): { scale: number; tx: number; ty: number } {
    return typeof this.ice.getRenderViewport === 'function' ? this.ice.getRenderViewport() : this.ice.viewport;
  }

  /**
   * 预检：只读组件标志（display/dirty/快照存在），不触发矩阵/样式计算。
   * @returns { visible: 可见数量, dirty: 可见且脏数量, hiddenErase: 是否有曾上屏的隐藏脏组件 }
   */
  private __preCount(queue: any[]): { visible: number; dirty: number; hiddenErase: boolean } {
    let visible = 0;
    let dirty = 0;
    let hiddenErase = false;
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (!c.isEffectivelyVisible()) {
        //曾上屏就说明它的墨迹还在画布上，本帧必须擦掉 —— 不能只看 dirty：
        //「父容器被设为 false」时子组件自身并不会被置脏。
        if (this.__snap.has(c)) hiddenErase = true;
        continue;
      }
      visible++;
      if (c.dirty) dirty++;
    }
    return { visible, dirty, hiddenErase };
  }

  /**
   * 区域收集 pass：仅当预检通过、即将走局部时才调用。
   * 把「可见且脏」组件的旧快照盒 ∪ 新几何盒、以及「隐藏且曾上屏」组件的旧快照盒
   * 逐条推进 `boxes`（聚合交给 `coalesceRegions`，这里不做并集）。
   * 返回 false = 有组件盒非法（回退全量）。
   */
  private __collectDirtyBoxes(boxes: number[][], queue: any[]): boolean {
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (!c.isEffectivelyVisible()) {
        // 隐藏且曾上屏：只需擦除旧盒。判据是「有快照」而不是「脏」——
        // 父容器被设为 false 时子组件不会有脏标记，但它的墨迹必须被擦掉。
        const old = this.__snap.get(c);
        if (old) boxes.push([old[0], old[1], old[2], old[3]]);
        continue;
      }
      if (!c.dirty) continue;
      // 先给「脏的种类」拍个快照：`__freshBox()` 会调 `refreshParams()` 把 `paramsDirty` 清掉，
      // 而门控（`__riskyIntersectsRegions`）要到收集**之后**才读它 —— 不快照就会把
      // 「内容/几何变了」误判成「只是平移」，从而错误地放行（像素不一致）。
      c.__paramsDirtyAtCollect = c.paramsDirty;
      const nb = this.__freshBox(c);
      if (!nb) return false;
      const old = this.__snap.get(c);
      // 同一个组件的移动/变形区间（旧盒 ∪ 新盒）必然要一起擦一起画 → 先并成一条
      boxes.push(old ? mergeBox(old as any, nb) : nb);
    }
    return true;
  }

  /**
   * 相交级门控：判断「对本帧脏区域有 AA 风险的组件」是否真的与区域相交。
   *
   * 有风险的类别（与整场景门控时代一致）：
   * - 点集路径（星形/正N边形/玫瑰/折线）：clip 会切断折线抗锯齿边缘
   * - 文本：clip 会改变字形 AA
   * - 非不透明落墨（rgba/hsla 色、阴影、globalAlpha≠1、非 source-over）
   *
   * 例外：已离屏缓存的组件在主画布上只是 drawImage（不透明位图整像素采样），
   * 不再受 clip 影响，因此不阻塞。
   *
   * **刚变脏的 risky 组件一律回退**：它本轮要重建位图/重算参数，而实际墨迹范围可能超出
   * 几何盒（文本的字形与描边尤甚，实测「文本内容变更」时墨迹会超出盒若干像素），
   * 在 clip 下重绘无法保证与全量逐像素一致。dirty-rect 像素回归正是靠这条兜住的。
   *
   * 干净的 risky 组件才做相交判定，盒取上屏快照（世界轴对齐盒，含 paint pad）；
   * 快照缺失（从未上屏）时无法判定 → 保守回退。
   */
  private __riskyIntersectsRegions(regions: number[][], queue: any[]): boolean {
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (!c.isEffectivelyVisible()) continue;
      /**
       * **先做廉价的空间预筛，再判"风险类别"**（2026-09-21）。
       *
       * 为什么顺序重要：`isOpaqueDrawing()` 带着两条颜色正则，是这条谓词里最贵的一段；
       * 而它是**逐组件**跑的 —— 10 万图元实测这一段占掉 `__collect()` 的 12.1ms（总 16.2ms）。
       * 但"风险"只在**墨迹与本次脏区相交**时才成立（clip 只作用在脏区里），
       * 于是先用快照盒做 4 次比较（绝大多数组件当场被筛掉），再对剩下的少数做分类。
       *
       * 语义与改造前逐条对齐：
       * - 脏组件：它的盒已经并进脏区（收集阶段做的），必然相交 → 跳过预筛。
       * - 干净且**有快照**：不相交 → 本帧的 clip 碰不到它的墨迹 → 直接放行（原来也要走到最后一步才放行）。
       * - 干净但**无快照**：没有可信盒子 —— **保持改造前的保守口径**（照旧走分类，risky 就回退），
       *   因为"没有快照"既可能是"从未上屏"、也可能是别处把盒丢了；这一档数量极少，保守不吃性能。
       */
      let box: any = null;
      if (!c.dirty) {
        box = this.__snap.get(c);
        if (box) {
          let hit = false;
          for (let k = 0; k < regions.length; k++) {
            if (intersects(box, regions[k])) {
              hit = true;
              break;
            }
          }
          if (!hit) continue;
        }
      }
      const risky = this.__isDotPath(c) || this.__isText(c) || !isOpaqueDrawing(c.state);
      if (!risky) continue;
      // 变脏：先按「墨迹是否可能超出几何盒」分两类。
      //
      // **文本**：字形 + 描边的墨迹会超出几何盒（实测「文本内容变更」时差异色正是文本的描边色），
      // clip 下重绘无法与全量逐像素一致 → 必须有离屏缓存（主画布只是 drawImage 位图，
      // clip 只作用于整像素采样），否则回退。
      //
      // **非文本**（点集路径 / 折线 / 半透明落墨）：墨迹 = 几何 + `stylePaintPad`
      //（连线还含标签，见 `ICEPolyLine.__localBox`），而「它是脏的」意味着**旧盒 ∪ 新盒都已并进脏区** ——
      // 也就是说：旧墨迹在区域内会被擦掉、新墨迹也完全落在区域内，clip 边界落在墨迹之外。
      // 因此内容/几何变了同样放行。（原实现是「刚变脏一律回退」，那条结论来自上面那个文本实测，
      // 泛化到全部 risky 类别过于保守 —— 编辑器里拖动实体时关系连线会重新布线、每帧都变脏，
      // 局部重绘因此 100% 失效。）
      if (c.dirty) {
        if (!this.__isText(c)) {
          continue;
        }
        // 文本：只有「仅位置变化（paramsDirty 为 false，即祖先平移）+ 已缓存」才放行 ——
        // 此时主画布只是把位图平移贴回；内容/几何一变，字形墨迹仍可能超出几何盒（缓存位图同样受
        // 盒子限制，超出的部分一样会被裁掉），必须回退。
        // 注意读的是收集阶段拍的快照：`__freshBox()` 会清掉 `paramsDirty`。
        if (!c.__paramsDirtyAtCollect && this.cache.isCachable(c) && this.cache.has(c)) {
          continue;
        }
        return true;
      }
      // 干净的已缓存组件：主画布只是 drawImage 不透明位图，clip 不影响 → 不阻塞
      if (this.cache.isCachable(c) && this.cache.has(c)) continue;

      const snap: any = box || this.__snap.get(c);
      if (!snap) return true; // 干净但无快照：没有可信盒子 → 保守回退
      for (let k = 0; k < regions.length; k++) {
        if (intersects(snap as any, regions[k])) return true;
      }
    }
    return false;
  }

  private __renderDirtyRect(plan: { regions: number[][]; renderRegions: number[][]; bounding: number[] }) {
    const ctx = this.ice.ctx;
    //regions 是世界盒（与上屏快照盒同一坐标系，用于相交判定）；renderRegions 是渲染坐标（用于擦除与裁剪）
    const regions = plan.regions;
    const renderRegions = plan.renderRegions;

    for (let k = 0; k < regions.length; k++) {
      const r = regions[k];
      const d = renderRegions[k];
      const rx = d[0];
      const ry = d[1];
      const rw = d[2] - d[0];
      const rh = d[3] - d[1];
      if (rw <= 0 || rh <= 0) continue;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(rx, ry, rw, rh);
      // 在画布坐标建立裁剪区；组件 render 内部自行 setTransform 只替换 CTM、不清除 clip
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();

      // 组件 pass：画「本帧脏」或「包围盒与本块区域相交」的组件（z 升序，与全量路径一致）
      for (let i = 0; i < this.componentQueue.length; i++) {
        const component = this.componentQueue[i];
        if (!component.isEffectivelyVisible()) continue;
        const snap = this.__snap.get(component);
        const needDraw = component.dirty || (snap && intersects(snap as any, r));
        if (!needDraw) continue;
        this.__ensureContext(component);
        this.__renderComponent(component);
        this.__capture(component);
      }

      // 工具 pass：clip 内恒画（数量恒小），与全量路径「组件层→工具层」合成序一致
      for (let i = 0; i < this.toolsQueue.length; i++) {
        const tool = this.toolsQueue[i];
        if (!tool.isEffectivelyVisible()) continue;
        this.__ensureContext(tool);
        tool.render();
        this.__capture(tool);
      }

      //插件渲染钩子：仍在 clip 之内，语义与组件一致
      this.__invokePluginRender(r);

      ctx.restore();
    }

    this.__finalizeHidden(this.componentQueue);
    this.__finalizeHidden(this.toolsQueue);

    this.ice.dirty = false;
    this.ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH);
  }

  /**
   * 调用插件渲染钩子。要求：
   * - 与世界坐标一致：先把 CTM 设为「渲染视口」（dpr · viewport），插件即可按世界坐标绘制
   * - 在两条渲染路径中都调用；局部重绘时处于 clip 之内，语义与组件一致
   * - 未注册任何钩子时零开销（不构造 frame 对象）
   */
  private __invokePluginRender(region: number[] | null): void {
    const host: any = this.ice && this.ice.plugins;
    if (!host || typeof host.hasRenderHooks !== 'function' || !host.hasRenderHooks()) {
      return;
    }
    const ctx = this.ice.ctx;
    const vp = this.__renderViewport();
    ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.tx, vp.ty);
    host.invokeRenderHooks({
      ctx,
      mode: this.renderMode,
      region,
      width: this.ice.canvasWidth,
      height: this.ice.canvasHeight,
    });
  }

  // ===================== 局部重绘支撑 =====================

  private __ensureContext(component: any): void {
    if (component.ctx !== this.ice.ctx || component.ice !== this.ice) {
      component.root = this.ice.root;
      component.ctx = this.ice.ctx;
      component.evtBus = this.ice.evtBus;
      component.ice = this.ice;
    }
  }

  /**
   * @internal 取组件上一次上屏的世界包围盒（含 paint pad，格式 [minX,minY,maxX,maxY]）。
   * 供命中检测做「廉价包围盒预筛」，避免对屏外组件做矩阵反变换 + 形状判定。无快照返回 null。
   */
  public getWorldBox(component: any): Float64Array | null {
    return this.__snap.get(component) || null;
  }

  /**
   * 命中测试要用的「已排好序」的组件 / 工具队列（都是 zIndex 升序）。
   *
   * 为什么给命中测试用：`hitTestComponents` 原来每次都 `flattenAllComponents()` + `sort()`，
   * 那是**每次鼠标命中**都要展平整棵树、分配并排序一个大数组（实测 1 万组件下 0.8ms/次，
   * 而 hover 类交互是逐次 mousemove 调的）。渲染器手里本来就有一份同样口径、
   * 且只在结构/zIndex 变化时才重建的队列，直接复用即可。
   *
   * 语义口径与渲染队列完全一致（`flattenTree` 先组件后工具 + zIndex 稳定排序），
   * 因此「点得到的位置」与「画出来的样子」仍然严格对齐 —— 这两者一旦漂移，
   * 就会变成「看得见却点不中」这类最难查的问题。
   *
   * @internal 供 `hitTestComponents` 复用；调用方不要改这两个数组。
   */
  public getOrderedQueues(): { components: any[]; tools: any[] } {
    // 结构变更 / zIndex 变更都会在这里被按需修正；两者都没变时 `refreshQueue` 是 O(1) 返回
    //（结构未变时它只做一次 O(n) 的 zIndex 快照比对）。
    this.refreshQueue();
    return { components: this.componentQueue, tools: this.toolsQueue };
  }

  /**
   * 当前视口对应的可见世界矩形 [minX,minY,maxX,maxY]。画布尺寸缺失时返回 null（不裁剪）。
   */
  private __visibleWorldRect(): number[] | null {
    const cw = this.ice.canvasWidth || 0;
    const ch = this.ice.canvasHeight || 0;
    if (!cw || !ch) return null;
    const [x0, y0] = this.ice.screenToWorld(0, 0);
    const [x1, y1] = this.ice.screenToWorld(cw, ch);
    const box = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
    return isFiniteBox(box) ? box : null;
  }

  /**
   * 组件渲染入口：可缓存组件走离屏位图（命中贴图 / 纯平移复用 / 重建），
   * 否则回退到普通 render()。
   */
  private __renderComponent(component: any): void {
    if (!this.cache.render(component)) {
      component.render();
    }
  }

  private __isDotPath(c: any): boolean {
    return typeof c.calcDots === 'function';
  }
  private __isText(c: any): boolean {
    return typeof c.measureText === 'function';
  }

  /**
   * 计算 dirty 组件的「新盒」（含 paint pad，世界坐标）。
   * 需要先刷新组件参数（文本 measure / dot-path calcDots），再 refresh 合成矩阵。
   * 返回 null = 盒非法或计算失败（回退全量）。
   */
  private __freshBox(c: any): number[] | null {
    try {
      if (typeof c.refreshParams === 'function') {
        c.refreshParams();
      }
      const box = c.getMaxBoundingBox(true);
      const mm = box.getMinAndMaxPoint();
      const pad = stylePaintPad(c.state, this.__renderViewport().scale);
      const out = [mm.minX - pad, mm.minY - pad, mm.maxX + pad, mm.maxY + pad];
      return isFiniteBox(out) ? out : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * 渲染后捕获组件的世界包围盒（含 pad）到快照，供后续帧做旧区域擦除与相交判断。
   */
  private __capture(c: any): void {
    let out = this.__snap.get(c);
    if (!out) {
      out = new Float64Array(4);
      this.__snap.set(c, out);
    }
    c.__paintWorldBox(out);
    const pad = stylePaintPad(c.state, this.__renderViewport().scale);
    out[0] -= pad;
    out[1] -= pad;
    out[2] += pad;
    out[3] += pad;
  }

  /**
   * 隐藏组件（display:false）曾上屏过、且仍挂着脏标记（render 提前返回不会自清）：
   * 本帧它的旧区域已被擦除（全量 clear 或局部 erase 区域），因此清除脏位并移除快照，
   * 避免「永久脏组件把后续局部帧反复顶成全量」。display 重新打开时 setState 会重新置脏。
   */
  private __finalizeHidden(queue: any[]): void {
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (!c.isEffectivelyVisible() && c.dirty) {
        c.dirty = false;
        this.__snap.delete(c);
      }
    }
  }
}

export default CanvasRenderer;
