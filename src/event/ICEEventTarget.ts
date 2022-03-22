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

  /**
   * 添加事件监听
   * @param eventName
   * @param fn
   * @param scope
   */
  public on(eventName: string, fn: Function, scope: any = root) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.off(eventName, fn, scope);
    this.listeners[eventName].push({ callback: fn, scope: scope });
  }

  /**
   * 删除事件监听
   * @param eventName
   * @param fn
   * @param scope
   * @returns
   */
  public off(eventName: string, fn: Function, scope: any = root) {
    let arr = this.listeners[eventName];
    if (!arr) return;
    arr = [...arr];
    for (let i = 0; i < arr.length; i++) {
      let item = arr[i];
      if (item.callback === fn && item.scope === scope) {
        this.listeners[eventName].splice(i, 1);
        return;
      }
    }
  }

  /**
   * 一次性事件，触发一次就自动删除自己。
   * @param eventName
   * @param fn
   */
  public once(eventName: string, fn: Function, scope: any = root) {
    const that = this;

    function callback(evt: ICEEvent) {
      that.off(eventName, callback, scope);
      fn.call(scope, evt);
    }

    that.on(eventName, callback, scope);
  }

  /**
   * 触发事件。
   * @param eventName
   * @param originalEvent
   * @param param
   * @returns
   */
  public trigger(eventName: string, originalEvent: any = null, param = {}) {
    if (!this.listeners[eventName] || !this.listeners[eventName].length) return false;
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

    let arr = this.listeners[eventName];
    for (let i = 0; i < arr.length; i++) {
      let item = arr[i];
      let fn = item.callback;
      let scope = item.scope;
      fn.call(scope, iceEvent);
    }
    return true;
  }

  /**
   * 挂起事件。
   * @param eventName
   */
  public suspend(eventName: string) {
    if (eventName && !this.suspendedEventNames.includes(eventName)) {
      this.suspendedEventNames.push(eventName);
    }
  }

  /**
   * 恢复事件。
   * @param eventName
   */
  public resume(eventName: string) {
    this.suspendedEventNames.splice(
      this.suspendedEventNames.findIndex((el) => el === eventName),
      1
    );
  }

  /**
   * 清除所有事件。
   */
  public purgeEvents() {
    this.listeners = {};
    this.suspendedEventNames = [];
  }

  /**
   * 查询是否带有某个事件监听器。
   * @param eventName
   * @param fn
   * @param scope
   * @returns
   */
  public hasListener(eventName: string, fn: Function, scope: any = root): boolean {
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
