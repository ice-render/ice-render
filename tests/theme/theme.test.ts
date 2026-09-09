import ICERect from '../../src/graphic/shape/ICERect';
import AnimationManager from '../../src/animation/AnimationManager';
import { setTheme, getTheme, registerTheme, baseTokens, DEFAULT_THEME, DARK_THEME } from '../../src/theme/ICETheme';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
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
  setTheme('default'); // 恢复默认主题，避免测试间污染
});

describe('三层 token 结构（base / semantic / component）', () => {
  it('baseTokens 有颜色 ramp + spacing + radius + fontSize', () => {
    expect(baseTokens.color.blue[600]).toBe('#2563EB');
    expect(baseTokens.radius.lg).toBe(12);
    expect(baseTokens.spacing[4]).toBe(16);
    expect(baseTokens.fontSize['2xl']).toBe(24);
  });

  it('semantic 引用 base（primary = blue-500）', () => {
    expect(DEFAULT_THEME.semantic.primary).toBe(baseTokens.color.blue[500]);
    expect(DEFAULT_THEME.semantic.danger).toBe(baseTokens.color.red[500]);
  });

  it('palette 是数据系列配色数组（≥ 8 个）', () => {
    expect(DEFAULT_THEME.semantic.palette.length).toBeGreaterThanOrEqual(8);
    expect(DEFAULT_THEME.semantic.palette[0]).toBe(baseTokens.color.blue[500]);
  });

  it('motion 有时长 + 缓动 token', () => {
    expect(DEFAULT_THEME.semantic.motion.duration.normal).toBe(200);
    expect(DEFAULT_THEME.semantic.motion.easing.out).toBe('easeOutCubic');
  });
});

describe('preset（组件层）', () => {
  it('card 补丁 merge 到 props（radius + style）', () => {
    const card = new ICERect({ preset: 'card' });
    expect(card.state.radius).toBe(12);
    expect(card.state.style.fillStyle).toBe('#ffffff');
    expect(card.state.style.strokeStyle).toBe(baseTokens.color.gray[200]);
    expect(card.state.style.shadow).toBe('md');
  });

  it('用户 props 覆盖 preset', () => {
    const card = new ICERect({ preset: 'card', style: { fillStyle: 'red' } });
    expect(card.state.style.fillStyle).toBe('red');
  });

  it('button 用主题 primary 色', () => {
    const btn = new ICERect({ preset: 'button' });
    expect(btn.state.style.fillStyle).toBe('#3B82F6');
  });
});

describe('命名主题 + registerTheme', () => {
  it('setTheme(\'dark\') 切换到暗色主题', () => {
    setTheme('dark');
    expect(getTheme().semantic.background).toBe('#111827');
    expect(getTheme().semantic.text).toBe(baseTokens.color.gray[200]);
  });

  it('registerTheme 注册自定义主题后可按名切换', () => {
    registerTheme('brand', { base: baseTokens, semantic: { ...DEFAULT_THEME.semantic, primary: '#ff6600' } });
    setTheme('brand');
    const btn = new ICERect({ preset: 'button' });
    expect(btn.state.style.fillStyle).toBe('#ff6600');
  });

  it('setTheme 对象浅合并 semantic（兼容旧用法）', () => {
    setTheme({ primary: '#ff0000' });
    expect(getTheme().semantic.primary).toBe('#ff0000');
    expect(getTheme().semantic.danger).toBe(baseTokens.color.red[500]); // 未覆盖字段保留
  });
});

describe('热切换', () => {
  it('__reapplyPreset 按新主题重新 resolve', () => {
    const btn = new ICERect({ preset: 'button' });
    expect(btn.state.style.fillStyle).toBe('#3B82F6');
    setTheme({ primary: '#ff0000' });
    (btn as any).__reapplyPreset();
    expect(btn.state.style.fillStyle).toBe('#ff0000');
  });

  it('用户显式 style 优先于 preset', () => {
    const btn = new ICERect({ preset: 'button', style: { fillStyle: 'green' } });
    setTheme({ primary: '#ff0000' });
    (btn as any).__reapplyPreset();
    expect(btn.state.style.fillStyle).toBe('green');
  });
});

describe('motion token 与动画打通', () => {
  it('duration/easing 语义名 resolve 到实际值', () => {
    const mgr = new AnimationManager({} as any);
    const anim = { duration: 'normal', easing: 'out' };
    (mgr as any).__resolveMotion(anim);
    expect(anim.duration).toBe(200);
    expect(anim.easing).toBe('easeOutCubic');
  });

  it('数字 duration / Easing 方法名 原样保留（向后兼容）', () => {
    const mgr = new AnimationManager({} as any);
    const anim = { duration: 500, easing: 'easeInOutCubic' };
    (mgr as any).__resolveMotion(anim);
    expect(anim.duration).toBe(500);
    expect(anim.easing).toBe('easeInOutCubic');
  });

  it('duration/easing 语义名跟随主题切换', () => {
    setTheme({ motion: { ...getTheme().semantic.motion, duration: { fast: 50, normal: 150, slow: 400, slower: 900 } } });
    const mgr = new AnimationManager({} as any);
    const anim = { duration: 'normal', easing: 'out' };
    (mgr as any).__resolveMotion(anim);
    expect(anim.duration).toBe(150); // 主题覆盖后 normal=150
  });
});
