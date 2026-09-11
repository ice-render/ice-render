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

/**
 * 折线包围盒回归。
 *
 * 历史缺陷：`calcComponentParams` 用「顶点对相减」（`points[1].x - points[0].x`）推导宽高，但
 * `ICEPolyLine.calc4VertexPoints()` 返回的是沿路径方向排列的**笔画带宽顶点**（不是包围盒的
 * 左上/右上角）→ 近似水平的折线算出 `width ≈ 0` → 包围盒退化 →
 * dirty-rect 按快照盒挑选「需要重画的对象」时漏掉折线，被擦除区域内的折线笔迹丢失
 * （表现为 full 与 dirty-rect 的像素分歧，且只在「连线真正连上」时才暴露）。
 */
describe('ICEPolyLine 包围盒（退化盒子回归）', () => {
  function makeLine(points: number[][], lineWidth = 2) {
    const l: any = new ICEPolyLine({ points, style: { lineWidth } });
    l.ice = { ctx: {} };
    l.refreshParams();
    l.composeMatrix();
    return l;
  }

  it('近似水平的折线宽度不能退化为 ≈0', () => {
    const l = makeLine([
      [0, 0],
      [485, -10],
    ]);
    expect(l.state.width).toBeGreaterThan(480);
    expect(l.state.width).toBeCloseTo(485.04, 1);
    expect(l.state.height).toBeCloseTo(12, 2); // 带宽在 y 上的投影
  });

  it('水平折线的宽高为「长度 × 线宽」', () => {
    const l = makeLine(
      [
        [0, 0],
        [485, 0],
      ],
      2
    );
    expect(l.state.width).toBeCloseTo(485, 6);
    expect(l.state.height).toBeCloseTo(2, 6);
  });

  it('上屏快照盒 __paintWorldBox 与 getMinBoundingBox 必须一致', () => {
    // 这两条路径以前各算各的（前者由 width/height 推导、后者被折线覆盖为顶点盒），
    // 退化时二者不一致 → 局部重绘选不中折线。现在同源于 __localBox()，必须逐位相同。
    for (const pts of [
      [
        [0, 0],
        [485, -10],
      ],
      [
        [0, 0],
        [485, 0],
      ],
      [
        [0, 0],
        [100, 100],
      ],
      [
        [80, 150],
        [160, 200],
      ],
      [
        [0, 0],
        [60, 0],
        [60, 40],
      ],
    ]) {
      const l = makeLine(pts);
      const box = l.getMinBoundingBox().getMinAndMaxPoint();
      const out = new Float64Array(4);
      l.__paintWorldBox(out);
      expect(Array.from(out)).toEqual([box.minX, box.minY, box.maxX, box.maxY]);
    }
  });

  it('重复量测结果稳定（不因读取上一次的 height 而自我漂移）', () => {
    const l = makeLine([
      [0, 0],
      [485, -10],
    ]);
    const first = [l.state.width, l.state.height];
    for (let i = 0; i < 3; i++) {
      l.paramsDirty = true;
      l.refreshParams();
      l.composeMatrix();
      expect([l.state.width, l.state.height]).toEqual(first);
    }
  });

  it('本地盒覆盖含负坐标的点集（原点固定在起点，不适用 [0,0,w,h] 约定）', () => {
    const l = makeLine(
      [
        [0, 0],
        [100, -60],
      ],
      2
    );
    const out = new Float64Array(4);
    l.__paintWorldBox(out);
    expect(out[1]).toBeLessThan(0); // 上边界在本地原点之上
    expect(out[3]).toBeGreaterThan(0);
  });
});
