import ICEComponent from '../graphic/ICEComponent';

export default class GeometryUtil {
  constructor() {
    throw new Error('GeometryUtil is a static util class.');
  }

  /**
   * 判断一个坐标点是否包含在图元内部。
   * @param component
   * @param point
   * @returns
   */
  public static containsPoint(component: ICEComponent, point: any): boolean {
    return false;
  }

  /**
   * 判断两个图元是否相交。
   * @param a 第一个图元
   * @param b 第二个图元
   * @returns
   */
  public static isIntersect(a: ICEComponent, b: ICEComponent): boolean {
    return false;
  }

  /**
   * 已知两点坐标，求线段长度。
   * @param x1
   * @param y1
   * @param x2
   * @param y2
   */
  public static getLength(x1, y1, x2, y2): number {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  }

  /**
   * 已知原点和目标点坐标，求相对于 X 轴正向的旋转角度。两个点需要处于同一个坐标系中。
   *
   * @param x
   * @param y
   * @param originX
   * @param originY
   */
  public static calcRotateAngle(x, y, originX, originY): number {
    let offsetX = x - originX;
    let offsetY = y - originY;
    let cos = offsetX / Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    let sin = offsetY / Math.sqrt(offsetX * offsetX + offsetY * offsetY);

    let sign = sin < 0 ? -1 : 1;
    let rotateAngle = (sign * Math.acos(cos) * 180) / Math.PI;
    return rotateAngle;

    //FIXME:
    //rotateAngle 的数值限定在 0-90 度之间，然后根据 sin 值确定象限，最终数值范围限定在 0-360 度之间。
    // let rotateAngle = (Math.acos(Math.abs(cos)) * 180) / Math.PI;

    // //位于X轴上
    // if (cos === 1) {
    //   return 0;
    // } else if (cos === -1) {
    //   return 180;
    // }

    // if (cos === 0) {
    //   if (sin > 0) {
    //     return 90;
    //   } else {
    //     return 270;
    //   }
    // }

    // if (cos > 0) {
    //   if (sin > 0) {
    //     return rotateAngle;
    //   } else {
    //     return 270 + rotateAngle;
    //   }
    // } else {
    //   if (sin > 0) {
    //     return 90 + rotateAngle;
    //   } else {
    //     return 180 + rotateAngle;
    //   }
    // }
  }
}
