/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { isString } from '../util/lang';
import { isUndefined } from '../util/lang';
import ICE_EVENT_NAME_CONSTS from '../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from '../event/ICEEvent';
import ICEComponent from '../graphic/ICEComponent';
import ICE from '../ICE';
import { EasingProgress } from './Easing';
import { resolveEasing } from './easing-registry';
import { classifyValue, interpolateValue, isInterpolatable } from './interpolators';
import {
  ICE_ANIMATION_DIAGNOSTIC_CODES,
  ICEAnimationDiagnostic,
  ICEAnimationDiagnosticCode,
} from './validate-animations';
import { getTheme } from '../theme/ICETheme';
import root from '../cross-platform/root';
import FrameManager from '../FrameManager';
import AnimationTimeline from './AnimationTimeline';

/**
 * @class AnimationManager
 *
 * 动画管理器
 *
 * - 全局单例，一个 ICE 实例上只能有一个 AnimationManager 的实例。
 *
 * @singleton
 * @see ICE
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
/**
 * 读系统偏好 `prefers-reduced-motion: reduce`。
 * 无 DOM / 没有 matchMedia 的运行时（Node / headless）返回 false —— 引擎不替应用猜偏好。
 */
function readPrefersReducedMotion(): boolean {
  try {
    const mm =
      (root as any) && typeof (root as any).matchMedia === 'function'
        ? (root as any).matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    return !!(mm && mm.matches);
  } catch (err) {
    return false;
  }
}

class AnimationManager {
  private animationMap = new Map(); //所有需要执行动画的元素都会被自动存入此列表中
  private ice: ICE;
  private paused = false;
  private pausedAt = 0;
  /**
   * 飞行中的**平移**是否吸附到设备像素栅格（默认开）。
   *
   * 为什么需要它：离屏位图的纯平移复用（`ObjectCache.refreshPosition`）要求位移是**整数设备像素**，
   * 否则会退化成每帧重建位图（实测 1000 个文本：可复用 2.5ms/帧 vs 重建 32~41ms/帧）。
   * 吸附只作用于「纯平移 + 当前可离屏缓存」的组件，且**动画终点值永远精确写入**（配置 100.5 就落在 100.5）。
   * 需要极致平滑的应用可以整体关掉（`ice.animationManager.snapToDevicePixel = false`），
   * 或对单条动画写 `snapToDevicePixel: false`。
   */
  public snapToDevicePixel = true;
  /**
   * 「减少动态效果」：用户系统偏好（`prefers-reduced-motion: reduce`）为真时，**动画直接落终点**
   * （不播放位移/缩放过程），只保留最终状态 —— 这是无障碍上最保守、最可预期的语义。
   *
   * 默认在构造时读一次 `root.matchMedia`（无 DOM 运行时为 false）；应用层可用
   * `ice.setReducedMotion(true/false)` 显式覆盖（也能接自己的偏好设置）。
   */
  public reducedMotion = false;
  // 已告警过的动画配置：只提示一次，避免非法配置每帧刷屏（WeakSet，不污染会被序列化的 props）
  private warned = new WeakSet<object>();
  /** 运行期诊断（见 getDiagnostics）：按 code|path 去重。 */
  private __diagnostics: ICEAnimationDiagnostic[] = [];
  private __diagnosticKeys: string[] = [];
  /** 当前正在处理的属性路径（`__easingFn` 记诊断时要用，避免把 path 一层层传下去）。 */
  private __currentPath = '';
  /** 已告警过的回调异常（key|name），避免写错的回调每帧刷屏。 */
  private __callbackWarned: string[] = [];

  constructor(ice: ICE) {
    this.ice = ice;
    this.reducedMotion = readPrefersReducedMotion();
  }

