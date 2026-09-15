/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type ICEGroup from '../graphic/container/ICEGroup';
import ICELayoutManager from './ICELayoutManager';

/** 交叉轴对齐（横向排列时作用于高度，纵向排列时作用于宽度）。 */
export type ICEBoxAlign = 'start' | 'center' | 'end' | 'stretch';

/**
 * @class ICEBoxLayout 箱式布局
 *
 * 对齐 Java Swing 的 BoxLayout：子组件沿单轴（横向 x / 纵向 y）依次排列，不换行。
 *
 * 主轴：子项上写 `grow: <number>` 时按比例瓜分**剩余空间**（0 或未写 = 不参与瓜分），
 * 于是"一个定宽侧栏 + 一个自适应内容区"这类版式不必再手算宽度。
 *
 * 交叉轴由 `align` 决定（Swing 的 BoxLayout 默认会把子项在交叉轴撑满，这里默认保持引擎历史行为）：
 * - `'start'`（默认）：贴内容盒起点、保持自身尺寸；
 * - `'center'` / `'end'`：在交叉轴居中 / 贴末端；
 * - `'stretch'`：撑满交叉轴 —— 纵向堆叠 + 每项拉满宽度的表单用它（对齐 Swing 默认口径）。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEBoxLayout extends ICELayoutManager {
  private axis: 'x' | 'y';
  private gap: number;
  private align: ICEBoxAlign;

  constructor(props: { axis?: 'x' | 'y'; gap?: number; align?: ICEBoxAlign } = {}) {
    super();
    this.axis = props.axis || 'x';
    this.gap = props.gap ?? 5;
    this.align = props.align || 'start';
  }

  /** 序列化参数（见 `ICELayoutManager.toJSON`）。 */
  public toJSON(): any {
    return { axis: this.axis, gap: this.gap, align: this.align };
  }

  /** 交叉轴偏移量（`start` / `center` / `end`；`stretch` 直接撑满，不偏移）。 */
  private __crossDelta(child: any, crossSize: number): number {
    if (this.align === 'start' || this.align === 'stretch') {
      return 0;
    }
    const outer = this.axis === 'x' ? this.outerSizeOf(child)[1] : this.outerSizeOf(child)[0];
    if (this.align === 'center') {
      return Math.max(0, (crossSize - outer) / 2);
    }
    return Math.max(0, crossSize - outer); // end
  }

  /**
   * @overwrite
   * 沿单轴依次排列（横向 left 递增 / 纵向 top 递增）：吃了 `grow` 的子项分剩余空间，
   * 交叉轴按 `align` 落位（`stretch` 时写交叉轴尺寸）。
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

    const crossStart = horizontal ? box.top : box.left;
    const crossSize = horizontal ? box.height : box.width;
    let offset = horizontal ? box.left : box.top;

    // 主轴增量：剩余空间按 grow 权重**整数**分配（除以权重和会得到 33.333 这种落点）；
    // 空间不足（leftover < 0）时反过来收缩：只有声明了 `grow` 的子项参与，且不越过它的最小尺寸
    // （`setMinimumSize()` 声明过才有下限，没声明就按首选尺寸处理 = 不许压缩，与历史行为一致）。
    const mainOwn = children.map((child) => {
      const [ow, oh] = this.outerSizeOf(child);
      return horizontal ? ow : oh;
    });
    const growWeights = children.map((child) => Math.max(0, Number(child.state.grow) || 0));
    const extras = new Array(children.length).fill(0);
    if (leftover > 0) {
      const shares = this.distributeIntegers(leftover, growWeights);
      for (let i = 0; i < children.length; i++) {
        extras[i] = shares[i];
      }
    } else if (leftover < 0) {
      const capacities = children.map((child, i) => {
        if (growWeights[i] <= 0) {
          return 0; // 没声明 grow 的子项不参与收缩
        }
        const minMain = horizontal ? this.minimumSizeOf(child)[0] : this.minimumSizeOf(child)[1];
        return Math.max(0, mainOwn[i] - minMain);
      });
      const shrinks = this.__allocateByCapacity(-leftover, capacities);
      for (let i = 0; i < children.length; i++) {
        extras[i] = -shrinks[i];
      }
    }

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const extra = extras[i];
      const mainSize = mainOwn[i] + extra;
      const crossPos = crossStart + this.__crossDelta(child, crossSize);
      // 要写尺寸的两种情况：主轴吃了 grow（定主轴尺寸）、交叉轴 stretch（定交叉轴尺寸）
      const writeMain = extra !== 0 || this.align === 'stretch';
      const writeCross = this.align === 'stretch';

      if (writeMain || writeCross) {
        if (horizontal) {
          this.placeChildSized(
            child,
            offset,
            crossPos,
            writeMain ? mainSize : undefined,
            writeCross ? crossSize : undefined
          );
        } else {
          this.placeChildSized(
            child,
            crossPos,
            offset,
            writeCross ? crossSize : undefined,
            writeMain ? mainSize : undefined
          );
        }
      } else if (horizontal) {
        this.placeChild(child, offset, crossPos);
      } else {
        this.placeChild(child, crossPos, offset);
      }
      offset += mainSize + this.gap;
    }
  }

  /**
   * 把 `amount` 按各项容量（互不相同的上限）摊下去：先按容量比例分、撞到上限的项退出，
   * 余量继续分给还装得下的项 —— 直到分完或所有项都到顶（到顶就接受溢出，不硬压内容）。
   */
  private __allocateByCapacity(amount: number, capacities: number[]): number[] {
    const result = capacities.map(() => 0);
    let remaining = Math.max(0, amount);
    let guard = 0;
    while (remaining > 1e-6 && guard < 32) {
      guard += 1;
      const active: number[] = [];
      let totalRoom = 0;
      for (let i = 0; i < capacities.length; i++) {
        const room = capacities[i] - result[i];
        if (room > 1e-6) {
          active.push(i);
          totalRoom += room;
        }
      }
      if (totalRoom <= 0) {
        break;
      }
      // 关键：本趟的预算与总容量要**先取快照**，整趟算完再统一扣减。
      // 一边算一边扣会让同容量、同权重的两项分到不同的量（实测 60 分成 35.2 / 24.8 而不是 30 / 30）。
      const budget = remaining;
      let moved = 0;
      for (let k = 0; k < active.length; k++) {
        const i = active[k];
        const room = capacities[i] - result[i];
        const take = Math.min(room, (budget * room) / totalRoom);
        if (take > 0) {
          result[i] += take;
          moved += take;
        }
      }
      if (moved <= 1e-9) {
        break;
      }
      remaining -= moved;
    }
    return result;
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

  /**
   * 内容最小尺寸：主轴累加各项**最小**尺寸（没声明下限的项按首选尺寸算），交叉轴取最大。
   * 与 `getPreferredSize()` 同构，所以"最小"能沿着嵌套容器一层层往上传。
   */
  getMinimumSize(container: ICEGroup): [number, number] {
    const pad = this.paddingOf(container);
    const children = this.layoutChildren(container);
    let main = 0;
    let cross = 0;
    for (let i = 0; i < children.length; i++) {
      const [w, h] = this.minimumSizeOf(children[i]);
      const m = this.marginOf(children[i]);
      const outerW = w + m.left + m.right;
      const outerH = h + m.top + m.bottom;
      main += this.axis === 'x' ? outerW : outerH;
      if (i > 0) {
        main += this.gap;
      }
      cross = Math.max(cross, this.axis === 'x' ? outerH : outerW);
    }
    const width = (this.axis === 'x' ? main : cross) + pad.left + pad.right;
    const height = (this.axis === 'x' ? cross : main) + pad.top + pad.bottom;
    return [width, height];
  }
}

export default ICEBoxLayout;
