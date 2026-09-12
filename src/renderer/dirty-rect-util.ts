/**
 * 脏矩形局部重绘（dirty-rect）的纯函数工具集。
 *
 * 本模块不依赖任何引擎实例/ctx，所有几何与阈值计算都可用 jest 直接单测。
 * 设计目标见 docs/architecture/04-rendering-performance.md「脏矩形局部重绘」章节。
 *
 * 盒的表示：一维数组 [minX, minY, maxX, maxY]（世界/画布坐标，轴对齐，已含 paint pad）。
 */

/** 抗锯齿兜底余量（px），覆盖 1px 级 AA 溢出与文字 baseline 溢出。 */
export const PAD_AA = 2;

/**
 * 命中预筛的包围盒容差（px）。
 *
 * 命中的第一道筛子用「渲染快照的世界盒」做 O(1) 拒绝；快照盒本身已含 paint pad
 * （含 AA 余量），但折线的命中判定自带 errorRange 容差，这里再放宽 1px 作为安全余量，
 * 确保预筛绝不误杀边界命中。
 */
export const HIT_BOX_TOLERANCE = 1;

/** 阴影简写 → 阴影外扩量（shadowBlur + max(|offsetX|,|offsetY|)），与 ICEComponent.SHADOW_PRESETS 数值一致。 */
const SHADOW_PAD = { sm: 4 + 1, md: 10 + 3, lg: 20 + 6 };

/**
 * 计算组件「实际绘制会溢出几何边界多少像素」的保守 padding。
 * 依据 state（style.lineWidth / lineBorderWidth / shadow 等）实时估算，
 * 用于把几何包围盒扩成「真实落墨盒」。
 */
export function stylePaintPad(state: any): number {
  const style = (state && state.style) || {};
  let pad = PAD_AA;

  // 描边 / 蚂蚁线管壁：以线宽（保守取整条线宽）外扩。
  const lineWidth = Number(style.lineWidth) || 0;
  const borderWidth = Number(state.lineBorderWidth) || 0;
  const strokePad = Math.ceil(Math.max(lineWidth, borderWidth));
  if (strokePad > 0) pad += strokePad;

  // 阴影：显式数值优先；style.shadow 简写映射到简写档。
  const shadowBlur = Number(style.shadowBlur);
  if (shadowBlur > 0) {
    pad +=
      shadowBlur + Math.max(Math.abs(Number(style.shadowOffsetX) || 0), Math.abs(Number(style.shadowOffsetY) || 0));
  } else if (typeof style.shadow === 'string' && SHADOW_PAD[style.shadow]) {
    pad += SHADOW_PAD[style.shadow];
  }
  return pad;
}

export function boxWidth(box: number[]): number {
  return box[2] - box[0];
}
export function boxHeight(box: number[]): number {
  return box[3] - box[1];
}
export function boxArea(box: number[]): number {
  return boxWidth(box) * boxHeight(box);
}

/**
 * 把 src 盒并进 target 盒（原地修改 target，减少分配）。
 * target 传入空盒（[Infinity,Infinity,-Infinity,-Infinity]）即可从 src 开始累加。
 */
export function unionBoxes(target: number[], src: number[]): number[] {
  if (src[0] < target[0]) target[0] = src[0];
  if (src[1] < target[1]) target[1] = src[1];
  if (src[2] > target[2]) target[2] = src[2];
  if (src[3] > target[3]) target[3] = src[3];
  return target;
}

/** 判断盒 a 与盒 b 是否相交（含边界相触）。 */
export function intersects(a: number[], b: number[]): boolean {
  return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
}

/**
 * 盒内是否有限（无 NaN/Infinity）。非法盒不得参与区域计算或写入快照。
 */
export function isFiniteBox(box: number[]): boolean {
  return isFinite(box[0]) && isFinite(box[1]) && isFinite(box[2]) && isFinite(box[3]);
}

/**
 * 生成一个「空盒」，可用作 unionBoxes 的起点。
 */
export function emptyBox(): number[] {
  return [Infinity, Infinity, -Infinity, -Infinity];
}

/**
 * 把盒外扩到整像素边界（min 向下取整、max 向上取整），保证 clearRect/clip 用同一像素掩码，
 * 消除「清除区域与裁剪区域亚像素不一致」导致的接缝。
 */
export function integerAlign(box: number[]): number[] {
  box[0] = Math.floor(box[0]);
  box[1] = Math.floor(box[1]);
  box[2] = Math.ceil(box[2]);
  box[3] = Math.ceil(box[3]);
  return box;
}

