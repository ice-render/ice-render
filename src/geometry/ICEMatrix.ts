/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export default class ICEMatrix {
  constructor() {}

  /**
   * 从变换矩阵计算旋转角度。
   * @param matrix
   * @returns 角度
   */
  public static calcRotateAngleFromMatrix(matrix): number {
    let radians = 0;
    let a = matrix[0];
    let b = matrix[1];
    const temp = Math.hypot(a, b);
    let sin = b / temp;
    let cos = a / temp;
    radians = Math.acos(cos);
    if (sin < 0) {
      radians += Math.PI / 2;
    }
    return radians * (180 / Math.PI);
  }

  /**
   * 从变换矩阵计算缩放参数。
   * @param matrix
   * @returns 缩放数组
   */
  public static calcScaleFromMatrix(matrix): Array<number> {
    let a = matrix[0];
    let b = matrix[1];
    let c = matrix[2];
    let d = matrix[3];
    const scaleX = Math.hypot(a, b) / a;
    const scaleY = Math.hypot(c, d) / d;
    return [scaleX, scaleY];
  }
}
