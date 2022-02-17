/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * @class ICEEvent
 * 在 ICE 中，所有事件都会被转化成 ICEEvent 进行处理。
 * ICEEvent 用来模拟 W3C 定义的 Event 接口，ICE 自定义的事件也使用此实现，事件对象上能获取到的属性不同。
 * 从原始 DOM 事件转发出来的 ICEEvent 实例包含 Event 接口上所定义的所有属性，ICE 内部代码创建的 ICEEvent 实例上只包含很少的自定义属性。
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Event
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEEvent {
  public originalEvent: any;
  public target: any;

  constructor(evt: any = {}, data: any = {}) {
    //FIXME:事件对象的属性拷贝需要更加细致的控制
    for (let p in evt) {
      this[p] = evt[p];
    }

    for (let p in data) {
      this[p] = data[p];
    }
  }
}
export default ICEEvent;
