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
import { getTheme } from '../theme/ICETheme';

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
class AnimationManager {
  private animationMap = new Map(); //所有需要执行动画的元素都会被自动存入此列表中
  private ice: ICE;
  private paused = false;
  private pausedAt = 0;
  // 已告警过的动画配置：只提示一次，避免非法配置每帧刷屏（WeakSet，不污染会被序列化的 props）
  private warned = new WeakSet<object>();

  constructor(ice: ICE) {
    this.ice = ice;
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
    const animations = el.props.animations;
    const t = isUndefined(now) ? Date.now() : now;
    let hasActive = false;

    for (const key in animations) {
      const animation = animations[key];
      if (animation.finished) {
        continue;
      }
      if (isUndefined(animation.startTime)) {
        animation.startTime = t;
        // 首次解析 motion token（duration 语义名如 'normal' → 数字；easing 语义名如 'out' → 缓动方法名）
        this.__resolveMotion(animation);
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
          `[ICE] 动画属性「${key}」的 duration 必须是正数，当前为 ${String(animation.duration)}；已直接落到终点。`
        );
        this.__writeValue(newState, key, this.__roundIfNeeded(animation, this.__sampleValue(frames, animation, 1)));
        continue;
      }

      // delay：延迟期内保持起始值不推进（可让同一组件的多个属性错峰，或让多个组件的动画成序列）
      const delay = Number(animation.delay) || 0;
      const elapsed = t - animation.startTime - delay;
      if (elapsed < 0) {
        hasActive = true;
        // 延迟期保持起始值，**不取整**（与旧行为一致：组件静止在 from 处）
        this.__writeValue(newState, key, this.__sampleValue(frames, animation, 0));
        continue;
      }

      if (elapsed >= duration) {
        // 到达终点：精确落到终点值，避免浮点残差
        let value = this.__sampleValue(frames, animation, 1);
        if (this.shouldRepeat(animation)) {
          // 需要重复：重置 startTime，重新开始一轮，本帧取新一轮的起点
          animation.startTime = t;
          value = this.__sampleValue(frames, animation, 0);
          hasActive = true;
        } else {
          animation.finished = true;
        }
        this.__writeValue(newState, key, this.__roundIfNeeded(animation, value));
        continue;
      }

      hasActive = true;
      // 关键帧：缓动由各段自己承担，这里传**线性**进度；
      // 单段：用动画级缓动把线性进度映射成缓动后的进度。
      const progress = frames ? elapsed / duration : this.__easingFn(animation.easing, animation)(elapsed / duration);
      this.__writeValue(
        newState,
        key,
        this.__roundIfNeeded(animation, this.__sampleValue(frames, animation, progress))
      );
    }

    if (!hasActive) {
      this.remove(el);
    }
    if (Object.keys(newState).length > 0) {
      el.setState(newState);
    }
    return el;
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

  /** 按进度 p 在 from/to 之间插值：数值直接线性，等长数字数组逐元素。 */
  private __interpolate(from: any, to: any, p: number): any {
    if (typeof from === 'number') {
      return from + (to - from) * p;
    }
    const out = new Array(from.length);
    for (let i = 0; i < from.length; i++) {
      out[i] = from[i] + (to[i] - from[i]) * p;
    }
    return out;
  }

  /** 补间取值是否合法：都是数字，或都是**等长**的数字数组。 */
  private __isTweenable(from: any, to: any): boolean {
    const kind = this.__valueKind(from);
    if (kind === null || kind !== this.__valueKind(to)) {
      return false;
    }
    return kind === 'number' || from.length === to.length;
  }

  /** 取值种类：number | array（非空且全为数字） | null（不支持）。 */
  private __valueKind(value: any): 'number' | 'array' | null {
    if (typeof value === 'number') {
      return 'number';
    }
    if (Array.isArray(value) && value.length > 0) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== 'number') {
          return null;
        }
      }
      return 'array';
    }
    return null;
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
    const fn = typeof name === 'string' ? EasingProgress[name] : undefined;
    if (fn) {
      return fn;
    }
    if (animation) {
      this.__warnOnce(
        animation,
        `[ICE] 未知的缓动「${String(name)}」，已回退为 linear。可用：${Object.keys(EasingProgress).join(' / ')}`
      );
    }
    return EasingProgress.linear;
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

  /** 拒绝一个非法的动画配置：标记结束（不再每帧重试）并只提示一次。 */
  private __reject(animation: any, message: string): void {
    animation.finished = true;
    this.__warnOnce(animation, message);
  }

  /** 同一个动画配置只告警一次，避免非法配置每帧刷屏。 */
  private __warnOnce(animation: any, message: string): void {
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
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public add(component: ICEComponent) {
    this.animationMap.set(component.props.id, component);
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
