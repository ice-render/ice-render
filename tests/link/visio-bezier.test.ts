/**
 * ICEVisioLink 的连线形态切换（`linkShape: 'visio' | 'bezier'`）。
 *
 * 历史行为：`ICEVisioLink.__calcDots()` 无条件调 `interpolate()`（正交路径搜索），只画 Visio 形态。
 * 现在多一个 `bezier` 形态：从两端点与**插槽外法线**构造三次贝塞尔，等分采样成密集折线写回
 * `state.points/dots`，从而复用既有的折线渲染 + 箭头 + 命中 + 包围盒通路（不改 createPathObject）。
 *
 * 两个关键设计点（都在下面的用例里被钉死）：
 * 1. **采样必须写回 `state.points`**：`isDotsOnSameLine()` 只读 points，若 points 只剩首尾两点会被判
 *    「共线」→ 包围盒走 `splitEndpointsTo4Points()`、只按 lineWidth 外扩 → 曲线鼓出的部分落在盒外
 *    → dirty-rect 快照盒偏小、局部重绘裁掉曲线。
 * 2. **不能借用 `curveType: 'cubic'`**：`createPathObject()` 在 cubic 时把 `dots[1]/dots[2]` 当控制点，
 *    而箭头会把三角面顶点插进 `dots` 两端 → 两者必然冲突。bezier 形态强制 `curveType: 'straight'`。
 */
import ICEVisioLink from '../../src/graphic/link/ICEVisioLink';
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

const allFinite = (pts: number[][]) => pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

/** 造一条连线：默认 2 点（startPoint/endPoint），需要时再 calcDots() */
function makeLink(props: any = {}) {
  const line: any = new ICEVisioLink({
    startPoint: [0, 0],
    endPoint: [100, 50],
    ...props,
  });
  return line;
}

describe('连线形态：默认 visio 行为不变', () => {
  it('默认 linkShape 为 visio，且不改变 curveType', () => {
    const line = makeLink();
    expect(line.state.linkShape).toBe('visio');
    expect(line.state.curveType).toBe('straight');
  });

  it('visio 形态仍走正交路径（水平对齐的两端 ⇒ 每段轴对齐）', () => {
    const line = makeLink({
      startPoint: [0, 0],
      endPoint: [100, 0],
      links: { start: { id: 'a', position: 'R' }, end: { id: 'b', position: 'L' } },
    });
    line.setState({ startPoint: [0, 0], endPoint: [100, 0] });
    line.calcDots();

    const pts = line.state.points;
    expect(allFinite(pts)).toBe(true);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[pts.length - 1]).toEqual([100, 0]);
    for (let i = 0; i < pts.length - 1; i++) {
      expect(pts[i][0] === pts[i + 1][0] || pts[i][1] === pts[i + 1][1]).toBe(true);
    }
  });
});

describe('连线形态：bezier 控制点与端点', () => {
  it('控制点沿起点插槽法线：R 槽先向右、B 槽先向下', () => {
    const right = makeLink({
      startPoint: [0, 0],
      endPoint: [100, 50],
      linkShape: 'bezier',
      links: { start: { id: 'a', position: 'R' }, end: { id: 'b', position: 'L' } },
    });
    right.calcDots();
    const p1 = right.state.points[1];
    expect(p1[0]).toBeGreaterThan(0); // 向右
    expect(Math.abs(p1[1] - 0)).toBeLessThan(Math.abs(p1[0] - 0)); // 基本水平

    const bottom = makeLink({
      startPoint: [0, 0],
      endPoint: [100, 50],
      linkShape: 'bezier',
      links: { start: { id: 'a', position: 'B' }, end: { id: 'b', position: 'L' } },
    });
    bottom.calcDots();
    const q1 = bottom.state.points[1];
    expect(q1[1]).toBeGreaterThan(0); // 向下
    expect(Math.abs(q1[0] - 0)).toBeLessThan(Math.abs(q1[1] - 0)); // 基本垂直
  });

  it('端点跟随插槽（followComponent 后 startPoint 等于宿主右边中点）', () => {
    const hostA: any = new ICERect({ left: 0, top: 0, width: 100, height: 60 });
    const hostB: any = new ICERect({ left: 300, top: 200, width: 100, height: 60 });
    const line = makeLink({
      linkShape: 'bezier',
      links: { start: { id: 'a', position: 'R' }, end: { id: 'b', position: 'L' } },
    });
    line.ice = {
      findComponent: (id: string) => (id === 'a' ? hostA : id === 'b' ? hostB : null),
    };

    (line as any).followComponent();

    expect(line.state.startPoint).toEqual(hostA.getMinBoundingBox(true).rc);
    expect(line.state.endPoint).toEqual(hostB.getMinBoundingBox(true).lc);

    line.calcDots();
    expect(line.state.points[0]).toEqual(line.state.startPoint);
    expect(line.state.points[line.state.points.length - 1]).toEqual(line.state.endPoint);
  });

  it('无 links / 只有一端有 links / C 槽：退化但不产生非有限值', () => {
    const cases: any[] = [
      { links: {} },
      { links: { start: { id: 'a', position: 'R' } } },
      { links: { start: { id: 'a', position: 'C' }, end: { id: 'b', position: 'C' } } },
    ];
    for (const c of cases) {
      const line = makeLink({ linkShape: 'bezier', ...c });
      line.calcDots();
      expect(allFinite(line.state.dots)).toBe(true);
      expect(line.state.points[0]).toEqual([0, 0]);
      expect(line.state.points[line.state.points.length - 1]).toEqual([100, 50]);
    }
  });

  it('两端点重合 + arrow:both：不产生 NaN（覆盖零切线短路）', () => {
    const line = makeLink({
      startPoint: [50, 50],
      endPoint: [50, 50],
      linkShape: 'bezier',
      arrow: 'both',
    });
    line.calcDots();

    expect(allFinite(line.state.dots)).toBe(true);
    // 箭头顶点确实插进了 dots（说明走到了 calcArrowPoints 且没有异常）
    expect(line.state.dots.length).toBeGreaterThan(line.state.points.length);
  });
});

