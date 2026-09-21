/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import root from '../cross-platform/root';
import { resolveThemeValue } from '../theme/ICETheme';
import ICEComponent from './ICEComponent';

/**
 * 几何签名的**采样缓冲**（模块级共享，不给实例加字段）。
 *
 * 只在 `__pathStale()` / `__capturePathSignature()` 内部存活：采样完当场比较，或 `slice()` 存成
 * 组件自己的 `__pathSig`。采样过程不会调用别的组件的代码（各 builder 只是往 `out` 里 push 标量），
 * 所以跨组件共享是安全的；每实例一份的话，10 万图元就是 10 万个 12 元素数组（≈12MB）。
 */
const PATH_SIG_SCRATCH: any[] = [];

/**
 * 几何签名 → **指纹**（双 32 位哈希）的实现细节（2026-09-21）。
 *
 * 为什么要哈希：签名只用来做「和上一次一样吗」这一件事，却要按图元常驻。10 万图元的堆快照里
 * `__pathSig` 一项就是 **11.7MB**。改成「长度 + 两个 32 位哈希」后每图元只多 12 字节，
 * 而漏判（碰撞 → 该重建却没重建）的概率是 2⁻⁶⁴ 量级 —— 比"进程被宇宙射线打穿"还低。
 *
 * **口径必须与改造前的逐项 `!==` 比较一致**，逐条对齐：
 * - 数字：`-0` 归一化成 `0`（`-0 === 0` 为真）；`NaN` → `forceStale`（旧实现里 `NaN !== NaN`，
 *   含义就是"每次都当它变了"）。数字按 IEEE754 位型混入（`1` 与 `1.0` 位型相同，正确）。
 * - 字符串 / 布尔 / `undefined` / `bigint`：按值混入（`===` 的语义）。
 * - 对象 / 数组 / 函数：按**引用身份**混入（`WeakMap` 发号），与 `===` 的引用比较等价 ——
 *   同一个引用恒等，换了引用必然换号，既不漏判也不会像"一律 forceStale"那样逼第三方子类每帧重建。
 * - `symbol` / `null`：前者无法做弱引用发号、后者在签名里没有意义，一并 `forceStale`（保守）。
 *
 * 返回值：**函数返回 `forceStale`，哈希值经模块级的 `sigHashH1` / `sigHashH2` 带出** ——
 * 热路径（每帧每个脏图元一次）不分配对象，避免给 GC 添无谓的压力。
 */
const sigF64 = new Float64Array(1);
const sigU32 = new Uint32Array(sigF64.buffer);
/** 对象/函数的引用身份表：弱引用，键没了项就没了，不构成泄漏；值是页内自增号。 */
const SIG_OBJ_IDS = new WeakMap<object, number>();
let nextSigObjId = 1;
let sigHashH1 = 0;
let sigHashH2 = 0;

// 类型标签：直接混值的话，「数字 1」和「字符串 '1'」会撞成同一个指纹。
const SIG_TAG_FLOAT = 1;
const SIG_TAG_STRING = 2;
const SIG_TAG_BOOL = 3;
const SIG_TAG_UNDEFINED = 4;
const SIG_TAG_OBJECT = 5;
const SIG_TAG_BIGINT = 6;

/** 混入一个 32 位字（两条独立的链：一条乘法混淆、一条加法混淆，保证不同位置不可交换）。 */
function sigMix(tag: number, x: number): void {
  let h1 = sigHashH1 ^ Math.imul(tag, 0x9e3779b1);
  h1 = Math.imul(h1 ^ x, 0x01000193);
  sigHashH1 = (h1 ^ (h1 >>> 13)) >>> 0;
  let h2 = (sigHashH2 + x) >>> 0;
  h2 = Math.imul(h2 ^ (h2 >>> 15), 0x85ebca6b);
  sigHashH2 = (h2 ^ (h2 >>> 16)) >>> 0;
}

