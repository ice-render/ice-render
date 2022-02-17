/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * 连接线特性：
 *
 * - 两端分别带有一个控制手柄
 * - 拖动控制手柄可以修改线条起点和终点的坐标
 * - 控制手柄同时带有磁吸功能，与组件上的连接插槽位置重叠时会建立连接关系
 *
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
 */
export default class ICECableLike {
  startHook;
  endHook;
  hookRadius = 10;

  createLinkHooks() {}

  setHookPositions() {}
}
