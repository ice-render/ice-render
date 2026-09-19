/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type { ICEEventSource } from './event-types';

/**
 * @class ICEEvent
 *
 * - 在 ICE 中，所有事件都会被转化成 ICEEvent 进行处理。
 * - ICEEvent 用来模拟 W3C 定义的 Event 接口，ICE 自定义的事件也使用此实现，事件对象上能获取到的属性不同。
 * - 从原始 DOM 事件转发出来的 ICEEvent 实例包含 Event 接口上所定义的所有属性，ICE 内部代码创建的 ICEEvent 实例上只包含很少的自定义属性。
 * - 如果事件是从原始 DOM 事件包装而来，那么ICEEvent 实例的 originalEvent 属性是原始 DOM 事件对象，否则 originalEvent 属性为 null。
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Event
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
/**
 * 这些键**不允许**被传入对象覆盖。
 *
 * 为什么：构造函数是"把传入对象上的字段平铺到自己身上"（`for...in` 拷贝），
 * 而**普通对象做的事件桩**（测试夹具、业务里手搓的 `{ type, preventDefault(){} }`）
 * 上的 `preventDefault` 是**可枚举的 own 属性** —— 一旦被拷进来，就会盖掉本类的方法，
 * 于是 `evt.preventDefault()` 调用的是外部那个函数：引擎的"默认行为已阻止"状态永远为假，
 * 而调用方还以为生效了。（真实 DOM 事件的这些方法是原型上的**不可枚举**方法，所以旧实现没暴露这个坑。）
 */
const NON_COPYABLE_KEYS = [
  'preventDefault',
  'stopPropagation',
  'stopImmediatePropagation',
  'composedPath',
  'initEvent',
  '__iceStopped',
  '__iceImmediateStopped',
  '__iceTarget',
  '__icePassiveListener',
];

/** `passive` 监听器里调 `preventDefault()` 的提醒：**按事件名只提醒一次**（生产构建会剥掉 console.*）。 */
const PASSIVE_WARNED = new Set<string>();

/**
 * 这些**字段**同样不允许被传入对象覆盖 —— 它们是「引擎自己的派发语义」，不是事件源的属性。
 *
 * 为什么必须单独列出来：`new ICEEvent(原始 DOM 事件)` 是引擎的输入入口（见 `ICEEventTarget.trigger`），
 * 而构造函数按 `for...in` 平铺字段，于是 DOM 事件上的 `target` / `currentTarget` / `eventPhase`
 * 会被一起拷进来。但这套系统里：
 * - `target` 的语义是「**命中的组件**」（画布外输入 / 纯代码触发时为 `null`）—— 塞进一个
 *   `HTMLButtonElement` 会让应用只能靠 `instanceof` 去猜"这到底是不是组件"；
 * - `eventPhase` 由引擎按传播段自己设（命中 `2` / 祖先 `3` / 传播结束 `0`），DOM 的相位对不上；
 * - 原始 DOM 的 `target` **并不会丢**：它在 `evt.originalEvent.target` 上。
 *
 * 2026-09-19 起：`evt.target` 要么是组件、要么是 `null`，**永远不是 DOM 元素**；
 * 想知道"这条事件来自画布内还是画布外"，看 `evt.source`。
 *
 * ⚠️ 注意**只挡这三样**，`target` / `srcElement` 仍然可以显式传（`new ICEEvent({ target: this })`
 * 是引擎自己的用法，见 `ICELinkHook`）；DOM 事件的泄漏在**包装入口**（`ICEEventTarget.trigger`
 * 的 `originalEvent` 分支）统一消毒，见那里的注释 —— 一刀切禁掉 target 会把 `ICELinkHook` 打断。
 */
const NON_COPYABLE_FIELDS = ['currentTarget', 'eventPhase', 'source'];

class ICEEvent<TParam = any> implements Event {
  public originalEvent: any;
  /** 事件载荷（各事件名的形状见 `event/event-types.ts` 的 `ICEEventParamMap`）。 */
  public param: TParam;

