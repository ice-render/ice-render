/**
 * 自动换行的断行策略（纯函数，便于单测）。
 *
 * 背景：i18n 的「词条」在应用层，但**断行规则**属于排版：
 * - 旧实现是「逐 grapheme 贪心」——拉丁词会被硬拆（"hello" 会被拆成 "hell" / "o"）；
 * - CJK 可以在任意字之间断，但有**禁则**：行首不能是闭标点（`、。，）」`…），行尾不能是开标点（`（「`…）。
 *
 * 两种策略（`ICEText` 的 `wordBreak`）：
 * - `'normal'`（默认）：优先在**词边界**断行（空白 / 连字符 / CJK 字间）；单个词整行放不下时才硬拆
 *   （等价于 CSS `overflow-wrap: break-word`）；并做 CJK 禁则调整。
 * - `'break-all'`：保留旧的「逐 grapheme 贪心」，留给需要等宽硬断的场景（代码、艺术字）。
 *
 * 这里只处理**段内**换行；`\n` 由调用方先切段。不做任何文本规范化（i18n 词条必须原样保留）。
 */

export type ICEWordBreak = 'normal' | 'break-all';

/** 行首禁则：这些字符不能出现在行首 —— 断行点正好落在它前面时，把它留在上一行（允许轻微溢出）。 */
const NO_LINE_START = new Set([
  '、',
  '。',
  '，',
  '．',
  '；',
  '：',
  '？',
  '！',
  '）',
  '］',
  '｝',
  '〉',
  '》',
  '」',
  '』',
  '】',
  '〕',
  '〗',
  '”',
  '’',
  '·',
  '…',
  '—',
  'ー',
  '々',
  'ぁ',
  'ぃ',
  'ぅ',
  'ぇ',
  'ぉ',
  'っ',
  'ゃ',
  'ゅ',
  'ょ',
  'ゎ',
  'ァ',
  'ィ',
  'ゥ',
  'ェ',
  'ォ',
  'ッ',
  'ャ',
  'ュ',
  'ョ',
  'ヮ',
]);

/** 行尾禁则：这些字符不能出现在行尾 —— 断行时把它带到下一行。 */
const NO_LINE_END = new Set(['（', '［', '｛', '〈', '《', '「', '『', '【', '〔', '〖', '“', '‘']);

