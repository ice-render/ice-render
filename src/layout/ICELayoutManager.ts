/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type ICEGroup from '../graphic/container/ICEGroup';

/** 四边内距 / 外边距：数字 = 四边等距；对象按边给（缺省 0）。 */
export type ICELayoutInsets = number | { top?: number; right?: number; bottom?: number; left?: number };

/** `ICEBorderLayout` 的区域约束（写在子组件的 `layoutConstraint` 上）。 */
export type ICELayoutConstraint = 'north' | 'south' | 'east' | 'west' | 'center';

/** 归一化后的四边内距。 */
export interface ICELayoutInsetsValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 网格跨格（`ICEGridLayout` 用，写在子组件的 `gridSpan` 上）。 */
export interface ICEGridSpan {
  colSpan?: number;
  rowSpan?: number;
}

/** 内容盒（容器扣掉 `padding` 之后的可排布区域，坐标相对容器自身）。 */
export interface ICELayoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const ZERO_INSETS: ICELayoutInsetsValue = { top: 0, right: 0, bottom: 0, left: 0 };

/** 把 `number | {top,right,bottom,left}` 归一化成四边值（非法 / 缺省一律 0）。 */
export function normalizeInsets(value: ICELayoutInsets | undefined | null): ICELayoutInsetsValue {
  if (typeof value === 'number' && isFinite(value)) {
    return { top: value, right: value, bottom: value, left: value };
  }
  if (value && typeof value === 'object') {
    return {
      top: Number((value as any).top) || 0,
      right: Number((value as any).right) || 0,
      bottom: Number((value as any).bottom) || 0,
      left: Number((value as any).left) || 0,
    };
  }
  return ZERO_INSETS;
}

