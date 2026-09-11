/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export default class GeoUtil {
  constructor() {
    throw new Error('GeoUtil is a static util class.');
  }

  /**
   * 点是否在多边形内部（射线法）。
   *
   * 点集类图元（星形 / 正N边形 / 玫瑰）的精确命中判定用的就是它；上提为公共 API 后，
   * 应用层做自己的命中/碰撞判定时不必再抄一遍。
   *
   * 边界约定：不做特殊判定，按射线法自身的**半开**约定处理 —— 落在边/顶点上的点结果取决于
   * 该边与射线的相对方向（例如正方形左下角顶点会判为「在内」）。需要「边界算命中」的语义时，
   * 调用方应另外用 `distanceToPolyline` 判一次距离。
   *
   * @param x 待判定点的 x（与 polygon 同一坐标系）
   * @param y 待判定点的 y
   * @param polygon 顶点数组 [[x,y], ...]，按顺序首尾相连（自动闭合，无需重复首点）
   */
  public static pointInPolygon(x: number, y: number, polygon: Array<[number, number]>): boolean {
    if (!polygon || polygon.length < 3) {
      return false;
    }
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  /**
   * 点到**线段**的最短距离（注意不是到直线的距离：投影落在端点外时取端点距离）。
   */
  public static distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /**
   * 点到折线（多段线）的最短距离。
   * 折线类图元的命中判定就是「距离 ≤ 阈值」，此前这段逻辑内联在图元里。
   */
  public static distanceToPolyline(points: Array<[number, number]>, px: number, py: number): number {
    if (!points || points.length === 0) {
      return Infinity;
    }
    if (points.length === 1) {
      return Math.hypot(px - points[0][0], py - points[0][1]);
    }
    let min = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      const d = GeoUtil.distanceToSegment(px, py, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
      if (d < min) {
        min = d;
      }
    }
    return min;
  }

  /**
   * 沿折线等距采样 `count + 1` 个点（含首尾）。
   *
   * 用途：把曲线/折线离散成均匀点集（例如贝塞尔采样后写回 `state.points` 供包围盒与命中使用），
   * 或者做路径动画的关键点。零长度段会被跳过，不会产生 NaN。
   */
  public static samplePolyline(points: Array<[number, number]>, count: number): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    if (!points || points.length < 2 || count < 1) {
      return points ? points.map((p) => [p[0], p[1]] as [number, number]) : out;
    }
    const segs: number[] = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const d = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
      segs.push(d);
      total += d;
    }
    if (total === 0) {
      return [points[0].slice() as [number, number], points[points.length - 1].slice() as [number, number]];
    }
    for (let k = 0; k <= count; k++) {
      const target = (total * k) / count;
      let acc = 0;
      for (let i = 0; i < segs.length; i++) {
        if (acc + segs[i] >= target || i === segs.length - 1) {
          const t = segs[i] === 0 ? 0 : (target - acc) / segs[i];
          out.push([
            points[i][0] + (points[i + 1][0] - points[i][0]) * t,
            points[i][1] + (points[i + 1][1] - points[i][1]) * t,
          ]);
          break;
        }
        acc += segs[i];
      }
    }
    return out;
  }

  /**
   * 两条线段是否相交（含相触）。返回交点或 null。
   * 用参数方程求解，平行/共线时返回 null（不做重叠区间的特殊处理）。
   */
  public static segmentIntersect(
    a1: [number, number],
    a2: [number, number],
    b1: [number, number],
    b2: [number, number]
  ): [number, number] | null {
    const d1x = a2[0] - a1[0];
    const d1y = a2[1] - a1[1];
    const d2x = b2[0] - b1[0];
    const d2y = b2[1] - b1[1];
    const denom = d1x * d2y - d1y * d2x;
    if (denom === 0) {
      return null;
    }
    const t = ((b1[0] - a1[0]) * d2y - (b1[1] - a1[1]) * d2x) / denom;
    const u = ((b1[0] - a1[0]) * d1y - (b1[1] - a1[1]) * d1x) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) {
      return null;
    }
    return [a1[0] + t * d1x, a1[1] + t * d1y];
  }

  /**
   *
   * 已知向量原点和向量坐标值，求向量相对于 X 轴正向的旋转角度。
   *
   * 两个点需要处于同一个坐标系中。
   *
   * rotateAngle 的数值范围限定在 [0,360] 度之间，闭区间。
   *
   * @param x
   * @param y
   * @param originX
   * @param originY
   * @returns
   */
  public static calcRotateAngle(x, y, originX, originY): number {
    const deltaX = x - originX;
    const deltaY = y - originY;
    const temp = Math.hypot(deltaX, deltaY);
    const cos = deltaX / temp;
    const sin = deltaY / temp;

    //Math.acos 的返回值处于 [0,PI] 之间，根据 sin 的正负号进行判断之后， rotateAngle 处于 [-180,180] 度之间
    //先加 360 度，保证 rotateAngle 为正值，再对 360 取模，最终让 rotateAngle 的返回值始终处于 [0,360] 度之间
    const sign = sin < 0 ? -1 : 1;
    let rotateAngle = (sign * Math.acos(cos) * 180) / Math.PI + 360;
    rotateAngle = rotateAngle % 360;
    return rotateAngle;
  }

  /**
   * 从变换矩阵计算旋转角度。
   * @param matrix
   * @returns 角度
   */
  public static calcRotateAngleFromMatrix(matrix): number {
    const a = matrix[0];
    const b = matrix[1];
    const radians = Math.atan2(b, a);
    return radians * (180 / Math.PI);
  }

  /**
   * 从变换矩阵计算缩放参数。
   * @param matrix
   * @returns 缩放数组
   */
  public static calcScaleFromMatrix(matrix): Array<number> {
    const a = matrix[0];
    const b = matrix[1];
    const c = matrix[2];
    const d = matrix[3];
    // 列向量约定下，x 轴基向量 (1,0) 映射为 (a,b)、y 轴基向量 (0,1) 映射为 (c,d)，
    // 各轴缩放即对应基向量的模长。直接用模长既正确，也避免 a/d 为 0 时除零。
    const scaleX = Math.hypot(a, b);
    const scaleY = Math.hypot(c, d);
    return [scaleX, scaleY];
  }
}
