/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEComponent from './ICEComponent';

/**
 * @class ICEPath
 *
 * 路径
 *
 * @abstract
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class ICEPath extends ICEComponent {
  public path2D: Path2D = new Path2D();

  /**
   * @cfg
   * {
   *   dots:[]  //可选参数，路径上的点。
   * }
   * @param props
   */
  constructor(props: any = {}) {
    super({ closePath: true, fill: true, stroke: true, ...props });
  }

  /**
   * @method doRender
   * @overwrite
   */
  protected doRender(): void {
    this.ctx.beginPath();

    this.createPathObject();

    //FIXME:想办法减少已下3条指令的执行次数
    if (this.state.closePath) {
      this.ctx.closePath();
    }
    if (this.state.fill) {
      this.ctx.fill(this.path2D);
    }
    if (this.state.stroke) {
      this.ctx.stroke(this.path2D);
    }

    super.doRender();
  }

  /**
   * @method createPathObject
   * 创建 Path2D 对象，子类需要提供具体实现，此方法仅创建对象实例，不会立即绘制到画布上，绘制过程由 Renderer 进行调度。
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Path2D/Path2D
   */
  protected abstract createPathObject(): Path2D;
}

export default ICEPath;
