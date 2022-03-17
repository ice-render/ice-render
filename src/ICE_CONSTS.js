/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
export const ICE_CONSTS = {
  ICE_FRAME_EVENT: 'ICE_FRAME_EVENT',
  BEFORE_RENDER: 'BEFORE_RENDER',
  AFTER_RENDER: 'AFTER_RENDER',
  ICE_CLICK: 'ICE_CLICK',
  BEFORE_ADD: 'BEFORE_ADD', //在 addChild() 方法中的第一行执行
  AFTER_ADD: 'AFTER_ADD', //在 addChild() 方法返回之前执行
  BEFORE_REMOVE: 'BEFORE_REMOVE', //在 removeChild() 方法中的第一行执行
  AFTER_REMOVE: 'AFTER_REMOVE', //在 removeChild() 方法返回之前执行
  ROUND_FINISH: 'ROUND_FINISH', //当渲染器完成一轮渲染时，会触发此事件
};
