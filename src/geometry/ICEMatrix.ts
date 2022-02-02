//FIXME:包装 DOMMatrix，进行兼容处理。
export default class ICEMatrix {
  constructor() {}

  /**
   * 从变换矩阵计算旋转角度。
   * @param matrix
   * @returns 角度
   */
  public static calcRotateAngle(matrix: DOMMatrix): number {
    let radians = 0;
    let { a, b } = matrix;
    let sin = b / Math.sqrt(a * a + b * b);
    let cos = a / Math.sqrt(a * a + b * b);
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
  public static calcScale(matrix: DOMMatrix): Array<number> {
    const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b) / matrix.a;
    const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d) / matrix.d;
    return [scaleX, scaleY];
  }
}
