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
  if (style.globalAlpha !== undefined && style.globalAlpha !== 1) return false;
  if (style.globalCompositeOperation && style.globalCompositeOperation !== 'source-over') return false;
  if (style.shadow || (Number(style.shadowBlur) || 0) > 0) return false;
  for (const key of ['fillStyle', 'strokeStyle']) {
    const v = style[key];
    if (typeof v === 'string' && ALPHA_COLOR_PATTERN.test(v)) return false;
  }
  return true;
}