/** 空白（含不换行空格）：连续空白视作一个「空格单元」，断行时丢弃行尾空白。 */
const SPACE = /^[\s\u00a0]$/u;
/** 词字符：字母 / 数字 / 组合记号。拉丁词靠它聚成一个整体，避免被硬拆。 */
const WORD_CHAR = /^[\p{L}\p{N}\p{M}]$/u;
/** 连字符类：允许在它后面断行（`state-of-the-art`）。 */
const HYPHEN = /^[-\u2010\u2011\u2012\u2013\u2014]$/u;
/** CJK / 假名 / 全角标点：逐字断行（不进「词」单元）。 */
const CJK = /[\u2e80-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u;

const graphemeCache = new Map<string, string[]>();

/** 按 grapheme cluster 切分（与 ICEText 同一口径）。带小缓存，避免重复切分同一段文本。 */
export function splitGraphemes(s: string, intl: any = typeof Intl !== 'undefined' ? Intl : undefined): string[] {
  const cached = graphemeCache.get(s);
  if (cached) return cached;
  let out: string[];
  if (intl && typeof intl.Segmenter === 'function') {
    try {
      const seg = new intl.Segmenter(undefined, { granularity: 'grapheme' });
      out = [];
      for (const part of seg.segment(s)) {
        out.push(part.segment);
      }
    } catch (err) {
      out = Array.from(s);
    }
  } else {
    out = Array.from(s);
  }
  if (graphemeCache.size > 500) graphemeCache.clear();
  graphemeCache.set(s, out);
  return out;
}

/** 测试用：清空 grapheme 缓存。 */
export function clearGraphemeCache(): void {
  graphemeCache.clear();
}

function firstGrapheme(s: string): string {
  const gs = splitGraphemes(s);
  return gs[0] || '';
}

function lastGrapheme(s: string): string {
  const gs = splitGraphemes(s);
  return gs[gs.length - 1] || '';
}

/**
 * 把一段文本切成「断行单元」：
 * - 连续的词字符（拉丁字母 / 数字）算一个单元；连字符若后面还跟着词字符，一并归入前一个单元；
 * - CJK 字符各自成一个单元（逐字可断）；
 * - 空白连续段算一个单元；其余符号各自成一个单元。
 */
function toUnits(graphemes: string[]): string[] {
  const units: string[] = [];
  let word = '';
  const flushWord = () => {
    if (word) {
      units.push(word);
      word = '';
    }
  };

  for (let i = 0; i < graphemes.length; i++) {
    const g = graphemes[i];
    if (WORD_CHAR.test(g) && !CJK.test(g)) {
      word += g;
      continue;
    }
    if (HYPHEN.test(g) && word && i + 1 < graphemes.length && WORD_CHAR.test(graphemes[i + 1])) {
      // 连字符**终结**当前单元（断行点在它之后）：`state-of-the-art` → `state-` | `of-` | `the-` | `art`
      units.push(word + g);
      word = '';
      continue;
    }
    flushWord();
    if (SPACE.test(g)) {
      let spaces = g;
      while (i + 1 < graphemes.length && SPACE.test(graphemes[i + 1])) {
        spaces += graphemes[++i];
      }
      units.push(spaces);
      continue;
    }
    units.push(g);
  }
  flushWord();
  return units;
}

/** 旧行为：逐 grapheme 贪心。 */
function greedyWrap(graphemes: string[], maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  let line = '';
  for (let i = 0; i < graphemes.length; i++) {
    const next = line + graphemes[i];
    if (line !== '' && measure(next) > maxWidth) {
      out.push(line);
      line = graphemes[i];
    } else {
      line = next;
    }
  }
  out.push(line);
  return out;
}

/** 单个放不下的单元逐 grapheme 硬拆；已满的行推进 `out`，返回最后一行。 */
function hardBreak(unit: string, maxWidth: number, measure: (s: string) => number, out: string[]): string {
  const gs = splitGraphemes(unit);
  let line = '';
  for (let i = 0; i < gs.length; i++) {
    const next = line + gs[i];
    if (line !== '' && measure(next) > maxWidth) {
      out.push(line);
      line = gs[i];
    } else {
      line = next;
    }
  }
  return line;
}

/**
 * 对**单个段落**（不含 `\n`）做换行，返回行数组（至少一行）。
 *
 * @param maxWidth 可用宽度（必须 > 0，否则原样返回一段）
 * @param measure 测宽函数（调用方保证已设置字体）
 */
export function wrapParagraph(
  paragraph: string,
  maxWidth: number,
  measure: (s: string) => number,
  wordBreak: ICEWordBreak = 'normal',
  intl?: any
): string[] {
  const gs = splitGraphemes(paragraph, intl);
  if (!(maxWidth > 0)) return [paragraph];
  if (wordBreak === 'break-all') return greedyWrap(gs, maxWidth, measure);

  const units = toUnits(gs);
  const out: string[] = [];
  let line = '';

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];

    if (line !== '' && measure(line + unit) > maxWidth) {
      // ① 行首禁则：下一个单元以闭标点开头 → 留在本行（宁可轻微溢出，也别让标点孤零零跑到行首）
      if (NO_LINE_START.has(firstGrapheme(unit))) {
        line += unit;
        continue;
      }
      // ② 行尾禁则：本行末尾是开标点 → 把它带到下一行
      const trailing = lastGrapheme(line);
      let carry = '';
      if (NO_LINE_END.has(trailing)) {
        carry = trailing;
        line = line.slice(0, line.length - trailing.length);
      }
      out.push(line.replace(/\s+$/u, '')); // 行尾空白不计入宽度
      line = carry + unit;
      continue;
    }

    if (line === '' && measure(unit) > maxWidth) {
      // ③ 单个单元整行放不下（超长词）→ 硬拆
      line = hardBreak(unit, maxWidth, measure, out);
      continue;
    }

    line += unit;
  }

  out.push(line.replace(/\s+$/u, ''));
  return out.length ? out : [''];
}
