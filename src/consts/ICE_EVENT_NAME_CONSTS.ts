/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

//!ICE 自定的事件名称常量，原生 DOM 事件的名称不变。
// `as const`：让每个值都是**字面量类型**，应用侧才能拿到补全与拼写检查
//（`on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, fn)` 的 `evt` 因此有类型；见 `event/event-types.ts`）。
const ICE_EVENT_NAME_CONSTS = {
  ICE_FRAME_EVENT: 'ICE_FRAME_EVENT',
  BEFORE_RENDER: 'BEFORE_RENDER',
  AFTER_RENDER: 'AFTER_RENDER',
  BEFORE_ADD: 'BEFORE_ADD', //在 addChild() 方法中的第一行执行
  AFTER_ADD: 'AFTER_ADD', //在 addChild() 方法返回之前执行
  BEFORE_REMOVE: 'BEFORE_REMOVE', //在 removeChild() 方法中的第一行执行
  AFTER_REMOVE: 'AFTER_REMOVE', //在 removeChild() 方法返回之前执行
  ROUND_FINISH: 'ROUND_FINISH', //当渲染器完成一轮渲染时，会触发此事件
  HOOK_MOUSEDOWN: 'HOOK_MOUSEDOWN',
  HOOK_MOUSEMOVE: 'HOOK_MOUSEMOVE',
  HOOK_MOUSEUP: 'HOOK_MOUSEUP',
  BEFORE_RESIZE: 'BEFORE_RESIZE',
  AFTER_RESIZE: 'AFTER_RESIZE',
  BEFORE_ROTATE: 'BEFORE_ROTATE',
  AFTER_ROTATE: 'AFTER_ROTATE',
  BEFORE_MOVE: 'BEFORE_MOVE',
  AFTER_MOVE: 'AFTER_MOVE',
  THEME_CHANGE: 'THEME_CHANGE', //setTheme() / setChrome() 应用完成之后触发（见 ICE.onThemeChange）
} as const;

/** 引擎内置事件名的联合类型（=`ICE_EVENT_NAME_CONSTS` 的取值）。 */
export type ICEEngineEventNameConst = (typeof ICE_EVENT_NAME_CONSTS)[keyof typeof ICE_EVENT_NAME_CONSTS];

export default ICE_EVENT_NAME_CONSTS;
