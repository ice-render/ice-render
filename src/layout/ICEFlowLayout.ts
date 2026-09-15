/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type ICEGroup from '../graphic/container/ICEGroup';
import ICELayoutManager from './ICELayoutManager';

/** 行内交叉轴对齐（一行里高矮不一的子项怎么排）。 */
export type ICEFlowCrossAlign = 'start' | 'center' | 'end';

/**
 * @class ICEFlowLayout 流式布局
 *
 * 对齐 Java Swing 的 FlowLayout：子组件从左到右依次排列，一行放不下（超出容器宽度）则换行。
 * 支持 left / center / right 三种**行对齐**（整行在容器里怎么摆），以及 gap 间距。
 *
 * 引擎在 Swing 的基础上补一项 `crossAlign`：**行内交叉轴对齐**（start / center / end），
 * 让「一行里矮的项垂直居中」这类版式不必自己算 —— `ICESpace` 的 align 就是它。
 *
 * `getPreferredSize()` 也按 Swing 的口径计入换行：容器已有确定宽度时，按该宽度分行后
 * 报「最宽行 × 各行高度之和」（Swing `FlowLayout.preferredLayoutSize` 就是这么算的，
 * 它用的是 `target.getWidth()`）；容器宽度未定 / `fitContent` 时按单行报。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEFlowLayout extends ICELayoutManager {
  private gap: number;
  /** 行间距（默认 = `gap`，与历史行为一致） */
  private gapY: number;
  private align: 'left' | 'center' | 'right';
  private crossAlign: ICEFlowCrossAlign;
  /** 装箱方式：`in-order`（默认，按顺序填满一行再换行）/ `first-fit`（优先回填还能放下的上一行） */
  private pack: 'in-order' | 'first-fit';

  constructor(
    props: {
      gap?: number;
      /** 行间距；不传就与 `gap` 相同（历史行为） */
      gapY?: number;
      align?: 'left' | 'center' | 'right';
      crossAlign?: ICEFlowCrossAlign;
      /**
       * 装箱方式（默认 `in-order`）：
       * - `in-order`：按顺序往当前行塞，塞不下才换行（Swing `FlowLayout` 的行为）；
       * - `first-fit`：优先回填到**任何**还放得下的行（把"小徽标 / 小按钮"塞回上一行），
       *   页面不容易被零碎小件撑高 —— `ice-web-components` 示例页的"簇 + 货架"手写布局就是这个语义。
       */
      pack?: 'in-order' | 'first-fit';
    } = {}
  ) {
    super();
    this.gap = props.gap ?? 10;
    this.gapY = props.gapY ?? this.gap;
    this.align = props.align || 'left';
    this.crossAlign = props.crossAlign || 'start';
    this.pack = props.pack === 'first-fit' ? 'first-fit' : 'in-order';
  }

  /** 序列化参数（见 `ICELayoutManager.toJSON`）。 */
  public toJSON(): any {
    return { gap: this.gap, gapY: this.gapY, align: this.align, crossAlign: this.crossAlign, pack: this.pack };
  }

  /**
   * 换行宽度：`fitContent` 的容器由内容决定宽度 → 单行；容器宽度未定（0）也当单行
   * （否则会在 0 宽上把每个子项都换到下一行）。
   */
  private __wrapWidth(container: ICEGroup, boxWidth: number): number {
    if ((container.state as any).fitContent) {
      return Infinity;
    }
    return boxWidth > 0 ? boxWidth : Infinity;
  }

  /** 按换行宽度把子项分行，并给出每行的占位宽度 / 行高。 */
  private __packRows(children: any[], wrapWidth: number): { rows: any[][]; rowWidths: number[]; rowHeights: number[] } {
    const rows: any[][] = [[]];
    const rowWidths: number[] = [];
    let rowWidth = 0;
    for (const child of children) {
      const w = this.outerSizeOf(child)[0];
      if (this.pack === 'first-fit') {
        // first-fit：回填到第一行还放得下的（+0.5 容差：宽度刚好铺满时别因浮点误差换行）
        let placed = false;
        for (let r = 0; r < rows.length; r += 1) {
          const used = rowWidths[r] === undefined ? rowWidth : rowWidths[r];
          if (rows[r].length > 0 && used + this.gap + w <= wrapWidth + 0.5) {
            rows[r].push(child);
            rowWidths[r] = used + this.gap + w;
            placed = true;
            break;
          }
        }
        if (placed) {
          continue;
        }
        if (rows[rows.length - 1].length === 0) {
          // 当前行还是空的：直接放（放不下也不换行，避免在超窄容器里无限换行）
          rows[rows.length - 1].push(child);
          rowWidth = w;
          continue;
        }
        // 开新行；旧行宽度先记账，新行宽度随后逐项累加
        rowWidths[rowWidths.length - 1] = rowWidths[rowWidths.length - 1] ?? rowWidth;
        rows.push([child]);
        rowWidth = w;
        continue;
      }
      if (rowWidth > 0 && rowWidth + this.gap + w > wrapWidth) {
        rowWidths.push(rowWidth);
        rows.push([]);
        rowWidth = 0;
      }
      rows[rows.length - 1].push(child);
      rowWidth += rowWidth > 0 ? this.gap + w : w;
    }
    if (this.pack === 'first-fit') {
      // 最后一行（以及任何还没记过账的行）宽度补齐
      rows.forEach((row, index) => {
        if (rowWidths[index] === undefined) {
          rowWidths[index] = row.reduce(
            (sum, child, i) => sum + this.outerSizeOf(child)[0] + (i > 0 ? this.gap : 0),
            0
          );
        }
      });
    } else {
      rowWidths.push(rowWidth);
    }
    const rowHeights = rows.map((row) => row.reduce((max, child) => Math.max(max, this.outerSizeOf(child)[1]), 0));
    return { rows, rowWidths, rowHeights };
  }

  /** 行内交叉轴偏移（start = 0）。 */
  private __crossDelta(child: any, rowMaxH: number): number {
    if (this.crossAlign === 'start') {
      return 0;
    }
    const h = this.outerSizeOf(child)[1];
    return this.crossAlign === 'center' ? Math.max(0, (rowMaxH - h) / 2) : Math.max(0, rowMaxH - h);
  }

  /**
   * @overwrite
   * 从左到右排列子组件，超出内容盒宽度则换行；行内按 `crossAlign` 对齐。
   */
  layoutContainer(container: ICEGroup): void {
    const children = this.layoutChildren(container);
    const box = this.contentBox(container);
    const { rows, rowWidths, rowHeights } = this.__packRows(children, this.__wrapWidth(container, box.width));

    let y = box.top;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const rowTotal = rowWidths[r];
      const rowMaxH = rowHeights[r];

      // 行对齐（整行在内容盒里怎么摆）
      let x = box.left;
      if (this.align === 'center') {
        x = box.left + (box.width - rowTotal) / 2;
      } else if (this.align === 'right') {
        x = box.left + box.width - rowTotal;
      }

      for (const child of row) {
        this.placeChild(child, x, y + this.__crossDelta(child, rowMaxH));
        x += this.outerSizeOf(child)[0] + this.gap;
      }
      y += rowMaxH + this.gapY;
    }
  }

  /**
   * 内容首选尺寸：容器有确定宽度时按该宽度分行（Swing `FlowLayout.preferredLayoutSize` 口径），
   * 否则按单行 —— 结果是「最宽行的宽度 + 各行高度之和」。
   */
  getPreferredSize(container: ICEGroup): [number, number] {
    const pad = this.paddingOf(container);
    const children = this.layoutChildren(container);
    const boxWidth = Math.max(0, (Number(container.state.width) || 0) - pad.left - pad.right);
    const { rowWidths, rowHeights } = this.__packRows(children, this.__wrapWidth(container, boxWidth));

    let width = 0;
    let height = 0;
    for (let r = 0; r < rowHeights.length; r++) {
      width = Math.max(width, rowWidths[r]);
      if (r > 0) height += this.gapY;
      height += rowHeights[r];
    }
    return [width + pad.left + pad.right, height + pad.top + pad.bottom];
  }
}

export default ICEFlowLayout;
