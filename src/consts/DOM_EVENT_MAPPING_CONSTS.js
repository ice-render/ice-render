/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * 原生 DOM 鼠标事件与 ICE 内部转发事件之间的对应关系。
 * 原生 DOM 事件的名称在 ICE 中不变。
 * FIXME:修改转发器，原生 DOM 事件不进行名称映射。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export const mouseEvents = [
  ['mousedown', 'ICE_MOUSEDOWN'],
  ['mouseup', 'ICE_MOUSEUP'],
  ['mousemove', 'ICE_MOUSEMOVE'],
  ['click', 'ICE_CLICK'],
  ['dbclick', 'ICE_DBCLICK'],
  ['contextmenu', 'ICE_CONTEXTMENU'],
];

/**
 * 原生 DOM 键盘事件与 ICE 内部转发事件之间的对应关系。
 * 原生 DOM 事件的名称在 ICE 中不变。
 * FIXME:修改转发器，原生 DOM 事件不进行名称映射。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export const keyboardEvents = [
  ['keydown', 'ICE_KEYDOWN'],
  ['keyup', 'ICE_KEYUP'],
];
