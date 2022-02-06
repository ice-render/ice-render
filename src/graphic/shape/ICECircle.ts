import ICEPath from '../ICEPath';

/**
 * FIXME:采用椭圆绘制方法，正圆形作为椭圆的特殊情况处理。
 * @class ICECircle
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICECircle extends ICEPath {
  constructor(props: any = {}) {
    super({ radius: 10, ...props });
    this.props.width = this.props.radius * 2;
    this.props.height = this.props.radius * 2;
    this.state.width = this.props.radius * 2;
    this.state.height = this.props.radius * 2;
  }

  /**
   * 所有坐标点的坐标都是相对于父层组件，而不是全局坐标。
   * @returns
   */
  protected createPathObject(): Path2D {
    this.path2D = new Path2D();
    this.path2D.arc(
      this.state.radius - this.state.localOrigin.x,
      this.state.radius - this.state.localOrigin.y,
      this.state.radius,
      0,
      Math.PI * 2
    );
    this.path2D.closePath();
    return this.path2D;
  }
}
export default ICECircle;
