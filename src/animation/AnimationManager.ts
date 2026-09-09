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
    const arr = [...this.animationMap.values()];
    for (let i = 0; i < arr.length; i++) {
      const el = arr[i];
      //在动画过程中，对象不响应所有交互事件，防止影响属性值的计算。
      el.state.interactive = false;
      this.tween(el);
      el.state.interactive = true;
    }
  }

  /**
   * 每一帧推进动画：计算各属性的缓动值。
   * - 各属性独立计时（各自维护 duration/startTime），全部结束后把对象从动画列表移除。
   * - 支持 loop（无限循环）与 iterationCount（播放次数）。
   * - 支持 from > to 的递减动画。
   */
  private tween(el: ICEComponent) {
    const newState: any = {};
    const animations = el.props.animations;
    let hasActive = false;

    for (const key in animations) {
      const animation = animations[key];
      if (animation.finished) {
        continue;
      }
      if (isUndefined(animation.startTime)) {
        animation.startTime = Date.now();
      }
      if (isUndefined(animation.easing)) {
        animation.easing = 'linear';
      }

      let newValue = Easing[animation.easing](animation.from, animation.to, animation.duration, animation.startTime);
      const reachedEnd = animation.to >= animation.from ? newValue >= animation.to : newValue <= animation.to;
      if (reachedEnd) {
        newValue = animation.to;
        if (this.shouldRepeat(animation)) {
          // 需要重复：重置 startTime，重新开始一轮，并重算本帧值（从 from 开始）
          animation.startTime = Date.now();
          newValue = Easing[animation.easing](animation.from, animation.to, animation.duration, animation.startTime);
          hasActive = true;
        } else {
          animation.finished = true;
        }
      } else {
        hasActive = true;
      }
      newState[key] = Math.floor(newValue);
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
