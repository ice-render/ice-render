import ICEPath from './ICEPath';

/**
 * @class ICEDotPath
 * 基于一系列点进行绘制的路径。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ICEDotPath extends ICEPath {
  constructor(props) {
    super({ dots: [], ...props });
  }

  /**
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
   * @returns
   */
  protected calcOriginalDimension() {
    //DotPath 需要先计算每个点的坐标，然后才能计算 width/height
    this.calcOriginalDots();
    let points = this.calc4PointsFromDots();
    let width = points[1].x - points[0].x; //maxX-minX
    let height = points[2].y - points[0].y; //maxY-minY
    this.state.width = width;
    this.state.height = height;
    return { width: this.state.width, height: this.state.height };
  }

  /**
   * @returns
   */
  protected createPathObject(): Path2D {
    this.path2D = new Path2D();
    for (let i = 0; i < this.state.dots.length; i++) {
      const dot = this.state.dots[i];
      if (i === 0) {
        this.path2D.moveTo(dot.x, dot.y);
      } else {
        this.path2D.lineTo(dot.x, dot.y);
      }
    }
    this.path2D.closePath();
    return this.path2D;
  }

  /**
   * 计算路径上的关键点:
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   * @returns
   */
  protected calcOriginalDots(): Array<DOMPoint> {
    this.state.dots = [];
    return this.state.dots;
  }

  /**
   * 设置组件内部的原点坐标，坐标点的计算相对于组件的 local 坐标系，而不是全局默认坐标系。
   * 在不修改坐标原点时，ctx 的坐标原点默认放在组件的左上角位置。
   * 移动坐标原点后，组件中所有的坐标点，当前边界盒子，都会受到影响。
   * @param point
   */
  public setLocalOrigin(position = 'center'): void {
    super.setLocalOrigin(position);

    for (let i = 0; i < this.state.dots.length; i++) {
      let dot = this.state.dots[i];
      dot = dot.matrixTransform(new DOMMatrix([1, 0, 0, 1, -this.state.origin.x, -this.state.origin.y]));
      this.state.dots[i] = dot;
    }
  }

  /**
   * 组件本地坐标系原点位于左上角时的数值
   * @returns
   */
  calc4PointsFromDots(): Array<DOMPoint> {
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < this.state.dots.length; i++) {
      let point = this.state.dots[i];
      if (i === 0) {
        minX = point.x;
        maxX = point.x;
        minY = point.y;
        maxY = point.y;
      } else {
        if (point.x < minX) {
          minX = point.x;
        }
        if (point.x > maxX) {
          maxX = point.x;
        }
        if (point.y < minY) {
          minY = point.y;
        }
        if (point.y > maxY) {
          maxY = point.y;
        }
      }
    }

    //top-left point
    const x1 = minX;
    const y1 = minY;
    //top-right point
    const x2 = maxX;
    const y2 = minY;
    //bottom-left point
    const x3 = minX;
    const y3 = maxY;
    //bottom-right point
    const x4 = maxX;
    const y4 = maxY;

    return [new DOMPoint(x1, y1), new DOMPoint(x2, y2), new DOMPoint(x3, y3), new DOMPoint(x4, y4)];
  }
}
