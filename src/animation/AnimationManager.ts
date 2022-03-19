/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import isString from 'lodash/isString';
import isUndefined from 'lodash/isUndefined';
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
    this.animationMap.forEach((el: ICEComponent) => {
      //在动画过程中，对象不响应鼠标或者触摸交互，防止影响属性值的计算。
      el.state.interactive = false;
      this.tween(el);
      el.state.interactive = true;
    });
  }

  //TODO:处理无限循环播放的情况，处理播放次数的情况
  //TODO:每一个属性变化的持续时间不同，需要做同步处理，所有动画都执行完毕之后，需要把对象从动画列表中删除
  private tween(el: ICEComponent) {
    let newState: any = {};
    let animations = el.props.animations;
    let finishCounter = 1;

    for (let key in animations) {
      let animation = animations[key];
      if (animation.finished) {
        finishCounter++;
        //元素上的所有动画效果都已经执行完毕，从动画列表中删除， FIXME: 处理无限循环动画的问题
        if (finishCounter === Object.keys(animations).length) {
          this.remove(el);
          break;
        }
        continue;
      }
      let from = animation.from;
      let to = animation.to;
      let duration = animation.duration;
      if (isUndefined(animation.startTime)) {
        animation.startTime = Date.now();
      }
      if (isUndefined(animation.easing)) {
        animation.easing = 'linear';
      }
      let newValue = Easing[animation.easing](from, to, duration, animation.startTime);
      if (newValue > to) {
        newValue = to;
        animation.finished = true;
      }
      newState[key] = Math.floor(newValue); //使用整数个像素点
    }

    el.setState({ ...newState });
    return el;
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
