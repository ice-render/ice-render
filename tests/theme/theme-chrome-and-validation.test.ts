/**
 * 交互外壳 token（chrome）与主题校验。
 *
 * 外壳指引擎自己画的那层：选中框 / 变换手柄 / 连线端点 / 连接插槽 / 对齐引导线 /
 * 连线标签 / 文本选区 / 阴影颜色 / 调试框。以前这层是写死在源码里的十几处色值，
 * 深色主题下不会跟着变 —— 现在收进主题，并可用 `ice.setChrome()` 单独覆盖。
 */
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
import {
  DEFAULT_THEME,
  DARK_THEME,
  token,
  resolveThemeValue,
  validateTheme,
  contrastRatio,
  registerPreset,
  unregisterPreset,
  STYLE_PRESETS,
  BUILTIN_PRESET_NAMES,
  setTheme,
} from '../../src/theme/ICETheme';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return {
    __esModule: true,
    default: { createPath2D: () => new PolyfillPath2D(), createOffscreenCanvas: () => null },
  };
});
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
};

afterEach(() => {
  setTheme('default');
});

describe('交互外壳 token', () => {
  it('默认主题带完整的 chrome 段（与历史观感一致）', () => {
    const chrome = DEFAULT_THEME.semantic.chrome;
    expect(chrome.selection.stroke).toBe('#8b0000');
    expect(chrome.handle.fill).toBe('#CC3300');
    expect(chrome.slot.fill).toBe('#3ce92c');
    expect(chrome.slot.hoverFill).toBe('#fffb00');
    expect(chrome.guide.color).toBe('#EC4899');
    expect(chrome.linkLabel.background).toBe('#ffffff');
    expect(chrome.textSelection.color).toBeTruthy();
    expect(chrome.shadow.md).toBeTruthy();
    expect(chrome.debug.minBox).toBe('#ff0000');
    expect(chrome.lineBorder).toBe('#c8c8c8');
  });

  it('深色主题给出一套协调的外壳色（与浅色不同）', () => {
    const light = DEFAULT_THEME.semantic.chrome;
    const dark = DARK_THEME.semantic.chrome;
    expect(dark.handle.fill).not.toBe(light.handle.fill);
    expect(dark.linkLabel.background).not.toBe(light.linkLabel.background);
    expect(dark.shadow.md).toBeTruthy();
  });

  it('setChrome 只覆盖外壳，不动其它语义 token', () => {
    const ice: any = new ICE();
    ice.theme = DEFAULT_THEME;
    ice.childNodes = [];
    ice.toolNodes = [];
    ice.setChrome({ handle: { fill: '#0d6efd' } as any });
    expect(ice.getTheme().semantic.chrome.handle.fill).toBe('#0d6efd');
    // 没写的字段保留
    expect(ice.getTheme().semantic.chrome.handle.stroke).toBe(DEFAULT_THEME.semantic.chrome.handle.stroke);
    // 其它语义色不受影响
    expect(ice.getTheme().semantic.primary).toBe(DEFAULT_THEME.semantic.primary);
  });

  it('外壳样式里的主题引用按实例主题解析', () => {
    const ice: any = new ICE();
    ice.theme = DARK_THEME;
    const rect = new ICERect({ style: { fillStyle: token('chrome.slot.fill') } } as any);
    rect.ice = ice;
    expect(resolveThemeValue((rect.props.style as any).fillStyle, rect.themeOf())).toBe(
      DARK_THEME.semantic.chrome.slot.fill
    );
  });

  it('连线标签默认跟随主题（深色主题下不再白底黑字）', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [10, 10],
      ],
      label: 'x',
    } as any);
    // 标签外观的规范位置是 style.label（`labelStyle` 是已弃用别名，构造时被并入）
    const style: any = line.props.style.label;
    expect(resolveThemeValue(style.fillStyle, DEFAULT_THEME)).toBe(DEFAULT_THEME.semantic.chrome.linkLabel.fill);
    expect(resolveThemeValue(style.backgroundColor, DARK_THEME)).toBe(DARK_THEME.semantic.chrome.linkLabel.background);
  });
});

