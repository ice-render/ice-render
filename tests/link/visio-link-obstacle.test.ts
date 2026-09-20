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
import GeoLine from '../../src/geometry/GeoLine';
import GeoPoint from '../../src/geometry/GeoPoint';

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
  /**
   * 线段相交的**口径**（把"轴向特判"换成参数方程之后，得逐条钉住语义）。
   *
   * 这条是私有方法，但它是路由三道过滤里最靠底的一层：写错不会报错，
   * 只会让线悄悄贴上图元或莫名其妙绕远。所以按几何情形逐条钉：
   * 真交叉 / 端点相接 / 共线重叠（横、竖、斜三种）/ 平行不相交。
   */
  describe('线段相交（私有实现的口径）', () => {
    const intersects = (a1: number[], a2: number[], b1: number[], b2: number[]) => {
      const link: any = new ICEVisioLink({ id: 'probe' });
      return link.lineIntersectsLine(
        new GeoLine(new GeoPoint(a1[0], a1[1]), new GeoPoint(a2[0], a2[1])),
        new GeoLine(new GeoPoint(b1[0], b1[1]), new GeoPoint(b2[0], b2[1]))
      );
    };

    it('真交叉（斜 × 斜）与端点相接都算相交', () => {
      expect(intersects([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true);
      expect(intersects([0, 0], [10, 0], [10, 0], [20, 10])).toBe(true); // 端点相接
      expect(intersects([0, 0], [10, 0], [5, -5], [5, 5])).toBe(true); // 横 × 竖，交于 (5,0)
      expect(intersects([0, 0], [10, 0], [5, 1], [5, 9])).toBe(false); // 竖线够不到 → 不相交
    });

    it('共线重叠：横 / 竖 / 斜三种方向都算相交', () => {
      expect(intersects([0, 0], [10, 0], [5, 0], [15, 0])).toBe(true); // 横
      expect(intersects([0, 0], [0, 10], [0, 5], [0, 15])).toBe(true); // 竖
      expect(intersects([0, 0], [10, 10], [5, 5], [15, 15])).toBe(true); // 斜
    });

    it('平行不相交（含共线但区间不重叠）判 false', () => {
      expect(intersects([0, 0], [10, 0], [0, 5], [10, 5])).toBe(false); // 平行不共线
      expect(intersects([0, 0], [10, 0], [20, 0], [30, 0])).toBe(false); // 共线但错开
      expect(intersects([0, 0], [10, 10], [12, 12], [20, 20])).toBe(false); // 斜向共线错开
    });
  });

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

  /**
   * 贴边容忍：障碍的顶边正好与走线同一条直线（y = 20）时，走线**保留直连**。
   *
   * 这是**刻意的口径**：`countObstacleCrossings()` 会把障碍盒各向内缩 1px，
   * "贴着边走、擦着角过"因此不算穿越 —— 否则"零穿越"这个判据几乎永远无法满足
   * （相邻图元之间的通道本来就只有十几像素）。这条用例把那个决定钉住，
   * 免得以后有人把 inset 去掉时以为是在"修 bug"。
   */
  it('走线贴着障碍边框（1px 内）不算穿越 —— 保留直连', () => {
    const a = new ICERect({ id: 'a', left: 0, top: 0, width: 80, height: 40 });
    const blocker = new ICERect({ id: 'blocker', left: 140, top: 20, width: 80, height: 40 });
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
    expect(points[0]).toEqual([80, 20]);
    expect(points[points.length - 1]).toEqual([300, 20]);
    // 全程都在 y=20 上（沿障碍顶边走），没有被判成穿越而去绕路
    for (const p of points) {
      expect(p[1]).toBe(20);
    }
  });
});
