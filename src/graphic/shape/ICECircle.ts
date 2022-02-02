import ICEPath from '../ICEPath';

/**
 * @class ICECircle
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICECircle extends ICEPath {
  constructor(props: any = {}) {
    super({ radius: 10, ...props });
  }

  /**
   * 所有坐标点的坐标都是相对于父层组件，而不是全局坐标。
   * @returns
   */
  protected createPathObject(): Path2D {
    this.path2D = new Path2D();
    this.path2D.arc(
      this.state.radius - this.state.absoluteOrigin.x,
      this.state.radius - this.state.absoluteOrigin.y,
      this.state.radius,
      0,
      Math.PI * 2
    );
    this.path2D.closePath();
    return this.path2D;
  }

  /**
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * @returns
   */
  protected calcOriginalDimension() {
    this.state.width = this.props.radius * 2;
    this.state.height = this.props.radius * 2;
    return { width: this.state.width, height: this.state.height };
  }
}
export default ICECircle;
