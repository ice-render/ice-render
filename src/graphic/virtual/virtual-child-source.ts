/**
 * **虚拟子源（VirtualChildSource）**：让"文档里的图元"和"内存里的组件对象"解耦。
 *
 * 设计见 `plans/virtual-child-source.md`；这一版落地的是 **P0（批量绘制 + 窗口裁剪）**
 * 与 **P3（窗口内物化的廉价增删）**。
 *
 * 一句话：容器可以声明"我的子项不在 `childNodes` 里，而是由一个只会回答几个问题的只读视图描述" ——
 * 引擎按**可见窗口**向它要内容（`paint` / `forEachInBox`），需要真组件时再 `materialize` 一个。
 * 10 万图元实测（真机 Chrome + CDP，spike）：堆 173.8 MB → **5.4 MB**、单帧 123.1 ms → **0.2 ms**、
 * 命中 3,994 µs → **0.14 µs**；100 万图元 **32 MB** / 平移 121 fps。
 *
 * **坐标系口径**：`boxAt` / `forEachInBox` / `hitTest` / `paint` 全部在**容器自己的局部坐标系**
 * 里（与 `state.left/top`、`containsLocalPoint()` 同一套），不是世界坐标 —— 这样虚拟容器可以像
 * 任何组件一样被摆放/嵌套。引擎负责在调用前把可见窗口经**逆合成矩阵**变换到局部坐标
 * （见 `visibleLocalRect`）。常见用法（容器在 (0,0)、无变换）下局部 == 世界，没有额外心智负担。
 */
/** 传给 `paint` 的窗口视图（**局部坐标**）。 */
export interface VirtualChildView {
  /** 可见窗口的局部矩形（含 `state.width/height` 之外的余量由应用自己决定）。 */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 世界 → 设备像素的缩放（`getRenderViewport().scale`，已含 dpr）：LOD / 线宽决策用它。 */
  scale: number;
}

/**
 * **SVG 导出的 sink**（`paintToSvg` 用）：应用按文档顺序把条目写进来，引擎负责
 * 包 `<g transform>`（容器的世界矩阵）、拼 `<defs>`、转义与最终文档结构。
 *
 * 为什么给 `raw` 的逃生舱：领域图元千奇百怪（IED 的 21 种工艺符号都是复合形状），
 * 引擎不可能预定义"足够的图元词汇"；而"复合符号复用一份 def + 逐实例 `<use>`"这类做法
 * 恰恰是导出体积与正确性的关键（2 万个符号 = 21 份 def + 2 万个 `<use>`）。
 */
export interface VirtualSvgSink {
  /** 原样插入一段 SVG（应用自己拼 `<use>` / `<polyline>` / `<text>` …）。 */
  raw(svg: string): void;
  /** 登记一份可复用的 def（`id` 由应用给，重复登记会覆盖）。 */
  define(id: string, svg: string): void;
  /** 引用一份 def：`<use href="#id" x y>`（引擎不改应用的坐标口径）。 */
  use(id: string, x: number, y: number): void;
}

/**
 * 虚拟子源：应用实现的只读视图。**引擎不碰应用的数据结构**，只认这几个方法。
 *
 * 实现纪律（写在契约里，违反会出问题）：
 * 1. **文档是唯一真相**，`materialize()` 出来的组件是投影；改内容必须走应用自己的入口并 `version++`。
 * 2. `forEachInBox` 必须与 `boxAt` 自洽（引擎的窗口裁剪只信这两个）。
 * 3. `hitTest` 必须与 `boxAt` 自洽（命中预筛用的是盒）。
 */
export interface VirtualChildSource {
  /** 文档里的真实子项数（不是物化数）。 */
  readonly count: number;
  /** 文档版本：任何影响"画出来是什么 / 命中什么"的变更都要 +1（引擎用它失效缓存）。 */
  readonly version: number;

  /** 第 i 项的局部轴对齐盒（写进 `out[0..3]`）。窗口遍历与命中预筛只读它，不建对象。 */
  boxAt(i: number, out: Float64Array): void;

  /** 窗口遍历：把与局部矩形 `[x0,y0,x1,y1]` 相交的子项下标交给 `visit`（应用用自己的空间索引做快）。 */
  forEachInBox(x0: number, y0: number, x1: number, y1: number, visit: (i: number) => void): void;

  /** 点（**局部坐标**）→ 下标；找不到返回 -1。 */
  hitTest(lx: number, ly: number): number;

