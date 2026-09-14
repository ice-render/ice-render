/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type ICEGroup from '../graphic/container/ICEGroup';
import ICELayoutManager from './ICELayoutManager';

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

  constructor(props: { gapX?: number; gapY?: number } = {}) {
    super();
    this.gapX = props.gapX ?? 80;
    this.gapY = props.gapY ?? 40;
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
        const from = c.getLinkFromId ? c.getLinkFromId() : null;
        const to = c.getLinkToId ? c.getLinkToId() : null;
        edgeList.push({ from, to, component: c });
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

    this.assignRanks(nodeList, edges);
    this.assignOrders(nodeList, edges, nodeById);
    this.assignCoords(nodeList, edges, nodeById, { left: box.left, top: box.top });
  }

  /**
   * 内容首选尺寸：分层排完之后节点占据的包围盒（再补上容器 padding）。
   *
   * 算法只在节点之间用相对间距，所以这里按"每层最宽 + gapX、每层节点高之和 + gapY"推一遍，
   * 不依赖节点当前落点 —— 首次布局（还没排过）也能给出正确的首选尺寸。
   */
  getPreferredSize(container: ICEGroup): [number, number] {
    const pad = this.paddingOf(container);
    const children = (container.childNodes || []).filter((c: any) => !c.isLine);
    if (!children.length) {
      return [pad.left + pad.right, pad.top + pad.bottom];
    }
    const nodes = children.map((component: any) => ({ id: component.props.id, component, rank: 0 }) as GraphNode);
    const edges = (container.childNodes || [])
      .filter((c: any) => c.isLine && c.getLinkFromId && c.getLinkToId)
      .map((c: any) => ({ from: c.getLinkFromId(), to: c.getLinkToId() }));
    const nodeById: { [id: string]: GraphNode } = {};
    nodes.forEach((n) => (nodeById[n.id] = n));
    const validEdges = edges.filter((e: any) => e.from && e.to && nodeById[e.from] && nodeById[e.to]);
    this.assignRanks(nodes, validEdges);

    const layers: { [rank: number]: GraphNode[] } = {};
    nodes.forEach((n) => {
      (layers[n.rank] = layers[n.rank] || []).push(n);
    });
    const rankList = Object.keys(layers)
      .map(Number)
      .sort((a, b) => a - b);
    let width = 0;
    let height = 0;
    rankList.forEach((r, index) => {
      const layer = layers[r];
      const maxW = Math.max(...layer.map((n) => Number(n.component.state.width) || 0));
      const columnH =
        layer.reduce((sum, n) => sum + (Number(n.component.state.height) || 0), 0) +
        Math.max(0, layer.length - 1) * this.gapY;
      width += maxW + (index > 0 ? this.gapX : 0);
      height = Math.max(height, columnH);
    });
    return [width + pad.left + pad.right, height + pad.top + pad.bottom];
  }

  /**
   * 拓扑分层（最长路径法）：rank = 所有前驱的最大 rank + 1；无前驱为 0。
   * 用 visiting 集合处理有向环。
   */
  private assignRanks(nodes: GraphNode[], edges): void {
    const rankMap: { [id: string]: number } = {};
    const visit = (id: string, stack: Set<string>): number => {
      if (rankMap[id] !== undefined) {
        return rankMap[id];
      }
      if (stack.has(id)) {
        return 0; // 环，直接给 0 避免死循环
      }
      stack.add(id);
      const preds = edges.filter((e) => e.to === id).map((e) => e.from);
      let maxPred = -1;
      for (const p of preds) {
        maxPred = Math.max(maxPred, visit(p, stack));
      }
      rankMap[id] = maxPred + 1;
      stack.delete(id);
      return rankMap[id];
    };
    nodes.forEach((n) => {
      n.rank = visit(n.id, new Set());
    });
  }

  /**
   * 层内排序（重心法）：迭代把每层节点按「下一层邻居的平均 order」排序，减少边交叉。
   */
  private assignOrders(nodes: GraphNode[], edges, nodeById): void {
    const layers: { [rank: number]: GraphNode[] } = {};
    nodes.forEach((n) => {
      (layers[n.rank] = layers[n.rank] || []).push(n);
    });
    const rankList = Object.keys(layers)
      .map(Number)
      .sort((a, b) => a - b);

    rankList.forEach((r) => layers[r].forEach((n, i) => (n.order = i)));

    for (let iter = 0; iter < 4; iter++) {
      for (const r of rankList) {
        const layer = layers[r];
        layer.forEach((n) => {
          const down = edges.filter((e) => e.from === n.id).map((e) => nodeById[e.to]);
          n.barycenter = down.length ? down.reduce((s: number, m: GraphNode) => s + m.order, 0) / down.length : n.order;
        });
        layer.sort((a, b) => a.barycenter - b.barycenter);
        layer.forEach((n, i) => (n.order = i));
      }
    }
  }

  /**
   * 算坐标（LR 方向）：rank 递增 → left 递增；层内按 order 垂直排列。
   * 节点落位后，把每条边（连线）的端点对齐到源/目标节点的插槽（全局坐标）。
   */
  private assignCoords(
    nodes: GraphNode[],
    edges,
    nodeById,
    origin: { left: number; top: number } = { left: 0, top: 0 }
  ): void {
    const layers: { [rank: number]: GraphNode[] } = {};
    nodes.forEach((n) => {
      (layers[n.rank] = layers[n.rank] || []).push(n);
    });
    const rankList = Object.keys(layers)
      .map(Number)
      .sort((a, b) => a - b);

    const gapX = this.gapX;
    const gapY = this.gapY;
    let x = origin.left;
    rankList.forEach((r) => {
      const layer = layers[r];
      const maxW = Math.max(...layer.map((n) => n.component.state.width));
      let y = origin.top;
      layer.forEach((n) => {
        n.component.setState({ left: x, top: y });
        y += n.component.state.height + gapY;
      });
      x += maxW + gapX;
    });

    // 对齐连线端点（容器本地坐标，和节点 left/top 同一空间）：
    // 源节点出边用右边中点，目标节点入边用左边中点
    for (const e of edges) {
      const source = nodeById[e.from].component;
      const target = nodeById[e.to].component;
      const sx = source.state.left + source.state.width;
      const sy = source.state.top + source.state.height / 2;
      const tx = target.state.left;
      const ty = target.state.top + target.state.height / 2;
      e.component.setState({ startPoint: [sx, sy], endPoint: [tx, ty] });
    }
  }
}

export default ICELayeredLayout;
