import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
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

function commands(obj: any): string[] {
  return obj._commands.map((c: any[]) => c[0]);
}

describe('贝塞尔曲线（curveType）', () => {
  it('quadratic：二次贝塞尔用 quadraticCurveTo', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [50, -50],
        [100, 100],
      ],
      curveType: 'quadratic',
    });
    const path = (line as any).createPathObject();
    expect(commands(path)).toContain('quadraticCurveTo');
  });

  it('cubic：三次贝塞尔用 bezierCurveTo', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [30, -50],
        [70, -50],
        [100, 100],
      ],
      curveType: 'cubic',
    });
    const path = (line as any).createPathObject();
    expect(commands(path)).toContain('bezierCurveTo');
  });

  it('straight：默认直线折线', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 100],
      ],
    });
    const path = (line as any).createPathObject();
    expect(commands(path)).toContain('lineTo');
    expect(commands(path)).not.toContain('bezierCurveTo');
  });
});

describe('圆角矩形（radius）', () => {
  it('radius > 0 用 arcTo 画圆角', () => {
    const rect = new ICERect({ width: 100, height: 50, radius: 10 });
    const path = (rect as any).createPathObject();
    expect(commands(path)).toContain('arcTo');
  });

  it('radius = 0（默认）用直角 rect', () => {
    const rect = new ICERect({ width: 100, height: 50 });
    const path = (rect as any).createPathObject();
    expect(commands(path)).toContain('rect');
    expect(commands(path)).not.toContain('arcTo');
  });
});
