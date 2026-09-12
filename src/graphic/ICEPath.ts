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

    // 上屏对象：path2D 是 Path2DRecorder 时取它内部的原生 Path2D（无原生则取记录器自身，
    // 走下面的 replayPath 重放命令）。路径构建与上屏解耦，导出器才能复用同一条命令流。
    const drawPath = this.path2D.drawable || this.path2D;

    const lineDash = this.state.lineDash;
    const hasDash = Array.isArray(lineDash) && lineDash.length > 0;
    const isFlow = this.state.lineDashFlow;

    // 蚂蚁线流动时持续重绘
    if (isFlow) {
      this.__ensureFlowAnimation();
    }

    // 水管壁：蚂蚁线外层套一条粗实线（像水管的管壁），画在虚线之前
    const hasBorder = this.state.lineBorder && hasDash;
    if (hasBorder && this.state.stroke) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth = (this.state.style.lineWidth || 1) + (this.state.lineBorderWidth || 4) * 2;
      ctx.strokeStyle = this.state.lineBorderColor || '#c8c8c8';
      if (this.path2D._isPolyfill) {
        this.replayPath();
        ctx.stroke();
      } else {
        ctx.stroke(drawPath);
      }
      ctx.restore();
    }

    // 虚线：描边前设置（仅影响 stroke，不影响 fill）
    if (hasDash && typeof this.ctx.setLineDash === 'function') {
      this.ctx.setLineDash(lineDash);
      if (isFlow && typeof this.ctx.lineDashOffset === 'number') {
        const period = lineDash.reduce((a: number, b: number) => a + b, 0) || 1;
        const speed = this.state.lineDashFlowSpeed || 60;
        this.ctx.lineDashOffset = -((Date.now() / 1000) * speed) % period;
      } else if (this.state.lineDashOffset) {
        this.ctx.lineDashOffset = this.state.lineDashOffset;
      }
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
        this.ctx.fill(drawPath);
      }
      if (this.state.stroke) {
        this.ctx.stroke(drawPath);
      }
    }

    // 描边后重置虚线，避免影响后续组件
    if (hasDash && typeof this.ctx.setLineDash === 'function') {
      this.ctx.setLineDash([]);
    }

    super.doRender();
  }

  private __flowRegistered = false;

  /**
   * 蚂蚁线流动依赖持续重绘：注册一个 loop 动画，让 AnimationManager 每帧 setState 触发 dirty。
   * 真正的流动位置由 doRender 里的 Date.now() 计算，动画本身只负责"每帧重绘"。
   */
  private __ensureFlowAnimation(): void {
    if (this.__flowRegistered) {
      return;
    }
    this.__flowRegistered = true;
    this.props.animations = {
      ...this.props.animations,
      __flow: { from: 0, to: 1, duration: 100, loop: true },
    };
    if (this.ice && this.ice.animationManager) {
      this.ice.animationManager.add(this);
    }
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
