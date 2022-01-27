import ICEDotPath from '../ICEDotPath';

/**
 * @class ICERect 矩形
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICERect extends ICEDotPath {
  constructor(props: any = {}) {
    super({ width: 10, height: 10, ...props });
  }

  /**
   * 计算路径上的关键点:
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   * @returns
   */
  protected calcOriginalDots(): Array<DOMPoint> {
    let point1 = new DOMPoint(0, 0); //top-left point
    let point2 = new DOMPoint(this.state.width, 0); //top-right point
    let point3 = new DOMPoint(this.state.width, this.state.height); //bottom-right point
    let point4 = new DOMPoint(0, this.state.height); //bottom-left point
    this.state.dots = [point1, point2, point3, point4];
    return this.state.dots;
  }
}
export default ICERect;