  /**
   * **批量落墨**（可选）：能画就返回 true —— 这些子项不进组件树、不建对象。
   * `ctx` 的 CTM 已经包含视口与容器自身的变换（与组件 `doRender` 同源），所以按局部坐标画即可。
   * 不实现它也能用（子项就都得 `materialize`），但那样只有"窗口内物化"的收益。
   */
  paint?(ctx: any, view: VirtualChildView): boolean;

  /**
   * **全量导出**（可选）：把**整份文档**（不是窗口）写进 sink，成功返回 true。
   *
   * 只被 SVG 导出调用；应用在这里按自己的文档顺序写条目 —— 想复用复合符号就
   * `sink.define(id, svg)` + `sink.use(id, x, y)`（引擎不管，也不该管）。
   * 不实现它时，导出**只包含物化出来的子项**（窗口里那点），这一点必须让应用知道。
   */
  paintToSvg?(sink: VirtualSvgSink, bounds: { x0: number; y0: number; x1: number; y1: number }): boolean;

  /**
   * 文档包围盒（可选，**局部坐标**）：`exportSvg(..., { area: 'content' })` 与"适应视图"用它。
   * 不实现时用容器自己的盒（对"容器盒 = 文档范围"的常见写法没有影响）。
   */
  documentBounds?(out: Float64Array): boolean;

  /**
   * **按需物化**（可选）：要一个真实组件（可交互 / 文字 / 图片 / 自定义子类）。
   * 返回的组件由引擎挂进本容器的 `childNodes`；`null` = 这次放弃（引擎跳过它）。
   */
  materialize?(i: number): any | null;

  /**
   * **文档载荷**（可选）：序列化时原样写进容器的 `virtual.payload`，反序列化时原样传回
   * 给 `ICE.registerVirtualSource(type, factory)` 注册的工厂。
   *
   * 引擎不理解它，也不该理解：文档是应用的数据。引擎保证的是"它跟着快照进出、位置正确"。
   */
  serializeDocument?(): any;

  /**
   * **文档的唯一写入口**（可选，P2 第 3 条）：把补丁写进**文档**（不是写进物化组件）。
   *
   * 引擎的 `applyVirtualPatch(container, i, patch)` 会调它，然后**同步到那个物化组件** ——
   * 于是"文档是真相、组件是投影"这条契约在代码上只有一个入口；undo/redo 记的是这里发生的补丁，
   * 而不是物化组件的 state 变化（后者的记录会在物化/回收时丢掉）。
   *
   * 实现里请 `version++`（引擎与宿主用 version 判断"要不要重算派生内容"）。
   */
  applyPatch?(index: number, patch: Record<string, any>): boolean;

  /**
   * **物化组件被改动后的回流**（可选，P2 第 3 条）：用户在画布上拖动 / 属性面板改了那个真组件时，
   * 引擎把补丁回调给应用，应用据此写进文档并 `version++`。
   *
   * 为什么引擎不自己写文档：只有应用知道"文档的 `x/y` 对应 state 的哪些字段"。
   * 引擎的职责是把这个信号**可靠地发出来**（物化时包一层 `setState`，见 `materializeVirtualChild`）。
   */
  onChildPatched?(index: number, patch: Record<string, any>): void;

  /**
   * 文档类型键（可选）：反序列化时用它在引擎的虚拟源注册表里找回工厂。
   * 与 `ICE.registerType` 同源思路：**不写类名**（会被打包器 mangle）。
   */
  readonly documentType?: string;
}

/**
 * 每实例一个 `childSource` 的侧表。
 *
 * 为什么不用实例字段：AGENTS「热路径类不加实例字段铁律」—— 给 `ICEComponent`/`ICEGroup`/图元加一个
 * 字段会把属性挤出 V8 的对象内属性区，整条继承链的属性访问退化 3~4×。侧表是那个铁律里指定的做法。
 */