/**
 * 合并两个盒为一个盒（取并集，不修改入参）。
 */
export function mergeBox(a: number[], b: number[]): number[] {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/**
 * 把一组脏盒聚合成若干块**互不相接**的裁剪区。
 *
 * 为什么不是并成一个盒：脏组件常是分散的（多选拖拽、布局重排、若干条独立动画），
 * 一个并集大盒会把中间大片干净区域一起圈进来，很容易撞上「脏区面积占比」阈值
 * 从而回退全量 —— 局部重绘的收益被吃掉。多块裁剪区让每块都贴近真实脏区。
 *
 * 策略：
 * 1. 贪心合并 —— 与已有区相交/相接**且合并划算**的盒并进去；合并会改变相邻关系，故迭代到收敛；
 * 2. 区数超 `maxRegions` 时，反复合并「并集面积增量最小」的两块（只合并划算的）。
 *    `maxRegions` 是**软上限**：没有划算的合并时就多留几块（多跑几遍便宜的 AABB 过滤，
 *    好过把脏区撑成整屏）；区数超过 `MAX_REGIONS_HARD` 时塌缩成一个并集盒，
 *    让面积阈值去回退全量。
 *
 * ## 「合并划算」护栏（`isWorthMerging`，2026-09-11 加）
 *
 * 只按「相交就合并」会把**细长盒串联**：编辑器里拖动一个实体时，8 条横跨画布的关系连线
 * 旧/新盒互相交叉，22 个脏盒会被串成一个**整屏大盒**（实测面积占画布 1.004），
 * 于是永远撞上「脏区面积占比 > 0.35 回退全量」——局部重绘在该编辑器里 100% 失效，
 * 而 22 个盒的**实际面积之和只有画布的 6%**。
 * 护栏用「合并后面积 ≤ 两块面积之和 × 2」把这类无意义的合并挡掉，同时不影响
 * 相邻 / 嵌套 / 同向延展的正常合并（它们的比值 ≈ 1.0~1.3）。
 *
 * 返回值保证两两不相接（可安全地按块分别 clearRect + clip）。
 */
/**
 * 合并两块时允许的**面积增长倍数**上限（见 `coalesceRegions` 的护栏说明）。
 *
 * 2 的含义：合并后的盒最多只能比「两块之和」大一倍（即至少一半面积是真脏的）。
 * 相邻/嵌套/同向延展的正常脏盒合并后 ≈ 1.0~1.3，远在阈值内；
 * 而两条互相交叉的细长连线合并后能到 10 倍以上 —— 那种合并必须拒绝。
 */
const MAX_MERGE_AREA_GROWTH = 2;

/**
 * 区数的**硬上限**。`maxRegions`（默认 6）是「尽量做到」的目标，不是硬闸门：
 * 当已经没有划算的合并时，多留几块区只是多跑几遍「组件 ↔ 区域」的 AABB 过滤
 *（每遍 O(组件数)，很便宜），而强行合并会把脏区撑成整屏、白扔掉局部重绘。
 * 但区数必须仍然有界 —— 超过本上限就直接塌缩成一个并集盒，交给面积阈值回退全量。
 */
const MAX_REGIONS_HARD = 24;

/** 合并两块是否「划算」：不会把大片干净区域圈进来。 */
function isWorthMerging(a: number[], b: number[]): boolean {
  const sum = boxArea(a) + boxArea(b);
  if (sum <= 0) return true;
  return boxArea(mergeBox(a, b)) <= sum * MAX_MERGE_AREA_GROWTH;
}

export function coalesceRegions(boxes: number[][], maxRegions = 6): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!isFiniteBox(b)) continue;
    let merged = false;
    for (let j = 0; j < out.length; j++) {
      if (intersects(out[j], b) && isWorthMerging(out[j], b)) {
        out[j] = mergeBox(out[j], b);
        merged = true;
        break;
      }
    }
    if (!merged) out.push([b[0], b[1], b[2], b[3]]);
  }

  // 合并后可能产生新的相接关系，迭代到收敛（通常 1~2 轮）
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (intersects(out[i], out[j]) && isWorthMerging(out[i], out[j])) {
          out[i] = mergeBox(out[i], out[j]);
          out.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
  }

  // 区数超上限：合并「并集面积增量最小」的两块。**优先挑划算的合并**（同样受护栏约束），
  // 只有在所有配对都不划算时才退而求其次 —— 否则上限这道闸门会把刚被护栏挡住的
  // 「细长盒串成一整块」又放进来。
  while (out.length > maxRegions) {
    let bi = 0;
    let bj = 1;
    let best = Infinity;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const cost = boxArea(mergeBox(out[i], out[j])) - boxArea(out[i]) - boxArea(out[j]);
        if (isWorthMerging(out[i], out[j]) && cost < best) {
          best = cost;
          bi = i;
          bj = j;
        }
      }
    }
    if (best === Infinity) {
      // 已经没有划算的合并了：细长盒再合只会把大片干净区圈进来。此时宁可多留几块。
      if (out.length > MAX_REGIONS_HARD) {
        // 但区数必须仍然有界：塌缩成一个并集盒，让面积阈值去回退全量（保持既有保守行为）。
        const union = out.reduce(
          (acc: number[], b: number[]) => mergeBox(acc, b),
          [Infinity, Infinity, -Infinity, -Infinity]
        );
        return [union];
      }
      break;
    }
    out[bi] = mergeBox(out[bi], out[bj]);
    out.splice(bj, 1);
  }
  return out;
}