function sigMixFloat(v: number): void {
  sigF64[0] = v === 0 ? 0 : v; // -0 → 0
  sigMix(SIG_TAG_FLOAT, sigU32[0]);
  sigMix(SIG_TAG_FLOAT, sigU32[1]);
}

function sigMixString(s: string): void {
  for (let i = 0; i < s.length; i++) sigMix(SIG_TAG_STRING, s.charCodeAt(i));
  sigMix(SIG_TAG_STRING, s.length); // 长度也混一次，避免「按字符混」带来的拼接歧义
}

function signatureHash(sig: any[]): boolean {
  sigHashH1 = 0x811c9dc5;
  sigHashH2 = 0x9e3779b9;
  sigMix(0, sig.length);
  for (let i = 0; i < sig.length; i++) {
    const v = sig[i];
    const t = typeof v;
    if (t === 'number') {
      if (v !== v) return true; // NaN
      sigMixFloat(v);
    } else if (t === 'string') {
      sigMixString(v);
    } else if (t === 'boolean') {
      sigMix(SIG_TAG_BOOL, v ? 1 : 0);
    } else if (t === 'undefined') {
      sigMix(SIG_TAG_UNDEFINED, 0);
    } else if (t === 'bigint') {
      sigMixString(String(v));
      sigMix(SIG_TAG_BIGINT, 0);
    } else if (t === 'object' && v !== null) {
      sigMix(SIG_TAG_OBJECT, sigObjIdOf(v));
    } else if (t === 'function') {
      sigMix(SIG_TAG_OBJECT, sigObjIdOf(v));
    } else {
      return true; // symbol / null：无从判定，宁可多重建
    }
  }
  return false;
}

/** 引用身份 → 稳定编号（同一个引用恒等，换了引用必然换号）。 */
function sigObjIdOf(o: object): number {
  let id = SIG_OBJ_IDS.get(o);
  if (!id) {
    id = nextSigObjId++;
    SIG_OBJ_IDS.set(o, id);
  }
  return id;
}

/**
 * **几何 → `Path2D` 的共享缓存**（2026-09-21）。
 *
 * 为什么值得共享：真机 Chrome + V8 堆快照实测（`examples/performance/bench-scene.html`，10 万图元）
 * 里有 **100,018 个 `Path2D`（55.7MB）**，而其中**只有 3 种几何**（10×10 圆、12×12 星、14×14 矩形）。
 * 工艺图/流程图/组件库里的重复符号更是成百上千个同形图元 —— 每个图元各建一份路径，纯属重复。
 *
 * **只对"签名能精确描述几何"的类生效**（`__hasPrecisePathSignature()`，即内置的四个 builder 与
 * 显式实现了 `__pathSignature()` 的第三方子类）：它们的 `createPathObject()` 被契约约束为
 * "只是签名里那些值的纯函数"（见 `__pathSignature` 的注释），因此同一签名 → 同一条路径。
 * 没实现签名的子类继续**每实例一份**（保守，语义与改造前逐字一致）。
 *
 * 生命周期与安全性：
 * - 路径**发布后只读**：`closePath()` 在 `Path2DRecorder` 里是幂等标记（`_closed`），不会重复入队；
 *   除此之外引擎只在 `createPathObject()` 里写它。位置/缩放一律走 CTM，不进路径坐标。
 * - 有上界（`PATH_CACHE_MAX`），按插入顺序淘汰最旧的：路径重建很便宜，淘汰只意味着少共享一次。
 */
const PATH_CACHE = new Map<string, any>();
const PATH_CACHE_MAX = 512;

/**
 * 每个类一个稳定编号（用于缓存键）。
 *
 * 不用 `constructor.name`：打包器会 mangle 类名（引擎的类型注册表就是为此引入 `typeId` 的）。
 * 页内自增编号足够 —— 缓存本身也是页内生命周期。
 */