const CHILD_SOURCE = new WeakMap<any, VirtualChildSource>();
/** 上一次批量落墨用的窗口（**只为调试与断言**：测试要确认"窗口跟着视口走"）。 */
const LAST_WINDOW = new WeakMap<any, number[]>();
/** 命中检测刚问到的那一个子项下标（`containsPoint` 写、事件路径读；-1 = 没命中子项）。 */
const HIT_INDEX = new WeakMap<any, number>();
/** 命中策略（默认 `materialize`：命中批量图元就把它物化成真组件，事件重定向过去）。 */
const HIT_POLICY = new WeakMap<any, VirtualHitPolicy>();
/** 容器 → （下标 → 已物化的真组件）。引擎维护它，保证"同一下标只物化一次"与可回收。 */
const MATERIALIZED = new WeakMap<any, Map<number, any>>();
/**
 * 容器 → **由 `syncVirtualWindow` 物化出来的**下标集合。
 *
 * 为什么单独记：命中路径（用户点一下）也会物化条目，那些**不属于窗口同步的管辖范围** ——
 * 回收时若按"窗口里的下标集合"一刀切，会把用户刚点中的那个当场拆掉
 * （真机实测：点中符号 → 立刻被回收 → 属性面板找不到节点）。
 */
const SYNC_MANAGED = new WeakMap<any, Set<number>>();
/** 下标的稳定自增号（用于把 `forEachInBox` 的候选按"离窗口中心近"排序，见 `syncWindowMaterialization`）。 */

/** 命中策略：`materialize`（默认）命中批量图元就物化成真组件；`container` 命中容器本身。 */
export type VirtualHitPolicy = 'materialize' | 'container';

export function setVirtualHitIndex(container: any, index: number): void {
  HIT_INDEX.set(container, index);
}

export function virtualHitIndexOf(container: any): number {
  const i = HIT_INDEX.get(container);
  return i === undefined ? -1 : i;
}

export function setVirtualHitPolicy(container: any, policy: VirtualHitPolicy): void {
  HIT_POLICY.set(container, policy === 'container' ? 'container' : 'materialize');
}

export function virtualHitPolicyOf(container: any): VirtualHitPolicy {
  return HIT_POLICY.get(container) || 'materialize';
}

/** 绑定 / 解绑虚拟子源（`null` = 解绑）。返回 `this` 以便链式。 */
export function setChildSourceFor(target: any, source: VirtualChildSource | null): void {
  if (source) {
    CHILD_SOURCE.set(target, source);
  } else {
    CHILD_SOURCE.delete(target);
  }
}

/** 取容器上的虚拟子源；没绑定返回 `null`（热路径一次 WeakMap 读，约 20ns）。 */
export function childSourceOf(target: any): VirtualChildSource | null {
  if (!target) return null;
  return CHILD_SOURCE.get(target) || null;
}

/** 复用的窗口缓冲（模块级：不给实例加字段，也不每次分配数组）。 */
const WINDOW_SCRATCH = [0, 0, 0, 0];
/** 变换 4 个角用的复用数组（局部 x / 世界 y 两组）。 */
const CORNER_X = [0, 0, 0, 0];
const CORNER_Y = [0, 0, 0, 0];

/**
 * 可见窗口 → **容器局部坐标**矩形（写进 `out`），成功返回 true。
 *
 * 做法：取渲染器手里那份"可见世界矩形"，用容器合成矩阵的逆把它变换回局部空间。
 * 旋转/缩放下矩形会变成四边形，所以按**4 个角的包围盒**取（保守，宁多不少）。
 */
export function visibleLocalRect(component: any, out: number[] = WINDOW_SCRATCH): boolean {
  const ice = component && component.ice;
  const renderer = ice && ice.renderer;
  const world = renderer && typeof renderer.getVisibleWorldRect === 'function' ? renderer.getVisibleWorldRect() : null;
  if (!world || !(world.length >= 4)) return false;
  const m = component.state && component.state.composedMatrix;
  if (!m || m.length < 6) return false;

  const a = m[0];
  const b = m[1];
  const c = m[2];
  const d = m[3];
  const e = m[4];
  const f = m[5];
  const det = a * d - b * c;
  if (!det) return false;
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;

  CORNER_X[0] = world[0];
  CORNER_Y[0] = world[1];
  CORNER_X[1] = world[2];
  CORNER_Y[1] = world[1];
  CORNER_X[2] = world[2];
  CORNER_Y[2] = world[3];
  CORNER_X[3] = world[0];
  CORNER_Y[3] = world[3];

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 4; i++) {
    const wx = CORNER_X[i] - e;
    const wy = CORNER_Y[i] - f;
    const lx = ia * wx + ic * wy;
    const ly = ib * wx + id * wy;
    if (lx < x0) x0 = lx;
    if (ly < y0) y0 = ly;
    if (lx > x1) x1 = lx;
    if (ly > y1) y1 = ly;
  }
  out[0] = x0;
  out[1] = y0;
  out[2] = x1;
  out[3] = y1;
  return true;
}

