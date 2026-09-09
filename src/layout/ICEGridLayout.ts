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
 * @class ICEGridLayout 网格布局
 *
 * 对齐 Java Swing 的 GridLayout：把容器分成 cols 列，子组件按「行优先」依次填入网格。
 * 每行高度取该行最高子组件，行间 gapY 间距，列间 gapX 间距。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEGridLayout extends ICELayoutManager {
  private cols: number;
  private gapX: number;
  private gapY: number;

  constructor(props: { cols?: number; gapX?: number; gapY?: number } = {}) {
    super();
    this.cols = props.cols || 2;
    this.gapX = props.gapX || 10;
    this.gapY = props.gapY || 10;
  }

  /**
   * @overwrite
   * 按「行优先」把子组件填入 cols 列网格。
   */
  layoutContainer(container: ICEGroup): void {
    const children = container.childNodes;
    let x = 0;
    let y = 0;
    let rowMaxH = 0;
    let col = 0;

    for (const child of children) {
      child.setState({ left: x, top: y });
      x += child.state.width + this.gapX;
      rowMaxH = Math.max(rowMaxH, child.state.height);
      col++;

      if (col >= this.cols) {
        col = 0;
        x = 0;
        y += rowMaxH + this.gapY;
        rowMaxH = 0;
      }
    }
  }
}

export default ICEGridLayout;
