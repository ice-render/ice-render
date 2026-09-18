/**
 * 正交路由的**避障**：折线不得横穿第三个图元。
 *
 * 这是"图看着乱"里最扎眼的一种 —— 线从方块中间穿过去。它长期存在的原因是
 * `ICEVisioLink.interpolate()` 里的"不相交"过滤只认**两端自己**的包围盒
 * （`startBounding` / `endBounding`），走廊里挡着的其他图元它压根不知道。
 *
 * 给排水工艺图的实测：37 条管线里 24 处穿越（见 ice-agent-console 的
 * `tests/diagram-crossings.test.ts`）。这里用一个三盒子最小场景把机制钉住。
 */
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEVisioLink from '../../src/graphic/link/ICEVisioLink';

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

function makeIce(children: any[]) {
  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  // `once` 不能省：`ICEPolyLine.afterAddHandler` 会订阅 ROUND_FINISH（连线要等一轮渲染后才建立连接）
  ice.evtBus = { on: () => {}, off: () => {}, once: () => {}, trigger: () => {} };
  children.forEach((c) => ice.addChild(c));
  return ice;
}

/** 线段是否穿进矩形内部（留 1px 内缩：贴着边走不算）。 */
function segmentEntersBox(a: number[], b: number[], box: any, inset = 1): boolean {
  const minX = box.minX + inset;
  const maxX = box.maxX - inset;
  const minY = box.minY + inset;
  const maxY = box.maxY - inset;
  if (minX >= maxX || minY >= maxY) return false;
  const inside = (p: number[]) => p[0] > minX && p[0] < maxX && p[1] > minY && p[1] < maxY;
  if (inside(a) || inside(b)) return true;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return (
    clip(-dx, a[0] - minX) && clip(dx, maxX - a[0]) && clip(-dy, a[1] - minY) && clip(dy, maxY - a[1]) && t1 - t0 > 1e-9
  );
}

describe('连线正交路由：避障', () => {
  it('★ 中间挡着一个图元时，折线绕开它（而不是从它身上穿过去）', () => {
    const a = new ICERect({ id: 'a', left: 0, top: 0, width: 80, height: 40 });
    const blocker = new ICERect({ id: 'blocker', left: 140, top: 0, width: 80, height: 40 });
    const c = new ICERect({ id: 'c', left: 300, top: 0, width: 80, height: 40 });
    const ice: any = makeIce([a, blocker, c]);

    const link: any = new ICEVisioLink({
      id: 'l1',
      links: { start: { id: 'a', position: 'R' }, end: { id: 'c', position: 'L' } },
      startPoint: [80, 20],
      endPoint: [300, 20],
      linkShape: 'visio',
    });
    ice.addChild(link);
    link.recalculateRoute();
    link.__calcDots();

    const points: number[][] = link.state.points;
    // 端点必须还在原位（避障不能把线接飞）
    expect(points[0]).toEqual([80, 20]);
    expect(points[points.length - 1]).toEqual([300, 20]);
    // 每段正交
    for (let i = 0; i < points.length - 1; i++) {
      expect(points[i][0] === points[i + 1][0] || points[i][1] === points[i + 1][1]).toBe(true);
    }
    // 不穿中间的方块
    const box = { minX: 140, minY: 0, maxX: 220, maxY: 40 };
    const hit = points.some((p, i) => i > 0 && segmentEntersBox(points[i - 1], p, box));
    expect({ hit, points }).toEqual({ hit: false, points });
  });

  it('参照组：中间没有障碍时，仍然是最短的正交路径（行为不变）', () => {
    const a = new ICERect({ id: 'a', left: 0, top: 0, width: 80, height: 40 });
    const c = new ICERect({ id: 'c', left: 300, top: 0, width: 80, height: 40 });
    const ice: any = makeIce([a, c]);
    const link: any = new ICEVisioLink({
      id: 'l1',
      links: { start: { id: 'a', position: 'R' }, end: { id: 'c', position: 'L' } },
      startPoint: [80, 20],
      endPoint: [300, 20],
      linkShape: 'visio',
    });
    ice.addChild(link);
    link.recalculateRoute();
    link.__calcDots();

    // 同高、正对：就一条直线（有没有逃逸点都无所谓，这里只管"没被避障逻辑改动"）
    const points: number[][] = link.state.points;
    expect(points[0]).toEqual([80, 20]);
    expect(points[points.length - 1]).toEqual([300, 20]);
    for (const p of points) {
      expect(p[1]).toBe(20);
    }
  });
});