/** 世界 → 设备像素的缩放（`getRenderViewport().scale`，已含 dpr）。取不到时按 1。 */
export function renderScaleOf(component: any): number {
  const ice = component && component.ice;
  if (!ice || typeof ice.getRenderViewport !== 'function') return 1;
  const rvp = ice.getRenderViewport();
  const s = rvp && rvp.scale;
  return s > 0 ? s : 1;
}

/**
 * 在容器的 `doRender()` 里调：按当前可见窗口向虚拟子源要一次批量落墨。
 *
 * 只做三件事：算局部窗口 → 调 `source.paint(ctx, view)` → 把窗口解析结果缓存到 `stats`，
 * 供调试与断言（`__virtualWindow`）。
 */
export function paintVirtualWindow(component: any): void {
  const source = CHILD_SOURCE.get(component);
  if (!source || typeof source.paint !== 'function') return;
  if (!visibleLocalRect(component, WINDOW_SCRATCH)) return;
  const view: VirtualChildView = {
    x0: WINDOW_SCRATCH[0],
    y0: WINDOW_SCRATCH[1],
    x1: WINDOW_SCRATCH[2],
    y1: WINDOW_SCRATCH[3],
    scale: renderScaleOf(component),
  };
  /**
   * **必须把 `source.paint` 包在 save/restore 里**（2026-09-21 真机实测抓到的问题）：
   * 容器的 `applyStyleToCtx()`（在 `doRender` **之前**执行）已经把 `fillStyle` 设成了容器自己的样式，
   * 而批量落墨会一路改 `fillStyle`（最后一个图元的颜色就留在 ctx 上）—— 紧接着
   * `super.doRender()` 画容器自己的盒子时，就会**用最后一个图元的颜色**填满整块容器
   * （spike 里表现为"整张画布被紫色盖住"，像素对拍 99.9% 不一致）。
   * 隔离状态既修掉这个泄漏，也让应用的 `paint` 有一个干净的起点。
   */
  const ctx = component.ctx;
  if (ctx && typeof ctx.save === 'function') {
    ctx.save();
    try {
      source.paint(ctx, view);
    } finally {
      ctx.restore();
    }
  } else {
    source.paint(ctx, view);
  }
  LAST_WINDOW.set(component, [view.x0, view.y0, view.x1, view.y1, view.scale]);
}

/** 上一次批量落墨的窗口 `[x0,y0,x1,y1,scale]`；没画过返回 `null`（调试 / 测试用）。 */
export function lastVirtualWindow(component: any): number[] | null {
  return LAST_WINDOW.get(component) || null;
}

/**
 * **结构 / 成员变更的统一通知入口**（`ICE.addChild`、`ICEGroup.addChild` 等都走它）。
 *
 * - 父级**没有**虚拟子源 → 老路径 `markQueueDirty()`：结构变更，清队列与上屏快照，下一帧全量 prime；
 * - 父级**有**虚拟子源 → `markWindowChanged(child)`：队列照重建，但**保留其他组件的上屏快照**，
 *   只丢"进出窗口的那个"的快照，并要求本帧整屏重画。
 *
 * 为什么要分开：虚拟化每帧都在进出几十上百个子项（窗口内物化 / 回收），走老路径等于
 * "每物化一次，整屏失去视口裁剪 + 快照重建" —— 10 万图元世界里那是一次 **117 ms** 的帧。
 */
export function notifyStructureChanged(ice: any, parent: any, child: any): void {
  const renderer = ice && ice.renderer;
  if (!renderer) return;
  if (childSourceOf(parent) && typeof renderer.markWindowChanged === 'function') {
    renderer.markWindowChanged(child);
    return;
  }
  renderer.markQueueDirty();
}

/**
 * **把一个虚拟子项物化成真组件**（幂等：同一个下标只会物化一次，重复调用返回同一个组件）。
 *
 * 物化出来的组件会被挂进容器的 `childNodes` —— 于是它自动获得引擎的全部能力：
 * 命中、选中、控制面板、拖动、序列化（`getSerializableChildren`）、worker 镜像、无障碍。
 *
 * ⚠️ 实现方的 `materialize(i)` **必须**在文档里把这一项标记为"已物化"（批量落墨时跳过它），
 * 否则会被画两遍（引擎不知道你的文档长什么样）。
 */
