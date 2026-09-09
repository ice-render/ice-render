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
 * @class ICELayeredLayout 分层图布局（dagre 式）
 *
 * 用于「图」场景（节点 + 边，如流程图/ER 图），借鉴 dagre 的分层布局思想：
 * 1. 拓扑分层（最长路径法）：有向边总是从低层指向高层，源在左、汇在右；
 * 2. 层内排序（重心法）：迭代调整每层节点顺序，减少边交叉；
 * 3. 算坐标：层号 → left，层内序号 → top（LR 方向）。
 *
 * 与 Swing 的「容器布局」（Flow/Grid/Border）不同，本类面向「图」，作为策略框架里的一个特殊实现。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICELayeredLayout extends ICELayoutManager {
  private gapX: number;
  private gapY: number;

  constructor(props: { gapX?: number; gapY?: number } = {}) {
    super();
    this.gapX = props.gapX || 80;
    this.gapY = props.gapY || 40;
  }

  /**
   * @overwrite
   * 读容器里的节点（非连线组件）+ 边（ICEPolyLine 的 links），分层布局后 setState 落位。
   */
  layoutContainer(container: ICEGroup): void {
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
    this.assignCoords(nodeList, edges, nodeById);
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
  private assignCoords(nodes: GraphNode[], edges, nodeById): void {
    const layers: { [rank: number]: GraphNode[] } = {};
    nodes.forEach((n) => {
      (layers[n.rank] = layers[n.rank] || []).push(n);
    });
    const rankList = Object.keys(layers)
      .map(Number)
      .sort((a, b) => a - b);

    const gapX = this.gapX;
    const gapY = this.gapY;
    let x = 0;
    rankList.forEach((r) => {
      const layer = layers[r];
      const maxW = Math.max(...layer.map((n) => n.component.state.width));
      let y = 0;
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