describe('组件样式预设注册', () => {
  it('内置预设不能覆盖（同名不同义会让同一份配置画出不同的图）', () => {
    expect(() => registerPreset('card', () => ({ style: {} }))).toThrow(/内置预设/);
    expect(BUILTIN_PRESET_NAMES).toContain('card');
  });

  it('重复注册同一个应用层预设会抛错，显式 overwrite 才允许', () => {
    registerPreset('app:probe', (t) => ({ style: { fillStyle: t.semantic.primary } }));
    expect(() => registerPreset('app:probe', () => ({ style: {} }))).toThrow(/已注册/);
    expect(() =>
      registerPreset('app:probe', () => ({ style: { fillStyle: '#123' } }), { overwrite: true })
    ).not.toThrow();
    expect(unregisterPreset('app:probe')).toBe(true);
    expect(unregisterPreset('app:probe')).toBe(false);
    expect(unregisterPreset('card')).toBe(false); // 内置不可注销
  });

  it('STYLE_PRESETS 是只读视图：直接赋值 / 删除都抛错并指向 registerPreset', () => {
    // 旧实现里 `STYLE_PRESETS.card = fn` 能盖掉内置预设（内置挂在原型上，赋值生成同名自有属性）
    expect(() => {
      (STYLE_PRESETS as any).card = () => ({ style: {} });
    }).toThrow(/只读视图|registerPreset/);
    expect(() => {
      delete (STYLE_PRESETS as any).card;
    }).toThrow(/只读视图|unregisterPreset/);
    // 读还是照常
    expect(typeof STYLE_PRESETS.card).toBe('function');
    expect(STYLE_PRESETS.card(DEFAULT_THEME).radius).toBe(DEFAULT_THEME.base.radius.lg);
    // 注册进来的应用层预设也能读到，且 Object.keys 能看到它
    registerPreset('app:listable', () => ({ style: {} }));
    expect(Object.keys(STYLE_PRESETS)).toContain('app:listable');
    unregisterPreset('app:listable');
    expect(Object.keys(STYLE_PRESETS)).not.toContain('app:listable');
  });

  it('注册的预设能直接用在组件上', () => {
    registerPreset('app:probe', (t) => ({ radius: 2, style: { fillStyle: t.semantic.danger } }));
    const rect = new ICERect({ preset: 'app:probe' } as any);
    expect(rect.props.style.fillStyle).toBe(DEFAULT_THEME.semantic.danger);
    expect(rect.props.radius).toBe(2);
    unregisterPreset('app:probe');
    expect(STYLE_PRESETS['app:probe']).toBeUndefined();
  });
});

describe('主题校验（别让写错的主题静默生效）', () => {
  it('内置主题没有 error（对比度也都达标）', () => {
    expect(validateTheme(DEFAULT_THEME).filter((d) => d.severity === 'error')).toEqual([]);
    expect(validateTheme(DARK_THEME).filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('未知的语义 token 给警告（拼错名字最常见的形态）', () => {
    const diagnostics = validateTheme({ semantic: { primry: '#fff' } });
    expect(diagnostics.map((d) => d.code)).toContain('unknown-semantic-token');
  });

  it('颜色类型不对 / palette 为空 / motion 缺 easing 都报错', () => {
    expect(validateTheme({ semantic: { primary: 123 } }).map((d) => d.code)).toContain('invalid-color');
    expect(validateTheme({ semantic: { palette: [] } }).map((d) => d.code)).toContain('invalid-palette');
    const motion = validateTheme({ semantic: { motion: { duration: { fast: 1 } } } });
    expect(motion.map((d) => d.code)).toContain('invalid-motion');
  });

  it('对比度不足会报出来（WCAG 4.5:1）', () => {
    const diagnostics = validateTheme({ semantic: { text: '#eeeeee', background: '#ffffff' } });
    const low = diagnostics.filter((d) => d.code === 'low-contrast');
    expect(low.length).toBeGreaterThan(0);
    expect(low[0].severity).toBe('error');
  });

  it('contrastRatio 能算出黑白 21:1', () => {
    expect(Math.round(contrastRatio('#000000', '#ffffff')!)).toBe(21);
  });
});
