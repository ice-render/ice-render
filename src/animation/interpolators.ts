/**
 * 可插值取值的**唯一判定与求值入口**：数值 / 等长数字数组 / **颜色** / 带单位数字串。
 *
 * 为什么要有颜色：`fillStyle` 从红渐变到蓝是界面里最常见的动效之一，而 canvas 只会画字符串。
 * 早先引擎一律拒绝非数值取值（避免写出 NaN 破坏矩阵），代价就是"颜色动画做不了"。
 * 这里把"哪些类型可插值、怎么插值"收敛到一个模块：校验器（`validateAnimations`）与
 * 运行时（`AnimationManager`）都用它，避免"校验通过但跑起来算错"。
 *
 * 支持的类型：
 * - `number`：线性插值；
 * - `number[]`（等长）：逐元素线性插值（矩阵/位移/缩放都走这条）；
 * - 颜色字符串：`#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa` / `rgb()` / `rgba()`（两端必须都是颜色）；
 * - 带单位数字串：`'12px'` / `'1.5em'` 等（**单位必须一致**，否则视为不可插值）。
 *
 * 注意：插值在 **sRGB 数值空间**做（与 CSS `transition` 的默认行为一致），不做 OKLab 之类感知均匀空间。
 */

export type AnimationValueKind = 'number' | 'array' | 'color' | 'length' | null;

const COLOR_HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;
const NUMBER_WITH_UNIT = /^(-?\d+(?:\.\d+)?)([a-z%]+)$/i;

/** 解析颜色字符串为 `[r, g, b, a]`（a ∈ [0,1]）；不是颜色返回 null。 */
export function parseColor(value: any): [number, number, number, number] | null {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  if (COLOR_HEX.test(text)) {
    const hex = text.slice(1);
    const short = hex.length === 3 || hex.length === 4;
    const expand = (chunk: string): number => parseInt(short ? chunk + chunk : chunk, 16);
    const r = expand(hex.slice(0, short ? 1 : 2));
    const g = expand(hex.slice(short ? 1 : 2, short ? 2 : 4));
    const b = expand(hex.slice(short ? 2 : 4, short ? 3 : 6));
    const a = hex.length === 4 || hex.length === 8 ? expand(hex.slice(short ? 3 : 6)) / 255 : 1;
    return [r, g, b, a];
  }
  const matched = COLOR_RGB.exec(text);
  if (matched) {
    const r = Math.min(255, Math.max(0, Number(matched[1])));
    const g = Math.min(255, Math.max(0, Number(matched[2])));
    const b = Math.min(255, Math.max(0, Number(matched[3])));
    const a = matched[4] === undefined ? 1 : Math.min(1, Math.max(0, Number(matched[4])));
    return [r, g, b, a];
  }
  return null;
}

/** 把 `[r,g,b,a]` 写回 `rgba(...)`（alpha 为 1 时给 `rgb(...)`，与输入形态无关，输出统一）。 */
export function formatColor(rgba: [number, number, number, number]): string {
  const r = Math.round(Math.min(255, Math.max(0, rgba[0])));
  const g = Math.round(Math.min(255, Math.max(0, rgba[1])));
  const b = Math.round(Math.min(255, Math.max(0, rgba[2])));
  const a = Math.min(1, Math.max(0, rgba[3]));
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(4))})`;
}

/** 解析带单位数字串（`'12px'` / `'1.5em'`）→ `{ number, unit }`；不是就返回 null。 */
export function parseNumberWithUnit(value: any): { number: number; unit: string } | null {
  if (typeof value !== 'string') {
    return null;
  }
  const matched = NUMBER_WITH_UNIT.exec(value.trim());
  if (!matched) {
    return null;
  }
  const amount = Number(matched[1]);
  return Number.isFinite(amount) ? { number: amount, unit: matched[2] } : null;
}

/** 取值种类（`null` = 不可插值）。 */
export function classifyValue(value: any): AnimationValueKind {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? 'number' : null;
  }
  if (Array.isArray(value) && value.length > 0) {
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) {
        return null;
      }
    }
    return 'array';
  }
  if (parseColor(value)) {
    return 'color';
  }
  if (parseNumberWithUnit(value)) {
    return 'length';
  }
  return null;
}

/** 两个取值能否互相插值（同型；数组等长；带单位数字串单位一致）。 */
export function isInterpolatable(from: any, to: any): boolean {
  const kind = classifyValue(from);
  if (kind === null || kind !== classifyValue(to)) {
    return false;
  }
  if (kind === 'array') {
    return from.length === to.length;
  }
  if (kind === 'length') {
    return parseNumberWithUnit(from)!.unit === parseNumberWithUnit(to)!.unit;
  }
  return true;
}

/**
 * 按进度 `p` 求值。不可插值时返回 `from`（调用方负责在校验阶段拦住非法配置）。
 */
export function interpolateValue(from: any, to: any, p: number): any {
  const kind = classifyValue(from);
  if (kind === 'number') {
    return (from as number) + ((to as number) - (from as number)) * p;
  }
  if (kind === 'array') {
    const out = new Array(from.length);
    for (let i = 0; i < from.length; i++) {
      out[i] = from[i] + (to[i] - from[i]) * p;
    }
    return out;
  }
  if (kind === 'color') {
    const a = parseColor(from)!;
    const b = parseColor(to)!;
    return formatColor([
      a[0] + (b[0] - a[0]) * p,
      a[1] + (b[1] - a[1]) * p,
      a[2] + (b[2] - a[2]) * p,
      a[3] + (b[3] - a[3]) * p,
    ]);
  }
  if (kind === 'length') {
    const a = parseNumberWithUnit(from)!;
    const b = parseNumberWithUnit(to)!;
    const value = a.number + (b.number - a.number) * p;
    return `${Number(value.toFixed(4))}${a.unit}`;
  }
  return from;
}
