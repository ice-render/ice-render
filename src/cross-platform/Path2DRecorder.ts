/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { resolveRoundRect } from '../util/round-rect';
import type { RoundRectRadii } from '../util/round-rect';

/**
 * @class Path2DRecorder
 *
 * 路径对象的**唯一入口**：一边把命令写给内存里的命令流，一边转发给运行时的原生 Path2D。
 *
 * 为什么需要它：原生 `Path2D` 是不透明的 —— 画得出来，但拿不到「这条路径到底是什么形状」。
 * 而引擎的这几件事都需要**路径的几何描述**，不只是「画出来」：
 *
 * - 导出（SVG / 打印 / 服务端出图）：要把路径转成 `d` 属性；
 * - 测试与调试：可以直接断言「这个形状生成了哪几条命令」，不必截图比对像素。
 *
 * 设计取舍：
 * - **有原生 Path2D 时仍然用原生对象上屏**（`native`），命令流只是顺带记录，渲染路径与旧版
 *   完全一致；`ICEPath.doRender()` 用 `path2D.native || path2D` 取上屏对象。
 * - **没有原生 Path2D 时**（headless / 测试桩）退化为纯记录器：命令流仍然可用（导出、断言），
 *   但**不会自己重放命令去上屏** —— 那条支路是给"没有 Path2D 也要能画"的旧运行时用的，
 *   2026-09-20 已删（现在没有原生 Path2D 就不再支持上屏）。
 * - 路径是**几何变化时才重建**（`doRender` 只在 dirty 时调用 `createPathObject()`），因此
 *   记录带来的开销只发生在路径重建时，不在每帧热路径上。
 *
 * 命令格式（与外部消费者 / 导出器约定一致）：
 * `[['moveTo', x, y], ['rect', x, y, w, h], ['roundRect', x, y, w, h, radii], ...]`
 */
export default class Path2DRecorder {
  /** 记录的命令序列 */
  public _commands: Array<Array<any>> = [];
  /** closePath 是幂等标记（doRender 每帧调用），不重复入队 */
  public _closed = false;
  /** 原生 Path2D（有则上屏直接用它，命令流仍然记录）；无则为 null */
  public readonly native: any = null;
  /**
   * 原生对象是否支持 `roundRect`（构造时判定一次，路径重建是热路径）。
   *
   * `roundRect` 是 2021 年进入 Canvas 2D 规范的成员（Chrome 99 / Safari 16.4 / Firefox 112 起），
   * 目标运行时（现代浏览器 + Node/headless）基本都有；**没有时不能少画一层圆角**，见 `roundRect()` 的兜底。
   */
  private readonly __nativeRoundRect: boolean;
  /** 当前点（画布 arcTo / 圆弧的语义依赖它），[x, y]；空表示没有当前子路径 */
  private __current: [number, number] | null = null;
  /** 当前子路径的起点（closePath 后当前点回到这里） */
  private __subpathStart: [number, number] | null = null;

  constructor(native: any = null) {
    this.native = native || null;
    this.__nativeRoundRect = !!(this.native && typeof this.native.roundRect === 'function');
  }

  public moveTo(x: number, y: number): void {
    this._commands.push(['moveTo', x, y]);
    this.__current = [x, y];
    this.__subpathStart = [x, y];
    if (this.native) {
      this.native.moveTo(x, y);
    }
  }

  public lineTo(x: number, y: number): void {
    this._commands.push(['lineTo', x, y]);
    this.__current = [x, y];
    if (this.native) {
      this.native.lineTo(x, y);
    }
  }

  public bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this._commands.push(['bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y]);
    this.__current = [x, y];
    if (this.native) {
      this.native.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }
  }

  public quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this._commands.push(['quadraticCurveTo', cpx, cpy, x, y]);
    this.__current = [x, y];
    if (this.native) {
      this.native.quadraticCurveTo(cpx, cpy, x, y);
    }
  }