  public start() {
    this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEventHandler, this);
    return this;
  }

  public stop() {
    this.ice.evtBus.off(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEventHandler, this);
    return this;
  }

  private frameEventHandler(evt: ICEEvent) {
    if (this.paused) {
      return;
    }
    // 一帧只取一次时间：既省去每个动画一次 Date.now()，也保证同一帧内各属性时间一致
    const now = Date.now();
    const arr = [...this.animationMap.values()];
    for (let i = 0; i < arr.length; i++) {
      const el = arr[i];
      //在动画过程中，对象不响应所有交互事件，防止影响属性值的计算。
      //注意：必须**保存并恢复原值**，不能直接置回 true —— 否则会覆盖用户显式设置的
      //`interactive: false`（组件本意不可交互，动画跑完就被强制变成可交互）。
      const prevInteractive = el.state.interactive;
      el.state.interactive = false;
      this.tween(el, now);
      el.state.interactive = prevInteractive;
    }
  }

  /**
   * 把值按点路径写入目标对象（支持 `transform.rotate` / `style.globalAlpha` 这类嵌套字段）。
   *
   * 旧实现直接 `newState[key] = value`，键里的点会被当成**字面量键名**，
   * 于是 `animations: { 'transform.rotate': ... }` 静默失效（既不报错也不生效）。
   * 多段路径共用同一父级时会逐段合并（`transform.rotate` 与 `transform.scale` 不互相覆盖）。
   */
  private __writeValue(target: any, path: string, value: any): void {
    const dot = path.indexOf('.');
    if (dot === -1) {
      target[path] = value;
      return;
    }
    const head = path.slice(0, dot);
    const rest = path.slice(dot + 1);
    if (!target[head] || typeof target[head] !== 'object') {
      target[head] = {};
    }
    this.__writeValue(target[head], rest, value);
  }

  /**
   * 每一帧推进动画：计算各属性的取值。
   *
   * 支持三种配置形态（同一组件上可混用）：
   * 1. 单段补间：`{ from, to, duration }`
   * 2. 关键帧时间轴：`{ keyframes: [{ offset, value, easing? }], duration }`
   *    - `offset` 为 0~1 的时间占比，缺省时按数组顺序均分，超出 [0,1] 会被夹紧；
   *    - `easing` 写在**段起始关键帧**上，作用于「该帧 → 下一帧」这一段；未写则用动画级 `easing`；
   *    - 时间轴之外的取值分别是首帧 / 末帧的值（保持，不外推）。
   * 3. 缓动可用主题 motion token 语义名（`duration: 'normal'` / `easing: 'out'`）或 EasingProgress 方法名。
   *
   * 取值可以是**数值**，也可以是**等长的数字数组**（`transform.scale` / `transform.translate` /
   * `transform.skew` 等逐元素补间）。
   *
   * 结束判定按**已流逝时间**而非「值是否越过 to」：弹簧类缓动中途会过冲（越过 to 再回落），
   * 若按值判定，第一帧过冲就会被误判成结束、动画提前停在过冲点上。
   */
  private tween(el: ICEComponent, now?: number) {
    const newState: any = {};
    // 本帧实际写出的键路径：决定"要不要置 paramsDirty"（见 __commitAnimationState）
    const writtenPaths: string[] = [];
    const write = (path: string, value: any): void => {
      writtenPaths.push(path);
      this.__writeValue(newState, path, value);
    };
    const animations = el.props.animations;
    const t = isUndefined(now) ? Date.now() : now;
    let hasActive = false;

    for (const key in animations) {
      this.__currentPath = key;
      const animation = animations[key];
      if (animation.finished) {
        continue;
      }
      if (isUndefined(animation.startTime)) {
        animation.startTime = t;
        // 首次解析 motion token（duration 语义名如 'normal' → 数字；easing 语义名如 'out' → 缓动方法名）
        this.__resolveMotion(animation);
        animation.__iteration = 0;
        // onStart：进入这条动画时触发一次（回调异常不打断帧循环，见 __invokeCallback）
        this.__invokeCallback(
          animation,
          key,
          'onStart',
          this.__callbackContext(el, key, animation, animation.from, 0, 0)
        );
      }
      if (isUndefined(animation.easing)) {
        animation.easing = 'linear';
      }

      // 关键帧形态：解析并缓存归一化后的时间轴（非法时为 null）
      let frames: any[] | undefined;
      if (Array.isArray(animation.keyframes)) {
        const normalized = this.__normalizeKeyframes(animation);
        if (!normalized) {
          this.__reject(
            animation,
            ICE_ANIMATION_DIAGNOSTIC_CODES.KEYFRAMES_INVALID,
            key,
            `[ICE] 动画属性「${key}」的 keyframes 非法：需要 ≥2 帧、offset 为数字、各帧取值同型（都是数字或等长的数字数组）；已跳过。`
          );
          continue;
        }
        frames = normalized;
      } else if (!this.__isTweenable(animation.from, animation.to)) {
        // 旧实现在非数值上会算出 NaN 并写进 state，对 transform.* 这类数组字段会直接产生
        // NaN 矩阵（静默损坏渲染）。这里明确拒绝并只提示一次。
        this.__reject(
          animation,
          ICE_ANIMATION_DIAGNOSTIC_CODES.VALUE_NOT_INTERPOLATABLE,
          key,
          `[ICE] 动画属性「${key}」的取值必须都是数字或等长的数字数组，当前为 ` +
            `${this.__describe(animation.from)} → ${this.__describe(animation.to)}；已跳过。`
        );
        continue;
      }

      const duration = Number(animation.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        // 无效时长：旧实现会算出 NaN / Infinity；from === to 时甚至永远无法结束（每帧空转 setState）。
        // 这里明确「立即落到终点并结束」，不再让组件滞留在动画列表里。
        this.__reject(
          animation,
          ICE_ANIMATION_DIAGNOSTIC_CODES.DURATION_INVALID,
          key,
          `[ICE] 动画属性「${key}」的 duration 必须是正数，当前为 ${String(animation.duration)}；已直接落到终点。`
        );
        write(key, this.__roundIfNeeded(animation, this.__sampleValue(frames, animation, 1)));
        continue;
      }

      // 「次要动画降频」：`fps` 给了就按这个频率更新（缺省 = 每帧）。
      // 采样是**按时间**的，跳过帧不会改变运动曲线（只是采样更稀），所以可以安全降频。
      const fps = Number(animation.fps);
      if (Number.isFinite(fps) && fps > 0 && fps < 240) {
        const minInterval = 1000 / fps;
        const last = Number(animation.__lastTick);
        if (Number.isFinite(last) && t - last < minInterval - 1) {
          hasActive = true; // 还在动画中（只是这一帧不更新）—— 保持"需要帧"
          continue;
        }
        animation.__lastTick = t;
      }

      // 「减少动态效果」（prefers-reduced-motion: reduce）：不播放过程，直接落终点、只留最终状态。
      // 放在 duration 校验之后 —— 非法配置照旧报错（无障碍偏好不该掩盖配置错误）。
      if (this.reducedMotion) {
        this.__recordDiagnostic(
          ICE_ANIMATION_DIAGNOSTIC_CODES.REDUCED_MOTION,
          key,
          `[ICE] 用户开启了「减少动态效果」：动画属性「${key}」直接落到终态（未播放过程）。`,
          'warning'
        );
        animation.finished = true;
        write(key, this.__roundIfNeeded(animation, this.__sampleValue(frames, animation, 1)));
        continue;
      }

      const direction = this.__directionOf(animation);
      const iteration = Number(animation.__iteration) || 0;
      // 这一轮的"起点/终点"进度（alternate 的奇偶轮会交换）
      const startProgress = this.__roundStartProgress(direction, iteration);
      const endProgress = this.__roundEndProgress(direction, iteration);

      // delay：延迟期内保持起始值不推进（可让同一组件的多个属性错峰，或让多个组件的动画成序列）
      const delay = Number(animation.delay) || 0;
      const elapsed = t - animation.startTime - delay;
      if (elapsed < 0) {
        hasActive = true;
        // 延迟期保持**本轮的起点值**，**不取整**（与旧行为一致：组件静止在起点处）
        write(key, this.__sampleValue(frames, animation, startProgress));
        continue;
      }

      if (elapsed >= duration) {
        // 到达终点：精确落到本轮终点值，避免浮点残差
        let value = this.__sampleValue(frames, animation, endProgress);
        if (this.shouldRepeat(animation)) {
          // 需要重复：重置 startTime、轮次 +1，本帧取新一轮的起点
          animation.startTime = t;
          animation.__iteration = iteration + 1;
          const nextStart = this.__roundStartProgress(direction, animation.__iteration);
          value = this.__sampleValue(frames, animation, nextStart);
          hasActive = true;
          this.__invokeCallback(
            animation,
            key,
            'onRepeat',
            this.__callbackContext(el, key, animation, value, 1, animation.__iteration)
          );
        } else {
          animation.finished = true;
          this.__invokeCallback(
            animation,
            key,
            'onComplete',
            this.__callbackContext(el, key, animation, value, 1, iteration)
          );
        }
        // 终点/新一轮起点：**精确写入**（不吸附，保证"配置多少就落在多少"）
        write(key, this.__roundIfNeeded(animation, value));
        continue;
      }

      hasActive = true;
      const linear = elapsed / duration;
      // 关键帧：缓动由各段自己承担，这里传**线性**进度；
      // 单段：用动画级缓动把线性进度映射成缓动后的进度。
      const eased = frames ? linear : this.__easingFn(animation.easing, animation)(linear);
      // 方向：reverse 直接反转；alternate 在奇数轮反向（yoyo）
      const progress = this.__applyDirection(eased, direction, iteration);
      const sampled = this.__sampleValue(frames, animation, progress);
      // 飞行中：纯平移可吸附到设备像素栅格（命中位图纯平移复用），其余键原样
      const value = this.__roundIfNeeded(animation, this.__snapTranslation(el, key, animation, sampled));
      this.__invokeCallback(
        animation,
        key,
        'onUpdate',
        this.__callbackContext(el, key, animation, value, linear, iteration)
      );
      write(key, value);
    }

    if (!hasActive) {
      this.remove(el);
    }
    if (Object.keys(newState).length > 0) {
      this.__commitAnimationState(el, newState, writtenPaths);
    }
    return el;
  }

  /**
   * 动画写值通道：把本帧的新值提交给组件。
   *
   * 与直接 `setState` 的区别只有一点 —— **只在必要时才置 `paramsDirty`**：
   * 本帧写出的键**全部**落在组件的「动画安全键」白名单里（纯绘制/变换）时跳过派生参数重算。
   * 判定由组件自己给（`isAnimationSafeKey`），未声明白名单的组件/第三方组件一律走旧路径（每帧置脏）。
   */
  private __commitAnimationState(el: any, newState: any, writtenPaths: string[]): void {
    let paramsDirty = true;
    if (writtenPaths.length > 0 && typeof el.isAnimationSafeKey === 'function') {
      paramsDirty = !writtenPaths.every((path) => el.isAnimationSafeKey(path));
    }
    el.setState(newState, { paramsDirty });
  }

  /**
   * 飞行中的**纯平移**吸附到设备像素栅格（`1 / 设备缩放` 的整数倍）。
   *
   * 三个前提缺一不可：① 实例开关打开且该动画没写 `snapToDevicePixel: false`；
   * ② 键是纯平移（`left` / `top` / `transform.translate`）；③ 该组件当前**可离屏缓存**
   * （只有这时吸附才换得来位图复用；无渲染器的运行时/测试替身自动跳过）。
   */
  private __snapTranslation(el: any, path: string, animation: any, value: any): any {
    if (!this.snapToDevicePixel) return value;
    if (animation && animation.snapToDevicePixel === false) return value;
    if (path !== 'left' && path !== 'top' && path !== 'transform.translate') return value;
    if (!this.__isBitmapReusable(el)) return value;
    const scale = this.__deviceScale();
    if (!(scale > 0)) return value;
    return this.__snapValue(value, scale);
  }

  /** 渲染视口的缩放（= dpr × 视口 scale）——设备像素与世界单位的换算比例。 */
  private __deviceScale(): number {
    const ice: any = this.ice;
    if (ice && typeof ice.getRenderViewport === 'function') {
      const vp = ice.getRenderViewport();
      if (vp && Number(vp.scale) > 0) {
        return Number(vp.scale);
      }
    }
    return 1;
  }

  /** 该组件当前是否走离屏缓存（只有它才谈得上"位图纯平移复用"）。判定权在渲染器，这里只查询。 */
  private __isBitmapReusable(el: any): boolean {
    const ice: any = this.ice;
    const cache = ice && ice.renderer && ice.renderer.cache;
    if (!cache || typeof cache.isCachable !== 'function') {
      return false;
    }
    try {
      return !!cache.isCachable(el);
    } catch (err) {
      return false;
    }
  }

  /** 数值按设备像素栅格吸附；数组逐元素（`transform.translate`）。 */
  private __snapValue(value: any, scale: number): any {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.round(value * scale) / scale : value;
    }
    if (Array.isArray(value)) {
      const out = value.slice();
      for (let i = 0; i < out.length; i++) {
        if (typeof out[i] === 'number' && Number.isFinite(out[i])) {
          out[i] = Math.round(out[i] * scale) / scale;
        }
      }
      return out;
    }
    return value;
  }

  /** 取进度 p 处的值：单段在 from→to 之间插值；关键帧按段插值（段内进度再经该段缓动）。 */
  private __sampleValue(frames: any[] | undefined, animation: any, p: number): any {
    if (!frames) {
      return this.__interpolate(animation.from, animation.to, p);
    }
    const first = frames[0];
    const last = frames[frames.length - 1];
    if (p <= first.offset) {
      return first.value;
    }
    if (p >= last.offset) {
      return last.value;
    }
    for (let i = 0; i < frames.length - 1; i++) {
      const a = frames[i];
      const b = frames[i + 1];
      if (p < a.offset || p > b.offset) {
        continue;
      }
      const span = b.offset - a.offset;
      if (span <= 0) {
        // 同一 offset 上的重复帧：后者胜出（与排序后的书写顺序一致）
        return b.value;
      }
      const u = (p - a.offset) / span;
      const easing = this.__easingFn(isUndefined(a.easing) ? animation.easing : a.easing, animation);
      return this.__interpolate(a.value, b.value, easing(u));
    }
    return last.value;
  }

  /**
   * 按进度 p 在 from/to 之间插值：数值 / 等长数字数组 / **颜色** / 带单位数字串
   * （判定与求值都在 `interpolators.ts`，与校验器同源）。
   */
  private __interpolate(from: any, to: any, p: number): any {
    return interpolateValue(from, to, p);
  }

  /** 补间取值是否合法（数值 / 等长数字数组 / 颜色 / 同单位数字串）—— 判定见 interpolators。 */
  private __isTweenable(from: any, to: any): boolean {
    return isInterpolatable(from, to);
  }

  /** 取值种类（转发到插值器，保持既有私有方法名可用）。 */
  private __valueKind(value: any): any {
    return classifyValue(value);
  }

  /** 归一化关键帧到 animation.__frames（只做一次）：夹紧 offset、排序、校验各帧取值同型。 */
  private __normalizeKeyframes(animation: any): any[] | null {
    if (animation.__frames) {
      return animation.__frames;
    }
    const raw = animation.keyframes;
    if (!Array.isArray(raw) || raw.length < 2) {
      return null;
    }
    const frames: any[] = [];
    for (let i = 0; i < raw.length; i++) {
      const f = raw[i] || {};
      const offset = isUndefined(f.offset) ? i / (raw.length - 1) : Number(f.offset);
      if (!Number.isFinite(offset)) {
        return null;
      }
      frames.push({ offset: Math.min(1, Math.max(0, offset)), value: f.value, easing: f.easing });
    }
    frames.sort((a, b) => a.offset - b.offset);
    const kind = this.__valueKind(frames[0].value);
    if (kind === null) {
      return null;
    }
    const len = kind === 'array' ? frames[0].value.length : 0;
    for (let i = 1; i < frames.length; i++) {
      if (this.__valueKind(frames[i].value) !== kind) {
        return null;
      }
      if (kind === 'array' && frames[i].value.length !== len) {
        return null;
      }
    }
    animation.__frames = frames;
    return frames;
  }

  /** 解析缓动名 → 归一化进度函数；未知名称回退 linear 并只提示一次。 */
  private __easingFn(name: any, animation?: any): EasingProgress {
    // 函数（临时自定义）→ 内置名 → 应用层注册名；都没有才回退 linear
    const fn = resolveEasing(name);
    if (fn) {
      return fn;
    }
    if (animation) {
      this.__warnOnce(
        animation,
        ICE_ANIMATION_DIAGNOSTIC_CODES.EASING_UNKNOWN,
        this.__currentPath || '',
        `[ICE] 未知的缓动「${String(name)}」，已回退为 linear。可用：${Object.keys(EasingProgress).join(' / ')}`
      );
    }
    return EasingProgress.linear;
  }

  /** 动画方向（缺省 `'normal'`；非法的方向由 `validateAnimations` 在运行前拦住）。 */
  private __directionOf(animation: any): 'normal' | 'reverse' | 'alternate' {
    const direction = animation && animation.direction;
    return direction === 'reverse' || direction === 'alternate' ? direction : 'normal';
  }

  /** 把缓动后的进度按方向映射：`reverse` 反转；`alternate` 在奇数轮反向（yoyo）。 */
  private __applyDirection(progress: number, direction: 'normal' | 'reverse' | 'alternate', iteration: number): number {
    if (direction === 'reverse') {
      return 1 - progress;
    }
    if (direction === 'alternate' && iteration % 2 === 1) {
      return 1 - progress;
    }
    return progress;
  }

  /** 本轮**起点**对应的进度（alternate 的奇数轮从另一端出发）。 */
  private __roundStartProgress(direction: 'normal' | 'reverse' | 'alternate', iteration: number): number {
    return this.__applyDirection(0, direction, iteration);
  }

  /** 本轮**终点**对应的进度。 */
  private __roundEndProgress(direction: 'normal' | 'reverse' | 'alternate', iteration: number): number {
    return this.__applyDirection(1, direction, iteration);
  }

  /** 回调上下文：给应用层足够信息做链式编排（不用再去读 state 反推进度）。 */
  private __callbackContext(
    el: any,
    key: string,
    animation: any,
    value: any,
    progress: number,
    iteration: number
  ): any {
    return { component: el, key, value, progress, iteration, animation };
  }

  /**
   * 触发生命周期回调（`onStart` / `onUpdate` / `onRepeat` / `onComplete`）。
   *
   * 回调异常**绝不打断帧循环**（一个写错的回调不该让整个场景卡死）：吞掉异常、记一条
   * `ICE_ANIM_CALLBACK_ERROR` 诊断并 `console.warn` 一次。
   */
  private __invokeCallback(animation: any, key: string, name: string, context: any): void {
    const callback = animation && animation[name];
    if (typeof callback !== 'function') {
      return;
    }
    try {
      callback(context);
    } catch (err: any) {
      this.__recordDiagnostic(
        ICE_ANIMATION_DIAGNOSTIC_CODES.CALLBACK_ERROR,
        key,
        `[ICE] 动画属性「${key}」的 ${name} 回调抛异常：${err && err.message ? err.message : String(err)}`
      );
      if (this.__callbackWarned.indexOf(key + '|' + name) === -1) {
        this.__callbackWarned.push(key + '|' + name);
        console.warn(`[ICE] 动画属性「${key}」的 ${name} 回调抛异常，已忽略（不影响动画推进）：`, err);
      }
    }
  }

  /** round: true 时对补间结果取整（数组逐元素）。 */
  private __roundIfNeeded(animation: any, value: any): any {
    if (!animation.round) {
      return value;
    }
    if (typeof value === 'number') {
      return Math.round(value);
    }
    return value.map((v: number) => Math.round(v));
  }

  /** 供告警信息使用的取值描述。 */
  private __describe(value: any): string {
    return Array.isArray(value) ? `数组[${value.length}]` : typeof value;
  }

  /** 拒绝一个非法的动画配置：标记结束（不再每帧重试）、只提示一次，并记一条结构化诊断。 */
  private __reject(animation: any, code: ICEAnimationDiagnosticCode, path: string, message: string): void {
    animation.finished = true;
    this.__warnOnce(animation, code, path, message);
  }

  /**
   * 记录一条诊断（`getDiagnostics()` 可读）并只 `console.warn` 一次，避免非法配置每帧刷屏。
   *
   * 诊断的 code / severity / path 与 `validateAnimations()` 同源：**运行期才发现被跳过的配置，
   * 与编译期校验报出的是同一组码**，Agent / 应用层不需要学两套。
   */
  private __warnOnce(animation: any, code: ICEAnimationDiagnosticCode, path: string, message: string): void {
    this.__recordDiagnostic(code, path, message);
    if (!animation || typeof animation !== 'object') {
      console.warn(message);
      return;
    }
    if (this.warned.has(animation)) {
      return;
    }
    this.warned.add(animation);
    console.warn(message);
  }

  /** 记一条结构化诊断（按 `code|path` 去重；只留文本，不含动画对象本身）。 */
  private __recordDiagnostic(
    code: ICEAnimationDiagnosticCode,
    path: string,
    message: string,
    severity: 'error' | 'warning' = 'error'
  ): void {
    const key = `${code}|${path}`;
    if (this.__diagnosticKeys.indexOf(key) !== -1) {
      return;
    }
    this.__diagnosticKeys.push(key);
    this.__diagnostics.push({ severity, code, message, path });
  }

  /**
   * 运行期累积的动画诊断（非法配置被跳过 / 缓动回退时会记录）。
   *
   * 与 `validateAnimations()` 的分工：那个是**运行前**的纯校验（Agent / DSL 用），
   * 这个是**运行中**真实发生过的拒绝与回退（应用层可上报 / 开发期断言）。
   */
  public getDiagnostics(): ICEAnimationDiagnostic[] {
    return this.__diagnostics.slice();
  }

  /** 清空运行期诊断（测试 / 重新加载场景时用）。 */
  public clearDiagnostics(): void {
    this.__diagnostics.length = 0;
    this.__diagnosticKeys.length = 0;
  }

  /**
   * 把动画配置里的 motion token 语义名解析成实际值（首次触发时执行，结果写回 animation 对象缓存）：
   * - duration: 'fast' | 'normal' | 'slow' | 'slower' → 主题 motion.duration 里的 ms。
   * - easing: 'linear' | 'out' | 'inOut' | 'outQuart' | 'spring' | 'springSoft' | 'springSnappy'
   *   → 主题 motion.easing 里的缓动方法名。
   * 若传的是数字/已存在的 Easing 方法名，则原样保留（向后兼容）。
   */
  private __resolveMotion(animation: any): void {
    // 优先用实例级主题（多品牌/多租户下 motion token 也应各自解析）
    const theme = (this.ice && this.ice.theme) || getTheme();
    const motion = theme.semantic.motion;
    if (typeof animation.duration === 'string' && motion.duration[animation.duration] !== undefined) {
      animation.duration = motion.duration[animation.duration];
    }
    if (typeof animation.easing === 'string' && motion.easing[animation.easing] !== undefined) {
      animation.easing = motion.easing[animation.easing];
    }
  }

  /**
   * 判断动画到达终点后是否重复播放：
   * - loop === true：无限循环；
   * - iterationCount > 1：剩余次数递减，直到 1 次后结束。
   */
  private shouldRepeat(animation: any): boolean {
    if (animation.loop === true) {
      return true;
    }
    if (typeof animation.iterationCount === 'number' && animation.iterationCount > 1) {
      animation.iterationCount--;
      return true;
    }
    return false;
  }

  /**
   * 暂停所有动画（冻结进度，恢复时从暂停处继续）。
   */
  public pause() {
    if (this.paused) {
      return;
    }
    this.paused = true;
    this.pausedAt = Date.now();
  }

  /**
   * 恢复所有动画：把每个动画的 startTime 往后移，抵消暂停期间的流逝。
   */
  public resume() {
    if (!this.paused) {
      return;
    }
    const pausedDuration = Date.now() - this.pausedAt;
    const arr = [...this.animationMap.values()];
    for (const el of arr) {
      const animations = el.props.animations;
      for (const key in animations) {
        const animation = animations[key];
        if (!isUndefined(animation.startTime)) {
          animation.startTime += pausedDuration;
        }
      }
    }
    this.paused = false;
    // 恢复 = 进度又开始推进：空闲停帧之后要唤醒帧循环（e2e 抓到的真实缺陷）
    if (this.animationMap.size > 0) {
      FrameManager.wake();
    }
  }

  public isPaused(): boolean {
    return this.paused;
  }

  /**
   * 是否有"还在推进"的动画（`ICE.needsFrame()` 用它决定要不要继续要帧）。
   *
   * 暂停时返回 false：暂停期间动画进度不推进，继续跑帧纯属空转（空闲停帧会因此把 rAF 停掉，
   * 恢复时 `resume()` 会调整 startTime，进度从暂停处接上）。
   */
  public hasActiveAnimations(): boolean {
    return !this.paused && this.animationMap.size > 0;
  }

  /**
   * 新建一条时间轴（编排多个组件/属性的时序）。见 `AnimationTimeline` 的文档与 18 §3。
   *
   * ```js
   * ice.animationManager.timeline()
   *   .add(cardA, { left: { from: 0, to: 100, duration: 400 } }, { at: 0 })
   *   .add(cardB, { left: { from: 0, to: 100, duration: 400 } }, { at: '+=120' })
   *   .play();
   * ```
   */
  public timeline(): AnimationTimeline {
    return new AnimationTimeline(this);
  }

  /**
   * 重播某个组件的全部动画：清掉运行时状态（startTime / finished / 轮次 / 降频节拍）后重新纳入管理。
   *
   * 与 `add()` 的区别：`add()` 只是"确保它在管理器的列表里"（跑完的动画不会自己重播），
   * `replay()` 才是"从头再放一遍"。时间轴的 `restart()` 就是用它实现的。
   */
  public replay(component: any): this {
    const animations = component && component.props && component.props.animations;
    if (animations) {
      for (const key in animations) {
        const animation = animations[key];
        animation.startTime = undefined;
        animation.finished = false;
        animation.__iteration = 0;
        animation.__lastTick = undefined;
      }
      this.add(component);
    }
    return this;
  }

  /** 这个组件的动画现在还在推进吗（跑完 / 被 stop / 已从管理器摘除 → false）。 */
  public isAnimating(component: any): boolean {
    const animations = component && component.props && component.props.animations;
    if (!animations || !this.animationMap.has(component.props.id)) {
      return false;
    }
    for (const key in animations) {
      if (!animations[key].finished) {
        return true;
      }
    }
    return false;
  }

  public add(component: ICEComponent) {
    this.animationMap.set(component.props.id, component);
    // 新动画 = "这一帧有事要做"：空闲停帧之后必须唤醒（否则动画要等下一次别的置脏才开始跑）
    FrameManager.wake();
  }

  public remove(el: any) {
    if (isString(el)) {
      this.animationMap.delete(el);
    } else {
      this.animationMap.delete(el.props.id);
    }
  }
}

export default AnimationManager;
