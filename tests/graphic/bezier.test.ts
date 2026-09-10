import ICEBezier from '../../src/graphic/link/ICEBezier';
import componentTypeMap from '../../src/consts/COMPONENT_TYPE_MAPPING';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

describe('ICEBezier 贝塞尔曲线', () => {
  it('默认是二次贝塞尔，未传点时自动构造 3 个点', () => {
    const b = new ICEBezier({});
    expect(b.state.curveType).toBe('quadratic');
    expect(b.state.points.length).toBe(3);
    expect(b.state.left).toBe(0);
    expect(b.state.top).toBe(0);
  });

  it('curveType=cubic 使用 4 个控制点', () => {
    const b = new ICEBezier({
      curveType: 'cubic',
      startPoint: [0, 0],
      controlPoint1: [10, 10],
      controlPoint2: [20, 0],
      endPoint: [30, 30],
    });
    expect(b.state.curveType).toBe('cubic');
    expect(b.state.points.length).toBe(4);
  });

  it('直接传 points 时透传', () => {
    const pts = [
      [0, 0],
      [5, 5],
      [10, 0],
    ];
    const b = new ICEBezier({ points: pts });
    expect(b.state.points).toEqual(pts);
  });

  it('已注册到序列化类型映射', () => {
    expect(componentTypeMap[ICEBezier.name]).toBe(ICEBezier);
  });
});
