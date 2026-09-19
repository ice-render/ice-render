/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { isEmpty } from '../util/lang';
import root from '../cross-platform/root';
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
   * @method on
   * 添加事件监听
   * @param eventName
   * @param fn
   * @param scope
   */
  public on(eventName: string, fn: (...args: any[]) => any, scope: any = root) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.off(eventName, fn, scope);
    this.listeners[eventName].push({ callback: fn, scope: scope });
    // 链式（与引擎其余 API 一致）：`target.on('click', fn).on('keydown', fn2)`
    return this;
  }

  /**
   * @method off
   * 删除事件监听
   * @param eventName
   * @param fn
   * @param scope
   * @returns
   */
  public off(eventName: string, fn: (...args: any[]) => any, scope: any = root) {
    let arr = this.listeners[eventName];
    if (!arr) return;
    /**
     * `off(name)`（不传回调）＝ **移除该事件上的全部监听**。
     * 旧实现只支持"按 (fn, scope) 摘一个"，想清空一个事件只能自己遍历，
     * 而 `purgeEvents()` 又会把**所有**事件的监听一起清掉 —— 中间这一档一直是缺的。
     */
    if (fn === undefined) {
      delete this.listeners[eventName];
      return this;
    }
    arr = [...arr];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      // `once` 注册的是包装函数，原始回调挂在它的 __onceOriginal 上（见 once()），两者都要匹配，
      // 否则「once 注册的监听」无法被提前摘除。
      const cb: any = item.callback;
      const matched = cb === fn || (cb && cb.__onceOriginal === fn);
      if (matched && item.scope === scope) {
        this.listeners[eventName].splice(i, 1);
        return this;
      }
    }
    return this;
  }

  /**
   * @method dispatchEvent
   *
   * 触发事件。
   *
   * 所有事件都会被转换成 ICEEvent 实例。
   *
   * @param eventName
   * @param originalEvent
   * @param param
   * @returns
   */
  public trigger(eventName: string, originalEvent: any = null, param = {}) {
    if (isEmpty(this.listeners[eventName])) return false;
    if (this.suspendedEventNames.includes(eventName)) return false;

    let iceEvent: ICEEvent;
    if (originalEvent instanceof ICEEvent) {
      /**
       * **已经是 ICEEvent 就不要再包一层**（这条是事件系统的正确性关键）：
       * - 包一层会换掉事件对象 → 上一个监听器里 `stopPropagation()` / `preventDefault()`
       *   打的标记落在副本上，冒泡与取消**永远不生效**；
       * - `param` 也会被后包的那层覆盖成 `{}`（组件路径上"看不到 param"就是这么来的）。
       * 现在：同一个事件对象一路传到底，`target`/`currentTarget`/标记都保持一份真相。
       */
      iceEvent = originalEvent;
      iceEvent.type = eventName || iceEvent.type;
      if (param && Object.keys(param).length) {
        iceEvent.param = { ...(iceEvent.param || {}), ...param };
      }
    } else if (originalEvent) {
      iceEvent = new ICEEvent(originalEvent);
      iceEvent.originalEvent = originalEvent.originalEvent ? originalEvent.originalEvent : originalEvent;
      iceEvent.type = eventName || iceEvent.type;
      iceEvent.param = { ...param };
    } else {
      iceEvent = new ICEEvent({
        type: eventName,
        timeStamp: Date.now(),
        param: { ...param },
      });
    }
    if (!iceEvent.__iceTarget) {
      iceEvent.__iceTarget = this;
    }
    const previousCurrentTarget = iceEvent.currentTarget;
    iceEvent.currentTarget = this as any;

    // 遍历**快照**，并在调用前确认监听仍在线：
    // `once` 的回调会先把自己 off 掉（splice 原数组），如果直接 `for (i...) arr[i]`，
    // 数组缩短会让紧随其后的监听被整体跳过 —— 同一个事件上挂的 once 越多漏得越多。
    // 快照 + 在线校验既修掉「漏触发」，又保留「派发期间被 off 掉的监听不再触发」的语义。
    const arr = [...this.listeners[eventName]];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (this.listeners[eventName].indexOf(item) === -1) {
        continue;
      }
      item.callback.call(item.scope, iceEvent);
      // stopImmediatePropagation()：当前目标上剩下的监听器不再执行（W3C 语义）
      if (iceEvent.__iceImmediateStopped) {
        break;
      }
    }
    iceEvent.currentTarget = previousCurrentTarget;
    return true;
  }

  /**
   * @method once
   * 一次性事件，触发一次就自动删除自己。
   * @param eventName
   * @param fn
   */
  public once(eventName: string, fn: (...args: any[]) => any, scope: any = root) {
    const that = this;

    function callback(evt: ICEEvent) {
      that.off(eventName, callback, scope);
      fn.call(scope, evt);
    }

    // 记录原始回调：否则外部 `off(eventName, fn, scope)` 永远匹配不到这个包装函数
    // （内部 on 存的是 callback，而调用方传的是 fn）→ 监听**无法提前摘除**，只能等它自己触发一次。
    // 这会直接造成「组件已销毁，但悬挂在总线上的 once 监听仍会在事件到来时操作已销毁对象」。
    (callback as any).__onceOriginal = fn;

    that.on(eventName, callback, scope);
    return this;
  }

  /**
   * @method suspend
   * 挂起事件。
   * @param eventName
   */
  public suspend(eventName: string) {
    if (eventName && !this.suspendedEventNames.includes(eventName)) {
      this.suspendedEventNames.push(eventName);
    }
    return this;
  }

  /**
   * @method resume
   * 恢复事件。
   * @param eventName
   */
  public resume(eventName: string) {
    const index = this.suspendedEventNames.indexOf(eventName);
    if (index !== -1) {
      this.suspendedEventNames.splice(index, 1);
    }
    return this;
  }

  /**
   * @method purgeEvents
   * 清除所有事件。
   */
  public purgeEvents() {
    this.listeners = {};
    this.suspendedEventNames = [];
    return this;
  }

  /**
   * @method hasListener
   * 查询是否带有某个事件监听器。
   * @param eventName
   * @param fn
   * @param scope
   * @returns
   */
  public hasListener(eventName: string, fn: (...args: any[]) => any, scope: any = root): boolean {
    if (!this.listeners[eventName]) {
      return false;
    }
    const arr = this.listeners[eventName];
    if (!arr) return false;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      // 与 off() 用同一套匹配：`once` 注册的是包装函数，原始回调挂在 __onceOriginal 上
      const cb: any = item.callback;
      if ((cb === fn || (cb && cb.__onceOriginal === fn)) && item.scope === scope) {
        return true;
      }
    }
    return false;
  }
}