export function materializeVirtualChild(container: any, index: number): any {
  const existing = MATERIALIZED.get(container);
  if (existing && existing.has(index)) {
    return existing.get(index);
  }
  const source = CHILD_SOURCE.get(container);
  if (!source || typeof source.materialize !== 'function') return null;
  const child = source.materialize(index);
  if (!child) return null;
  const map = existing || new Map<number, any>();
  if (!existing) MATERIALIZED.set(container, map);
  map.set(index, child);
  container.addChild(child);
  watchMaterializedChild(container, index, child);
  return child;
}

/** 已经包过 `setState` 的物化子项（模块级 WeakSet：不给组件加实例字段）。 */
const WATCHED = new WeakSet<any>();

/**
 * 包一层物化子项的 `setState`：把改动回流给文档（`source.onChildPatched`）。
 *
 * 为什么包实例方法而不是钩 `ICEComponent.setState`：后者是**每帧每组件**的热路径，
 * 在那里加一次 WeakMap 查（"我的父级是不是虚拟容器"）会让 10 万图元的 setState 都变慢；
 * 而物化子项只有几百个，包一次的成本可以忽略（且不进全局热路径）。
 */
function watchMaterializedChild(container: any, index: number, child: any): void {
  if (!child || WATCHED.has(child) || typeof child.setState !== 'function') return;
  WATCHED.add(child);
  const original = child.setState;
  child.setState = function (patch: any, options?: any) {
    const result = original.call(this, patch, options);
    const source = CHILD_SOURCE.get(container);
    // 程序化写入（`applyVirtualPatch`）不再回流：文档已经写过这份补丁了（见 APPLYING）
    if (
      !APPLYING.has(this) &&
      source &&
      typeof source.onChildPatched === 'function' &&
      patch &&
      typeof patch === 'object'
    ) {
      source.onChildPatched(index, patch);
    }
    return result;
  };
}

/**
 * **往文档里写补丁**（P2 第 3 条的唯一写入口）：`source.applyPatch(i, patch)` → 再同步到物化组件。
 *
 * 两条顺序是刻意的：**先文档后组件** —— 文档是真相，组件是投影；反过来的话，
 * 组件的那次 `setState` 会先回流（`onChildPatched`）造成"重复写一遍"，
 * 而且失败时会出现"屏幕变了、文档没变"。
 */
export function applyVirtualPatch(container: any, index: number, patch: Record<string, any>): boolean {
  const source = CHILD_SOURCE.get(container);
  if (!source || typeof source.applyPatch !== 'function') return false;
  if (!source.applyPatch(index, patch)) return false;
  const child = materializedChild(container, index);
  if (child && typeof child.setState === 'function') {
    APPLYING.add(child);
    try {
      child.setState(patch);
    } finally {
      APPLYING.delete(child);
    }
  }
  return true;
}

/**
 * 正在被 `applyVirtualPatch` 同步的物化组件。
 *
 * 为什么需要它：`child.setState(patch)` 会触发包好的回流（`onChildPatched`），
 * 而文档刚刚已经写过这份补丁了 —— 不拦的话每次程序化写都多回流一次（undo/redo 里会翻倍）。
 */
const APPLYING = new WeakSet<any>();

/** **回收**一个已物化的子项（滚出窗口时用）：摘除并允许下次再物化。返回是否真的回收了。 */
export function releaseVirtualChild(container: any, index: number): boolean {
  const map = MATERIALIZED.get(container);
  const child = map && map.get(index);
  if (!child) return false;
  map!.delete(index);
  container.removeChild(child);
  return true;
}

/** 反查：某个已经物化出来的组件对应哪个下标；没有返回 -1。 */
export function materializedIndexOf(container: any, child: any): number {
  const map = MATERIALIZED.get(container);
  if (!map) return -1;
  for (const [i, c] of map) {
    if (c === child) return i;
  }
  return -1;
}

/**
 * 取某个下标已物化出来的组件；没物化返回 `null`。
 *
 * 用途：应用在"从快照读回"之后重建自己的"活对象"表（引擎会把物化子项与下标一起还原，
 * 应用据此把引用重新挂上，否则这些组件再被拖动时应用写不回自己的文档）。
 */
export function materializedChild(container: any, index: number): any {
  const map = MATERIALIZED.get(container);
  return map ? map.get(index) || null : null;
}

