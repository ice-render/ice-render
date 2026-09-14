/**
 * 主题合并语义（深合并 + base token 可覆盖）。
 *
 * 这一组是**修 bug** 的回归：旧实现是浅合并，`setTheme({ motion: { duration: {...} } })`
 * 会把 `motion.easing` 整个抹掉，动画路径随后读 `motion.easing[名]` 直接抛 TypeError；
 * 而 `{ base: {...} }` 既不生效、还会以 `semantic.base` 的形式污染主题。
 */
import {
  DEFAULT_THEME,
  DARK_THEME,
  deepMerge,
  deepDiff,
  deepEqual,
  mergeThemes,
  resolveTheme,
  setTheme,
  getTheme,
  baseTokens,
} from '../../src/theme/ICETheme';
import AnimationManager from '../../src/animation/AnimationManager';

afterEach(() => {
  setTheme('default');
});

describe('主题合并：深合并', () => {
  it('部分覆盖 motion.duration 不会丢掉 easing', () => {
    const resolved = resolveTheme({ motion: { duration: { fast: 50 } } } as any, DEFAULT_THEME);
    expect(resolved.semantic.motion.duration.fast).toBe(50);
    // 没写的字段保留（旧实现这里会变成 undefined）
    expect(resolved.semantic.motion.duration.normal).toBe(DEFAULT_THEME.semantic.motion.duration.normal);
    expect(resolved.semantic.motion.easing.springSoft).toBe(DEFAULT_THEME.semantic.motion.easing.springSoft);
  });

  it('部分覆盖 motion.easing 也不会丢 duration', () => {
    const resolved = resolveTheme({ motion: { easing: { spring: 'springSnappy' } } } as any, DEFAULT_THEME);
    expect(resolved.semantic.motion.easing.spring).toBe('springSnappy');
    expect(resolved.semantic.motion.duration.fast).toBe(DEFAULT_THEME.semantic.motion.duration.fast);
  });

  it('只改 motion 之后，动画仍能解析语义名（旧实现会抛 TypeError）', () => {
    const ice: any = { theme: resolveTheme({ motion: { duration: { fast: 50 } } } as any, DEFAULT_THEME) };
    const manager: any = new AnimationManager(ice);
    const animation: any = { duration: 'fast', easing: 'springSnappy' };
    expect(() => manager.__resolveMotion(animation)).not.toThrow();
    expect(animation.duration).toBe(50);
    expect(animation.easing).toBe('springSnappy');
  });

  it('base token 可以被覆盖（旧实现里被忽略并污染 semantic.base）', () => {
    const resolved = resolveTheme({ base: { radius: { md: 6 }, fontSize: { md: 15 } } } as any, DEFAULT_THEME);
    expect(resolved.base.radius.md).toBe(6);
    expect(resolved.base.radius.lg).toBe(baseTokens.radius.lg); // 没写的保留
    expect(resolved.base.fontSize.md).toBe(15);
    expect((resolved.semantic as any).base).toBeUndefined(); // 不再污染
  });

  it('平铺 semantic 写法（历史用法）继续可用', () => {
    const resolved = resolveTheme({ primary: '#123456' }, DARK_THEME);
    expect(resolved.semantic.primary).toBe('#123456');
    expect(resolved.semantic.text).toBe(DARK_THEME.semantic.text);
    expect(resolved.semantic.palette).toEqual(DARK_THEME.semantic.palette);
  });

  it('显式 { semantic: {...} } 与平铺写法等价', () => {
    const a = resolveTheme({ primary: '#abcdef' }, DEFAULT_THEME);
    const b = resolveTheme({ semantic: { primary: '#abcdef' } }, DEFAULT_THEME);
    expect(a.semantic.primary).toBe(b.semantic.primary);
  });

  it('合并不会改动被合并的主题（不改 base）', () => {
    const before = JSON.stringify(DEFAULT_THEME.semantic.motion);
    const resolved = resolveTheme({ motion: { duration: { fast: 1 } } } as any, DEFAULT_THEME);
    expect(JSON.stringify(DEFAULT_THEME.semantic.motion)).toBe(before);
    expect(resolved).not.toBe(DEFAULT_THEME);
  });

  it('数组整体替换（palette 不会被逐项合并）', () => {
    const resolved = resolveTheme({ palette: ['#111', '#222'] }, DEFAULT_THEME);
    expect(resolved.semantic.palette).toEqual(['#111', '#222']);
  });

  it('deepMerge：undefined 不覆盖、null 覆盖、标量覆盖', () => {
    const merged: any = deepMerge({ a: 1, b: { c: 2, d: 3 }, list: [1, 2] }, { a: undefined, b: { c: 9 }, list: [3] });
    expect(merged.a).toBe(1);
    expect(merged.b).toEqual({ c: 9, d: 3 });
    expect(merged.list).toEqual([3]);
  });

  it('mergeThemes：chrome 的部分覆盖不丢其它外壳 token', () => {
    const merged = mergeThemes(DEFAULT_THEME, { semantic: { chrome: { handle: { fill: '#f00' } } } as any });
    expect(merged.semantic.chrome.handle.fill).toBe('#f00');
    expect(merged.semantic.chrome.handle.stroke).toBe(DEFAULT_THEME.semantic.chrome.handle.stroke);
    expect(merged.semantic.chrome.slot.hoverFill).toBe(DEFAULT_THEME.semantic.chrome.slot.hoverFill);
  });

  it('模块级 setTheme 支持 base + semantic 一次给全', () => {
    setTheme({ base: { radius: { md: 3 } }, semantic: { primary: '#0f0' } } as any);
    const current = getTheme();
    expect(current.base.radius.md).toBe(3);
    expect(current.semantic.primary).toBe('#0f0');
  });
});

describe('深比较与差异（快照只存改过的部分）', () => {
  it('deepEqual：数组按值比、对象键数不同即不等', () => {
    expect(deepEqual({ a: [1, 2], b: { c: 1 } }, { a: [1, 2], b: { c: 1 } })).toBe(true);
    expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual('#fff', '#fff')).toBe(true);
  });

  it('deepDiff：完全相同返回 undefined', () => {
    expect(deepDiff(DEFAULT_THEME, DEFAULT_THEME)).toBeUndefined();
    expect(deepDiff({ a: { b: 1 } }, { a: { b: 1 } })).toBeUndefined();
  });

  it('deepDiff：只给出真正不同的分支', () => {
    const target = resolveTheme({ semantic: { chrome: { handle: { fill: '#f00' } } } } as any, DEFAULT_THEME);
    const diff = deepDiff(DEFAULT_THEME, target);
    expect(diff).toEqual({ semantic: { chrome: { handle: { fill: '#f00' } } } });
  });

  it('deepDiff：数组整体替换（palette 不会被拆成逐项）', () => {
    const target = resolveTheme({ palette: ['#111', '#222'] }, DEFAULT_THEME);
    expect(deepDiff(DEFAULT_THEME, target)).toEqual({ semantic: { palette: ['#111', '#222'] } });
  });

  it('deepDiff 的结果喂回 setTheme 能还原出同一份主题（往返自洽）', () => {
    const target = resolveTheme({ primary: '#123456', base: { radius: { md: 5 } } } as any, DARK_THEME);
    const diff = deepDiff(DARK_THEME, target);
    const rebuilt = resolveTheme(diff, DARK_THEME);
    expect(rebuilt.semantic.primary).toBe('#123456');
    expect(rebuilt.base.radius.md).toBe(5);
    expect(rebuilt.semantic.motion.easing.spring).toBe(DARK_THEME.semantic.motion.easing.spring);
  });
});
