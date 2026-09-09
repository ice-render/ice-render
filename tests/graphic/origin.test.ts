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
};

describe('旋转原点（origin）', () => {
  it('默认 localCenter：原点在几何中心', () => {
    const rect = new ICERect({ width: 100, height: 50 });
    rect.getMinBoundingBox(true);
    expect(rect.state.localOrigin[0]).toBe(50);
    expect(rect.state.localOrigin[1]).toBe(25);
  });

  it('top-left：原点在左上角', () => {
    const rect = new ICERect({ width: 100, height: 50, origin: 'top-left' });
    rect.getMinBoundingBox(true);
    expect(rect.state.localOrigin[0]).toBe(0);
    expect(rect.state.localOrigin[1]).toBe(0);
  });

  it('custom：原点由 originX/originY 指定（相对左上角）', () => {
    const rect = new ICERect({ width: 100, height: 50, origin: 'custom', originX: 25, originY: 20 });
    rect.getMinBoundingBox(true);
    expect(rect.state.localOrigin[0]).toBe(25);
    expect(rect.state.localOrigin[1]).toBe(20);
  });

  it('自定义原点影响全局原点（absoluteOrigin）', () => {
    const rect = new ICERect({
      left: 100,
      top: 100,
      width: 100,
      height: 50,
      origin: 'custom',
      originX: 25,
      originY: 20,
    });
    rect.getMinBoundingBox(true);
    // absoluteOrigin = left/top + translate + localOrigin（无父层无旋转）
    expect(rect.state.absoluteOrigin[0]).toBeCloseTo(100 + 25, 1);
    expect(rect.state.absoluteOrigin[1]).toBeCloseTo(100 + 20, 1);
  });
});
