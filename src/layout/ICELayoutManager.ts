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
   * 容器内内容的「最小尺寸」（可选，默认 `[0,0]` = 没有意见）。
   *
   * 为什么要有它：首选尺寸只描述"想多大"，回答不了"最小能压到多小"。没有最小值的协议，
   * 布局在空间不足时只能二选一 —— 要么溢出（内容压出容器），要么硬压（把子项压没）。
   * 有了它，收缩才是**逐项显式声明**的：没写 `setMinimumSize()` 的子项默认不可压缩
   * （见 `minimumSizeOf` 的兜底），所以历史行为不变。
   */
  getMinimumSize(container: ICEGroup): [number, number] {
    return [0, 0];
  }

  /**
   * 布局自己的**构造参数**（序列化用）：返回一个能原样喂回构造函数的对象。
   *
   * 为什么要它：布局是"怎么排"，属于文档内容 —— 快照往返（`ice.toJSONString()` → 另存 →
   * `fromJSONString()`）必须把策略一起带回来，否则"存盘再打开，版式散了"。
   * 每个布局只要报自己的参数即可；`ICELayeredLayout` 这种无参布局返回 `{}`。
   *
   * **约定**：只报构造参数，不要报运行时状态（`currentIndex` 这种"用户切到第几张卡"要报，
   * 但缓存/上一次算出的尺寸不要报）。第三方布局实现了它才能被序列化。
   *
   * **返回 `null` = 显式声明"这个策略不进文档"**：用于组件内部策略 —— 由组件在构造时自己
   * `setLayout(new XxxLayout())` 重建、参数活在组件的 state 里（组件库的
   * `ICEMenuLayout` / `ICEWindowLayout` / `ICEFomItemLayout` 就是这一类）。
   * 返回 `null` 时序列化既不写 `layout` 字段、也不告警；返回 `{}` 则相反，表示
   * "我确实没有参数，但请在文档里保留这个策略"。
   */
  public toJSON(): any {
    return {};
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
   * 子项**能被压到多小**（收缩类布局用，例如 `ICEBoxLayout` 的剩余空间不足时）。
   *
   * 口径（逐轴判断，缺省则回落到首选尺寸）：
   * - 子项用 `setMinimumSize()` 声明过的轴 → 用声明值；
   * - 没声明的轴 → 用它的**首选尺寸**，也就是"不许压缩"。
   *
   * 这样"能不能压"是子项自己说了算的（对齐 Swing `Component.getMinimumSize()` 的
   * 默认实现返回 `getPreferredSize()`）：不写 `setMinimumSize()` 的既有界面，
   * 收缩行为与引入这个协议之前**完全一致**。
   */
  protected minimumSizeOf(child: any): [number, number] {
    const preferred = this.preferredSizeOf(child);
    let declared: any = null;
    if (child && typeof child.getMinimumSize === 'function') {
      declared = child.getMinimumSize();
    }
    if (!declared) {
      return preferred;
    }
    const minWidth = Number(declared[0]) || 0;
    const minHeight = Number(declared[1]) || 0;
    return [minWidth > 0 ? minWidth : preferred[0], minHeight > 0 ? minHeight : preferred[1]];
  }

  /**
   * 参与排布的子项（跳过不可见子项）。
   *
   * 对齐 Swing：`FlowLayout` / `BorderLayout` / `BoxLayout` 都跳过不可见子项，
   * **`GridLayout` 不跳过**（不可见子项照样占一个格子），所以网格布局不要用它。
   * 判据用 `isEffectivelyVisible()`：父容器 `display:false` 时整棵子树都不参与排布。
   */
  protected layoutChildren(container: ICEGroup, options: { includeInvisible?: boolean } = {}): any[] {
    const children = container.childNodes;
    const result: any[] = [];
    for (let i = 0; i < children.length; i++) {
      const child: any = children[i];
      // `layoutIgnore`：这个子项由调用方手动定位（CSS 里 `position:absolute` 的对应物），布局不碰它。
      // 有了它，"容器负责大多数子项、少数子项位置是数据（用户拖出来的）"这类界面才成立。
      if (child.state && child.state.layoutIgnore === true) {
        continue;
      }
      if (
        !options.includeInvisible &&
        typeof child.isEffectivelyVisible === 'function' &&
        !child.isEffectivelyVisible()
      ) {
        continue;
      }
      result.push(child);
    }
    return result;
  }

  /**
   * 把 `total` 按权重切成**整数**分量，且分量之和精确等于 `Math.round(total)`。
   *
   * 为什么要有它：等分网格与 `grow` 的剩余空间分配天然是除法 —— 100 分 3 份是 33.333…，
   * 落在画布上就是 .333 像素的落点与尺寸（文本被反锯齿软化、相邻子项边缘对不齐）。
   * 用「累计取整」分配（第 i 份 = round(累计权重占比 × total) − 已分配）可以做到：
   * ① 每份都是整数；② 不会出现"最后一项多出半像素"的漂移；③ 容器尺寸变化时整体单调、不抖动。
   *
   * 注意：这里只消除**布局自己引入**的分数（除法余数）。容器自身若在分数坐标上，
   * 子项仍会带着那个偏移 —— 那是调用方的构图选择，布局不该越权改写。
   */
  protected distributeIntegers(total: number, weights: number[]): number[] {
    const result: number[] = [];
    let weightSum = 0;
    for (let i = 0; i < weights.length; i++) {
      weightSum += Math.max(0, Number(weights[i]) || 0);
    }
    if (weightSum <= 0 || weights.length === 0) {
      for (let i = 0; i < weights.length; i++) {
        result.push(0);
      }
      return result;
    }
    let consumedWeight = 0;
    let assigned = 0;
    for (let i = 0; i < weights.length; i++) {
      consumedWeight += Math.max(0, Number(weights[i]) || 0);
      const boundary = Math.round((total * consumedWeight) / weightSum);
      result.push(boundary - assigned);
      assigned = boundary;
    }
    return result;
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
