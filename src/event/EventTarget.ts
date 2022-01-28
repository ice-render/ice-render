import root from '../nodejs-support/root.js';
import ICEEvent from './ICEEvent';

/**
 * Canvas 内部的对象默认没有事件机制，模仿 W3C 定义的 EventTaregt 接口，为 Canvas 内部的组件添加事件机制。
 * 部分 API 名称模仿 jQuery ，方便使用者调用。
 * TODO:需要完整模拟 W3C 和 jQuery 提供的事件接口，在 API 名称和调用逻辑上保持完全一致。
 *
 * listeners 的结构：
 * {
 *    "click":[
 *        {
 *          callback:fn1,
 *          scope:window
 *        },
 *        {
 *          callback:fn2,
 *          scope:component-1
 *        }
 *     ],
 *    "mousemove":[
 *        {
 *          callback:fn1,
 *          scope:window
 *        },
 *        {
 *          callback:fn2,
 *          scope:component-1
 *        }
 *     ]
 * }
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class EventTarget {
  protected listeners: any = {};
  protected suspendedEventNames: any = [];

  constructor() {}

  on(eventName: string, fn: Function, scope: any = root) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.off(eventName, fn, scope);
    this.listeners[eventName].push({ callback: fn, scope: scope });
  }

  off(eventName: string, fn: Function, scope: any = root) {
    let arr = this.listeners[eventName];
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      let item = arr[i];
      if (item.callback === fn && item.scope === scope) {
        this.listeners[eventName].splice(i, 1);
        return;
      }
    }
  }

  /**
   * 一次性回调，调用一次就自动删除。
   * @param eventName
   * @param fn
   */
  once(eventName: string, fn: Function, scope: any = root) {
    this.on(
      eventName,
      (evt: ICEEvent, scope) => {
        this.off(eventName, fn, scope);
        fn.call(scope, evt);
      },
      scope
    );
  }

  trigger(eventName: string, originalEvent: any = null) {
    if (!this.listeners[eventName]) return false;
    if (this.suspendedEventNames.includes(eventName)) return false;

    //DOM 事件和代码触发的事件都会被转换成 ICEEvent
    let iceEvent: ICEEvent;
    if (originalEvent) {
      iceEvent = new ICEEvent(originalEvent);
      iceEvent.originalEvent = originalEvent;
    } else {
      iceEvent = new ICEEvent({
        type: eventName,
        timeStamp: new Date().getTime(),
      });
    }

    this.listeners[eventName].forEach((item: any) => {
      let fn = item.callback;
      let scope = item.scope;
      fn.call(scope, iceEvent);
    });
    return true;
  }

  //FIXME:加上 scope 控制
  suspend(eventName: string, fn: Function) {
    if (eventName && !this.suspendedEventNames.includes(eventName)) {
      this.suspendedEventNames.push(eventName);
    }
    if (fn) {
      fn.prototype.suspended = true;
    }
  }

  //FIXME:加上 scope 控制
  resume(eventName: string, fn: Function) {
    if (eventName && this.suspendedEventNames.includes(eventName)) {
      this.suspendedEventNames.splice(this.suspendedEventNames.findIndex(eventName), 1);
    }
    if (fn) {
      fn.prototype.suspended = false;
    }
  }

  purge() {
    this.listeners = {};
  }
}

//增加别名，模拟 W3C 的 EventTarget 接口
EventTarget.prototype.addEventListener = EventTarget.prototype.on;
EventTarget.prototype.removeEventListener = EventTarget.prototype.off;
EventTarget.prototype.dispatchEvent = EventTarget.prototype.trigger;

export default EventTarget;
