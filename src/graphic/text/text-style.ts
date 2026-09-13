/**
 * 文本排版属性的解析（`lineHeight` / `letterSpacing`）。
 *
 * 为什么单独抽一个模块：这两项**必须在四处保持同一口径** —— 量测（盒子宽高）、换行（断行宽度）、
 * 渲染（ctx + 自绘装饰线）、SVG 导出。任何一处各自 `parseFloat` 都会漂移，表现为
 * 「屏幕上有字间距、盒子宽度却不含间距」（`letterSpacing` 原先只是透传给 ctx，就是这个毛病）。
 *
 * 语义约定（与 CSS 对齐，避免「数字到底是 px 还是倍数」的歧义）：
 * - `letterSpacing`：数字 = **px**；字符串支持 `'2px'` / `'0.2em'`（相对字号）/ `'20%'`（相对字号）。
 * - `lineHeight`：数字 = **px**；字符串支持 `'2'`（无单位 = **倍数**）/ `'40px'` / `'1.5em'` / `'150%'`；
 *   `0` / 空 / `'normal'` = 未配置，走引擎默认（`max(墨迹高, 字号 × 1.35)`）。
 */

const LENGTH_PATTERN = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/;

/** `letterSpacing` → px（相对字号单位按 fontSize 折算）。无法解析时按 0（与 CSS 的容错一致）。 */
export function resolveLetterSpacingPx(value: any, fontSize: number): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const matched = LENGTH_PATTERN.exec(String(value).trim());
  if (!matched) {
    return 0;
  }
  const amount = parseFloat(matched[1]);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  const unit = matched[2];
  if (unit === 'em' || unit === 'rem') {
    return amount * fontSize;
  }
  if (unit === '%') {
    return (amount / 100) * fontSize;
  }
  return amount; // 无单位 / px
}

/** `letterSpacing` → 可以直接写进 `ctx.letterSpacing` / SVG `letter-spacing` 的 CSS 值。 */
export function resolveLetterSpacingCss(value: any, fontSize: number): string {
  return `${resolveLetterSpacingPx(value, fontSize)}px`;
}

/**
 * `lineHeight` → **每一行的行高**（px）。
 *
 * @returns `null` 表示「调用方没有配置」——由调用方决定默认行高（见 `ICEText.LINE_HEIGHT_RATIO`）。
 */
export function resolveLineHeightPx(value: any, fontSize: number): number | null {
  if (value === undefined || value === null || value === '' || value === 'normal') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const matched = LENGTH_PATTERN.exec(String(value).trim());
  if (!matched) {
    return null;
  }
  const amount = parseFloat(matched[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const unit = matched[2];
  if (unit === 'em' || unit === 'rem') {
    return amount * fontSize;
  }
  if (unit === '%') {
    return (amount / 100) * fontSize;
  }
  if (unit === undefined) {
    // 无单位 = 倍数（CSS `line-height: 2` 的语义）
    return amount * fontSize;
  }
  return amount; // px
}

/** 文本装饰线的取值（空格分隔可组合，如 `'underline line-through'`）。 */
export const TEXT_DECORATIONS = ['underline', 'line-through', 'overline'] as const;

export function resolveTextDecorations(value: any): string[] {
  if (!value || value === 'none') {
    return [];
  }
  const parts = String(value)
    .split(/\s+/)
    .filter((part) => (TEXT_DECORATIONS as readonly string[]).includes(part));
  return parts;
}
