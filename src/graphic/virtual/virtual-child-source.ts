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
   * **按需物化**（可选）：要一个真实组件（可交互 / 文字 / 图片 / 自定义子类）。
   * 返回的组件由引擎挂进本容器的 `childNodes`；`null` = 这次放弃（引擎跳过它）。
   */
  materialize?(i: number): any | null;
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
  return child;
}

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