  /**
   * **事件从哪里来**（2026-09-19 起）：
   *
   * - `'canvas'`：画布内的原始输入事件（指针 / 鼠标 / 触摸 / 滚轮 / 键盘）。有命中组件时
   *   `target` 是那个组件；点在画布空白处时 `target` 为 `null`（事件照旧上总线）。
   * - `'window'`：**画布之外**的原始输入事件（工具栏按钮 / 页面空白）。原始输入监听挂在
   *   `window` 上（拖拽移出画布也要跟手），所以这些事件也会到总线 —— 但它们没有命中组件：
   *   `target` 为 `null`，那个 DOM 元素在 `originalEvent.target`。
   * - `'engine'`：代码创建的事件（`trigger()` / `dispatchEvent()` / 引擎内部派发）。
   *
   * 应用只关心画布内交互时，一句 `if (evt.source !== 'canvas') return;` 就够了。
   */
  public source: ICEEventSource;

  constructor(evt: any = {}, data: any = {}) {
    /**
     * W3C `Event` 的字段先给**默认值**，再让传入对象覆盖。
     *
     * 为什么必须先有默认值：旧实现只声明字段不赋值，引擎自造的事件上
     * `bubbles / cancelable / defaultPrevented / eventPhase` 全是 `undefined` ——
     * 应用按 W3C 语义读 `evt.cancelable` 会拿到 `undefined`（falsy），
     * 而 `defaultPrevented` 永远不是布尔值，`preventDefault()` 又直接抛异常，
     * 于是"事件能不能取消、有没有被取消"在引擎里根本无从判断。
     */
    this.type = typeof evt.type === 'string' ? evt.type : '';
    this.bubbles = evt.bubbles === true;
    this.cancelable = evt.cancelable === true;
    this.defaultPrevented = false;
    this.eventPhase = 0;
    this.target = null;
    this.currentTarget = null;
    this.srcElement = null; // legacy 别名，与 target 同语义
    // W3C 那几个"声明了就该有值"的字段：以前只在拷贝到 DOM 事件字段时才有值，
    this.timeStamp = typeof evt.timeStamp === 'number' ? evt.timeStamp : Date.now();
    this.isTrusted = false;
    this.composed = false;
    this.cancelBubble = false;
    this.returnValue = true;
    this.originalEvent = null;
    this.param = {} as TParam;
    // 事件来源：代码创建默认 `'engine'`；经输入层派发时由 `DOMEventDispatcher` 改写成
    // `'canvas'` / `'window'`（见字段声明处的说明）。
    this.source = 'engine';

    for (const p in evt) {
      if (NON_COPYABLE_KEYS.indexOf(p) === -1 && NON_COPYABLE_FIELDS.indexOf(p) === -1) this[p] = evt[p];
    }
    for (const p in data) {
      if (NON_COPYABLE_KEYS.indexOf(p) === -1 && NON_COPYABLE_FIELDS.indexOf(p) === -1) this[p] = data[p];
    }
    // 上面两个循环可能把默认值覆盖成 undefined（调用方显式传了 undefined 字段时）
    if (typeof this.type !== 'string') this.type = '';
    if (typeof this.bubbles !== 'boolean') this.bubbles = false;
    if (typeof this.cancelable !== 'boolean') this.cancelable = false;
    if (typeof this.defaultPrevented !== 'boolean') this.defaultPrevented = false;
    if (typeof this.eventPhase !== 'number') this.eventPhase = 0;
    if (this.param === undefined || this.param === null) this.param = {} as TParam;
  }
  bubbles: boolean;
  cancelBubble: boolean;
  cancelable: boolean;
  composed: boolean;
  currentTarget: EventTarget | null;
  defaultPrevented: boolean;
  eventPhase: number;
  isTrusted: boolean;
  returnValue: boolean;
  srcElement: EventTarget | null;
  target: EventTarget | null;
  timeStamp: number;
  type: string;
  /**
   * **归一化后的输入字段**（只有经 `DOMEventDispatcher` 派发的指针 / 鼠标 / 触摸 / 键盘事件才有）。
   *
   * 这些字段由 `event/input-normalize.ts` 在事件边界写入（见该文件顶部说明），
   * 组件、拖拽、变换手柄、对齐吸附都直接读它们。以前类上没声明 —— 应用侧写 TS 时
   * 要么 `evt: any` 要么报错；现在声明出来，`on('mousedown', (evt) => evt.offsetX)` 能过编译。
   *
   * ⚠️ 键盘事件没有坐标（只有 `key` 与修饰键）。
   */
  offsetX?: number;
  offsetY?: number;
  clientX?: number;
  clientY?: number;
  movementX?: number;
  movementY?: number;
  pointerType?: string;
  pointerId?: number;
  button?: number;
  buttons?: number;
  isPrimary?: boolean;
  isTouchInput?: boolean;
  key?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  composedPath(): EventTarget[] {
    /**
     * 事件的传播路径：**命中组件 → 各级父容器**（不含引擎内部的工具层）。
     *
     * 我们只有一棵组件树（`parentNode` 链），没有 DOM 的 shadow/composed 概念，
     * 所以路径就是祖先链本身。`trigger` 会把 `__icePath` 存下来（见 ICEEventTarget）。
     */
    const path: any[] = [];
    const origin: any = this.target || this.__iceTarget;
    let node: any = origin;
    while (node) {
      path.push(node);
      node = node.parentNode || null;
    }
    return path as EventTarget[];
  }
  initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void {
    this.type = type;
    this.bubbles = bubbles === true;
    this.cancelable = cancelable === true;
    this.defaultPrevented = false;
    this.__iceStopped = false;
    this.__iceImmediateStopped = false;
  }
  /**
   * 阻止默认行为。与 W3C 一致：**只有 `cancelable === true` 的事件才生效**。
   *
   * 从原生 DOM 事件包装而来的事件会**顺手调用原始事件的 `preventDefault()`** ——
   * 这正是应用想要的语义（"我在 canvas 里处理了这个手势，别让浏览器再滚一屏"）。
   * 旧实现这个方法直接 `throw new Error('Method not implemented.')`：
   * 应用里 `event.preventDefault()` 会把整个派发链打断（异常从监听器里冒出去，
   * 后面的监听器与总线都收不到事件），`ice-chart` 因此专门写了"只对原始 DOM 事件调用"的绕过代码，
   * `ice-web-components` 里则留下了若干"看着防了、其实一调用就炸"的写法。
   */
  preventDefault(): void {
    /**
     * `passive` 监听器里 `preventDefault()` 不生效（与 W3C 一致）。
     *
     * 但**不能静默**：这类"以为生效了"的失败正是最难查的那一类，所以按事件名提醒一次。
     * （`addEventListener('wheel', fn, { passive: true })` 是滚动场景的常规写法。）
     */
    if (this.__icePassiveListener) {
      if (!PASSIVE_WARNED.has(this.type)) {
        PASSIVE_WARNED.add(this.type);
        console.warn(
          `[ICE] passive 监听器里调用 preventDefault() 不生效（事件「${this.type}」）。需要阻止默认行为时，请注册非 passive 的监听器。`
        );
      }
      return;
    }
    if (!this.cancelable) {
      return;
    }
    this.defaultPrevented = true;
    const raw: any = this.originalEvent;
    if (raw && typeof raw.preventDefault === 'function') {
      try {
        raw.preventDefault();
      } catch (e) {
        // 某些宿主（测试桩 / 小程序）的原生对象上 preventDefault 可能不可调用：忽略，不影响引擎语义
      }
    }
  }
  /** 阻止事件继续冒泡到**祖先组件**（同层其他监听器照常执行）。 */
  stopPropagation(): void {
    this.__iceStopped = true;
    this.cancelBubble = true;
  }
  /** 阻止冒泡，并且**跳过当前目标上剩下的监听器**（W3C 语义）。 */
  stopImmediatePropagation(): void {
    this.stopPropagation();
    this.__iceImmediateStopped = true;
  }
  /** @internal 派发器读这个标记决定要不要继续向祖先冒泡。 */
  public __iceStopped = false;
  /** @internal 派发器读这个标记决定要不要跳过当前目标剩下的监听器。 */
  public __iceImmediateStopped = false;
  /** @internal 真正的派发起点（`target` 可能被应用改写，这里保留引擎认定的起点）。 */
  public __iceTarget: any = null;
  /** @internal 当前正在执行的是不是一个 `passive` 监听器（由 ICEEventTarget 在调用前置位）。 */
  public __icePassiveListener = false;
  readonly AT_TARGET = 2 as const;
  readonly BUBBLING_PHASE = 3 as const;
  readonly CAPTURING_PHASE = 1 as const;
  readonly NONE = 0 as const;
}
export default ICEEvent;
