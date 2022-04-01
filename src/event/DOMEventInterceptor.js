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
 * @see {DOMEventDispatcher}
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const DOMEventInterceptor = {
  //在同一个 window 中可能存在多个 ICE 实例，每一个 ICE 实例上都有一条事件总线，这里把多个事件总线实例隔开。
  evtBuses: [],

  start: function () {
    if (root && root && root.addEventListener) {
      //所有原生 DOM 事件全部通过 EventBus 转发到 canvas 内部的对象上去
      //TODO:不同浏览器版本，以及 NodeJS 环境兼容性测试
      for (let i = 0; i < DOMEventInterceptor.evtBuses.length; i++) {
        const evtBus = DOMEventInterceptor.evtBuses[i];
        const domEvts = [...mouseEvents, ...keyboardEvents];
        for (let j = 0; j < domEvts.length; j++) {
          const item = domEvts[j];
          root.addEventListener(item[0], (domEvt) => {
            evtBus.trigger(item[1], domEvt);
          });
        }
      }
    }
  },

  regitserEvtBus: function (evtBus) {
    if (DOMEventInterceptor.evtBuses.includes(evtBus)) {
      return;
    }
    DOMEventInterceptor.evtBuses.push(evtBus);
  },

  delEvtBus: function (evtBus) {
    if (!DOMEventInterceptor.evtBuses.includes(evtBus)) {
      return;
    }
    DOMEventInterceptor.evtBuses.splice(DOMEventInterceptor.evtBuses.indexOf(evtBus), 1);
  },
};

export default DOMEventInterceptor;
