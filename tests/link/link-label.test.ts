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

describe('连线标签定位', () => {
  it('2 点直线：标签在端点中点', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      label: 'x',
    });
    expect((line as any).getLabelPosition()).toEqual([50, 25]);
  });

  it('多点折线：标签在中间顶点', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 0],
        [100, 50],
      ],
      label: 'x',
    });
    // 3 点，中间顶点 points[1] = [100,0]，left/top = points[0] = [0,0]
    expect((line as any).getLabelPosition()).toEqual([100, 0]);
  });

  it('label 非空不影响折线顶点', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      label: 'one-to-many',
    });
    expect(line.state.points.length).toBe(2);
    expect(line.state.label).toBe('one-to-many');
  });
});

describe('连线虚线', () => {
  it("lineType 'dashed' 自动转成 lineDash", () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      lineType: 'dashed',
      lineWidth: 2,
    });
    expect(Array.isArray(line.state.lineDash)).toBe(true);
    expect(line.state.lineDash.length).toBeGreaterThan(0);
  });

  it('lineDash 可显式指定', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      lineDash: [20, 10],
    });
    expect(line.state.lineDash).toEqual([20, 10]);
  });

  it('默认 solid：lineDash 为空', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
    });
    expect(line.state.lineDash).toEqual([]);
  });
});