/**
 * **窗口同步**（P2 第 4 条）：按当前窗口把"需要真组件"的条目物化、把出窗口的回收。
 *
 * 为什么要有它：P0~P2 之前每个应用都在自己的 `paint` 里写一遍这段循环（IED 也不例外），
 * 而它有几处容易写错：① 用哪个窗口（必须和批量落墨同一个，否则边界上一条会被建了又拆）；
 * ② 滞后带（`pad`：没有它，指针在边界上抖一下就会反复物化/回收）；
 * ③ 每帧新建上限（`budget`：一屏滚进一大片新内容时，几百次 `addChild` 集中在同一帧会造成尖峰）。
 *
 * ```ts
 * // 在 paint 里（拿得到窗口）或渲染后调：
 * syncVirtualWindow(layer, { needs: (i) => doc.type[i] === LABEL, pad: 300 });
 * ```
 *
 * 不传 `view` 时用最近一次批量落墨记下的窗口（`lastVirtualWindow`）。
 */
export interface VirtualWindowOptions {
  /** 这条条目要不要物化成真组件（不实现 = 全部都要，通常不是你想要的）。 */
  needs?: (index: number) => boolean;
  /**
   * 「被访问的下标 → 要物化的下标」（默认恒等）。
   *
   * 为什么需要：条目之间会**互相派生** —— IED 的标注就是"扫到符号、物化它的标注"，
   * 被访问的是符号下标、物化了的是标注下标。不写映射的话，回收那段会拿"物化过的下标"
   * 去跟"窗口里的下标"比，结果**建完立刻全回收**（实测 `created 104 / released 104 / live 0`）。
   * 返回 <0 表示这条跳过。
   */
  map?: (index: number) => number;
  /** 窗口外扩（局部坐标，默认 0）：滞后带，避免边界抖动反复建/拆。 */
  pad?: number;
  /** 每帧最多**新建**几个（默认 64）：把"滚进一大片新内容"的尖峰摊到几帧上。 */
  budget?: number;
  /** 自定义物化（默认走 `materializeVirtualChild`，幂等）。 */
  materialize?: (index: number) => any;
}

export interface VirtualWindowResult {
  created: number;
  released: number;
  live: number;
  /** 本帧想建但因为 budget 没建的个数（>0 说明下一帧还要继续消化）。 */
  deferred: number;
}

export function syncVirtualWindow(container: any, options: VirtualWindowOptions = {}): VirtualWindowResult {
  const source = CHILD_SOURCE.get(container);
  const out: VirtualWindowResult = { created: 0, released: 0, live: 0, deferred: 0 };
  if (!source) return out;
  const view = lastVirtualWindow(container);
  if (!view) return out;
  const pad = Number(options.pad) > 0 ? Number(options.pad) : 0;
  const budget = Number.isFinite(Number(options.budget)) ? Math.max(0, Number(options.budget)) : 64;
  const needs = options.needs;
  const map = options.map || ((i: number) => i);
  const doMaterialize = options.materialize || ((i: number) => materializeVirtualChild(container, i));

  const keep = new Set<number>();
  if (typeof source.forEachInBox === 'function') {
    source.forEachInBox(view[0] - pad, view[1] - pad, view[2] + pad, view[3] + pad, (i: number) => {
      if (needs && !needs(i)) return;
      const li = map(i);
      if (!(li >= 0)) return;
      keep.add(li);
      if (materializedChild(container, li)) return;
      if (out.created >= budget) {
        out.deferred++;
        return;
      }
      if (doMaterialize(li)) {
        out.created++;
        // 登记"这是我建的"（回收只在这个集合里进行，见下面 SYNC_MANAGED 的说明）
        let owned = SYNC_MANAGED.get(container);
        if (!owned) {
          owned = new Set<number>();
          SYNC_MANAGED.set(container, owned);
        }
        owned.add(li);
      }
    });
  }
  // 回收**只管自己物化的那些**（命中路径 / 应用自己物化的条目不在管辖范围，交给应用决定）
  const managed = SYNC_MANAGED.get(container);
  if (managed) {
    for (const i of [...managed]) {
      if (keep.has(i)) continue;
      if (releaseVirtualChild(container, i)) {
        managed.delete(i);
        out.released++;
      }
    }
  }
  out.live = materializedIndices(container).length;
  return out;
}

