import ICERect from '../../src/graphic/shape/ICERect';
import { setTheme, getTheme, DEFAULT_THEME } from '../../src/theme/ICETheme';

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
  setTheme(DEFAULT_THEME); // 恢复默认主题，避免测试间污染
});

describe('主题机制（preset + setTheme）', () => {
  it('preset: card 补丁 merge 到 props（radius + style）', () => {
    const card = new ICERect({ preset: 'card' });
    expect(card.state.radius).toBe(12);
    expect(card.state.style.fillStyle).toBe('#ffffff');
    expect(card.state.style.strokeStyle).toBe('#e0e0e0');
    expect(card.state.style.shadow).toBe('md');
  });

  it('用户 props 覆盖 preset', () => {
    const card = new ICERect({ preset: 'card', style: { fillStyle: 'red' } });
    expect(card.state.style.fillStyle).toBe('red');
  });

  it('preset: button 用主题 primary 色', () => {
    const btn = new ICERect({ preset: 'button' });
    expect(btn.state.style.fillStyle).toBe('#185fa5'); // 默认主题 primary
  });

  it('setTheme 切换主题后，preset 跟随主题变量', () => {
    setTheme({ primary: '#ff0000' });
    const btn = new ICERect({ preset: 'button' });
    expect(btn.state.style.fillStyle).toBe('#ff0000');
  });

  it('getTheme 返回当前主题', () => {
    setTheme({ primary: '#00ff00' });
    expect(getTheme().primary).toBe('#00ff00');
    expect(getTheme().danger).toBe('#d40c0c'); // 未覆盖的字段保留默认
  });

  it('shadow 简写保留在 style（render 时展开成 4 个属性）', () => {
    const r = new ICERect({ style: { shadow: 'md' } });
    expect(r.state.style.shadow).toBe('md');
  });

  it('热切换：__reapplyPreset 按新主题重新 resolve', () => {
    const btn = new ICERect({ preset: 'button' });
    expect(btn.state.style.fillStyle).toBe('#185fa5');
    setTheme({ primary: '#ff0000' });
    (btn as any).__reapplyPreset();
    expect(btn.state.style.fillStyle).toBe('#ff0000');
  });

  it('热切换：用户显式 style 优先于 preset', () => {
    const btn = new ICERect({ preset: 'button', style: { fillStyle: 'green' } });
    expect(btn.state.style.fillStyle).toBe('green');
    setTheme({ primary: '#ff0000' });
    (btn as any).__reapplyPreset();
    expect(btn.state.style.fillStyle).toBe('green'); // 用户 green 不被 preset 覆盖
  });
});
