import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';

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

describe('连线正交路由', () => {
  it('orthogonal：根据插槽方向生成直角折线（每段水平或垂直）', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      links: { start: { id: 'a', position: 'R' }, end: { id: 'b', position: 'L' } },
      routeType: 'orthogonal',
      routeOffset: 20,
    });
    line.setState({ startPoint: [0, 0], endPoint: [100, 50] });

    const pts = line.state.points;
    // 首尾端点保持
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[pts.length - 1]).toEqual([100, 50]);
    // 每段都是水平或垂直（正交）
    for (let i = 0; i < pts.length - 1; i++) {
      expect(pts[i][0] === pts[i + 1][0] || pts[i][1] === pts[i + 1][1]).toBe(true);
    }
    // 有中间拐点（> 2 点）
    expect(pts.length).toBeGreaterThan(2);
  });

  it('straight：直线不生成中间拐点', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      routeType: 'straight',
    });
    line.setState({ startPoint: [0, 0], endPoint: [100, 50] });
    expect(line.state.points.length).toBe(2);
  });

  it('orthogonal 无连接：退化为曼哈顿折线', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      routeType: 'orthogonal',
      routeOffset: 20,
    });
    line.setState({ startPoint: [0, 0], endPoint: [100, 50] });

    const pts = line.state.points;
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[pts.length - 1]).toEqual([100, 50]);
    for (let i = 0; i < pts.length - 1; i++) {
      expect(pts[i][0] === pts[i + 1][0] || pts[i][1] === pts[i + 1][1]).toBe(true);
    }
  });
});
