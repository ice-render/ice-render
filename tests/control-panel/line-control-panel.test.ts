import LineControlPanel from '../../src/control-panel/link-controls/LineControlPanel';
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

describe('LineControlPanel 端点拖拽', () => {
  it('拖动起点时实时计算目标线性矩阵（不读过期缓存）', () => {
    const panel: any = new LineControlPanel({ left: 0, top: 0, width: 100, height: 100 });
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [10, 10],
      ],
    });
    panel.targetComponent = line;

    panel.trigger('AFTER_RESIZE', { position: 'start', movementX: 5, movementY: 0 });

    expect(line.state.points[0]).toEqual([5, 0]);
    expect(line.state.points[1]).toEqual([10, 10]);
  });
});
