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
 * @class ICEBoxLayout 箱式布局
 *
 * 对齐 Java Swing 的 BoxLayout：子组件沿单轴（横向 x / 纵向 y）依次排列，不换行。
 *
 * 子项上写 `grow: <number>` 时按比例瓜分**剩余空间**（0 或未写 = 不参与瓜分），
 * 于是"一个定宽侧栏 + 一个自适应内容区"这类版式不必再手算宽度。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEBoxLayout extends ICELayoutManager {
  private axis: 'x' | 'y';
  private gap: number;

  constructor(props: { axis?: 'x' | 'y'; gap?: number } = {}) {
    super();
    this.axis = props.axis || 'x';
    this.gap = props.gap ?? 5;
  }

  /**
   * @overwrite
   * 沿单轴依次排列，横向时 left 递增，纵向时 top 递增；带 `grow` 的子项按比例吃掉剩余空间。
   */
  layoutContainer(container: ICEGroup): void {
    const box = this.contentBox(container);
    const children = this.layoutChildren(container);
    const horizontal = this.axis === 'x';

    // 先算总占位，才能知道"剩余空间"有多少
    let total = 0;
    for (const child of children) {
      total += horizontal ? this.outerSizeOf(child)[0] : this.outerSizeOf(child)[1];
    }
    total += Math.max(0, children.length - 1) * this.gap;
    const available = horizontal ? box.width : box.height;
    const leftover = available - total;

    let growSum = 0;
    for (const child of children) {
      growSum += Math.max(0, Number(child.state.grow) || 0);
    }

    let offset = horizontal ? box.left : box.top;
    for (const child of children) {
      const [ow, oh] = this.outerSizeOf(child);
      const grow = Math.max(0, Number(child.state.grow) || 0);
      // 只有"容器比内容宽"且这个子项声明了 grow 时才分配剩余空间（容器小于内容时保持原尺寸，不压缩）
      if (this.axis === 'x') {
        const extra = leftover > 0 && growSum > 0 && grow > 0 ? (leftover * grow) / growSum : 0;
        if (extra > 0) {
          const width = ow + extra;
          this.placeChildSized(child, offset, box.top, width);
          offset += width + this.gap;
        } else {
          this.placeChild(child, offset, box.top);
          offset += ow + this.gap;
        }
      } else {
        const extra = leftover > 0 && growSum > 0 && grow > 0 ? (leftover * grow) / growSum : 0;
        if (extra > 0) {
          const height = oh + extra;
          this.placeChildSized(child, box.left, offset, undefined, height);
          offset += height + this.gap;
        } else {
          this.placeChild(child, box.left, offset);
          offset += oh + this.gap;
        }
      }
    }
  }

  /** 内容首选尺寸：单轴累加（不分配剩余空间），交叉轴取最大。 */
  getPreferredSize(container: ICEGroup): [number, number] {
    const pad = this.paddingOf(container);
    const children = this.layoutChildren(container);
    let main = 0;
    let cross = 0;
    for (let i = 0; i < children.length; i++) {
      const [w, h] = this.outerSizeOf(children[i]);
      main += this.axis === 'x' ? w : h;
      if (i > 0) main += this.gap;
      cross = Math.max(cross, this.axis === 'x' ? h : w);
    }
    const width = (this.axis === 'x' ? main : cross) + pad.left + pad.right;
    const height = (this.axis === 'x' ? cross : main) + pad.top + pad.bottom;
    return [width, height];
  }
}

export default ICEBoxLayout;
