import ICEDotPath from '../ICEDotPath';

/**
 * @class ICEIsogon 正多边形
 * 用宽高描述法描述正多边形，方便传参。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEIsogon extends ICEDotPath {
  //外接圆的半径
  public radius: number = 10;
  //边数 N ，正整数
  public edges: number = 3;

  /**
   * radius, edges 会暴露给 AnimationManager ，可能会动态变化。
   * @param props
   */
  constructor(props: any = {}) {
    super({ radius: 10, edges: 3, ...props });
    this.radius = this.props.radius;
    this.edges = this.props.edges;
  }

  /**
   * 计算路径上的关键点:
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   * @returns
   */
  protected calcOriginalDots(): Array<DOMPoint> {
    //求正 N 边形的顶点坐标，极坐标法。
    this.state.dots = [];
    let avgAngle = (2 * Math.PI) / this.state.edges;
    for (let i = 0; i < this.state.edges; i++) {
      let currentAngel = avgAngle * i;
      let x = Math.floor(this.state.radius * Math.cos(currentAngel) + this.state.radius);
      let y = Math.floor(this.state.radius * Math.sin(currentAngel) + this.state.radius);
      this.state.dots.push(new DOMPoint(x, y));
    }
    return this.state.dots;
  }
}
export default ICEIsogon;
