import ICERect from '../../src/graphic/shape/ICERect';

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

describe('蚂蚁线（lineDashFlow / lineDashOffset）', () => {
  it('默认 lineDashOffset=0, lineDashFlow=false（静态虚线）', () => {
    const r = new ICERect({ width: 100, height: 40, lineDash: [10, 5] });
    expect(r.state.lineDashOffset).toBe(0);
    expect(r.state.lineDashFlow).toBe(false);
    expect(r.state.lineDashFlowSpeed).toBe(30);
  });

  it('lineDashFlow=true 触发 loop 动画注册（__flowRegistered）', () => {
    const r = new ICERect({ width: 100, height: 40, lineDash: [10, 5], lineDashFlow: true });
    expect(r.state.lineDashFlow).toBe(true);
    // __flowRegistered 私有字段在 ensureFlowAnimation 后被设为 true
    expect((r as any).__flowRegistered).toBe(false);
    // 调一次 ensureFlowAnimation
    (r as any).__ensureFlowAnimation();
    expect((r as any).__flowRegistered).toBe(true);
    // 第二次调用 noop
    (r as any).__ensureFlowAnimation();
    expect((r as any).__flowRegistered).toBe(true);
  });

  it('lineDashFlowSpeed 决定流动速度', () => {
    const r = new ICERect({ lineDashFlow: true, lineDashFlowSpeed: 50 });
    expect(r.state.lineDashFlowSpeed).toBe(50);
  });
});
