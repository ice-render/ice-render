/**
 * 断行策略（`wordBreak`）。
 *
 * 用「每字符 10px」的确定性 measure 函数，断言断点位置而不是像素。
 */
import { clearGraphemeCache, wrapParagraph } from '../../src/graphic/text/text-wrap';

/** 每字符 10px（grapheme 数 × 10），便于精确控制断点。 */
const measure = (s: string): number => Array.from(s).length * 10;

describe('wrapParagraph', () => {
  afterEach(() => {
    clearGraphemeCache();
  });

  it('normal：拉丁词不被硬拆，整词换行（旧实现会拆成 hell/o）', () => {
    expect(wrapParagraph('hello world', 70, measure)).toEqual(['hello', 'world']);
    expect(wrapParagraph('hello world', 110, measure)).toEqual(['hello world']);
  });

  it('normal：单个词整行放不下时才硬拆（等价 overflow-wrap: break-word）', () => {
    expect(wrapParagraph('abcdefgh', 50, measure)).toEqual(['abcde', 'fgh']);
  });

  it('normal：连字符后可断行', () => {
    // 9 字符/行：`state-of-`(9) 放得下，`the-art` 换下一行
    expect(wrapParagraph('state-of-the-art', 90, measure)).toEqual(['state-of-', 'the-art']);
  });

  it('normal：CJK 逐字断行', () => {
    expect(wrapParagraph('中文测试', 20, measure)).toEqual(['中文', '测试']);
  });

  it('normal：行首禁则 —— 闭标点不孤零零跑到行首', () => {
    // 3 字/行：朴素断点是「他说好」+「」的」→ 禁则把 」 留在上一行
    expect(wrapParagraph('他说好」的', 30, measure)).toEqual(['他说好」', '的']);
  });

  it('normal：行尾禁则 —— 开标点跟着下一行走', () => {
    // 朴素断点是「他说「」+「好的」→ 行尾开括号被带到下一行
    expect(wrapParagraph('他说「好的', 30, measure)).toEqual(['他说', '「好的']);
  });

  it('normal：行尾空白不计入结果', () => {
    expect(wrapParagraph('hello   world', 80, measure)).toEqual(['hello', 'world']);
  });

  it('break-all：保留旧的逐 grapheme 贪心行为', () => {
    expect(wrapParagraph('hello', 30, measure, 'break-all')).toEqual(['hel', 'lo']);
    expect(wrapParagraph('中文测试', 20, measure, 'break-all')).toEqual(['中文', '测试']);
  });

  it('边界：空串 / 非正宽度', () => {
    expect(wrapParagraph('', 50, measure)).toEqual(['']);
    expect(wrapParagraph('hello world', 0, measure)).toEqual(['hello world']);
  });
});
