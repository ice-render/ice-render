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
    this.gap = props.gap ?? 10;
    this.align = props.align || 'left';
  }

  /**
   * @overwrite
   * 从左到右排列子组件，超出内容盒宽度则换行；`fitContent` 的容器排成一行
   * （它的宽度本来就由内容决定，按宽度换行会在 0 宽上无限换行）。
   */
  layoutContainer(container: ICEGroup): void {
    const children = container.childNodes;
    const box = this.contentBox(container);
    const wrapWidth = (container.state as any).fitContent ? Infinity : box.width;
    const gap = this.gap;

    // 先按行分组（换行）
    const rows: Array<Array<any>> = [[]];
    let rowWidth = 0;
    for (const child of children) {
      const w = this.outerSizeOf(child)[0];
      const needWrap = rowWidth > 0 && rowWidth + gap + w > wrapWidth;
      if (needWrap) {
        rows.push([]);
        rowWidth = 0;
      }
      rows[rows.length - 1].push(child);
      rowWidth += rowWidth > 0 ? gap + w : w;
    }

    // 逐行落位
    let y = box.top;
    for (const row of rows) {
      let rowTotal = 0;
      let rowMaxH = 0;
      for (const child of row) {
        const [w, h] = this.outerSizeOf(child);
        rowTotal += w;
        rowMaxH = Math.max(rowMaxH, h);
      }
      rowTotal += gap * (row.length - 1);

      // 计算本行起始 x（对齐）
      let x = box.left;
      if (this.align === 'center') {
        x = box.left + (box.width - rowTotal) / 2;
      } else if (this.align === 'right') {
        x = box.left + box.width - rowTotal;
      }

      for (const child of row) {
        this.placeChild(child, x, y);
        x += this.outerSizeOf(child)[0] + gap;
      }
      y += rowMaxH + gap;
    }
  }

  /**
   * 内容首选尺寸：**排成一行**（不换行）时的宽度 + 最高子项的高度，再加上容器 padding。
   *
   * 与 `fitContent` 的语义一致：先问"内容想占多大"，再决定容器多大；换行只发生在容器
   * 已经有确定宽度的时候。
   */
  getPreferredSize(container: ICEGroup): [number, number] {
    const pad = this.paddingOf(container);
    let width = 0;
    let height = 0;
    const children = container.childNodes;
    for (let i = 0; i < children.length; i++) {
      const [w, h] = this.outerSizeOf(children[i]);
      width += w;
      if (i > 0) width += this.gap;
      height = Math.max(height, h);
    }
    return [width + pad.left + pad.right, height + pad.top + pad.bottom];
  }
}

export default ICEFlowLayout;
