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
}
