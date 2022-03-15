/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import root from '../cross-platform/root.js';
import ICEEvent from './ICEEvent';

/**
 * @class ICEEventTarget
 *
 * - canvas 标签内部没有事件机制，模仿 W3C 定义的 EventTaregt 接口，为 Canvas 内部的组件添加事件机制。
 * - ICE 内部的大部分组件都是 ICEEventTarget 的子类。
 * - 部分 API 名称模仿 jQuery ，方便使用者调用。
 *
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
 * @abstract
 * @author 大漠穷秋<damoqiongqiu@126.com>
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 */
abstract class ICEEventTarget {
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
   * FIXME:有 bug ，需要重新实现
   * 一次性回调，调用一次就自动删除。
   * @param eventName
   * @param fn
   */
  once(eventName: string, fn: Function, scope: any = root) {
    function callback(evt: ICEEvent) {
      this.off(eventName, callback, scope);
      fn.call(scope, evt);
    }

    this.on(eventName, callback, scope);
  }

  trigger(eventName: string, originalEvent: any = null, param = {}) {
    if (!this.listeners[eventName]) return false;
    if (this.suspendedEventNames.includes(eventName)) return false;

    //DOM 事件和代码触发的事件都会被转换成 ICEEvent
    //FIXME:这里需要判断传递了 originalEvent 且类型为 ICEEvent 的情况。
    let iceEvent: ICEEvent;
    if (originalEvent) {
      iceEvent = new ICEEvent(originalEvent);
      iceEvent.originalEvent = originalEvent;
      iceEvent.param = { ...param };
    } else {
      iceEvent = new ICEEvent({
        type: eventName,
        timeStamp: new Date().getTime(),
        param: { ...param },
      });
    }

    this.listeners[eventName].forEach((item: any) => {
      let fn = item.callback;
      let scope = item.scope;
      fn.call(scope, iceEvent);
    });
    return true;
  }

  suspend(eventName: string) {
    if (eventName && !this.suspendedEventNames.includes(eventName)) {
      this.suspendedEventNames.push(eventName);
    }
  }

  resume(eventName: string) {
    this.suspendedEventNames.splice(
      this.suspendedEventNames.findIndex((el) => el === eventName),
      1
    );
  }

  purgeEvents() {
    this.listeners = {};
    this.suspendedEventNames = [];
  }

  hasListener(eventName: string, fn: Function, scope: any = root): boolean {
    if (!this.listeners[eventName]) {
      return false;
    }
    let arr = this.listeners[eventName];
    if (!arr) return false;
    for (let i = 0; i < arr.length; i++) {
      let item = arr[i];
      if (item.callback === fn && item.scope === scope) {
        return true;
      }
    }
    return false;
  }
}

//增加别名，模拟 W3C 的 EventTarget 接口
ICEEventTarget.prototype.addEventListener = ICEEventTarget.prototype.on;
ICEEventTarget.prototype.removeEventListener = ICEEventTarget.prototype.off;
ICEEventTarget.prototype.dispatchEvent = ICEEventTarget.prototype.trigger;

export default ICEEventTarget;