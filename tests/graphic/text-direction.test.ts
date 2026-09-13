/**
 * 文本方向解析：`direction: 'auto'` → 具体 ltr/rtl，以及 `textAlign: 'start' | 'end'` 的语言相关映射。
 *
 * 这层是 i18n 边界里的「引擎原语」：词条在应用层，但方向必须由引擎落到 `ctx.direction` /
 * SVG 的 `text-anchor` 上，否则 RTL 文案在 canvas 里会排错。
 */
import { resolveTextAlign, resolveTextDirection } from '../../src/graphic/text/text-direction';

describe('resolveTextDirection', () => {
  it('显式声明直接照用', () => {
    expect(resolveTextDirection('hello', 'ltr')).toBe('ltr');
    expect(resolveTextDirection('שלום', 'ltr')).toBe('ltr'); // 显式优先，不做「智能纠正」
    expect(resolveTextDirection('hello', 'rtl')).toBe('rtl');
  });

  it('auto：按首个强方向字符判定', () => {
    expect(resolveTextDirection('hello')).toBe('ltr');
    expect(resolveTextDirection('你好，世界')).toBe('ltr'); // CJK 属 L 类，按 LTR
    expect(resolveTextDirection('שלום עולם')).toBe('rtl');
    expect(resolveTextDirection('مرحبا بالعالم')).toBe('rtl');
  });

  it('auto：跳过前导中性字符（空白 / 标点 / 数字）', () => {
    expect(resolveTextDirection('  123 "שלום"')).toBe('rtl');
    expect(resolveTextDirection('  （中文）')).toBe('ltr');
  });

  it('auto：整段没有字母（纯数字 / 标点 / 空串）按 ltr', () => {
    expect(resolveTextDirection('')).toBe('ltr');
    expect(resolveTextDirection('123 456.78')).toBe('ltr');
    expect(resolveTextDirection('——……')).toBe('ltr');
  });
});

describe('resolveTextAlign', () => {
  it('物理对齐照用', () => {
    expect(resolveTextAlign('left', 'ltr')).toBe('left');
    expect(resolveTextAlign('center', 'rtl')).toBe('center');
    expect(resolveTextAlign('right', 'ltr')).toBe('right');
    expect(resolveTextAlign(undefined, 'ltr')).toBe('left'); // 缺省与旧行为一致
  });

  it('start/end 依方向映射（rtl 下 start 在右）', () => {
    expect(resolveTextAlign('start', 'ltr')).toBe('left');
    expect(resolveTextAlign('start', 'rtl')).toBe('right');
    expect(resolveTextAlign('end', 'ltr')).toBe('right');
    expect(resolveTextAlign('end', 'rtl')).toBe('left');
  });
});
