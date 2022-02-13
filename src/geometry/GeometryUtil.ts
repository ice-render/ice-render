import round from 'lodash/round';
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
    let offsetX = x - originX;
    let offsetY = y - originY;
    let cos = offsetX / Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    let sin = offsetY / Math.sqrt(offsetX * offsetX + offsetY * offsetY);

    //Math.acos 的返回值处于 [0,PI] 之间，根据 sin 的正负号进行判断之后， rotateAngle 处于 [-180,180] 度之间
    //先加 360 度，保证 rotateAngle 为正值，再对 360 取模，最终让 rotateAngle 的返回值始终处于 [0,360] 度之间
    let sign = sin < 0 ? -1 : 1;
    let rotateAngle = (sign * Math.acos(cos) * 180) / Math.PI + 360;
    rotateAngle = rotateAngle % 360;
    return rotateAngle;
  }

  /**
   * 2D 向量叉乘。
   *
   * 两个点需要处于同一个坐标系中。
   *
   * @param x1
   * @param y1
   * @param x2
   * @param y2
   * @returns
   */
  public static crossProduct(x1, y1, x2, y2): number {
    //FIXME:需要确认计算公式是否正确
    let result = x1 * y2 - x2 * y1;
    return round(result, 2);
  }

  /**
   * 2D 向量点乘。
   *
   * 两个点需要处于同一个坐标系中。
   *
   * @param x1
   * @param y1
   * @param x2
   * @param y2
   * @returns
   */
  public static dotProduct(x1, y1, x2, y2): number {
    let result = x1 * x2 + y1 * y2;
    return round(result, 2);
  }
}