describe('连线形态：bezier 的包围盒与绘制路径', () => {
  it('包围盒包含曲线鼓出的部分（不能退化成弦的盒子）', () => {
    // R 出、B 进：曲线会先向右再向下，纵向超出弦的跨度
    const line = makeLink({
      startPoint: [0, 0],
      endPoint: [100, 100],
      linkShape: 'bezier',
      links: { start: { id: 'a', position: 'R' }, end: { id: 'b', position: 'B' } },
      style: { lineWidth: 2 },
    });
    line.ice = { ctx: {} };
    line.refreshParams();
    line.composeMatrix();
    line.calcDots();

    const box = line.__localBox();
    const dots = line.state.dots;
    // 盒子必须覆盖全部采样点
    for (const [x, y] of dots) {
      expect(x).toBeGreaterThanOrEqual(box[0] - 1e-6);
      expect(x).toBeLessThanOrEqual(box[2] + 1e-6);
      expect(y).toBeGreaterThanOrEqual(box[1] - 1e-6);
      expect(y).toBeLessThanOrEqual(box[3] + 1e-6);
    }
    // 且明显高于「弦的跨度 + 线宽」——证明走的是 dots min/max 而不是共线分支
    expect(line.state.points.length).toBeGreaterThan(2);
    expect(box[3] - box[1]).toBeGreaterThan(100 + 2);
  });

  it('bezier 强制 curveType 为 straight（与 cubic 互斥）', () => {
    const line = makeLink({
      linkShape: 'bezier',
      curveType: 'cubic',
      links: { start: { id: 'a', position: 'R' }, end: { id: 'b', position: 'L' } },
    });
    expect(line.state.curveType).toBe('straight');

    line.calcDots();
    const cmds = (line as any).createPathObject()._commands.map((c: any[]) => c[0]);
    expect(cmds).toContain('lineTo');
    expect(cmds).not.toContain('bezierCurveTo');
    expect(cmds).not.toContain('quadraticCurveTo');
  });

  it('recalculateRoute 在 bezier 形态下不覆盖 points（正交路由被拦掉）', () => {
    const line = makeLink({
      linkShape: 'bezier',
      routeType: 'orthogonal',
      links: { start: { id: 'a', position: 'R' }, end: { id: 'b', position: 'L' } },
    });
    line.calcDots();
    const before = line.state.points.map((p: number[]) => [...p]);

    (line as any).recalculateRoute();

    expect(line.state.points).toEqual(before);
  });

  it('无 links 时回落弦方向且不回折（终点不被越过）', () => {
    const line = makeLink({ startPoint: [0, 0], endPoint: [200, 0], linkShape: 'bezier' });
    line.calcDots();

    const xs = line.state.points.map((p: number[]) => p[0]);
    for (let i = 0; i < xs.length - 1; i++) {
      expect(xs[i + 1]).toBeGreaterThanOrEqual(xs[i] - 1e-6);
    }
    // 没有冲出终点（若两端控制点都取 +chord，这里会 > 200）
    expect(Math.max(...xs)).toBeLessThanOrEqual(200 + 1e-6);
    expect(xs[xs.length - 1]).toBeCloseTo(200, 6);
  });
});
