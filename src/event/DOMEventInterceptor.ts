/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { buildDomEventList } from '../consts/DOM_EVENT_MAPPING_CONSTS';
import root from '../cross-platform/root';

/**
 * @class DOMEventInterceptor DOM 事件拦截器
 *
 * 拦截所有原生的输入事件（指针 / 鼠标 / 触摸 / 滚轮 / 键盘），转发到全局事件总线，
 * ICE 内部的事件派发器再监听总线，把事件派发给 canvas 内特定的组件。
 *
 * - 输入通道按运行时能力选择：有 PointerEvent 则只监听 pointer*（统一鼠标/触控笔/触摸），
 *   否则回退 mouse* + touch*；见 `buildDomEventList()`。
 * - 全局只绑定一套 DOM 监听：事件到来时遍历当前所有事件总线转发。
 *   这样重复 init / 多实例 / React StrictMode 双挂载都不会叠加监听，且 stop() 可以真正解绑。
 * - wheel 以 passive:false 绑定，便于应用层阻止页面滚动；触摸的滚动抑制由 canvas 上的
 *   `touch-action: none` 声明式完成（见 ICE.init）。
 *
 * @see {DOMEventDispatcher}
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const DOMEventInterceptor = {
  //在同一个 window 中可能存在多个 ICE 实例，每一个 ICE 实例上都有一条事件总线，这里把多个事件总线实例隔开。
  evtBuses: [] as any[],

  //全局唯一的 DOM 监听句柄：start 时绑定、stop 时解绑；null 表示当前未绑定。
  __handlers: null as null | Array<{ name: string; handler: (evt: any) => void }>,

  /** 当前运行时是否走 PointerEvent 通道（start 时探测并缓存，便于测试断言）。 */
  __hasPointerEvent: false,

  /**
   * @method start 绑定全局 DOM 监听（幂等：重复调用不会重复绑定）
   */
  start: function (): void {
    if (!root || !root.addEventListener || DOMEventInterceptor.__handlers) {
      return;
    }
    const hasPointerEvent = typeof root.PointerEvent === 'function';
    DOMEventInterceptor.__hasPointerEvent = hasPointerEvent;
    const domEvts = buildDomEventList(hasPointerEvent);
    const handlers: Array<{ name: string; handler: (evt: any) => void }> = [];
    for (let i = 0; i < domEvts.length; i++) {
      const item = domEvts[i];
      const handler = (domEvt: any) => {
        //转发给当前所有事件总线（总线可能在运行期增删，因此每次动态遍历）
        for (let j = 0; j < DOMEventInterceptor.evtBuses.length; j++) {
          DOMEventInterceptor.evtBuses[j].trigger(item[1], domEvt);
        }
      };
      // wheel 需要能 preventDefault（阻止页面缩放/滚动），因此显式 passive:false
      const options = item[0] === 'wheel' || item[0] === 'touchmove' ? { passive: false } : undefined;
      if (options && typeof root.addEventListener === 'function') {
        root.addEventListener(item[0], handler, options);
      } else {
        root.addEventListener(item[0], handler);
      }
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
