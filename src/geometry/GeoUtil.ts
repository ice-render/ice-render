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
    let deltaX = x - originX;
    let deltaY = y - originY;
    const temp = Math.hypot(deltaX, deltaY);
    let cos = deltaX / temp;
    let sin = deltaY / temp;

    //Math.acos 的返回值处于 [0,PI] 之间，根据 sin 的正负号进行判断之后， rotateAngle 处于 [-180,180] 度之间
    //先加 360 度，保证 rotateAngle 为正值，再对 360 取模，最终让 rotateAngle 的返回值始终处于 [0,360] 度之间
    let sign = sin < 0 ? -1 : 1;
    let rotateAngle = (sign * Math.acos(cos) * 180) / Math.PI + 360;
    rotateAngle = rotateAngle % 360;
    return rotateAngle;
  }
}
