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
   * 所有子组件叠放到内容盒左上角（容器 `padding` 之内）。
   */
  layoutContainer(container: ICEGroup): void {
    const box = this.contentBox(container);
    for (const child of this.layoutChildren(container)) {
      this.placeChild(child, box.left, box.top);
    }
  }

  /** 内容首选尺寸：所有子项占位的最大值（叠加语义 —— 取最大而不是求和）。 */
  getPreferredSize(container: ICEGroup): [number, number] {
    const pad = this.paddingOf(container);
    let width = 0;
    let height = 0;
    for (const child of this.layoutChildren(container)) {
      const [w, h] = this.outerSizeOf(child);
      width = Math.max(width, w);
      height = Math.max(height, h);
    }
    return [width + pad.left + pad.right, height + pad.top + pad.bottom];
  }
}

export default ICEOverlayLayout;
