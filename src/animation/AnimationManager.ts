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
import Easing from './Easing';
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
   * 每一帧推进动画：计算各属性的缓动值。
   * - 各属性独立计时（各自维护 duration/startTime），全部结束后把对象从动画列表移除。
   * - 支持 loop（无限循环）与 iterationCount（播放次数）。
   * - 支持 from > to 的递减动画。
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
        // 首次解析 motion token（duration 语义名如 'normal' → 数字；easing 语义名如 'out' → Easing 方法名）
        this.__resolveMotion(animation);
      }
      if (isUndefined(animation.easing)) {
        animation.easing = 'linear';
      }

      // 只支持**数值**属性：旧实现在非数值上会算出 NaN 并写进 state，
      // 对 transform.scale / translate / skew 这类数组字段会直接产生 NaN 矩阵（静默损坏渲染）。
      // 这里明确拒绝并提示一次，而不是让它悄悄坏掉。
      if (typeof animation.from !== 'number' || typeof animation.to !== 'number') {
        if (!animation.__rejected) {
          animation.__rejected = true;
          animation.finished = true;
          console.warn(
            `[ICE] 动画属性「${key}」的 from/to 必须都是数字，当前为 ${typeof animation.from}/${typeof animation.to}；已跳过。` +
              `（数组型字段如 transform.scale/translate/skew 暂不支持补间，请改为动画其数值子属性或自行在外部补间）`
          );
        }
        continue;
      }

      // delay：延迟期内保持起始值不推进（可用来让同一组件的多个属性错峰，或让多个组件的动画成序列）
      const delay = Number(animation.delay) || 0;
      if (delay > 0 && t - animation.startTime < delay) {
        hasActive = true;
        this.__writeValue(newState, key, animation.from);
        continue;
      }

      // Easing 内部自行读 Date.now()，因此把 delay 折算到 startTime 上
      const startTime = animation.startTime + delay;
      let newValue = Easing[animation.easing](animation.from, animation.to, animation.duration, startTime);
      const reachedEnd = animation.to >= animation.from ? newValue >= animation.to : newValue <= animation.to;
      if (reachedEnd) {
        newValue = animation.to;
        if (this.shouldRepeat(animation)) {
          // 需要重复：重置 startTime，重新开始一轮，并重算本帧值（从 from 开始）
          animation.startTime = t;
          newValue = Easing[animation.easing](animation.from, animation.to, animation.duration, animation.startTime);
          hasActive = true;
        } else {
          animation.finished = true;
        }
      } else {
        hasActive = true;
      }

      // 默认**不取整**：旧实现对所有属性 Math.floor，会让 0→1 的透明度、角度、缩放彻底失真。
      // 需要整数步进（例如像素级位移想要锐利边缘）时显式声明 `round: true`。
      if (animation.round) {
        newValue = Math.round(newValue);
      }
      this.__writeValue(newState, key, newValue);
    }

    if (!hasActive) {
      this.remove(el);
    }
    if (Object.keys(newState).length > 0) {
      el.setState(newState);
    }
    return el;
  }

  /**
   * 把动画配置里的 motion token 语义名解析成实际值（首次触发时执行，结果写回 animation 对象缓存）：
   * - duration: 'fast' | 'normal' | 'slow' | 'slower' → 主题 motion.duration 里的 ms。
   * - easing: 'linear' | 'out' | 'inOut' | 'outQuart' → 主题 motion.easing 里的 Easing 方法名。
   * 若传的是数字/已存在的 Easing 方法名，则原样保留（向后兼容）。
   */
  private __resolveMotion(animation: any): void {
    const motion = getTheme().semantic.motion;
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
