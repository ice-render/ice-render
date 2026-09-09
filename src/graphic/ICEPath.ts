/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import root from '../cross-platform/root';
import ICEComponent from './ICEComponent';

/**
 * @abstract
 * @class ICEPath 路径
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class ICEPath extends ICEComponent {
  public path2D: any = root.createPath2D();

  /**
   * @cfg
   * {
   *   dots:[]  //可选参数，路径上的点。
   * }
   * @param props
   */
  constructor(props: any = {}) {
    super({ closePath: true, ...props });
  }

  /**
   * @method doRender
   * @overwrite
   */
  protected doRender(): void {
    if (this.dirty) {
      this.createPathObject();
    }

    if (this.state.closePath) {
      this.path2D.closePath();
    }

    if (this.path2D._isPolyfill) {
      // 无全局 Path2D 的运行时（小程序低版本/Node）：把记录的命令重放到 ctx 当前路径
      this.replayPath();
      if (this.state.fill) {
        this.ctx.fill();
      }
      if (this.state.stroke) {
        this.ctx.stroke();
      }
    } else {
      // 原生 Path2D：直接 fill/stroke 整个路径对象
      if (this.state.fill) {
        this.ctx.fill(this.path2D);
      }
      if (this.state.stroke) {
        this.ctx.stroke(this.path2D);
      }
    }

    super.doRender();
  }

  /**
   * 把 polyfill 记录的命令重放到 ctx 当前路径（beginPath + 命令序列 + closePath）。
   */
  private replayPath(): void {
    const ctx = this.ctx;
    ctx.beginPath();
    const commands = this.path2D._commands;
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      ctx[cmd[0]](...cmd.slice(1));
    }
    if (this.path2D._closed) {
      ctx.closePath();
    }
  }

  /**
   * @method createPathObject
   * 创建路径对象（原生 Path2D 或 PolyfillPath2D），子类需要提供具体实现，此方法仅创建对象实例，不会立即绘制到画布上，绘制过程由 Renderer 进行调度。
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Path2D/Path2D
   */
  protected abstract createPathObject(): any;
}

export default ICEPath;