/**
 * W3C `EventTarget` 别名 —— **真方法**，不是把 `on/off/trigger` 直接挂过去。
 *
 * 旧实现是 `prototype.addEventListener = prototype.on`：三个签名全不对 ——
 * `addEventListener(type, fn, options)` 的第三参（`{ once: true }` / `true` 捕获标志）
 * 会被当成 `scope`；`dispatchEvent(event)` 期望收**事件对象**，实际却当成了事件名。
 * 按 W3C 写法接进来的代码因此"看着能用、行为不是那回事"。
 */
//@ts-ignore —— 这三个方法不在本类的声明里（故意保持宽松，见类注释）
ICEEventTarget.prototype.addEventListener = function (type: string, listener: any, options?: any) {
  if (options && typeof options === 'object' && options.once) {
    return this.once(type, listener);
  }
  // 第三参是布尔（capture）时忽略：引擎的组件树只有冒泡阶段，没有捕获阶段
  return this.on(type, listener);
};
//@ts-ignore
ICEEventTarget.prototype.removeEventListener = function (type: string, listener: any) {
  return this.off(type, listener);
};
//@ts-ignore
ICEEventTarget.prototype.dispatchEvent = function (event: any) {
  if (event && typeof event.type === 'string') {
    return this.trigger(event.type, event);
  }
  return this.trigger(event);
};

export default ICEEventTarget;
