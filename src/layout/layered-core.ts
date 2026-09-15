/**
 * 分层图布局的**纯内核**（无组件、无 ctx、无副作用）：给定节点与边，算出每个节点的
 * `{left, top}`（以及 rank / order），供两处共用：
 *
 * - 引擎的 `ICELayeredLayout`（把结果写到容器里的组件上，并对齐连线端点）；
 * - 应用层的**编译器**（`ice-entity-designer-dsl` 的 UML / 流程图 / BPMN 自动布局）——
 *   它们要的是"算好坐标写进文档"，不该再造一份算法（此前那份 148 行的自研实现已删）。
 *
 * 算法（与引擎原有的实现逐条一致）：
 * 1. **分层**：最长路径法 —— `rank = 所有前驱的最大 rank + 1`，无前驱为 0；有向环用 visiting
 *    集合打断（环上的节点给 0），保证任何输入都能得到确定结果；
 * 2. **层内排序**：重心法迭代 4 轮（按下一层邻居的平均 order 排序），减少边交叉；
 * 3. **落坐标**：`direction` 决定主干方向（`horizontal` = 层自左而右；`vertical` = 层自上而下），
 *    `crossAlign` 决定交叉轴对齐（`start` = 层内从 0 开始依次排；`center` = 在层的尺寸里居中）。
 */

export interface ICELayeredNode {
  id: string;
  /** 占位宽度（引擎侧传"内容尺寸 + margin"） */
  width: number;
  /** 占位高度（引擎侧传"内容尺寸 + margin"） */
  height: number;
}

export interface ICELayeredEdge {
  from: string;
  to: string;
}

export interface ICELayeredCoreOptions {
  /** 层间距（默认 80） */
  gapX?: number;
  /** 层内间距（默认 40） */
  gapY?: number;
  /** 主干方向：`horizontal`（默认，层自左而右）/ `vertical`（层自上而下） */
  direction?: 'horizontal' | 'vertical';
  /** 交叉轴对齐：`start`（默认，与引擎原有行为一致）/ `center` */
  crossAlign?: 'start' | 'center';
}

export interface ICELayeredPosition {
  left: number;
  top: number;
  rank: number;
  order: number;
}

/**
 * 算出每个节点的落点。**无效边**（两端不在节点集合里）会被忽略；孤立节点给 rank 0。
 */
export function computeLayeredLayout(
  nodes: ICELayeredNode[],
  edges: ICELayeredEdge[],
  options: ICELayeredCoreOptions = {}
): Map<string, ICELayeredPosition> {
  const result = new Map<string, ICELayeredPosition>();
  if (!nodes.length) {
    return result;
  }
  const gapX = Number(options.gapX) || 80;
  const gapY = Number(options.gapY) || 40;
  const horizontal = options.direction !== 'vertical';
  const crossAlign = options.crossAlign === 'center' ? 'center' : 'start';

  const nodeById = new Map<string, ICELayeredNode>();
  nodes.forEach((node) => nodeById.set(node.id, node));
  const validEdges = edges.filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to));

  // ① 分层（最长路径法，环安全）
  const rankMap = new Map<string, number>();
  const visit = (id: string, stack: Set<string>): number => {
    const cached = rankMap.get(id);
    if (cached !== undefined) {
      return cached;
    }
    if (stack.has(id)) {
      return 0; // 环：给 0，避免死循环
    }
    stack.add(id);
    let maxPred = -1;
    validEdges.forEach((edge) => {
      if (edge.to === id) {
        maxPred = Math.max(maxPred, visit(edge.from, stack));
      }
    });
    const rank = maxPred + 1;
    rankMap.set(id, rank);
    stack.delete(id);
    return rank;
  };
  nodes.forEach((node) => visit(node.id, new Set()));

  // ② 层内排序（重心法，4 轮）
  const layers = new Map<number, ICELayeredNode[]>();
  nodes.forEach((node) => {
    const rank = rankMap.get(node.id) || 0;
    if (!layers.has(rank)) {
      layers.set(rank, []);
    }
    layers.get(rank)!.push(node);
  });
  const rankList = [...layers.keys()].sort((a, b) => a - b);
  const order = new Map<string, number>();
  rankList.forEach((rank) => layers.get(rank)!.forEach((node, index) => order.set(node.id, index)));
  for (let iter = 0; iter < 4; iter += 1) {
    rankList.forEach((rank) => {
      const layer = layers.get(rank)!;
      const barycenter = new Map<string, number>();
      layer.forEach((node) => {
        const next = validEdges.filter((edge) => edge.from === node.id).map((edge) => order.get(edge.to) || 0);
        barycenter.set(
          node.id,
          next.length ? next.reduce((sum, value) => sum + value, 0) / next.length : order.get(node.id) || 0
        );
      });
      layer.sort((a, b) => (barycenter.get(a.id) || 0) - (barycenter.get(b.id) || 0));
      layer.forEach((node, index) => order.set(node.id, index));
    });
  }

  // ③ 落坐标
  let cursor = 0;
  rankList.forEach((rank) => {
    const layer = layers.get(rank)!;
    const layerMain = horizontal
      ? Math.max(...layer.map((node) => node.width))
      : Math.max(...layer.map((node) => node.height));
    const layerCross = horizontal
      ? layer.reduce((sum, node) => sum + node.height, 0) + Math.max(0, layer.length - 1) * gapY
      : layer.reduce((sum, node) => sum + node.width, 0) + Math.max(0, layer.length - 1) * gapY;
    let cross = crossAlign === 'center' ? -layerCross / 2 : 0;
    layer.forEach((node) => {
      const nodeMain = horizontal ? node.width : node.height;
      const nodeCross = horizontal ? node.height : node.width;
      const mainOffset = crossAlign === 'center' ? (layerMain - nodeMain) / 2 : 0;
      const left = horizontal ? cursor + mainOffset : cross;
      const top = horizontal ? cross : cursor + mainOffset;
      result.set(node.id, {
        left: Math.round(left),
        top: Math.round(top),
        rank,
        order: order.get(node.id) || 0,
      });
      cross += nodeCross + gapY;
    });
    cursor += layerMain + gapX;
  });

  return result;
}