/**
 * **自检**（P2 第 5 条）：扫一遍文档的盒子，报出"跨度异常"的条目。
 *
 * 为什么需要：虚拟化把"图元的盒别跨全图"从隐含约束变成了硬约束 —— 我实测踩过：一条跨行的
 * 管线盒横跨 12,000 单位，网格索引的节点数按格子数爆炸（6 万条目 → 3,000 万节点 / 236MB / 11.8fps）。
 * 这类错误**不报任何异常**，只表现为"帧率莫名很低、内存莫名很高"，所以值得给一个显式的自检。
 *
 * 只在开发期调用（O(count) 次 `boxAt`）；返回值可直接打进控制台。
 */
export function diagnoseVirtualSource(
  source: VirtualChildSource,
  options: { sample?: number; spanRatio?: number } = {}
): { scanned: number; maxSpan: number; offenders: Array<{ index: number; span: number; box: number[] }> } {
  const sample = Number(options.sample) > 0 ? Number(options.sample) : Infinity;
  const ratio = Number(options.spanRatio) > 0 ? Number(options.spanRatio) : 0.5;
  const box = new Float64Array(4);
  const bounds = new Float64Array(4);
  const hasBounds = typeof source.documentBounds === 'function' ? !!source.documentBounds(bounds) : false;
  let docSpan = 0;
  if (hasBounds) {
    docSpan = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  } else {
    // 没有 documentBounds 就扫一遍求并集（同一次 O(count) 扫描）
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < source.count && i < sample; i++) {
      source.boxAt(i, box);
      if (box[0] < x0) x0 = box[0];
      if (box[1] < y0) y0 = box[1];
      if (box[2] > x1) x1 = box[2];
      if (box[3] > y1) y1 = box[3];
    }
    docSpan = isFinite(x0) ? Math.max(x1 - x0, y1 - y0) : 0;
  }
  const limit = docSpan > 0 ? docSpan * ratio : Infinity;
  const offenders: Array<{ index: number; span: number; box: number[] }> = [];
  let maxSpan = 0;
  let scanned = 0;
  for (let i = 0; i < source.count && scanned < sample; i++, scanned++) {
    source.boxAt(i, box);
    const span = Math.max(box[2] - box[0], box[3] - box[1]);
    if (span > maxSpan) maxSpan = span;
    if (span > limit && offenders.length < 20) {
      offenders.push({ index: i, span: Math.round(span), box: [box[0], box[1], box[2], box[3]] });
    }
  }
  if (offenders.length) {
    console.warn(
      `[ICE] 虚拟文档自检：${offenders.length} 条图元的跨度超过文档跨度的 ${Math.round(ratio * 100)}%` +
        `（最大 ${Math.round(maxSpan)}）—— 这类盒子会让空间索引按格子数爆炸，` +
        `帧率与内存都会莫名恶化。样本：${JSON.stringify(offenders.slice(0, 3))}`
    );
  }
  return { scanned, maxSpan: Math.round(maxSpan), offenders };
}

/** 当前物化着的全部下标（调试 / 断言 / 窗口同步用）。 */
export function materializedIndices(container: any): number[] {
  const map = MATERIALIZED.get(container);
  return map ? [...map.keys()] : [];
}

/**
 * **命中 → 物化 → 重定向**（P1 的核心，2026-09-21）。
 *
 * 引擎的命中检测会命中"虚拟容器"本身（批量图元没有对象）。这里按策略把它换成**刚被点到的那一个**
 * 子项物化出来的真组件 —— 于是上层（`evt.target`、选中、控制面板、拖动）**完全不用知道虚拟化的存在**，
 * 与"点到一个普通组件"逐条同义。
 *
 * - 策略 `container`（`setVirtualHitPolicy`）：保持旧行为，返回容器本身（应用自己接管）。
 * - 同一子项重复命中：返回**第一次**物化的那个组件（幂等，不会越点越多）。
 * - `materialize` 缺失 / 返回 null：退回容器本身（不炸）。
 */
export function resolveVirtualHit(container: any): any {
  if (!container) return container;
  const source = CHILD_SOURCE.get(container);
  if (!source || typeof source.materialize !== 'function') return container;
  if (virtualHitPolicyOf(container) === 'container') return container;
  const index = virtualHitIndexOf(container);
  if (!(index >= 0)) return container;
  return materializeVirtualChild(container, index) || container;
}

// ------------------------------------------------------------------ 序列化 / 导出

