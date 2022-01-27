import EventTarget from './EventTarget';

/**
 * @class EventTarget
 * EventBus, global singleton.
 * EventBus 是 EventTarget 接口的实现类，ICE 内部的全局事件总线。
 * EventBus 的用途：
 * - 把外层 DOM 上的原生时间转发到 canvas 内部(mouse/keyboard/touch)
 * - requestAnimationFrame 触发的事件
 * - ICE 内部需要使用事件总线的实现
 *
 * @singleton
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class EventBus extends EventTarget {
  constructor(props: any = {}) {
    super();
  }
}

export default EventBus;
