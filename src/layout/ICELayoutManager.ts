/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type ICEGroup from '../graphic/container/ICEGroup';

/**
 * @class ICELayoutManager 布局管理器（抽象基类）
 *
 * 借鉴 Java Swing 的 LayoutManager 设计思想——**策略模式**：
 * - 组件（ICEComponent）只负责「画自己」，不碰布局；
 * - 容器（ICEGroup）只负责「持有子组件」，通过 setLayout() 持有布局策略；
 * - 布局管理器（本类及其子类）只负责「摆位置」。
 *
 * 核心只有一个方法 layoutContainer(container)：给定容器，计算并设置所有子组件的位置/尺寸。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class ICELayoutManager {
  /**
   * 布局容器：计算并设置所有子组件的位置/尺寸。
   * @param container 目标容器（ICEGroup）
   */
  abstract layoutContainer(container: ICEGroup): void;

  /**
   * 计算容器内内容的「首选尺寸」（可选，默认 [0,0]）。
   * 子类可按需覆盖。
   */
  getPreferredSize(container: ICEGroup): [number, number] {
    return [0, 0];
  }
}

export default ICELayoutManager;
