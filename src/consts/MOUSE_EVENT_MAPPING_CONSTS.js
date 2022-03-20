/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * 原生 DOM 事件与 ICE 内部转发事件之间的对应关系
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const mouseEvents = [
  ['mousedown', 'ICE_MOUSEDOWN'],
  ['mouseup', 'ICE_MOUSEUP'],
  ['mousemove', 'ICE_MOUSEMOVE'],
  ['click', 'ICE_CLICK'],
  ['dbclick', 'ICE_DBCLICK'],
  ['contextmenu', 'ICE_CONTEXTMENU'],
];

export default mouseEvents;