/**
 * 多块裁剪区的总面积占画布的比例（用于「接近整屏则回退全量」的判定）。
 * 各块互不相接，面积可直接相加。
 */
export function regionsAreaRatio(regions: number[][], canvasWidth: number, canvasHeight: number): number {
  if (!canvasWidth || !canvasHeight) return 1;
  let area = 0;
  for (let i = 0; i < regions.length; i++) {
    area += boxArea(regions[i]);
  }
  return area / (canvasWidth * canvasHeight);
}

/**
 * 把「世界坐标盒」映射到「渲染坐标盒」（含 dpr），并向外取整。
 *
 * 渲染坐标 = 世界坐标 × 渲染视口 scale + 渲染视口 tx/ty，而 `ICE.getRenderViewport()` 已经
 * 把 dpr 乘进 scale 与 tx/ty（见 `ICE.getRenderViewport`）。`clearRect` / `clip` 用的正是这个
 * 坐标系，但脏区收集是在**世界坐标**里做的（上屏快照盒、组件几何盒都是世界盒），
 * 两者只在「视口为单位变换且 dpr === 1」时才重合 —— 这个函数就是它们之间唯一的换算点。
 *
 * 向外取整（min 向下、max 向上）保证映射后的区域不小于真实脏区，避免缩放时边缘出现接缝。
 */
export function mapBoxToRender(
  box: number[],
  viewport: { scale: number; tx: number; ty: number },
  out?: number[]
): number[] {
  const o = out || [0, 0, 0, 0];
  o[0] = Math.floor(box[0] * viewport.scale + viewport.tx);
  o[1] = Math.floor(box[1] * viewport.scale + viewport.ty);
  o[2] = Math.ceil(box[2] * viewport.scale + viewport.tx);
  o[3] = Math.ceil(box[3] * viewport.scale + viewport.ty);
  return o;
}

/**
 * 区域占画布总面积的比例，用于「接近整屏则回退全量」的判定。
 */
export function regionRatio(box: number[], canvasWidth: number, canvasHeight: number): number {
  if (!canvasWidth || !canvasHeight) return 1;
  return boxArea(box) / (canvasWidth * canvasHeight);
}

const ALPHA_COLOR_PATTERN = /(rgba|hsla)\(|transparent|#[0-9a-fA-F]{8}|opacity/i;

/**
 * 判断组件是否以「完全不透明、仅 source-over」的方式绘制。
 *
 * dirty-rect 用 clip 把补画限定在脏区域内；clip 边界与「半透明落墨（alpha 色 / 阴影 /
 * globalAlpha / 合成模式）」相交时，canvas 的 clip 会改变边界像素的子像素覆盖率，
 * 产生与全量渲染不一致的接缝。因此 v1 约定：本帧区域涉及任何非不透明落墨的组件时回退全量，
 * 局部重绘只服务于不透明场景（编辑器里的大多数实体/卡片/表格）。
 * 语义化渐变色（对象）视为不透明。
 */
export function isOpaqueDrawing(state: any): boolean {
  const style = (state && state.style) || {};
  // 子树不透明度（opacity）≠ 1 时整棵子树都可能半透明
  if (state && state.opacity !== undefined && state.opacity !== 1) return false;
  if (style.globalAlpha !== undefined && style.globalAlpha !== 1) return false;
  if (style.globalCompositeOperation && style.globalCompositeOperation !== 'source-over') return false;
  if (style.shadow || (Number(style.shadowBlur) || 0) > 0) return false;
  for (const key of ['fillStyle', 'strokeStyle']) {
    const v = style[key];
    if (typeof v === 'string' && ALPHA_COLOR_PATTERN.test(v)) return false;
  }
  return true;
}
