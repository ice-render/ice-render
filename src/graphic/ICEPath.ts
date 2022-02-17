/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEBaseComponent from './ICEBaseComponent';

/**
 * @class ICEPath
 *
 * 路径
 *
 * @abstract
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class ICEPath extends ICEBaseComponent {
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

  /**
   * 空实现。
   *
   * @see ICEBaseComponent.initEvents
   * @overwrite
   */
  protected initEvents() {}

  /**
   * @method doRender
   * @overwrite
   */
  protected doRender(): void {
    //创建 Path2D 对象，doRender() 方法仅创建对象实例，不会立即绘制到画布上，绘制过程由 FrameManager 进行调度。
    //@see FrameManager.ts
    //@see https://developer.mozilla.org/en-US/docs/Web/API/Path2D/Path2D
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
