/**
 * GeoUtil 公共几何函数单测（点在多边形内 / 点到线段与折线距离 / 折线等距采样 / 线段求交）。
 *
 * 这些能力原先都以私有实现散落在各图元里（ICEDotPath 的射线法、ICEPolyLine 的点-线段距离等），
 * 上提为公共 API 之后，应用层做自己的命中/碰撞/路径计算时不必再抄一遍。
 */
import GeoUtil from '../../src/geometry/GeoUtil';

const SQUARE: Array<[number, number]> = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const DIAMOND: Array<[number, number]> = [
  [0, -5],
  [5, 0],
  [0, 5],
  [-5, 0],
];

describe('GeoUtil.pointInPolygon', () => {
  it('正方形：内部为真，外部与包围盒角为假', () => {
    expect(GeoUtil.pointInPolygon(5, 5, SQUARE)).toBe(true);
    expect(GeoUtil.pointInPolygon(-1, 5, SQUARE)).toBe(false);
    expect(GeoUtil.pointInPolygon(11, 5, SQUARE)).toBe(false);
  });

  it('边界点按射线法的半开约定处理（不做特殊判定，已在 JSDoc 里写明）', () => {
    // 四角里只有左下角落在这个半开区间内；需要「边界算命中」时调用方应另用 distanceToPolyline
    expect(GeoUtil.pointInPolygon(0, 0, SQUARE)).toBe(true);
    expect(GeoUtil.pointInPolygon(10, 10, SQUARE)).toBe(false);
  });

  it('菱形：中心在内、包围盒角在外（射线法能区分凸包与包围盒）', () => {
    expect(GeoUtil.pointInPolygon(0, 0, DIAMOND)).toBe(true);
    expect(GeoUtil.pointInPolygon(4, 4, DIAMOND)).toBe(false); // 在包围盒内但在菱形外
    expect(GeoUtil.pointInPolygon(-4, -4, DIAMOND)).toBe(false);
  });

  it('顶点数不足 3 时返回 false', () => {
    expect(GeoUtil.pointInPolygon(0, 0, [])).toBe(false);
    expect(
      GeoUtil.pointInPolygon(0, 0, [
        [0, 0],
        [1, 1],
      ])
    ).toBe(false);
  });
});

describe('GeoUtil.distanceToSegment / distanceToPolyline', () => {
  it('投影落在段内：取垂距', () => {
    expect(GeoUtil.distanceToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3, 10);
  });

  it('投影落在段外：取端点距离（不是到直线的距离）', () => {
    expect(GeoUtil.distanceToSegment(-4, 0, 0, 0, 10, 0)).toBeCloseTo(4, 10);
    expect(GeoUtil.distanceToSegment(14, 0, 0, 0, 10, 0)).toBeCloseTo(4, 10);
  });

  it('退化线段（两端重合）按点距处理', () => {
    expect(GeoUtil.distanceToSegment(3, 4, 0, 0, 0, 0)).toBeCloseTo(5, 10);
  });

  it('折线取各段最短距离', () => {
    const poly: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    expect(GeoUtil.distanceToPolyline(poly, 5, 2)).toBeCloseTo(2, 10);
    expect(GeoUtil.distanceToPolyline(poly, 12, 5)).toBeCloseTo(2, 10);
  });

  it('空折线返回 Infinity，单点折线返回点距', () => {
    expect(GeoUtil.distanceToPolyline([], 0, 0)).toBe(Infinity);
    expect(GeoUtil.distanceToPolyline([[3, 4]], 0, 0)).toBeCloseTo(5, 10);
  });
});

describe('GeoUtil.samplePolyline', () => {
  it('等距采样 count+1 个点（含首尾）', () => {
    const out = GeoUtil.samplePolyline(
      [
        [0, 0],
        [10, 0],
      ],
      4
    );
    expect(out.length).toBe(5);
    expect(out[0]).toEqual([0, 0]);
    expect(out[4]).toEqual([10, 0]);
    expect(out[2][0]).toBeCloseTo(5, 10);
  });

  it('跨拐角时按累计弧长采样', () => {
    const out = GeoUtil.samplePolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      4
    );
    expect(out.length).toBe(5);
    // 总长 20 → 采样点分别在 0/5/10/15/20 处；10 正好是拐角
    expect(out[0]).toEqual([0, 0]);
    expect(out[2][0]).toBeCloseTo(10, 10);
    expect(out[2][1]).toBeCloseTo(0, 10);
    expect(out[4][1]).toBeCloseTo(10, 10);
  });

  it('零长度折线不产生 NaN', () => {
    const out = GeoUtil.samplePolyline(
      [
        [5, 5],
        [5, 5],
      ],
      3
    );
    expect(out.every((p) => p[0] === 5 && p[1] === 5)).toBe(true);
  });
});

describe('GeoUtil.segmentIntersect', () => {
  it('相交返回交点', () => {
    const hit = GeoUtil.segmentIntersect([0, 0], [10, 10], [0, 10], [10, 0]);
    expect(hit).not.toBeNull();
    expect(hit![0]).toBeCloseTo(5, 10);
    expect(hit![1]).toBeCloseTo(5, 10);
  });

  it('不相交（延长线才相交）返回 null', () => {
    expect(GeoUtil.segmentIntersect([0, 0], [1, 0], [5, -1], [5, 1])).toBeNull();
  });

  it('平行/共线返回 null', () => {
    expect(GeoUtil.segmentIntersect([0, 0], [10, 0], [0, 5], [10, 5])).toBeNull();
    expect(GeoUtil.segmentIntersect([0, 0], [10, 0], [5, 0], [15, 0])).toBeNull();
  });

  it('端点相触算相交', () => {
    expect(GeoUtil.segmentIntersect([0, 0], [5, 5], [5, 5], [10, 0])).toEqual([5, 5]);
  });
});
