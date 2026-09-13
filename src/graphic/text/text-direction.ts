/**
 * 文本方向（BiDi）解析。
 *
 * 背景：i18n 的「词条」属于应用层，但**文字方向**属于排版 —— canvas 不替我们做 BiDi 重排，
 * 引擎必须把 `direction` 落到实处（`ctx.direction`），并让 `textAlign: 'start' | 'end'`
 * 有语言相关的语义（start = 阅读起点，而不是物理左边）。
 *
 * 规则（刻意保守，只做「首个强方向字符」判定，不实现完整 UAX#9 ——
 * 完整的 BiDi 段落重排应由平台/字体栈负责，这里只需要把基线方向传对）：
 * - `'ltr'` / `'rtl'`：照用；
 * - `'auto'`：跳过空白、标点、数字、符号，取**第一个字母**；落在 RTL 区段则 `'rtl'`，否则 `'ltr'`；
 *   整段没有字母（纯数字/标点）按 `'ltr'` 处理，与浏览器 `dir="auto"` 的默认行为一致。
 */

export type ICETextDirection = 'ltr' | 'rtl' | 'auto';
export type ICETextAlign = 'left' | 'center' | 'right' | 'start' | 'end';

/** 强 RTL 码点区段（希伯来 / 阿拉伯 / 叙利亚 / 他拿 / 阿拉伯补充 / 表现形式）。 */
const RTL_RANGES: Array<[number, number]> = [
  [0x0590, 0x05ff], // Hebrew
  [0x0600, 0x06ff], // Arabic
  [0x0700, 0x074f], // Syriac
  [0x0750, 0x077f], // Arabic Supplement
  [0x0780, 0x07bf], // Thaana
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0xfb1d, 0xfdff], // Hebrew/Arabic Presentation Forms-A
  [0xfe70, 0xfeff], // Arabic Presentation Forms-B
];

/** 中性字符：空白 / 标点 / 数字 / 符号 —— 判定首个强方向字符时跳过。 */
const NEUTRAL = /^[\s\p{P}\p{N}\p{S}]$/u;
/** 字母（含 CJK：CJK 属 L 类，按 LTR 处理，与浏览器一致）。 */
const LETTER = /^\p{L}$/u;

function isRtlCodePoint(cp: number): boolean {
  for (let i = 0; i < RTL_RANGES.length; i++) {
    if (cp >= RTL_RANGES[i][0] && cp <= RTL_RANGES[i][1]) return true;
  }
  return false;
}

/**
 * 把 `'auto'` 解析成具体的 `'ltr' | 'rtl'`。
 *
 * @param text 该行 / 该段文本（用首个强方向字符判定）
 * @param direction 声明方向；缺省 `'auto'`
 */
export function resolveTextDirection(text: string, direction: ICETextDirection = 'auto'): 'ltr' | 'rtl' {
  if (direction === 'ltr' || direction === 'rtl') return direction;
  const s = String(text ?? '');
  for (const ch of s) {
    if (NEUTRAL.test(ch)) continue;
    if (!LETTER.test(ch)) continue; // 既不是中性也不是字母（极少见）→ 跳过
    return isRtlCodePoint(ch.codePointAt(0) as number) ? 'rtl' : 'ltr';
  }
  return 'ltr';
}

/**
 * 把 `textAlign` 解析成物理对齐（`left` / `center` / `right`）。
 *
 * `'start'` / `'end'` 依 `direction` 映射：rtl 下 start = 右、end = 左。
 */
export function resolveTextAlign(
  textAlign: ICETextAlign | string | undefined,
  direction: 'ltr' | 'rtl'
): 'left' | 'center' | 'right' {
  switch (textAlign) {
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    case 'start':
      return direction === 'rtl' ? 'right' : 'left';
    case 'end':
      return direction === 'rtl' ? 'left' : 'right';
    case 'left':
    default:
      return 'left';
  }
}
