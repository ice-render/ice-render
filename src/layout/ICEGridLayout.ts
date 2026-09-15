/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type ICEGroup from '../graphic/container/ICEGroup';
import ICELayoutManager, { type ICEGridSpan } from './ICELayoutManager';

/**
 * @class ICEGridLayout 网格布局
 *
 * 对齐 Java Swing 的 GridLayout：把容器分成 cols 列，子组件按「行优先」依次填入网格。
 * 每行高度取该行最高子组件，行间 gapY 间距，列间 gapX 间距。
 *
 * 两个比「裸 cols」多出来的能力：
 * - `rows`：只给行数时按子项数量反推列数（`cols` 与 `rows` 都给时以 `cols` 为准）；
 * - 跨格：子项上写 `gridSpan: { colSpan, rowSpan }`（默认 1×1）即可占多格，
 *   像表头 / 通栏区块这种"占满一行"的项不必再自己算宽度。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEGridLayout extends ICELayoutManager {
  private cols: number | null;
  private rows: number | null;
  private gapX: number;
  private gapY: number;
  private cellSizing: 'content' | 'equal';

  constructor(
    props: {
      cols?: number;
      rows?: number;
      gapX?: number;
      gapY?: number;
      /** `content`（默认）= 列宽取该列最宽子项；`equal` = 各格等宽等高等分容器（Swing GridLayout 口径）。 */
      cellSizing?: 'content' | 'equal';
    } = {}
  ) {
    super();
    this.cols = props.cols && props.cols > 0 ? Math.floor(props.cols) : null;
    this.rows = props.rows && props.rows > 0 ? Math.floor(props.rows) : null;
    this.gapX = props.gapX ?? 10;
    this.gapY = props.gapY ?? 10;
    this.cellSizing = props.cellSizing === 'equal' ? 'equal' : 'content';
  }

  /** 序列化参数（见 `ICELayoutManager.toJSON`）。 */
  public toJSON(): any {
    return {
      cols: this.cols || undefined,
      rows: this.rows || undefined,
      gapX: this.gapX,
      gapY: this.gapY,
      cellSizing: this.cellSizing,
    };
  }

  /** 等分模式：每列宽 / 每行高由容器内容盒均分（Swing `GridLayout` 的口径）。 */
  private __equalMetrics(container: ICEGroup) {
    const children = container.childNodes;
    const cols = this.resolveCols(children.length);
    const rows = Math.max(1, Math.ceil(children.length / cols));
    const box = this.contentBox(container);
    const colWidth = Math.max(0, (box.width - Math.max(0, cols - 1) * this.gapX) / cols);
    const rowHeight = Math.max(0, (box.height - Math.max(0, rows - 1) * this.gapY) / rows);
    return { cols, rows, colWidth, rowHeight };
  }

  /** 实际列数：显式 `cols` > 由 `rows` 反推 > 默认 2。 */
  private resolveCols(count: number): number {
    if (this.cols) return this.cols;
    if (this.rows) return Math.max(1, Math.ceil(count / this.rows));
    return 2;
  }

  /** 子项的跨格数（非法值按 1 处理）。 */
  private spanOf(child: any): { colSpan: number; rowSpan: number } {
    const span: ICEGridSpan = (child.state && child.state.gridSpan) || {};
    return {
      colSpan: Math.max(1, Math.floor(Number(span.colSpan)) || 1),
      rowSpan: Math.max(1, Math.floor(Number(span.rowSpan)) || 1),
    };
  }

  /**
   * 按「行优先 + 占位表」把子项安排到格子里。
   *
   * 跨格要求先知道哪些格被占了，所以这里先做一遍占用计算，再统一算列宽 / 行高。
   * 返回每个子项的 `{ row, col }`，以及每列宽度、每行高度。
   */
  private buildGrid(container: ICEGroup) {
    const children = container.childNodes;
    const cols = this.resolveCols(children.length);
    const occupied = new Set<string>();
    const cells: Array<{ child: any; row: number; col: number; colSpan: number; rowSpan: number }> = [];
    let row = 0;
    let col = 0;

    const isFree = (r: number, c: number, rowSpan: number, colSpan: number): boolean => {
      for (let rr = r; rr < r + rowSpan; rr++) {
        for (let cc = c; cc < c + colSpan; cc++) {
          if (occupied.has(rr + ',' + cc)) return false;
        }
      }
      return true;
    };
    const mark = (r: number, c: number, rowSpan: number, colSpan: number): void => {
      for (let rr = r; rr < r + rowSpan; rr++) {
        for (let cc = c; cc < c + colSpan; cc++) {
          occupied.add(rr + ',' + cc);
        }
      }
    };

    for (const child of children) {
      const { colSpan, rowSpan } = this.spanOf(child);
      // 从当前位置起找第一个放得下的位置（跨格会跳过被占的格）
      // 逐行扫描：列不够放下 colSpan 时换行
      for (;;) {
        if (col + colSpan > cols) {
          row += 1;
          col = 0;
          continue;
        }
        if (isFree(row, col, rowSpan, colSpan)) break;
        col += 1;
      }
      mark(row, col, rowSpan, colSpan);
      cells.push({ child, row, col, colSpan, rowSpan });
      col += colSpan;
    }

    const colWidths: number[] = new Array(cols).fill(0);
    const rowHeights: number[] = [];
    for (const cell of cells) {
      const [w, h] = this.outerSizeOf(cell.child);
      const each = w / cell.colSpan;
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        colWidths[c] = Math.max(colWidths[c] || 0, each);
      }
      const eachH = h / cell.rowSpan;
      for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
        rowHeights[r] = Math.max(rowHeights[r] || 0, eachH);
      }
    }
    for (let r = 0; r < rowHeights.length; r++) rowHeights[r] = rowHeights[r] || 0;
    return { cols, cells, colWidths, rowHeights };
  }

  /**
   * @overwrite
   * 按「行优先」把子组件填入网格（支持 `rows` 反推列数与 `gridSpan` 跨格）。
   */
  layoutContainer(container: ICEGroup): void {
    const box = this.contentBox(container);
    const { colWidths, rowHeights, cells } = this.buildGrid(container);
    const equal = this.cellSizing === 'equal' ? this.__equalMetrics(container) : null;

    const colLeft: number[] = [];
    let acc = box.left;
    for (let c = 0; c < colWidths.length; c++) {
      colLeft[c] = acc;
      acc += (equal ? equal.colWidth : colWidths[c]) + this.gapX;
    }
    const rowTop: number[] = [];
    acc = box.top;
    for (let r = 0; r < rowHeights.length; r++) {
      rowTop[r] = acc;
      acc += (equal ? equal.rowHeight : rowHeights[r]) + this.gapY;
    }

    for (const cell of cells) {
      if (equal) {
        // 等分模式要**写尺寸**：Swing 的 GridLayout 会把子项摆成格子大小（跨格时带上中间的间距）
        const width = equal.colWidth * cell.colSpan + this.gapX * (cell.colSpan - 1);
        const height = equal.rowHeight * cell.rowSpan + this.gapY * (cell.rowSpan - 1);
        this.placeChildSized(cell.child, colLeft[cell.col] || box.left, rowTop[cell.row] || box.top, width, height);
      } else {
        this.placeChild(cell.child, colLeft[cell.col] || box.left, rowTop[cell.row] || box.top);
      }
    }
  }

  /**
   * 内容首选尺寸。
   *
   * - `content` 模式：列宽之和 + 列间距、行高之和 + 行间距，再加容器 padding；
   * - `equal` 模式返回 `[0,0]`（**不表态**）：等分意味着"填满容器"，子项会被拉成格子大小，
   *   这时候再量它们就等于在量容器自己（`cols × 当前子项宽` 会随着容器变大而变大，
   *   父布局永远缩不回来）。容器多大由调用方给的尺寸决定，父布局会回落到这个盒子。
   */
  getPreferredSize(container: ICEGroup): [number, number] {
    const pad = this.paddingOf(container);
    if (this.cellSizing === 'equal') {
      return [0, 0];
    }
    const { colWidths, rowHeights } = this.buildGrid(container);
    const width =
      colWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, colWidths.length - 1) * this.gapX + pad.left + pad.right;
    const height =
      rowHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, rowHeights.length - 1) * this.gapY + pad.top + pad.bottom;
    return [width, height];
  }
}

export default ICEGridLayout;
