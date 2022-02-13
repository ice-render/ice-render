import ICEComponent from './ICEComponent';

/**
 * @class ICEPath
 * 路径，抽象类。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class ICEPath extends ICEComponent {
  public path2D: Path2D = new Path2D();

  /**
   * @cfg
   * {
   *   dots:Array<DOMPoint>  //可选参数，路径上的点。
   * }
   * @param props
   */
  constructor(props: any = {}) {
    super({ closePath: true, ...props });
  }

  protected doRender(): void {
    //创建 Path2D 对象，此时仅仅创建出对象实例，但还没有绘制到画布上，绘制过程由 FrameManager 进行调度。 @see https://developer.mozilla.org/en-US/docs/Web/API/Path2D/Path2D
    this.createPathObject();

    this.ctx.beginPath();
    if (this.state.closePath) {
      this.ctx.fill(this.path2D);
    }
    this.ctx.stroke(this.path2D);

    super.doRender();
  }

  /**
   * @method createPathObject
   * 创建路径对象，子类需要提供具体实现。
   */
  protected abstract createPathObject(): Path2D;
}

export default ICEPath;
