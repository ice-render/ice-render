/**
 * 命名主题注册的护栏 + 校验器对「应用自有 token」的态度。
 *
 * 两件事都属于「机制边界」：
 * 1. `registerTheme` 以前是裸赋值 —— 一个应用可以把内置 `dark` 静默换掉，全页面跟着变。
 *    类型注册（`registerType`）与预设注册（`registerPreset`）都会在撞名时抛错，主题这一层要对齐。
 * 2. `validateTheme` 以前把**所有**不认识的 semantic 键都判成"未知 token，引擎不会读它" ——
 *    但引擎其实会按引用解析它们（`token('app.highlight')` 是能取到值的）。
 *    这条警告把「自带词汇」这条正当路径说成了错误，还把真正的拼写错误混在一起。
 */
import {
  DEFAULT_THEME,
  DARK_THEME,
  BUILTIN_THEME_NAMES,
  registerTheme,
  getRegisteredTheme,
  listThemes,
  setTheme,
  token,
  resolveThemeValue,
  validateTheme,
} from '../../src/theme/ICETheme';

afterEach(() => {
  setTheme('default');
});

describe('命名主题注册的护栏', () => {
  it('内置主题名不可覆盖（default / dark 是引擎的基线）', () => {
    expect(() => registerTheme('default', DEFAULT_THEME)).toThrow(/内置/);
    expect(() => registerTheme('dark', DEFAULT_THEME)).toThrow(/内置/);
    // 拦住了，所以内置主题还是原来那份
    expect(getRegisteredTheme('dark').semantic.primary).toBe(DARK_THEME.semantic.primary);
    expect(BUILTIN_THEME_NAMES).toEqual(expect.arrayContaining(['default', 'dark']));
  });

  it('重复注册必须先说清楚：默认抛错，显式 overwrite 才允许', () => {
    registerTheme('app:probe-dup', DEFAULT_THEME);
    expect(() => registerTheme('app:probe-dup', DARK_THEME)).toThrow(/已注册/);
    expect(() => registerTheme('app:probe-dup', DARK_THEME, { overwrite: true })).not.toThrow();
    expect(getRegisteredTheme('app:probe-dup').semantic.primary).toBe(DARK_THEME.semantic.primary);
  });

  it('名字或主题不合法时明确抛错（不再静默忽略）', () => {
    expect(() => registerTheme('', DEFAULT_THEME)).toThrow(/主题名/);
    expect(() => registerTheme('app:probe-bad' as any, null as any)).toThrow(/主题/);
  });

  it('listThemes 始终包含内置的 default / dark', () => {
    expect(listThemes()).toEqual(expect.arrayContaining(['default', 'dark']));
  });
});

describe('校验器认得「应用自有 token」', () => {
  it('应用命名空间不再被判成"引擎不会读它"（它是能被引用解析的）', () => {
    const theme: any = { semantic: { primary: '#0D6EFD', app: { highlight: '#ff8800' } } };
    const diagnostics = validateTheme(theme);
    // 不再是 warning（那会把正常用法报成问题）
    expect(diagnostics.filter((d) => d.severity === 'warning')).toEqual([]);
    // 但也不是完全没提示：给一条 info 说明它是应用自己的词汇
    const info = diagnostics.filter((d) => d.severity === 'info');
    expect(info.map((d) => d.code)).toContain('custom-semantic-token');
    expect(info[0].path).toBe('semantic.app');

    // 关键：它真的能被引用解析（这正是不该报 warning 的原因）
    expect(resolveThemeValue(token('app.highlight'), theme)).toBe('#ff8800');
  });

  it('拼错内置 token 仍然报警告，并把候选名字指出来', () => {
    const diagnostics = validateTheme({ semantic: { primry: '#fff' } });
    const warning = diagnostics.find((d) => d.code === 'unknown-semantic-token');
    expect(warning).toBeTruthy();
    expect(warning!.severity).toBe('warning');
    expect(warning!.message).toContain('primary');
    expect(warning!.path).toBe('semantic.primry');
  });

  it('大小写 / 分隔符写错也算拼写问题，短名字少一个字母也算', () => {
    expect(validateTheme({ semantic: { BackGround: '#fff' } }).map((d) => d.code)).toContain('unknown-semantic-token');
    expect(validateTheme({ semantic: { borde: '#fff' } }).map((d) => d.code)).toContain('unknown-semantic-token');
  });

  it('只差首字母的名字不当成拼写错误（避免把应用词汇误报成问题）', () => {
    // `kind` 与内置的 `hint` 只差一个首字母，但它更像是应用自己的词汇
    const diagnostics = validateTheme({ semantic: { kind: '#fff' } });
    expect(diagnostics.map((d) => d.code)).toEqual(['custom-semantic-token']);
    expect(diagnostics[0].severity).toBe('info');
  });

  it('内置主题依旧零 error、零 warning', () => {
    expect(validateTheme(DEFAULT_THEME).filter((d) => d.severity !== 'info')).toEqual([]);
    expect(validateTheme(DARK_THEME).filter((d) => d.severity !== 'info')).toEqual([]);
  });
});
