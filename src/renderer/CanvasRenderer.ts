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
import { flattenTree } from '../util/data-util';
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
      // dirty-rect：能构造出局部重绘计划就走局部；否则回退全量。
      if (this.renderMode === 'dirty-rect' && !this.__forceFullRender) {
        const plan = this.__collect();
        if (plan) {
          this.__renderDirtyRect(plan);
          return;
        }
      }
      this.doRenderFull();
    }
  }

  private refreshQueue() {
    if (this.__queueDirty) {
      this.__rebuildQueue();
      return;
    }
    //结构未变：仅检查 zIndex 是否真的发生变化（O(n) 整数比对，无数组分配）。
    // 仅当顺序确实改变时才重新排序，否则直接复用上一次的队列。
    if (this.__zOrderChanged()) {
      const compareZ = (a: any, b: any) => a.state.zIndex - b.state.zIndex;
      this.componentQueue.sort(compareZ);
      this.toolsQueue.sort(compareZ);
      this.__snapshotZ();
    }
  }

  private __rebuildQueue() {
    const compareZ = (a: any, b: any) => a.state.zIndex - b.state.zIndex;
    this.componentQueue = flattenTree([], this.ice.childNodes);
    this.componentQueue.sort(compareZ);
    this.toolsQueue = flattenTree([], this.ice.toolNodes);
    this.toolsQueue.sort(compareZ);
    this.__queueDirty = false;
    this.__snapshotZ();
    // 结构变了：快照整体失效，下一次渲染必须先全量 prime。
    this.__snap = new WeakMap();
    this.__primed = false;
  }

  /**
   * 把当前 componentQueue + toolsQueue 的 zIndex 顺序快照到复用的 __zSnap 数组，
   * 供下一帧做稳定性比对，避免每帧分配新数组。
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
      const risky = this.__isDotPath(c) || this.__isText(c) || !isOpaqueDrawing(c.state);
      if (!risky) continue;
      // 变脏 → 无条件回退（见上方说明）
      if (c.dirty) return true;
      // 干净的已缓存组件：主画布只是 drawImage 不透明位图，clip 不影响 → 不阻塞
      if (this.cache.isCachable(c) && this.cache.has(c)) continue;

      const box: any = this.__snap.get(c);
      if (!box) return true; // 干净但无快照：没有可信盒子 → 保守回退
      for (let k = 0; k < regions.length; k++) {
        if (intersects(box as any, regions[k])) return true;
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
      const pad = stylePaintPad(c.state);
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
    const pad = stylePaintPad(c.state);
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
