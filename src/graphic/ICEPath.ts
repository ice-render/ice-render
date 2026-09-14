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
   * 上次构建命令流时的「派生参数代次」（见 `ICEComponent.paramsRev`）。
   * `-1` = 还没建过。
   */
  private __pathRev: number = -1;
  /** 上次构建命令流时的几何签名；`null` = 还没建过。 */
  private __pathSig: any[] | null = null;
  /** 几何签名的复用缓冲（每帧采样一次，避免为每个组件分配数组）。 */
  private __pathSigScratch: any[] = [];
  /** 本类是否提供了精确签名（惰性判定一次，避免给自定义子类每帧白采样）。 */
  private __pathSigPrecise: boolean | undefined = undefined;

  /**
   * 本类是否覆盖了 `__pathSignature()`。
   *
   * 没覆盖的实现（默认返回 `null`）每帧采样都是白费 —— 结果恒为「无法判定」。
   * 判定一次记在实例上，之后直接短路。第三方子类因此完全不付采样的钱。
   */
  private __hasPrecisePathSignature(): boolean {
    if (this.__pathSigPrecise === undefined) {
      this.__pathSigPrecise = this.__pathSignature !== ICEPath.prototype.__pathSignature;
    }
    return this.__pathSigPrecise;
  }

  /**
   * 几何签名：**除「派生参数」之外**还有哪些 state 字段会改变命令流。
   *
   * 返回值的约定（这是本机制的安全边界，子类必须遵守）：
   * - `null`（**默认**）= 本类无法用签名判定 → 维持改造前的行为：`dirty` 就重建。
   *   凡是在 `createPathObject()` 里读了额外 state 字段的自定义子类，都落在这一档上 ——
   *   它们的语义与改造前**逐字一致**，不会因为漏判而画错。
   * - `数组` = 精确判定：与建流时采样下来的那组值逐项 `Object.is` 比较，任一不同即重建。
   *
   * 内置的四个 builder（`ICERect` / `ICEEllipse` / `ICEDotPath` / `ICEPolyLine`）都覆盖了本方法 ——
   * 它们读的字段是封闭的，因此「几何没变」的帧可以安全跳过重建（平移/旋转动画的大头就在这里）。
   *
   * @param out 复用的输出缓冲：实现里请 `push`，不要新建数组
   */
  protected __pathSignature(out: any[]): any[] | null {
    return null;
  }

  /**
   * 命令流是否**可能**已经过期（几何被重算过，或签名里的值变了）。
   *
   * 只管几何，不管 `dirty` —— 调用方自己去与 `dirty` 取交集（`dirty` 的语义是「本帧要重绘」，
   * 祖先移动、平移动画都会置脏，但它们不改变命令流）。
   */
  private __pathStale(): boolean {
    if (!this.__hasPrecisePathSignature()) {
      return true; // 无法判定 → 保守：一律当作过期（调用方再用 dirty 收口）
    }
    if (this.__pathRev !== this.paramsRev) {
      return true; // 派生参数重算过（点集 / 尺寸 / 本地原点都在这一步产出）
    }
    const out = this.__pathSigScratch;
    out.length = 0;
    const sig = this.__pathSignature(out);
    if (sig === null) {
      return true; // 覆盖了却返回 null（子类动态决定不判定）→ 同样保守
    }
    const prev = this.__pathSig;
    if (!prev || prev.length !== sig.length) {
      return true;
    }
    // 用 `!==` 而不是 `Object.is`：前者是单条标量比较，且与改造前的**字符串比较**口径更接近
    //（字符串比较里 NaN 与 NaN 相等、-0 与 0 相等，`!==` 同样如此；`Object.is` 反而不同）。
    for (let i = 0; i < sig.length; i++) {
      if (prev[i] !== sig[i]) {
        return true;
      }
    }
    return false;
  }

  /** 采样并记下当前签名（在命令流**建完之后**调用：`createPathObject()` 可能触发 `ensureDots()`）。 */
  private __capturePathSignature(): void {
    const out = this.__pathSigScratch;
    out.length = 0;
    const sig = this.__pathSignature(out);
    this.__pathSig = sig === null ? null : out.slice();
    this.__pathRev = this.paramsRev;
  }

  /** 按「几何是否真的变了」决定要不要重建命令流（`dirty` 由调用方判断）。 */
  private __rebuildPathIfStale(): void {
    if (!this.__pathStale()) {
      return;
    }
    this.createPathObject();
    this.__capturePathSignature();
  }

  /**
   * 确保路径命令流是最新的。
   *
   * 画布通道里由 `doRender()` 在 dirty 时重建；但**导出 / 服务端出图没有渲染循环**
   * （Node 里连 canvas 都没有），此时必须显式建一次，否则命令流是空的、导出出来一片空白。
   */
  public ensurePathBuilt(): void {
    const commands = this.path2D && this.path2D._commands;
    if (!commands || commands.length === 0 || (this.dirty && this.__pathStale())) {
      this.createPathObject();
      this.__capturePathSignature();
      if (this.state.closePath) {
        this.path2D.closePath();
      }
    }
  }

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
      //@perf 几何没变就不重建命令流：`dirty` 的语义是「本帧要重绘」，
      //       祖先移动 / 只改 left·top·transform 的动画都会置脏，但矩形还是那个矩形 ——
      //       重建 `Path2D` + 重放整条命令流是纯浪费（实测 10k 全动画场景占 2.28ms/帧）。
      this.__rebuildPathIfStale();
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
      ctx.strokeStyle = this.state.lineBorderColor || this.themeOf().semantic.chrome.lineBorder;
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
    // 不再补一次 closePath()：闭合命令已经按它**当时的位置**记在命令流里了
    // （路径可能由多段子路径组成，补在末尾会把最后一段也闭合，与画布不一致）。
  }

  /**
   * @method createPathObject
   * 创建路径对象（原生 Path2D 或 PolyfillPath2D），子类需要提供具体实现，此方法仅创建对象实例，不会立即绘制到画布上，绘制过程由 Renderer 进行调度。
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Path2D/Path2D
   */
  protected abstract createPathObject(): any;
}

export default ICEPath;
