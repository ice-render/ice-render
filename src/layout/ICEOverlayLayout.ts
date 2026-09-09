/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type ICEGroup from '../graphic/container/ICEGroup';
import ICELayoutManager from './ICELayoutManager';

/**
 * @class ICEOverlayLayout 叠加布局
 *
 * 对齐 Java Swing 的 OverlayLayout：所有子组件叠放在同一位置（左上角）。
 * 可用于做图层叠加效果。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEOverlayLayout extends ICELayoutManager {
  /**
   * @overwrite
   * 所有子组件叠放到容器左上角。
   */
  layoutContainer(container: ICEGroup): void {
    for (const child of container.childNodes) {
      child.setState({ left: 0, top: 0 });
    }
  }
}

export default ICEOverlayLayout;
