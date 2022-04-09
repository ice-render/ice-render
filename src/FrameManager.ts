/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE_EVENT_NAME_CONSTS from './consts/ICE_EVENT_NAME_CONSTS';
import root from './cross-platform/root';

/**
 * @singleton
 * @class FrameManager 帧频控制器
 *
 * - 全局单例，请勿创建多个实例。
 * - 在同一个 window/global 中，只有一个 FrameManager ，也就是说 FrameManager 是跨 ICE 实例共享的。
 * - FrameManager 只负责把 window/global 上的 requestAnimationFrame 回调函数转换成 ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT 事件，然后在所有事件总线上进行触发。
 * - FrameManager 只触发事件，不进行渲染，渲染操作由对应的 Render 完成。
 * - FrameManager 与 EventBus 之间是一对多的关系，一个 FrameManager 上可以注册多个事件总线，因为同一个页面上可能会存在多幅画面。
 *
 * @see ICE
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const FrameManager = {
  evtBuses: [],
  stopped: false,

  frameCallback: function (): void {
    for (let i = 0; i < FrameManager.evtBuses.length; i++) {
      if (FrameManager.stopped) return;
      const evtBus = FrameManager.evtBuses[i];
      evtBus.trigger(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT);
    }
    if (!FrameManager.stopped) {
      root.requestFrame(FrameManager.frameCallback);
    }
  },

  start: function (): void {
    FrameManager.stopped = false;
    root.requestFrame(FrameManager.frameCallback);
  },

  stop: function (): void {
    FrameManager.stopped = true;
  },

  /**
   * @method registerEvtBus  注册事件总线
   */
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
