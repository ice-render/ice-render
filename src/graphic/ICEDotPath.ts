import ICEPath from './ICEPath';

/**
 * @class ICEDotPath
 * 基于一系列点进行绘制的路径。
 *
 *
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ICEDotPath extends ICEPath {
  /**
   * FIXME:编写完整的配置项描述
   * @cfg
   * {
   *
   * }
   *
   * @param props
   */
  constructor(props) {
    //dots 是内部计算使用的属性
    super({ dots: [], closePath: true, ...props });
  }

  /**
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
   * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * @overwrite
   * @returns
   */
  protected calcOriginalDimension() {
    //DotPath 需要先计算每个点的坐标，然后才能计算 width/height
    this.calcDots();
    let points = this.calc4VertexPoints();
    let width = Math.abs(points[1].x - points[0].x); //maxX-minX
    let height = Math.abs(points[2].y - points[0].y); //maxY-minY
    this.state.width = width;
    this.state.height = height;
    return { width: this.state.width, height: this.state.height };
  }

  /**
   * 点状路径在重新计算本地原点坐标之后，需要移动内部所有点的位置。
   * @overwrite
   * @returns
   */
  protected calcLocalOrigin(): DOMPoint {
    let origin = super.calcLocalOrigin();

    for (let i = 0; i < this.state.dots.length; i++) {
      let dot = this.state.dots[i];
      dot = dot.matrixTransform(new DOMMatrix([1, 0, 0, 1, -origin.x, -origin.y]));
      this.state.dots[i] = dot;
    }

    return origin;
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

    if (this.state.closePath) {
      this.path2D.closePath();
    }
    return this.path2D;
  }

  /**
   * 计算路径上的关键点:
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   * this.calcOriginalDimension() 会依赖此方法，在计算尺寸时还没有确定原点坐标，所以 calcDots() 方法内部不能依赖原点坐标，只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * @returns
   */
  protected calcDots(): Array<DOMPoint> {
    this.state.dots = [];
    return this.state.dots;
  }

  /**
   *
   * 计算4个顶点：
   * - 相对于组件本地的坐标系，原点位于左上角，没有经过矩阵变换。
   * - 返回值用于计算组件的原始 width/height 。
   *
   * @returns Array<DOMPoint>
   */
  protected calc4VertexPoints(): Array<DOMPoint> {
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