  /**
   * 圆角/切线圆弧。
   *
   * canvas 的 `arcTo` 依赖「当前点 + 控制点 + 半径」的切线关系，**SVG 没有对应命令**。
   * 这里在记录阶段就把它**还原成 `lineTo(切点) + arc(圆心, 半径, 起止角)`**：
   *
   * - 出口是标准命令流，SVG 导出（以及任何重放到 ctx 的运行时）都不需要再懂 arcTo；
   * - 原生 Path2D 收到的是等价的 lineTo/arc，渲染结果与直接 arcTo 一致；
   * - 圆角矩形（ICERect 的 radius）就是靠它才能导出成真正的圆角，否则导出会变成切角。
   *
   * 数学：设 P0 = 当前点、P1 = 控制点、P2 = 终点，u = 单位(P0−P1)、v = 单位(P2−P1)，
   * 夹角 θ = ∠(u,v)，切点到 P1 的距离 t = r / tan(θ/2)，圆心在角平分线上距 P1 为 r / sin(θ/2)。
   */
  public arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    const r = Math.abs(Number(radius) || 0);
    const from = this.__current;
    if (!from || r === 0) {
      // 与 canvas 一致：半径非法时退化为「直线到控制点」
      this.lineTo(x1, y1);
      return;
    }
    const ux0 = from[0] - x1;
    const uy0 = from[1] - y1;
    const vx0 = x2 - x1;
    const vy0 = y2 - y1;
    const len0 = Math.sqrt(ux0 * ux0 + uy0 * uy0);
    const len1 = Math.sqrt(vx0 * vx0 + vy0 * vy0);
    if (len0 === 0 || len1 === 0) {
      this.lineTo(x1, y1);
      return;
    }
    const ux = ux0 / len0;
    const uy = uy0 / len0;
    const vx = vx0 / len1;
    const vy = vy0 / len1;
    const cross = ux * vy - uy * vx;
    const dot = Math.max(-1, Math.min(1, ux * vx + uy * vy));
    if (Math.abs(cross) < 1e-9 || Math.abs(dot) >= 1 - 1e-9) {
      // 共线（继续直行或掉头）：canvas 同样退化为直线
      this.lineTo(x1, y1);
      return;
    }
    const angle = Math.acos(dot);
    const tangentLength = r / Math.tan(angle / 2);
    const t1x = x1 + ux * tangentLength;
    const t1y = y1 + uy * tangentLength;
    const t2x = x1 + vx * tangentLength;
    const t2y = y1 + vy * tangentLength;
    const bx = ux + vx;
    const by = uy + vy;
    const blen = Math.sqrt(bx * bx + by * by) || 1;
    const centerDistance = r / Math.sin(angle / 2);
    const cx = x1 + (bx / blen) * centerDistance;
    const cy = y1 + (by / blen) * centerDistance;
    const startAngle = Math.atan2(t1y - cy, t1x - cx);
    const endAngle = Math.atan2(t2y - cy, t2x - cx);
    this.lineTo(t1x, t1y);
    // 屏幕上（y 轴向下）叉积为负表示顺时针方向，与 canvas 的 counterclockwise 取反
    this.arc(cx, cy, r, startAngle, endAngle, cross > 0);
  }

  public rect(x: number, y: number, width: number, height: number): void {
    this._commands.push(['rect', x, y, width, height]);
    // canvas：rect() 开新子路径，当前点回到矩形起点
    this.__current = [x, y];
    this.__subpathStart = [x, y];
    if (this.native) {
      this.native.rect(x, y, width, height);
    }
  }

  /**
   * 圆角矩形（`roundRect`，2021 年进入 Canvas 2D 规范的成员）。
   *
   * 这是引擎里**最值得吃规范红利**的一个：圆角矩形是流程图 / 卡片 / 面板 / 图例的主力形状，
   * 改造前由 `ICERect` 用 4 次 `arcTo` 手撸（展开后 14 条命令，每个角一次
   * `sqrt/acos/tan/atan2` 三角运算），而平台自己一次调用就能做完。
   *
   * 三件事分开记，各取所需：
   * - **命令流**只记 1 条 `['roundRect', x, y, w, h, radii]` —— 导出器拿它生成等价的 SVG `d`；
   * - **有原生 `roundRect`**：原样转发（渲染交给平台）；
   * - **没有**（老 Safari / 某些 headless 的路径实现）：就地展开成
   *   `moveTo / lineTo / arcTo` 序列转给原生对象 —— 与原生**逐像素一致**
   *   （真机 12 组边角场景实测差异像素 0/120000，回归 `e2e/visual/round-rect-parity.spec.ts`）。
   *
   * 语义对齐原生：`radii` 支持数字或 1~4 个值的数组，负半径抛 `RangeError`，
   * 全 0 退化为 `rect()`，负宽高按视觉方向镜像。规则集中在 `util/round-rect.ts`。
   */
  public roundRect(x: number, y: number, width: number, height: number, radii: RoundRectRadii): void {
    // 先校验再入队/转发：非法半径（负数 / 数组长度不是 1~4）原生会抛，这里同样抛，
    // 免得上屏用的是原生（抛）而导出走记录器（不抛），两边对同一份数据给出不同结论。
    const geometry = resolveRoundRect(x, y, width, height, radii);
    if (geometry.plain) {
      // 规范：四角都为 0 时 roundRect 与 rect 等价
      this.rect(x, y, width, height);
      return;
    }
    // 数组半径拷一份再入队：命令流是**几何描述**，不该被调用方事后改了同一个数组而悄悄变样
    const recorded = Array.isArray(radii) ? (radii as number[]).slice() : radii;
    this._commands.push(['roundRect', x, y, width, height, recorded]);
    if (this.native) {
      if (this.__nativeRoundRect) {
        this.native.roundRect(x, y, width, height, radii);
      } else {
        this.__forwardRoundRectAsArcTo(geometry);
      }
    }
    // 与原生一致：roundRect 已是一条闭合子路径，当前点停在「左上角弧的起点」
    const [tl] = geometry.radii;
    this.__current = [geometry.x + tl, geometry.y];
    this.__subpathStart = [geometry.x + tl, geometry.y];
  }

  /**
   * 没有原生 `roundRect` 时的**转发**兜底：把归一化后的几何拆成 `moveTo / lineTo / arcTo`，
   * 直接交给原生对象（**不进命令流** —— 命令流里那一条 `roundRect` 才是这次调用的记录）。
   *
   * 用 `arcTo` 而不是自己算 `arc`：canvas 的切线圆角语义由平台实现，少一层三角函数、也少一处可能算错的地方。
   */
  private __forwardRoundRectAsArcTo(g: { x: number; y: number; width: number; height: number; radii: number[] }): void {
    const [tl, tr, br, bl] = g.radii;
    const x = g.x;
    const y = g.y;
    const w = g.width;
    const h = g.height;
    const native = this.native;
    native.moveTo(x + tl, y);
    native.lineTo(x + w - tr, y);
    native.arcTo(x + w, y, x + w, y + tr, tr);
    native.lineTo(x + w, y + h - br);
    native.arcTo(x + w, y + h, x + w - br, y + h, br);
    native.lineTo(x + bl, y + h);
    native.arcTo(x, y + h, x, y + h - bl, bl);
    native.lineTo(x, y + tl);
    native.arcTo(x, y, x + tl, y, tl);
    native.closePath();
  }

  /**
   * 圆弧。**必须实现**：事件圆等形状用的是 `arc`，早先的记录器没有实现它，
   * 于是「无原生 Path2D」的运行时（headless / 测试桩）画这类形状会直接抛
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
    this.__current = [x + radius * Math.cos(endAngle), y + radius * Math.sin(endAngle)];
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
    this.__current = [
      x + radiusX * Math.cos(endAngle) * Math.cos(rotation) - radiusY * Math.sin(endAngle) * Math.sin(rotation),
      y + radiusX * Math.cos(endAngle) * Math.sin(rotation) + radiusY * Math.sin(endAngle) * Math.cos(rotation),
    ];
    if (this.native) {
      this.native.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise);
    }
  }

  public closePath(): void {
    this._closed = true;
    // 闭合必须**记在当前这个位置**，不能只留个末尾标志：路径里可能有多段子路径
    // （典型：池/泳道 = 闭合矩形 + 一条名称带分隔线），只记末尾标志的话，导出时
    // 那条分隔线会被闭合到起点 —— 表现为「矩形缺一条边、还多出一条对角斜线」。
    // 幂等：`ICEPath.doRender()` 每帧都会调 closePath()，同一位置只记一次，避免命令流无限增长。
    const last = this._commands[this._commands.length - 1];
    if (!last || last[0] !== 'closePath') {
      this._commands.push(['closePath']);
    }
    // 与 canvas 一致：闭合后当前点回到子路径起点
    this.__current = this.__subpathStart ? [this.__subpathStart[0], this.__subpathStart[1]] : null;
    if (this.native) {
      this.native.closePath();
    }
  }

  /** 当前点（只读；调试与测试用） */
  public get currentPoint(): [number, number] | null {
    return this.__current;
  }
}
