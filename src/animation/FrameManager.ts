/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import root from '../cross-platform/root';
import { ICE_CONSTS } from '../ICE_CONSTS';

/**
 * @class FrameManager
 *
 * 帧频控制器，全局单例，请勿创建多个实例。
 * 在同一个 window/global 中，只有一个 FrameManager ，也就是说 FrameManager 是跨 ICE 实例共享的。
 * FrameManager 只负责把 window/global 上的 requestAnimationFrame 回调函数转换成 ICE_CONSTS.ICE_FRAME_EVENT 事件，然后在所有事件总线上进行触发。
 * FrameManager 只触发事件，不进行渲染，渲染操作由对应的 Render 完成。
 *
 * @singleton
 * @see ICE
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */

//FIXME:Move these to global config.
//FIXME:当帧率小于12时，自动跳帧
//FIXME:控制帧率
//FIXME:增量渲染
//FIXME:当动画帧频过高时，会导致 CPU 使用率飙升，页面会卡顿。

const MAX_FRAME_RATE = 60;
const MIN_FRAME_RATE = 12;
const DEFAULT_FRAME_RATE = 24;

const FrameManager = {
  evtBuses: [],

  frameCallback: function (): void {
    FrameManager.evtBuses.forEach((evtBus) => {
      evtBus.trigger(ICE_CONSTS.ICE_FRAME_EVENT);
    });
    root.requestAnimationFrame(FrameManager.frameCallback);
  },

  start: function (): void {
    //TODO:为 Node 平台自定义一个 requestAnimationFrame 函数，签名、参数、调用方式全部相同。
    root.requestAnimationFrame(FrameManager.frameCallback);
  },

  stop: function (): void {},

  pause: function (): void {},

  resume: function (): void {},

  regitserEvtBus: function (evtBus) {
    if (FrameManager.evtBuses.includes(evtBus)) {
      return;
    }
    FrameManager.evtBuses.push(evtBus);
  },

  delEvtBus: function (evtBus) {
    if (!FrameManager.evtBuses.includes(evtBus)) {
      return;
    }
    FrameManager.evtBuses.splice(FrameManager.evtBuses.indexOf(evtBus), 1);
  },
};

export default FrameManager;
