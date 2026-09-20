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
import type { ICEEventListenerOptions, ICEEventName, ICEEventOf } from './event-types';
import { markEventNameListened } from './listened-event-names';

/**
 * 事件时间戳用**单调时钟**（`performance.now()` 的时间原点），与 W3C 一致。
 *
 * 旧实现用 `Date.now()`（墙钟）：既受系统时间调整影响，语义也和应用里 `evt.timeStamp - performance.now()`
 * 这类算法对不上。拿不到 `performance`（测试桩 / headless）时退回 `Date.now()`。
 */
function monotonicNow(): number {
  const perf: any = (root as any) && (root as any).performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}

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
   * **注册监听的唯一实现**：`on`（jQuery 风格）与 `addEventListener`（W3C 风格）都走这里。
   *
   * 两套 API 只是**参数形状**不同，语义必须逐条一致：同一份去重规则、同一份移除规则、
   * 同一个 `scope`（回调里的 `this`）、同一套 `once` / `passive` / `signal` 行为。
   * 谁也别在别处再写第二份注册逻辑 —— 两份实现的 API 一定会漂。
   *
   * - `listener` 可以是函数，也可以是 `{ handleEvent(evt) }` 对象（W3C 允许）；
   * - `options.once`：触发一次后自动摘除（重入派发不会再触发）；
   * - `options.passive`：标记为"被动监听"——该监听器里调 `preventDefault()` 不生效（与 W3C 一致）；
   * - `options.capture`：**只作为注册身份**参与去重/移除（引擎的组件树只有冒泡阶段，没有捕获阶段）；
   * - `options.signal`：传入 `AbortSignal`，abort 时自动摘除；已 abort 的直接不注册。
   */
  private __register(eventName: string, listener: any, scope: any, options?: ICEEventListenerOptions): this {
    if (!listener) {
      return this;
    }
    const opts = options && typeof options === 'object' ? options : {};
    if (opts.signal && opts.signal.aborted) {
      return this; // 已经 abort：等价于注册后立刻移除
    }
    let callback: any = listener;
    if (typeof listener !== 'function') {
      if (typeof listener.handleEvent !== 'function') {
        return this;
      }
      // `{ handleEvent }` 对象：包一层函数，并把原始对象记下来供移除时匹配
      callback = (evt: ICEEvent) => listener.handleEvent(evt);
      callback.__iceOriginal = listener;
    }
    const targetScope = scope === undefined || scope === null ? root : scope;
    const capture = opts.capture === true;
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    // 去重：同 (eventName, listener, scope, capture) 只保留一份（与旧 `on` 的语义一致，再加上 capture 维度）
    this.__remove(eventName, listener, targetScope, capture, false);
    // ⚠️ `__remove` 摘空之后会把整个条目删掉，这里必须重新取一次
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push({
      callback,
      scope: targetScope,
      capture,
      passive: opts.passive === true,
      once: opts.once === true,
    });
    // 登记"这个名字有人听"：派发器据此跳过**没人听**的那一次派发（一次原生指针输入会派发
    // 原生名 + 兼容名两个名字，通常只有一个有人听；指针移动是每帧级高频）。
    // 只增不减 —— 取舍见 `event/listened-event-names.ts` 的说明。
    markEventNameListened(eventName);
    if (opts.signal && typeof opts.signal.addEventListener === 'function') {
      const onAbort = () => this.__remove(eventName, listener, targetScope, capture, false);
      opts.signal.addEventListener('abort', onAbort);
    }
    return this;
  }

  /**
   * 摘除监听：`scope` 传 `undefined` 时**忽略 scope**（`removeEventListener` 的 W3C 心智：
   * 监听器身份是 `(type, listener, capture)`，跟回调里的 `this` 无关）。
   */
  private __remove(eventName: string, listener: any, scope: any, capture: boolean, ignoreScope: boolean): boolean {
    const arr: any[] = this.listeners[eventName];
    if (!arr || !arr.length) {
      return false;
    }
    let removed = false;
    for (let i = arr.length - 1; i >= 0; i--) {
      const item = arr[i];
      const cb: any = item.callback;
      const matchedListener =
        cb === listener || (cb && cb.__iceOriginal === listener) || (cb && cb.__onceOriginal === listener);
      if (!matchedListener) {
        continue;
      }
      if (ignoreScope ? item.capture !== capture : item.scope !== scope || item.capture !== capture) {
        continue;
      }
      arr.splice(i, 1);
      removed = true;
    }
    if (!arr.length) {
      delete this.listeners[eventName];
    }
    return removed;
  }

  /**
   * @method on
   * 添加事件监听（jQuery 风格：第三参是 `scope`，第四参才是 options）
   *
   * @param eventName
   * @param fn
   * @param scope 回调里的 `this`
   * @param options `{ once, passive, capture, signal }`（与 `addEventListener` 同一套语义）
   */
  public on<K extends ICEEventName>(
    eventName: K,
    fn: (evt: ICEEventOf<K>) => any,
    scope?: any,
    options?: ICEEventListenerOptions
  ): this;
  public on(eventName: string, fn: (evt: any) => any, scope?: any, options?: ICEEventListenerOptions): this;
  public on(eventName: string, fn: any, scope: any = root, options?: ICEEventListenerOptions) {
    this.__register(eventName, fn, scope, options);
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
  public off(eventName: string, fn?: any, scope: any = root) {
    const arr = this.listeners[eventName];
    if (!arr) {
      return this;
    }
    /**
     * `off(name)`（不传回调）＝ **移除该事件上的全部监听**。
     * 旧实现只支持"按 (fn, scope) 摘一个"，想清空一个事件只能自己遍历，
     * 而 `purgeEvents()` 又会把**所有**事件的监听一起清掉 —— 中间这一档一直是缺的。
     */
    if (fn === undefined) {
      delete this.listeners[eventName];
      return this;
    }
    // 摘掉该 (listener, scope) 的**全部**匹配（capture 两个维度都摘）
    this.__remove(eventName, fn, scope, false, false);
    this.__remove(eventName, fn, scope, true, false);
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
  public trigger<K extends ICEEventName>(eventName: K, originalEvent?: any, param?: any): boolean;
  public trigger(eventName: string, originalEvent?: any, param?: any): boolean;
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
      /**
       * **这里才是 DOM 事件身份字段的消毒点**（2026-09-19）。
       *
       * `new ICEEvent(原始 DOM 事件)` 会按 `for...in` 平铺字段，于是 DOM 的 `target` /
       * `srcElement` / `currentTarget` / `eventPhase` 会被拷进来 —— 但在这套系统里：
       * - `target` 的语义是「**命中的组件**」（画布外输入 / 纯代码触发时为 `null`）；
       * - `eventPhase` 由引擎按传播段设置（命中 `2` / 祖先 `3` / 传播结束 `0`）。
       *
       * 必须**只在这个入口消毒**，不能在 `ICEEvent` 构造函数里一刀切禁掉 `target` ——
       * `new ICEEvent({ target: this })` 是引擎自己的合法用法（`ICELinkHook` 用它把
       * 「拖动的是哪个端点手柄」广播给 `ICELinkSlotManager`），禁掉就会让连线端点拖拽当场报错
       * （`null.getMaxBoundingBox`，2026-09-19 家族回归实测）。
       *
       * 原始 DOM 元素**不丢**：它在 `evt.originalEvent.target` 上。
       */
      iceEvent.target = null;
      iceEvent.srcElement = null;
      iceEvent.currentTarget = null;
      iceEvent.eventPhase = 0;
    } else {
      iceEvent = new ICEEvent({
        type: eventName,
        timeStamp: monotonicNow(),
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
      // `once`：**先摘再调**（与旧 wrapper 一致 —— 回调里再触发同一事件不会重入）
      if (item.once) {
        const at = this.listeners[eventName].indexOf(item);
        if (at !== -1) {
          this.listeners[eventName].splice(at, 1);
        }
      }
      // `passive`：该监听器里调 `preventDefault()` 不生效（与 W3C 一致）
      iceEvent.__icePassiveListener = item.passive === true;
      item.callback.call(item.scope, iceEvent);
      iceEvent.__icePassiveListener = false;
      // stopImmediatePropagation()：当前目标上剩下的监听器不再执行（W3C 语义）
      if (iceEvent.__iceImmediateStopped) {
        break;
      }
    }
    if (!this.listeners[eventName] || !this.listeners[eventName].length) {
      delete this.listeners[eventName];
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
  public once<K extends ICEEventName>(eventName: K, fn: (evt: ICEEventOf<K>) => any, scope?: any): this;
  public once(eventName: string, fn: (evt: any) => any, scope?: any): this;
  public once(eventName: string, fn: any, scope: any = root) {
    /**
     * `once` 不再包一层"自摘函数"，而是把 `once` 记成监听记录上的一个标记（见 `__register`）。
     *
     * 旧实现靠包装函数 + `__onceOriginal` 让 `off()` 能匹配到它 —— 那条路能用，但**两套身份**
     * （包装函数 / 原始回调）本身就是"off 匹配不到"这类 bug 的温床；改成记录标记后，
     * `off/hasListener/removeEventListener` 全都按同一个身份匹配。
     */
    this.__register(eventName, fn, scope, { once: true });
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
      // 与 off() 用同一套匹配：`{ handleEvent }` 对象注册的是包装函数，原始对象挂在 __iceOriginal 上
      const cb: any = item.callback;
      if ((cb === fn || (cb && cb.__iceOriginal === fn) || (cb && cb.__onceOriginal === fn)) && item.scope === scope) {
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
  /**
   * 与 `on` **同一个实现**（`__register`），只是参数形状按 W3C：第三参是 options / capture 布尔，
   * 没有 `scope`（回调里的 `this` 用默认 scope，即跨平台 root）。
   * 布尔第三参（`capture`）只参与注册身份 —— 引擎的组件树没有捕获阶段。
   */
  const opts = typeof options === 'boolean' ? { capture: options } : options;
  return this.__register(type, listener, undefined, opts);
};
//@ts-ignore
ICEEventTarget.prototype.removeEventListener = function (type: string, listener: any, options?: any) {
  // W3C 心智：监听器身份是 (type, listener, capture)，**不看 scope** —— 所以这里忽略 scope 匹配
  const capture = typeof options === 'boolean' ? options : options && options.capture === true;
  this.__remove(type, listener, undefined, capture === true, true);
  return this;
};
//@ts-ignore
ICEEventTarget.prototype.dispatchEvent = function (event: any) {
  if (event && typeof event.type === 'string') {
    this.trigger(event.type, event);
    // W3C：`dispatchEvent` 返回 `false` 表示事件被 `preventDefault()` 取消（与"有没有监听器"无关）
    return event.defaultPrevented !== true;
  }
  return this.trigger(event);
};

export default ICEEventTarget;