/** 虚拟源工厂注册表：`documentType` → 工厂（与组件类型注册表同源思路，避免写类名）。 */
const SOURCE_FACTORIES = new Map<string, VirtualSourceFactory>();

export type VirtualSourceFactory = (
  payload: any,
  ctx: { ice: any; component: any; count: number; version: number }
) => VirtualChildSource | null;

/**
 * 注册"虚拟文档工厂"：反序列化时按容器里的 `virtual.type` 重建子源。
 *
 * ```ts
 * ice.registerVirtualSource('ied:water-doc', (payload) => WaterVirtualDoc.fromPayload(payload));
 * ```
 *
 * 重复注册同名（不同工厂）**抛错** —— 与 `registerType` 同一条纪律：静默覆盖会让
 * "谁的工厂生效"取决于加载顺序，那种 bug 只在生产上出现。
 */
export function registerVirtualSource(factoryType: string, factory: VirtualSourceFactory): void {
  if (!factoryType || typeof factoryType !== 'string') {
    throw new Error('[ICE] registerVirtualSource 的 type 必须是非空字符串');
  }
  if (typeof factory !== 'function') {
    throw new Error(`[ICE] registerVirtualSource("${factoryType}") 的工厂必须是函数`);
  }
  const prev = SOURCE_FACTORIES.get(factoryType);
  if (prev && prev !== factory) {
    throw new Error(`[ICE] registerVirtualSource("${factoryType}") 重复注册（同名不同工厂）`);
  }
  SOURCE_FACTORIES.set(factoryType, factory);
}

export function virtualSourceFactory(type: string): VirtualSourceFactory | null {
  return SOURCE_FACTORIES.get(type) || null;
}

/**
 * 序列化时取容器的"虚拟块"：`{ type, count, version, payload }`；没有子源返回 null。
 * 物化出来的子项由 Serializer 逐个带上 `virtualIndex`（见 `serializedVirtualIndexOf`）。
 */
export function virtualBlockOf(container: any): any | null {
  const source = CHILD_SOURCE.get(container);
  if (!source) return null;
  const payload = typeof source.serializeDocument === 'function' ? source.serializeDocument() : undefined;
  return {
    type: source.documentType || null,
    count: source.count,
    version: source.version,
    payload,
  };
}

/** 反序列化时把虚拟源接回去：按 `virtual.type` 找工厂，用 `payload` 重建。 */
export function restoreVirtualSource(container: any, block: any, ice: any): VirtualChildSource | null {
  if (!block || !block.type) return null;
  const factory = SOURCE_FACTORIES.get(block.type);
  if (!factory) {
    console.warn(
      `[ICE] 反序列化跳过未注册的虚拟文档类型：${block.type}` +
        `（请先 ice.registerVirtualSource('${block.type}', factory) 注册）`
    );
    return null;
  }
  const source = factory(block.payload, {
    ice,
    component: container,
    count: Number(block.count) || 0,
    version: Number(block.version) || 0,
  });
  if (source) setChildSourceFor(container, source);
  return source || null;
}

/** 物化子项在快照里的下标（Deserializer 用它把子项重新登进 `MATERIALIZED`）。 */
export function registerMaterializedChild(container: any, index: number, child: any): void {
  if (!(index >= 0)) return;
  let map = MATERIALIZED.get(container);
  if (!map) {
    map = new Map<number, any>();
    MATERIALIZED.set(container, map);
  }
  map.set(index, child);
}

/** 该组件在快照里对应的虚拟下标（有子源且确实物化过才有值；否则 -1）。 */
export function serializedVirtualIndexOf(container: any, child: any): number {
  return materializedIndexOf(container, child);
}

// ------------------------------------------------------------------ SVG 导出

/** 导出的默认 sink 实现：把内容写进 `body` / `defs`（`SvgExporter` 内部用）。 */
export function createSvgSink(body: string[], defs: string[]): VirtualSvgSink {
  return {
    raw(svg: string) {
      if (svg) body.push(svg);
    },
    define(id: string, svg: string) {
      if (id && svg) defs.push(`<g id="${id}">${svg}</g>`);
    },
    use(id: string, x: number, y: number) {
      if (id) body.push(`<use href="#${id}" x="${round2(x)}" y="${round2(y)}"/>`);
    },
  };
}

function round2(v: number): number {
  return Math.round((Number(v) || 0) * 100) / 100;
}
