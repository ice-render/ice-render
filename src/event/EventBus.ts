/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEventTarget from './ICEEventTarget';

/**
 * @class EventBus
 * @singleton
 *
 * EventBus 事件总线。
 *
 * - canvas 标签内部没有事件机制，ICE 借助于 EventBus 把原生 DOM 事件转发到 canvas 内部(mouse/keyboard/touch)，在转发过程中可能会把原生 DOM 事件转换成 ICEEvent 。
 * - EventBus 是 ICEEventTarget 的实现类。
 * - EventBus 是全局单例，同一个 ICE 实例上只能有一个事件总线的实例。
 * - ICE 内部几乎所有机制都依赖事件总线来实现。
 * - requestAnimationFrame 会利用事件总线触发 FRAME 事件。
 *
 * @see ICEEventTaregt
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class EventBus extends ICEEventTarget {
  constructor(props: any = {}) {
    super();
  }
}

export default EventBus;
