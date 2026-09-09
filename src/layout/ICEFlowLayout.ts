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
 * @class ICEFlowLayout 流式布局
 *
 * 对齐 Java Swing 的 FlowLayout：子组件从左到右依次排列，一行放不下（超出容器宽度）则换行。
 * 支持 left / center / right 三种对齐，以及 gap 间距。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEFlowLayout extends ICELayoutManager {
  private gap: number;
  private align: 'left' | 'center' | 'right';

  constructor(props: { gap?: number; align?: 'left' | 'center' | 'right' } = {}) {
    super();
    this.gap = props.gap || 10;
    this.align = props.align || 'left';
  }

  /**
   * @overwrite
   * 从左到右排列子组件，超出容器宽度则换行。
   */
  layoutContainer(container: ICEGroup): void {
    const children = container.childNodes;
    const containerWidth = container.state.width;
    const gap = this.gap;

    // 先按行分组（换行）
    const rows: Array<Array<any>> = [[]];
    let rowWidth = 0;
    for (const child of children) {
      const w = child.state.width;
      const needWrap = rowWidth > 0 && rowWidth + gap + w > containerWidth;
      if (needWrap) {
        rows.push([]);
        rowWidth = 0;
      }
      rows[rows.length - 1].push(child);
      rowWidth += rowWidth > 0 ? gap + w : w;
    }

    // 逐行落位
    let y = 0;
    for (const row of rows) {
      let rowTotal = 0;
      let rowMaxH = 0;
      for (const child of row) {
        rowTotal += child.state.width;
        rowMaxH = Math.max(rowMaxH, child.state.height);
      }
      rowTotal += gap * (row.length - 1);

      // 计算本行起始 x（对齐）
      let x = 0;
      if (this.align === 'center') {
        x = (containerWidth - rowTotal) / 2;
      } else if (this.align === 'right') {
        x = containerWidth - rowTotal;
      }

      for (const child of row) {
        child.setState({ left: x, top: y });
        x += child.state.width + gap;
      }
      y += rowMaxH + gap;
    }
  }
}

export default ICEFlowLayout;
