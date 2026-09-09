/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * @class PolyfillPath2D
 *
 * Path2D 的极简 polyfill：无全局 Path2D 构造函数的运行时（如小程序低版本基础库、
 * Node 环境）中，用它记录路径命令，渲染时再重放到 ctx 当前路径。
 *
 * 仅实现引擎用到的 moveTo/lineTo/rect/ellipse/closePath，其余标准 Path2D 方法未实现。
 */
export default class PolyfillPath2D {
  /** 标记这是 polyfill，用于 ICEPath.doRender 区分原生 Path2D 与命令重放 */
  public _isPolyfill = true;
  /** 记录的命令序列，如 [['rect', 0, 0, 10, 10], ['moveTo', 1, 1], ...] */
  public _commands: Array<Array<any>> = [];
  /** closePath 是幂等标记（doRender 每帧调用），不重复入队 */
  public _closed = false;

  moveTo(x: number, y: number): void {
    this._commands.push(['moveTo', x, y]);
  }

  lineTo(x: number, y: number): void {
    this._commands.push(['lineTo', x, y]);
  }

  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this._commands.push(['bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y]);
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this._commands.push(['quadraticCurveTo', cpx, cpy, x, y]);
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    this._commands.push(['arcTo', x1, y1, x2, y2, radius]);
  }

  rect(x: number, y: number, width: number, height: number): void {
    this._commands.push(['rect', x, y, width, height]);
  }

  ellipse(
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
  }

  closePath(): void {
    this._closed = true;
  }
}
