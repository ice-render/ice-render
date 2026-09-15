/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type ICEGroup from '../graphic/container/ICEGroup';
import ICELayoutManager from './ICELayoutManager';
import { computeLayeredLayout } from './layered-core';

interface GraphNode {
  id: string;
  component: any;
  rank: number;
  order: number;
  barycenter: number;
}

/**
 * @class ICELayeredLayout 分层图布局
 *
 * **设计思想来自 Java Swing 的 LayoutManager**：和 Flow / Grid / Border 一样，它只是"把子项摆到位"
 * 的一个策略 —— 通过 `layoutContainer(container)` 接入容器（`setLayout`），重排时机由容器负责，
 * 布局本身不碰容器以外的任何东西。
 *
 * 区别只在**面向的对象**：它服务的是「图」（节点 + 边，如流程图 / ER 图），所以读的是节点与
 * `ICEPolyLine` 的连线，而不是单纯的子项列表。算法是分层图绘制的通用三步：
 *
 * 1. 拓扑分层（最长路径法）：有向边总是从低层指向高层，源在左、汇在右；有向环用 visiting 集合兜底；
 * 2. 层内排序（重心法）：迭代调整每层节点顺序，减少边交叉；
 * 3. 算坐标：层号 → left，层内序号 → top（LR 方向）。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICELayeredLayout extends ICELayoutManager {
  private gapX: number;
  private gapY: number;
  private direction: 'horizontal' | 'vertical';
  private crossAlign: 'start' | 'center';

  constructor(
    props: {
      gapX?: number;
      gapY?: number;
      /** 主干方向：`horizontal`（默认，层自左而右）/ `vertical`（层自上而下） */
      direction?: 'horizontal' | 'vertical';
      /** 交叉轴对齐：`start`（默认，与历史行为一致）/ `center` */
      crossAlign?: 'start' | 'center';
    } = {}
  ) {
    super();
    this.gapX = props.gapX ?? 80;
    this.gapY = props.gapY ?? 40;
    this.direction = props.direction === 'vertical' ? 'vertical' : 'horizontal';
    this.crossAlign = props.crossAlign === 'center' ? 'center' : 'start';
  }

  /** 序列化参数（见 `ICELayoutManager.toJSON`）。 */
  public toJSON(): any {
    return { gapX: this.gapX, gapY: this.gapY, direction: this.direction, crossAlign: this.crossAlign };
  }

  /**
   * @overwrite
   * 读容器里的节点（非连线组件）+ 边（ICEPolyLine 的 links），分层布局后 setState 落位。
   */
  layoutContainer(container: ICEGroup): void {
    const box = this.contentBox(container);
    const children = container.childNodes || [];
    const nodeList: GraphNode[] = [];
    const edgeList: Array<{ from: string | null; to: string | null; component: any }> = [];

    for (const c of children) {
      if (c.isLine) {
        // 边：通过 links 找两端节点 id
        edgeList.push({
          from: c.getLinkFromId ? c.getLinkFromId() : null,
          to: c.getLinkToId ? c.getLinkToId() : null,
          component: c,
        });
      } else {
        nodeList.push({ id: c.props.id, component: c, rank: 0, order: 0, barycenter: 0 });
      }
    }

    if (nodeList.length === 0) {
      return;
    }

    const nodeById: { [id: string]: GraphNode } = {};
    nodeList.forEach((n) => (nodeById[n.id] = n));
    // 只保留两端都在节点集合内的边
    const edges = edgeList.filter((e) => e.from && e.to && nodeById[e.from] && nodeById[e.to]);

    // 分层 / 层内排序 / 落坐标交给纯内核（与编译器共用同一份算法，口径不会漂）
    const positions = computeLayeredLayout(
      nodeList.map((n) => {
        const [w, h] = this.outerSizeOf(n.component);
        return { id: n.id, width: w, height: h };
      }),
      edges.map((e) => ({ from: e.from as string, to: e.to as string })),
      { gapX: this.gapX, gapY: this.gapY, direction: this.direction, crossAlign: this.crossAlign }
    );

    nodeList.forEach((n) => {
      const position = positions.get(n.id);
      if (!position) {
        return;
      }
      n.rank = position.rank;
      n.order = position.order;
      this.placeChild(n.component, box.left + position.left, box.top + position.top);
    });

    // 对齐连线端点（容器本地坐标，和节点 left/top 同一空间）：
    // 源节点出边用右边中点，目标节点入边用左边中点
    for (const e of edges) {
      const source = nodeById[e.from as string].component;
      const target = nodeById[e.to as string].component;
      const sx = source.state.left + source.state.width;
      const sy = source.state.top + source.state.height / 2;
      const tx = target.state.left;
      const ty = target.state.top + target.state.height / 2;
      e.component.setState({ startPoint: [sx, sy], endPoint: [tx, ty] });
    }
  }

  /**
   * 内容首选尺寸：分层排完之后节点占据的包围盒（再补上容器 padding）。
   *
   * 与 `layoutContainer` 走**同一个内核**，所以"还没排过"时也能给出正确结果。
   */
  getPreferredSize(container: ICEGroup): [number, number] {
    const pad = this.paddingOf(container);
    const children = (container.childNodes || []).filter((c: any) => !c.isLine);
    if (!children.length) {
      return [pad.left + pad.right, pad.top + pad.bottom];
    }
    const nodes = children.map((component: any) => {
      const [w, h] = this.outerSizeOf(component);
      return { id: component.props.id, width: w, height: h };
    });
    const edges = (container.childNodes || [])
      .filter((c: any) => c.isLine && c.getLinkFromId && c.getLinkToId)
      .map((c: any) => ({ from: c.getLinkFromId(), to: c.getLinkToId() }));
    const positions = computeLayeredLayout(nodes, edges, {
      gapX: this.gapX,
      gapY: this.gapY,
      direction: this.direction,
      crossAlign: this.crossAlign,
    });
    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = 0;
    let maxBottom = 0;
    nodes.forEach((node) => {
      const position = positions.get(node.id);
      if (!position) {
        return;
      }
      minLeft = Math.min(minLeft, position.left);
      minTop = Math.min(minTop, position.top);
      maxRight = Math.max(maxRight, position.left + node.width);
      maxBottom = Math.max(maxBottom, position.top + node.height);
    });
    if (!isFinite(minLeft) || !isFinite(minTop)) {
      return [pad.left + pad.right, pad.top + pad.bottom];
    }
    return [maxRight - minLeft + pad.left + pad.right, maxBottom - minTop + pad.top + pad.bottom];
  }
}

export default ICELayeredLayout;
