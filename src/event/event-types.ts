/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE_EVENT_NAME_CONSTS from '../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from './ICEEvent';
import type { ICEThemeChangeInfo } from '../ICE';

/**
 * DOM 语义的输入事件名（引擎会把原生事件归一化后按这些名字派发）。
 *
 * 单独列出来是为了让 `on('mousedown', fn)` 这类**最常见**的写法也能拿到
 * `evt` 的静态类型与补全；不在这里的名字一律按"应用自定义事件"处理（回调 `evt: any`）。
 */
export type ICEDOMEventName =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel'
  | 'mousedown'
  | 'mousemove'
  | 'mouseup'
  | 'mouseleave'
  | 'click'
  | 'dblclick'
  | 'contextmenu'
  | 'touchstart'
  | 'touchmove'
  | 'touchend'
  | 'touchcancel'
  | 'wheel'
  | 'keydown'
  | 'keyup';

/** 引擎内置事件名（值与 `ICE_EVENT_NAME_CONSTS` 一致）。 */
export type ICEEngineEventName = (typeof ICE_EVENT_NAME_CONSTS)[keyof typeof ICE_EVENT_NAME_CONSTS];

/** 所有"引擎认识的事件名"：内置事件 + DOM 语义输入事件。 */
export type ICEEventName = ICEEngineEventName | ICEDOMEventName;

/**
 * **事件名 → `evt.param` 形状**（只收录引擎自己确实这么用的事件，以代码为准）。
 *
 * ⚠️ 引擎事件的"载荷"分布在两处（历史原因，先如实描述、不强行统一）：
 * - `evt.param`：`trigger(name, originalEvent, param)` 的第三个参数 ——
 *   ADD/REMOVE 类事件的 `{ component }`、`THEME_CHANGE` 的 `{ theme, previous, kind }`、
 *   经派发器来的输入事件的 `{ component }`（命中组件）；
 * - **事件对象字段**：变换类事件把 `quadrant` / `movementX` / `movementY` / `transform` 等
 *   直接写在事件对象上（`new ICEEvent(evt, { quadrant })`），消费方
 *   （`TransformControlPanel` / `LineControlPanel`）也是直接读字段。
 *
 * 想要"所有载荷都走 `param`"的整洁版是一次**行为变更**（要同时改引擎与下游消费者），
 * 等真有需求时再做；现在先把类型加对，让写对/写错能被编译器看见。
 */
export type ICEEventParamMap = {
  [ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT]: Record<string, never>;
  [ICE_EVENT_NAME_CONSTS.BEFORE_RENDER]: Record<string, never>;
  [ICE_EVENT_NAME_CONSTS.AFTER_RENDER]: Record<string, never>;
  [ICE_EVENT_NAME_CONSTS.ROUND_FINISH]: Record<string, never>;
  [ICE_EVENT_NAME_CONSTS.BEFORE_ADD]: { component: any };
  [ICE_EVENT_NAME_CONSTS.AFTER_ADD]: { component: any };
  [ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE]: { component: any };
  [ICE_EVENT_NAME_CONSTS.AFTER_REMOVE]: { component: any };
  [ICE_EVENT_NAME_CONSTS.THEME_CHANGE]: ICEThemeChangeInfo;
  [ICE_EVENT_NAME_CONSTS.BEFORE_MOVE]: { component?: any };
  [ICE_EVENT_NAME_CONSTS.AFTER_MOVE]: { component?: any };
  [ICE_EVENT_NAME_CONSTS.BEFORE_RESIZE]: { component?: any; quadrant?: number };
  [ICE_EVENT_NAME_CONSTS.AFTER_RESIZE]: { component?: any; quadrant?: number };
  [ICE_EVENT_NAME_CONSTS.BEFORE_ROTATE]: { component?: any; rotate?: number };
  [ICE_EVENT_NAME_CONSTS.AFTER_ROTATE]: { component?: any; rotate?: number };
  [ICE_EVENT_NAME_CONSTS.HOOK_MOUSEDOWN]: { component?: any };
  [ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE]: { component?: any };
  [ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP]: { component?: any };
};

/** 输入事件（DOM 语义名）的 `param`：派发器会塞入命中组件。 */
export type ICEInputEventParam = { component: any };

/**
 * 按事件名取出事件对象的类型：内置/DOM 语义事件 → `ICEEvent<对应 param>`；
 * 应用自定义事件名 → `ICEEvent<any>`（引擎不认识它的载荷）。
 */
export type ICEEventOf<K extends string> = K extends keyof ICEEventParamMap
  ? ICEEvent<ICEEventParamMap[K]>
  : K extends ICEDOMEventName
    ? ICEEvent<ICEInputEventParam>
    : ICEEvent<any>;

/** 监听器选项（`on` 的第四参 / `addEventListener` 的第三参）。 */
export type ICEEventListenerOptions = {
  /** 触发一次后自动摘除（重入派发不会再触发）。 */
  once?: boolean;
  /** 被动监听：该监听器里 `preventDefault()` 不生效（与 W3C 一致）。 */
  passive?: boolean;
  /** 只作为**注册身份**参与去重/移除：引擎的组件树只有冒泡阶段，没有捕获阶段。 */
  capture?: boolean;
  /** `AbortSignal`：abort 时自动摘除；已 abort 的直接不注册。 */
  signal?: any;
};
