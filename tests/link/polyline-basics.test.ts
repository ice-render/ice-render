import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

describe('ICEPolyLine 构造参数', () => {
  it('未传 points 时自动补全默认两点，且不抛错', () => {
    const line = new ICEPolyLine({});
    expect(line.state.points).toEqual([
      [0, 0],
      [10, 10],
    ]);
    expect(line.state.left).toBe(0);
    expect(line.state.top).toBe(0);
  });

  it('只传一个点时自动补全终点，left/top 与起点重合', () => {
    const line = new ICEPolyLine({ points: [[5, 6]] });
    expect(line.state.points).toEqual([
      [5, 6],
      [10, 10],
    ]);
    expect(line.state.left).toBe(5);
    expect(line.state.top).toBe(6);
  });
});
