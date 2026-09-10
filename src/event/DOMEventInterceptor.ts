/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { keyboardEvents, mouseEvents } from '../consts/DOM_EVENT_MAPPING_CONSTS';
import root from '../cross-platform/root';

/**
 * @class DOMEventInterceptor DOM 事件拦截器
 *
 * 拦截所有原生的鼠标和键盘事件，拦截到的事件全部转发到全局事件总线上去， ICE 内部的事件转发器会监听事件总线，把事件派发到 canvas 内部特定的组件上去。
 *
 * 全局只绑定一套 DOM 监听：事件到来时遍历当前所有事件总线转发。
 * 这样重复 init / 多实例 / React StrictMode 双挂载都不会叠加监听，且 stop() 可以真正解绑。
 *
 * @see {DOMEventDispatcher}
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const DOMEventInterceptor = {
  //在同一个 window 中可能存在多个 ICE 实例，每一个 ICE 实例上都有一条事件总线，这里把多个事件总线实例隔开。
  evtBuses: [] as any[],

  //全局唯一的 DOM 监听句柄：start 时绑定、stop 时解绑；null 表示当前未绑定。
  __handlers: null as null | Array<{ name: string; handler: (evt: any) => void }>,

  /**
   * @method start 绑定全局 DOM 监听（幂等：重复调用不会重复绑定）
   */
  start: function (): void {
    if (!root || !root.addEventListener || DOMEventInterceptor.__handlers) {
      return;
    }
    const domEvts = [...mouseEvents, ...keyboardEvents];
    const handlers: Array<{ name: string; handler: (evt: any) => void }> = [];
    for (let i = 0; i < domEvts.length; i++) {
      const item = domEvts[i];
      const handler = (domEvt: any) => {
        //转发给当前所有事件总线（总线可能在运行期增删，因此每次动态遍历）
        for (let j = 0; j < DOMEventInterceptor.evtBuses.length; j++) {
          DOMEventInterceptor.evtBuses[j].trigger(item[1], domEvt);
        }
      };
      root.addEventListener(item[0], handler);
      handlers.push({ name: item[0], handler });
    }
    DOMEventInterceptor.__handlers = handlers;
  },

  /**
   * @method stop 解绑全局 DOM 监听
   */
  stop: function (): void {
    if (DOMEventInterceptor.__handlers && root && root.removeEventListener) {
      for (let i = 0; i < DOMEventInterceptor.__handlers.length; i++) {
        const item = DOMEventInterceptor.__handlers[i];
        root.removeEventListener(item.name, item.handler);
      }
    }
    DOMEventInterceptor.__handlers = null;
  },

  registerEvtBus: function (evtBus: any): void {
    if (DOMEventInterceptor.evtBuses.includes(evtBus)) {
      return;
    }
    DOMEventInterceptor.evtBuses.push(evtBus);
  },

  delEvtBus: function (evtBus: any): void {
    if (!DOMEventInterceptor.evtBuses.includes(evtBus)) {
      return;
    }
    DOMEventInterceptor.evtBuses.splice(DOMEventInterceptor.evtBuses.indexOf(evtBus), 1);
    //没有任何总线时不再需要全局监听
    if (DOMEventInterceptor.evtBuses.length === 0) {
      DOMEventInterceptor.stop();
    }
  },
};

export default DOMEventInterceptor;
