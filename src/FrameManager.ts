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
  /**
   * 每个总线对应的**宿主**（通常是 ICE 实例），与 `evtBuses` 一一对应。
   * 宿主实现 `needsFrame()`：这一帧还需要继续跑吗？没有宿主（老注册方式）视为"永远需要"。
   */
  hosts: [] as any[],
  stopped: false,

  frameCallback: function (): void {
    for (let i = 0; i < FrameManager.evtBuses.length; i++) {
      if (FrameManager.stopped) return;
      const evtBus = FrameManager.evtBuses[i];
      evtBus.trigger(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT);
    }
    if (FrameManager.stopped) {
      return;
    }
    // 空闲停帧：没有任何总线"需要帧"时停掉循环（省电），等 wake() 再起来。
    // 需要的典型场景：有脏组件要重绘、有动画在推进；都没有就真的什么都不用做。
    if (!FrameManager.needsFrame()) {
      FrameManager.stopped = true;
      return;
    }
    root.requestFrame(FrameManager.frameCallback);
  },

  /** 是否还有总线需要帧（没有宿主 = 老注册方式，按"需要"处理，保持既有行为）。 */
  needsFrame: function (): boolean {
    for (let i = 0; i < FrameManager.evtBuses.length; i++) {
      const host: any = FrameManager.hosts[i];
      if (!host) {
        return true;
      }
      if (typeof host.needsFrame === 'function' && host.needsFrame()) {
        return true;
      }
    }
    return false;
  },

  start: function (): void {
    FrameManager.stopped = false;
    root.requestFrame(FrameManager.frameCallback);
  },

  stop: function (): void {
    FrameManager.stopped = true;
  },

  /**
   * 唤醒帧循环：空闲停帧之后，只要"又有人需要帧"（组件被置脏、动画被加进来）就调它。
   * 循环已经在跑时是空操作（一次布尔判断），可以放心挂在 `dirty = true` 这类高频路径上。
   */
  wake: function (): void {
    if (FrameManager.stopped) {
      FrameManager.start();
    }
  },

  /**
   * @method registerEvtBus  注册事件总线
   *
   * @param evtBus 事件总线
   * @param host   可选宿主（实现 `needsFrame()`）；不传 = 该总线永远需要帧（兼容旧调用）
   */
  registerEvtBus: function (evtBus, host?: any) {
    const index = FrameManager.evtBuses.indexOf(evtBus);
    if (index !== -1) {
      // 重复注册：允许补上/更新宿主
      FrameManager.hosts[index] = host || FrameManager.hosts[index];
      return;
    }
    FrameManager.evtBuses.push(evtBus);
    FrameManager.hosts.push(host || null);
  },

  delEvtBus: function (evtBus) {
    const index = FrameManager.evtBuses.indexOf(evtBus);
    if (index === -1) {
      return;
    }
    FrameManager.evtBuses.splice(index, 1);
    FrameManager.hosts.splice(index, 1);
  },
};

export default FrameManager;