/**
 * @class ICELayoutManager 布局管理器（抽象基类）
 *
 * **设计思想来自 Java Swing 的 LayoutManager**（策略模式）：
 * - 组件（ICEComponent）只负责「画自己」，不碰布局；
 * - 容器（ICEGroup）只负责「持有子组件」，通过 setLayout() 持有布局策略；
 * - 布局管理器（本类及其子类）只负责「摆位置」。
 *
 * 核心只有一个方法 layoutContainer(container)：给定容器，计算并设置所有子组件的位置/尺寸；
 * 另可覆写 getPreferredSize(container) 报告「内容想要多大」，容器据此按内容自适应（`fitContent`）。
 *
 * 子类一律用下面这几个 helper 读取尺寸 —— 它们把 `padding`（容器内距）与 `margin`（子项外边距）
 * 一起算进去，避免每个布局各写一套口径：
 *
 * - `contentBox(container)`：容器的可排布区域（已扣 padding）；
 * - `outerSizeOf(child)`：子项的占位尺寸（内容尺寸 + margin）；
 * - `placeChild(child, x, y)`：把子项摆到「占位框」的 (x,y)（内部自动加 margin 偏移）。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class ICELayoutManager {
  /** 非法 `layoutConstraint` 只提示一次（避免每帧刷屏）。 */
  private __warnedConstraints = new Set<string>();

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

  /**
   * 容器的可排布区域：容器自身盒子扣掉 `padding`（`container.state.padding`）。
   *
   * 返回的坐标是**相对容器自身**的（与 `child.state.left/top` 同一坐标系）。
   */
  protected contentBox(container: ICEGroup): ICELayoutBox {
    const pad = this.paddingOf(container);
    const width = Math.max(0, (Number(container.state.width) || 0) - pad.left - pad.right);
    const height = Math.max(0, (Number(container.state.height) || 0) - pad.top - pad.bottom);
    return { left: pad.left, top: pad.top, width, height };
  }

  /** 容器的内距（`container.state.padding`；未设置即四边 0）。 */
  protected paddingOf(container: ICEGroup): ICELayoutInsetsValue {
    return normalizeInsets((container.state as any).padding);
  }

  /** 子项外边距（`child.state.margin`）。 */
  protected marginOf(child: any): ICELayoutInsetsValue {
    return normalizeInsets(child && child.state ? child.state.margin : undefined);
  }

  /**
   * 子项**想要的尺寸**：问它自己的 `getPreferredSize()`（对齐 Swing 的
   * `BorderLayout.preferredLayoutSize` —— 对每个子项调 `comp.getPreferredSize()`）。
   *
   * 三种子项各有各的答案，但布局不需要知道区别（这正是 Swing 尺寸协议的价值）：
   * - 叶子图元：显式声明的尺寸，或当前盒子（`ICEComponent.getPreferredSize()`）；
   * - 文本类组件：量测后的字形尺寸；
   * - 子容器：**没显式声明尺寸**时由它自己的布局算出的内容尺寸
   *   （显式给了尺寸的容器仍报自己的盒子，等价于 Swing 的 `setPreferredSize`，见 `ICEGroup`）。
   *
   * 兜底：子项没实现 / 报 `[0,0]`（例如布局没实现 `getPreferredSize`）时回落到它的盒子。
   */
  protected preferredSizeOf(child: any): [number, number] {
    if (child && typeof child.getPreferredSize === 'function') {
      const size = child.getPreferredSize();
      if (size && ((Number(size[0]) || 0) > 0 || (Number(size[1]) || 0) > 0)) {
        return [Number(size[0]) || 0, Number(size[1]) || 0];
      }
    }
    return [Number(child.state.width) || 0, Number(child.state.height) || 0];
  }

  /**
   * 参与排布的子项（跳过不可见子项）。
   *
   * 对齐 Swing：`FlowLayout` / `BorderLayout` / `BoxLayout` 都跳过不可见子项，
   * **`GridLayout` 不跳过**（不可见子项照样占一个格子），所以网格布局不要用它。
   * 判据用 `isEffectivelyVisible()`：父容器 `display:false` 时整棵子树都不参与排布。
   */
  protected layoutChildren(container: ICEGroup): any[] {
    const children = container.childNodes;
    const visible: any[] = [];
    for (let i = 0; i < children.length; i++) {
      const child: any = children[i];
      if (typeof child.isEffectivelyVisible === 'function' && !child.isEffectivelyVisible()) {
        continue;
      }
      visible.push(child);
    }
    return visible;
  }

  /** 子项的**占位尺寸**：内容尺寸 + 外边距（布局推进时用这个）。 */
  protected outerSizeOf(child: any): [number, number] {
    const [w, h] = this.preferredSizeOf(child);
    const m = this.marginOf(child);
    return [w + m.left + m.right, h + m.top + m.bottom];
  }

  /**
   * 把子项摆到「占位框」的 (x, y)：内容盒的左上角自动加上 margin 偏移。
   *
   * 语义与 CSS 的 margin 一致：布局给的是外框位置，子项自己往里缩 margin。
   */
  protected placeChild(child: any, x: number, y: number): void {
    const m = this.marginOf(child);
    child.setState({ left: x + m.left, top: y + m.top });
  }

  /** 落位 + 同时给尺寸（拉伸类布局用；宽度/高度按内容盒给，自动扣掉 margin）。 */
  protected placeChildSized(child: any, x: number, y: number, width?: number, height?: number): void {
    const m = this.marginOf(child);
    const next: any = { left: x + m.left, top: y + m.top };
    if (width !== undefined) next.width = Math.max(0, width - m.left - m.right);
    if (height !== undefined) next.height = Math.max(0, height - m.top - m.bottom);
    child.setState(next);
  }

  /**
   * 读子项的方位约束（`ICEBorderLayout` 用）：只认五个合法值，其它一律当 `center` 并提示一次。
   *
   * 以前是裸字符串比较，写错（`'North'` / `'top'`）会静默落到 center，看不出哪里错了。
   */
  protected constraintOf(child: any): ICELayoutConstraint {
    const raw = child && child.state ? child.state.layoutConstraint : undefined;
    if (raw === undefined || raw === null || raw === '') return 'center';
    if (raw === 'north' || raw === 'south' || raw === 'east' || raw === 'west' || raw === 'center') {
      return raw;
    }
    const key = String(raw);
    if (!this.__warnedConstraints.has(key)) {
      this.__warnedConstraints.add(key);
      console.warn(
        `[ICE] layoutConstraint「${key}」不是合法区域；只认 north / south / east / west / center，已按 center 处理。`
      );
    }
    return 'center';
  }
}

export default ICELayoutManager;