const CLASS_IDS = new WeakMap<any, number>();
let nextClassId = 1;
function classIdOf(ctor: any): number {
  let id = CLASS_IDS.get(ctor);
  if (!id) {
    id = nextClassId++;
    CLASS_IDS.set(ctor, id);
  }
  return id;
}

/**
 * 清空共享路径缓存（测试用；宿主应用一般不需要 —— 有上界、会按插入顺序淘汰）。
 *
 * 之所以要暴露：它是**模块级**状态，单测之间会互相看到对方建过的几何 ——
 * 断言"这次一定重建了"的用例需要先把它清掉（引擎的 `clearImageBitmaps()` 同理）。
 */
export function clearSharedPathCache(): void {
  PATH_CACHE.clear();
}

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
  /**
   * 上次几何签名的**指纹**（长度 + 两个 32 位哈希），`__pathSigLen === -1` = 还没建过。
   *
   * 为什么不存签名数组本身（2026-09-21）：签名只用于**相等比较**，而它是 12~20 个元素的数组 ——
   * 10 万图元实测 **11.7MB** 常驻（堆快照里 `__pathSig` 一项）。双哈希把"碰撞导致漏判重建"的概率压到
   * 2⁻⁶⁴ 量级，同时**逐条对齐旧语义**：`-0` 与 `0` 视为相等、NaN 一律判"过期"（旧实现里
   * `NaN !== NaN` 就是每帧重建），非原始值（对象 / 数组）一律判"过期"（宁可多重建，不可贴旧图）。
   */
  private __pathSigLen: number = -1;
  private __pathSigH1 = 0;
  private __pathSigH2 = 0;
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
    const out = PATH_SIG_SCRATCH;
    out.length = 0;
    const sig = this.__pathSignature(out);
    if (sig === null) {
      return true; // 覆盖了却返回 null（子类动态决定不判定）→ 同样保守
    }
    if (this.__pathSigLen !== sig.length || this.__pathSigLen < 0) {
      return true;
    }
    if (signatureHash(sig)) {
      return true; // 含 NaN / symbol / null → 与旧口径一致：当作"变了"
    }
    return sigHashH1 !== this.__pathSigH1 || sigHashH2 !== this.__pathSigH2;
  }

  /** 采样并记下当前签名（在命令流**建完之后**调用：`createPathObject()` 可能触发 `ensureDots()`）。 */
  private __capturePathSignature(): void {
    const out = PATH_SIG_SCRATCH;
    out.length = 0;
    const sig = this.__pathSignature(out);
    if (sig === null) {
      this.__pathSigLen = -1;
    } else {
      const forceStale = signatureHash(sig);
      // 含 NaN / symbol / null → 记成"没建过"，下一帧必然重算（与旧实现每帧重建一致）
      this.__pathSigLen = forceStale ? -1 : sig.length;
      this.__pathSigH1 = sigHashH1;
      this.__pathSigH2 = sigHashH2;
    }
    this.__pathRev = this.paramsRev;
  }

  /** 按「几何是否真的变了」决定要不要重建命令流（`dirty` 由调用方判断）。 */
  private __rebuildPathIfStale(): void {
    if (!this.__pathStale()) {
      return;
    }
    this.__buildPath();
  }

  /**
   * 几何 → 缓存键；`null` = 本类不参与共享（自定义子类没提供精确签名，或签名采样失败）。
   *
   * 采样前先 `ensureDots()`：点集是惰性算的，不先铺开的话签名拿到的是"还没算"的空值，
   * 键会分叉（同几何拿不到同一份路径）。
   */
  private __sharedPathKey(): string | null {
    if (!this.__hasPrecisePathSignature()) {
      return null;
    }
    const ensure = (this as any).ensureDots;
    if (typeof ensure === 'function') {
      ensure.call(this);
    }
    const out = PATH_SIG_SCRATCH;
    out.length = 0;
    const sig = this.__pathSignature(out);
    if (sig === null || sig.length === 0) {
      return null;
    }
    let key = String(classIdOf(this.constructor));
    for (let i = 0; i < sig.length; i++) {
      key += '\u0001' + sig[i];
    }
    return key;
  }

  /** 建路径：**先查共享缓存**，未命中才真的建，并把结果登记进去。 */
  private __buildPath(): void {
    const key = this.__sharedPathKey();
    if (key) {
      const hit = PATH_CACHE.get(key);
      if (hit) {
        this.path2D = hit;
        this.__capturePathSignature();
        return;
      }
    }
    this.createPathObject();
    if (key && this.path2D) {
      PATH_CACHE.set(key, this.path2D);
      if (PATH_CACHE.size > PATH_CACHE_MAX) {
        const oldest = PATH_CACHE.keys().next().value;
        PATH_CACHE.delete(oldest);
      }
    }
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
      this.__buildPath();
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

    /**
     * 上屏对象：`path2D` 是 `Path2DRecorder`，这里取它内部的原生 `Path2D`。
     *
     * **没有原生 Path2D 时（headless / 测试桩）只记命令、不上屏**：那条"把命令重放到 ctx"的支路
     * 2026-09-20 已删（见 CHANGELOG 的破坏性小节）—— 现在没有原生 Path2D 就不上屏。
     * 此时**绝不能把记录器对象传给 `ctx.fill/stroke`** —— 浏览器会报
     * "not a valid enum value of type CanvasFillRule" 并把整帧打断（探针实测）。
     *
     * 判定方式：**结构化**（`Path2DRecorder` 恒有 `native` 字段：有原生对象时是它，没有时是 `null`），
     * 不用 `instanceof` —— 同一页可能加载**两份引擎副本**（各示例页/多包组合时就发生过），
     * `instanceof` 会因构造器不同源而失配，把记录器当自定义对象喂给 `ctx.fill()` 直接抛异常
     * （2026-09-20 家族回归实测）。应用/测试直接赋给 `this.path2D` 的自定义对象（公开字段）
     * 没有 `native` 字段 → 原样传给 ctx，行为与从前一致。
     */
    const pathObject: any = this.path2D;
    const drawPath = pathObject && 'native' in pathObject ? pathObject.native : pathObject;

    const lineDash = this.state.lineDash;
    const hasDash = Array.isArray(lineDash) && lineDash.length > 0;
    const isFlow = this.state.lineDashFlow;

    // 蚂蚁线流动时持续重绘
    if (isFlow) {
      this.__ensureFlowAnimation();
    }

    // 水管壁：蚂蚁线外层套一条粗实线（像水管的管壁），画在虚线之前
    const hasBorder = this.state.lineBorder && hasDash;
    if (drawPath && hasBorder && this.state.stroke) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth = (this.state.style.lineWidth || 1) + (this.state.lineBorderWidth || 4) * 2;
      // `lineBorderColor` 是颜色 → 允许写主题引用（'$border' / token(...)），与 style 里的色值同一套解析；
      // 没给就用主题的 chrome.lineBorder。（lineBorderWidth 是几何量，保持数字、不进主题。）
      const borderColor =
        resolveThemeValue(this.state.lineBorderColor, this.themeOf()) || this.themeOf().semantic.chrome.lineBorder;
      ctx.strokeStyle = borderColor;
      ctx.stroke(drawPath);
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

    // 原生 Path2D：直接 fill/stroke 整个路径对象
    if (drawPath) {
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
   * @method createPathObject
   * 创建路径对象（`root.createPath2D()`：原生 `Path2D` 的命令记录包装），子类需要提供具体实现；
   * 此方法仅创建对象实例，不会立即绘制到画布上，绘制过程由 Renderer 进行调度。
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Path2D/Path2D
   */
  protected abstract createPathObject(): any;
}

export default ICEPath;
