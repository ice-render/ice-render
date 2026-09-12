/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * @class Path2DRecorder
 *
 * 路径对象的**唯一入口**：一边把命令写给内存里的命令流，一边转发给运行时的原生 Path2D。
 *
 * 为什么需要它：原生 `Path2D` 是不透明的 —— 画得出来，但拿不到「这条路径到底是什么形状」。
 * 而引擎的这几件事都需要**路径的几何描述**，不只是「画出来」：
 *
 * - 导出（SVG / 打印 / 服务端出图）：要把路径转成 `d` 属性；
 * - 服务端 / 小程序（无原生 Path2D）：要靠命令流重放到 ctx（原先只有 PolyfillPath2D 能做到）；
 * - 测试与调试：可以直接断言「这个形状生成了哪几条命令」，不必截图比对像素。
 *
 * 设计取舍：
 * - **有原生 Path2D 时仍然用原生对象上屏**（`native`），命令流只是顺带记录，渲染路径与旧版
 *   完全一致；`ICEPath.doRender()` 用 `path2D.native || path2D` 取上屏对象。
 * - **没有原生 Path2D 时**（小程序低版本 / Node）退化为纯记录器：`_isPolyfill` 为真，
 *   `ICEPath` 走「重放命令到 ctx」的老路径，行为与之前的 PolyfillPath2D 一致。
 * - 路径是**几何变化时才重建**（`doRender` 只在 dirty 时调用 `createPathObject()`），因此
 *   记录带来的开销只发生在路径重建时，不在每帧热路径上。
 *
 * 命令格式与 PolyfillPath2D 一致（也被 `replayPath()` 复用）：
 * `[['moveTo', x, y], ['rect', x, y, w, h], ...]`
 */
export default class Path2DRecorder {
  /** 标记「没有原生 Path2D，需要重放命令」——与 PolyfillPath2D 的语义保持一致 */
  public _isPolyfill: boolean;
  /** 记录的命令序列 */
  public _commands: Array<Array<any>> = [];
  /** closePath 是幂等标记（doRender 每帧调用），不重复入队 */
  public _closed = false;
  /** 原生 Path2D（有则上屏直接用它，命令流仍然记录）；无则为 null */
  public readonly native: any = null;

  constructor(native: any = null) {
    this.native = native || null;
    this._isPolyfill = !this.native;
  }

  /** 上屏对象：有原生就用原生，否则用记录器自己（配合 replayPath 重放） */
  public get drawable(): any {
    return this.native || this;
  }

  public moveTo(x: number, y: number): void {
    this._commands.push(['moveTo', x, y]);
    if (this.native) {
      this.native.moveTo(x, y);
    }
  }

  public lineTo(x: number, y: number): void {
    this._commands.push(['lineTo', x, y]);
    if (this.native) {
      this.native.lineTo(x, y);
    }
  }

  public bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this._commands.push(['bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y]);
    if (this.native) {
      this.native.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }
  }

  public quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this._commands.push(['quadraticCurveTo', cpx, cpy, x, y]);
    if (this.native) {
      this.native.quadraticCurveTo(cpx, cpy, x, y);
    }
  }

  public arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    this._commands.push(['arcTo', x1, y1, x2, y2, radius]);
    if (this.native) {
      this.native.arcTo(x1, y1, x2, y2, radius);
    }
  }

  public rect(x: number, y: number, width: number, height: number): void {
    this._commands.push(['rect', x, y, width, height]);
    if (this.native) {
      this.native.rect(x, y, width, height);
    }
  }

  /**
   * 圆弧。**必须实现**：事件圆等形状用的是 `arc`，此前 PolyfillPath2D 没有它，
   * 于是「无原生 Path2D」的运行时（Node / 小程序低版本）画这类形状会直接抛
   * `path.arc is not a function` —— 这正是服务端出图要修的第一件事。
   */
  public arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise: boolean = false
  ): void {
    this._commands.push(['arc', x, y, radius, startAngle, endAngle, counterclockwise]);
    if (this.native) {
      this.native.arc(x, y, radius, startAngle, endAngle, counterclockwise);
    }
  }

  public ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise: boolean
  ): void {
    this._commands.push(['ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise]);
    if (this.native) {
      this.native.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise);
    }
  }

  public closePath(): void {
    this._closed = true;
    if (this.native) {
      this.native.closePath();
    }
  }
}
