import root from '../nodejs-support/root';
import mouseEvents from './MOUSE_EVENT_MAPPING_CONSTS';

/**
 * @class MouseEventInterceptor
 * 原生鼠标事件拦截器
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const MouseEventInterceptor = {
  evtBuses: [],

  start: function () {
    if (root && root.document && root.document.addEventListener) {
      //所有原生 DOM 事件全部通过 EventBus 转发到 canvas 内部的对象上去
      //TODO:不同浏览器版本，以及 NodeJS 环境兼容性测试
      //FIXME:全部转发是否有性能问题？
      MouseEventInterceptor.evtBuses.forEach((evtBus) => {
        mouseEvents.forEach((item) => {
          root.document.addEventListener(item[0], (evt) => {
            evtBus.trigger(item[1], evt);
          });
        });
      });
    }
  },

  regitserEvtBus: function (evtBus) {
    if (MouseEventInterceptor.evtBuses.includes(evtBus)) {
      return;
    }
    MouseEventInterceptor.evtBuses.push(evtBus);
  },

  delEvtBus: function (evtBus) {
    if (!MouseEventInterceptor.evtBuses.includes(evtBus)) {
      return;
    }
    MouseEventInterceptor.evtBuses.splice(MouseEventInterceptor.evtBuses.indexOf(evtBus), 1);
  },
};

export default MouseEventInterceptor;
