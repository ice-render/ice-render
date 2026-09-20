import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
import ICERect from '../../src/graphic/shape/ICERect';

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
  it('radius > 0 走 roundRect：命令流里就一条，不再手撸 4 个角', () => {
    const rect = new ICERect({ width: 100, height: 50, radius: 10 });
    const path = (rect as any).createPathObject();
    // 2026-09-20 起圆角矩形交给平台的 roundRect（2021 进入 Canvas 2D 规范的成员）：
    // 改造前这里是 4 次 arcTo（10 条命令 + 每角一次三角函数），现在命令流只记一条。
    // 没有原生 roundRect 的运行时由 Path2DRecorder 展开成等价的 arcTo 序列
    //（只转发给原生对象、不再重复入队），见 tests/cross-platform/path2d-recorder.test.ts。
    expect(commands(path)).toEqual(['roundRect']);
    expect(path._commands[0]).toEqual(['roundRect', 0, 0, 100, 50, 10]);
  });

  it('radius = 0（默认）用直角 rect', () => {
    const rect = new ICERect({ width: 100, height: 50 });
    const path = (rect as any).createPathObject();
    expect(commands(path)).toContain('rect');
    expect(commands(path)).not.toContain('arcTo');
    expect(commands(path)).not.toContain('arc');
  });
});
