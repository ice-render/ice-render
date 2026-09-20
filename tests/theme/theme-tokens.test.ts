/**
 * 主题引用（style 里的 token）：**paint 时解析**，因此任意组件都能跟随 setTheme 热切换。
 *
 * 旧实现里样式颜色是构造时写死的字面量，只有用 preset 的组件才跟主题走 ——
 * 这条测试锁的就是「自定义组件也能跟随主题」这个能力。
 */
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import {
  token,
  palette,
  isTokenRef,
  resolveThemeValue,
  tokenValue,
  setTheme,
  DEFAULT_THEME,
  getTheme,
} from '../../src/theme/ICETheme';

jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
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

/** 只测样式解析，不需要真渲染：给一个最小 ctx，直接调样式应用。 */
function fakeCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  } as any;
}

function paint(component: any, ctx = fakeCtx()) {
  component.ctx = ctx;
  (component as any).applyStyleToCtx();
  return ctx;
}

describe('主题引用：解析', () => {
  it('token() / palette() / 字符串简写都认', () => {
    expect(isTokenRef(token('primary'))).toBe(true);
    expect(isTokenRef('$primary')).toBe(true);
    expect(isTokenRef('#fff')).toBe(false);
    expect(tokenValue('primary', DEFAULT_THEME)).toBe(DEFAULT_THEME.semantic.primary);
    expect(tokenValue('palette.2', DEFAULT_THEME)).toBe(DEFAULT_THEME.semantic.palette[2]);
    expect(tokenValue('chrome.handle.fill', DEFAULT_THEME)).toBe(DEFAULT_THEME.semantic.chrome.handle.fill);
    expect(tokenValue('base.radius.md', DEFAULT_THEME)).toBe(DEFAULT_THEME.base.radius.md);
    expect(resolveThemeValue(palette(1), DEFAULT_THEME)).toBe(DEFAULT_THEME.semantic.palette[1]);
    expect(resolveThemeValue('$text', DEFAULT_THEME)).toBe(DEFAULT_THEME.semantic.text);
  });

  it('拼错的 token 名解析成 undefined（能被拆出来报错，而不是静默变成黑）', () => {
    expect(tokenValue('primry', DEFAULT_THEME)).toBeUndefined();
    expect(resolveThemeValue(token('primry'), DEFAULT_THEME)).toBeUndefined();
  });
});

describe('主题引用：paint 时解析成真颜色', () => {
  it('style 里的引用在应用样式时被解析', () => {
    const rect = new ICERect({ style: { fillStyle: token('primary'), strokeStyle: '$border' } } as any);
    const ctx = paint(rect);
    expect(ctx.fillStyle).toBe(DEFAULT_THEME.semantic.primary);
    expect(ctx.strokeStyle).toBe(DEFAULT_THEME.semantic.border);
  });

  it('setTheme 之后重新绘制就换色（不用重建组件）', () => {
    const rect = new ICERect({ style: { fillStyle: token('primary') } } as any);
    const before = paint(rect).fillStyle;
    setTheme({ primary: '#ff0000' });
    const after = paint(rect).fillStyle;
    expect(after).toBe('#ff0000');
    expect(after).not.toBe(before);
  });

  it('token 名写错时保留 ctx 原值（不会把画布涂成 undefined）', () => {
    const rect = new ICERect({ style: { fillStyle: token('primry') } } as any);
    const ctx = fakeCtx();
    ctx.fillStyle = '#abcdef';
    paint(rect, ctx);
    expect(ctx.fillStyle).toBe('#abcdef');
  });

  it('渐变的 stops 里也能用主题引用', () => {
    const rect = new ICERect({
      style: {
        fillGradient: {
          type: 'linear',
          from: [0, 0],
          to: [0, 100],
          stops: [
            [0, token('primary')],
            [1, '$background'],
          ],
        },
      },
    } as any);
    const ctx = fakeCtx();
    const stops: any[] = [];
    ctx.createLinearGradient = () => ({ addColorStop: (at: number, color: string) => stops.push([at, color]) });
    paint(rect, ctx);
    expect(stops[0][1]).toBe(DEFAULT_THEME.semantic.primary);
    expect(stops[1][1]).toBe(DEFAULT_THEME.semantic.background);
  });

  it('shadow 简写的颜色来自主题，模糊/偏移仍由引擎决定', () => {
    const rect = new ICERect({ style: { shadow: 'md' } } as any);
    const ctx = paint(rect);
    expect(ctx.shadowColor).toBe(DEFAULT_THEME.semantic.chrome.shadow.md);
    expect(ctx.shadowBlur).toBeGreaterThan(0);
  });
});

