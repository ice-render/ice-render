import ICEEvent from './ICEEvent';

/**
 * Canvas 内部的对象默认没有事件机制，模仿 W3C 定义的 EventTaregt 接口，为 Canvas 内部的图形添加事件机制。
 * 部分API 名称模仿 jQuery。
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class EventTarget {
  protected listeners: any = {};
  protected suspendedEventNames: any = [];

  constructor() {}

  on(eventName: string, fn: Function) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.off(eventName, fn);
    this.listeners[eventName].push(fn);
  }

  off(eventName: string, fn: Function) {
    if (!this.listeners[eventName]) return false;
    if (!fn) this.listeners[eventName] = []; //clear all callbacks.
    if (!this.listeners[eventName].includes(fn)) return false;
    this.listeners[eventName].splice(this.listeners[eventName].indexOf(fn), 1);
    return true;
  }

  once(eventName: string, fn: Function) {
    this.on(eventName, (evt: ICEEvent) => {
      this.off(eventName, fn);
      fn(evt);
    });
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

    this.listeners[eventName].forEach((cb: Function) => {
      cb(iceEvent);
    });
    return true;
  }

  suspend(eventName: string, fn: Function) {
    if (eventName && !this.suspendedEventNames.includes(eventName)) {
      this.suspendedEventNames.push(eventName);
    }
    if (fn) {
      fn.prototype.suspended = true;
    }
  }

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

//模拟 W3C 的 EventTarget 接口
EventTarget.prototype.addEventListener = EventTarget.prototype.on;
EventTarget.prototype.removeEventListener = EventTarget.prototype.off;
EventTarget.prototype.dispatchEvent = EventTarget.prototype.trigger;

export default EventTarget;
