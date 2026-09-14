/**
 * 交互状态的**自动驱动**（可选开关）。
 *
 * 引擎的 mousemove 刻意不做命中检测（高频事件 + 脏矩形渲染），所以这里验证的是：
 * - 默认关闭时，移动事件不会带来任何额外开销 / 不会有 hover 状态；
 * - 打开 `enableInteractionStates()` 后，hover / active 由引擎自动维护；
 * - 状态变化会标脏（渲染器才知道要重画）。
 */
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D(), createOffscreenCanvas: () => null } };
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

function makeIce() {
  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  return ice;
}

describe('交互状态的自动驱动', () => {
  it('默认关闭：updateHoverState 不生效（不做命中检测，也就没有状态）', () => {
    const ice = makeIce();
    const rect = new ICERect({} as any);
    rect.ice = ice;
    rect.setInteractionState('hover', false);
    expect(ice.interactionStatesEnabled).toBe(false);
    expect(ice.updateHoverState(rect)).toBe(false);
    expect(rect.getInteractionState('hover')).toBe(false);
  });

  it('打开后：hover 在命中的组件之间转移，旧的会被清掉', () => {
    const ice = makeIce();
    ice.enableInteractionStates();
    const a = new ICERect({} as any);
    const b = new ICERect({} as any);
    a.ice = ice;
    b.ice = ice;

    expect(ice.updateHoverState(a)).toBe(true);
    expect(a.getInteractionState('hover')).toBe(true);

    // 移到 b：a 清、b 亮（且返回 true 表示"变了"，渲染器据此重绘）
    expect(ice.updateHoverState(b)).toBe(true);
    expect(a.getInteractionState('hover')).toBe(false);
    expect(b.getInteractionState('hover')).toBe(true);

    // 同一目标重复上报不视为变化（避免每个 mousemove 都重绘）
    expect(ice.updateHoverState(b)).toBe(false);

    // 移出画布（null）
    expect(ice.updateHoverState(null)).toBe(true);
    expect(b.getInteractionState('hover')).toBe(false);
  });

  it('可以中途关掉（数据流 / 大场景不想要 hover 反馈时）', () => {
    const ice = makeIce();
    ice.enableInteractionStates();
    const rect = new ICERect({} as any);
    rect.ice = ice;
    ice.updateHoverState(rect);
    expect(rect.getInteractionState('hover')).toBe(true);

    ice.disableInteractionStates();
    ice.updateHoverState(null);
    // 关掉之后连"清除"都不再做（避免无谓重绘），状态由应用层自己收尾
    expect(rect.getInteractionState('hover')).toBe(true);
  });
});