describe('交互状态样式', () => {
  const make = () =>
    new ICERect({
      style: { fillStyle: '#111111', lineWidth: 1 },
      states: {
        hover: { fillStyle: '#222222' },
        active: { fillStyle: '#333333' },
        selected: { strokeStyle: '#444444', lineWidth: 2 },
        disabled: { globalAlpha: 0.3 },
      },
    } as any);

  it('没有状态时用基础样式', () => {
    const rect = make();
    const ctx = paint(rect);
    expect(ctx.fillStyle).toBe('#111111');
    expect(ctx.lineWidth).toBe(1);
  });

  it('进入状态后叠加对应补丁', () => {
    const rect = make();
    rect.setInteractionState('hover', true);
    expect(paint(rect).fillStyle).toBe('#222222');

    rect.setInteractionState('hover', false);
    expect(paint(rect).fillStyle).toBe('#111111');
  });

  it('优先级：disabled > selected > active > hover > focus', () => {
    const rect = make();
    rect.setInteractionState('hover', true);
    rect.setInteractionState('active', true);
    expect(paint(rect).fillStyle).toBe('#333333'); // active 压 hover

    rect.setInteractionState('selected', true);
    expect(paint(rect).lineWidth).toBe(2); // selected 的补丁也在
    expect(paint(rect).strokeStyle).toBe('#444444');

    rect.setInteractionState('disabled', true);
    expect(paint(rect).globalAlpha).toBe(0.3); // disabled 压一切
  });

  it('状态样式也支持主题引用（hover 用 primary 这类写法）', () => {
    const rect = new ICERect({ states: { hover: { fillStyle: token('primary') } } } as any);
    rect.setInteractionState('hover', true);
    expect(paint(rect).fillStyle).toBe(DEFAULT_THEME.semantic.primary);
    setTheme({ primary: '#00ff00' });
    expect(paint(rect).fillStyle).toBe('#00ff00');
  });

  it('状态样式压过运行时 state.style（hover 反馈不会被基础样式盖掉）', () => {
    const rect = new ICERect({ style: { fillStyle: '#111111' }, states: { hover: { fillStyle: '#999999' } } } as any);
    rect.setState({ style: { fillStyle: '#121212' } });
    expect(paint(rect).fillStyle).toBe('#121212'); // 无状态时用运行时值
    rect.setInteractionState('hover', true);
    expect(paint(rect).fillStyle).toBe('#999999'); // 有状态时状态优先
  });

  it('设置状态会标脏（渲染器才知道要重画）', () => {
    const rect = make();
    rect.dirty = false;
    rect.setInteractionState('hover', true);
    expect(rect.dirty).toBe(true);
  });

  it('clearInteractionStates 一次清空', () => {
    const rect = make();
    rect.setInteractionState('hover', true);
    rect.setInteractionState('selected', true);
    rect.clearInteractionStates();
    expect(rect.getInteractionState('hover')).toBe(false);
    expect(paint(rect).fillStyle).toBe('#111111');
  });
});

describe('主题作用域（子树级主题）', () => {
  it('Group 上的 theme 补丁对后代生效，最近的一层优先', () => {
    const outer = new ICEGroup({ theme: { primary: '#111111' } } as any);
    const inner = new ICEGroup({ theme: { primary: '#222222' } } as any);
    const leaf = new ICERect({ style: { fillStyle: token('primary') } } as any);
    outer.addChild(inner);
    inner.addChild(leaf);

    expect(leaf.themeOf().semantic.primary).toBe('#222222');
    expect(inner.themeOf().semantic.primary).toBe('#222222');
    expect(outer.themeOf().semantic.primary).toBe('#111111');
    expect(paint(leaf).fillStyle).toBe('#222222');
  });

  it('作用域补丁不泄漏到兄弟节点', () => {
    const root = new ICEGroup({} as any);
    const scoped = new ICEGroup({ theme: { primary: '#123123' } } as any);
    const plain = new ICERect({ style: { fillStyle: token('primary') } } as any);
    root.addChild(scoped);
    root.addChild(plain);
    expect(paint(plain).fillStyle).toBe(getTheme().semantic.primary);
  });
});
