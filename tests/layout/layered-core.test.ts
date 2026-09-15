/**
 * 分层图布局**纯内核** `computeLayeredLayout` 的规格（2026-09-15 抽出）。
 *
 * 为什么要有它：应用层的编译器（`ice-entity-designer-dsl` 的 UML / 流程图 / BPMN 自动布局）
 * 要的是"算好坐标写进文档"，而引擎的 `ICELayeredLayout` 是绑在容器组件上的布局策略。
 * 早先两边各写一份分层算法（DSL 那份 148 行），口径会漂 —— 抽成纯内核后共用同一份实现：
 * 引擎负责"写回组件 + 对齐连线端点"，编译器负责"按 origin 平移后写进文档"。
 *
 * 契约：分层 = 最长路径法（环安全）；层内 = 重心法 4 轮；方向 `horizontal` / `vertical`；
 * 交叉轴 `start` / `center`；无效边忽略；空输入给空结果。
 */
import { computeLayeredLayout } from '../../src/layout/layered-core';

const chain = [
  { id: 'a', width: 100, height: 40 },
  { id: 'b', width: 100, height: 40 },
  { id: 'c', width: 100, height: 40 },
];
const chainEdges = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'c' },
];

describe('computeLayeredLayout（纯内核）', () => {
  it('最长路径分层：链式 a→b→c 是三层，主干方向递增', () => {
    const positions = computeLayeredLayout(chain, chainEdges, { gapX: 50, gapY: 20 });
    expect(positions.get('a')!.rank).toBe(0);
    expect(positions.get('b')!.rank).toBe(1);
    expect(positions.get('c')!.rank).toBe(2);
    // horizontal（默认）：层 → left 递增，层内 → top 累加
    expect(positions.get('a')!.left).toBe(0);
    expect(positions.get('b')!.left).toBe(150); // 100 + gapX50
    expect(positions.get('c')!.left).toBe(300);
    expect(positions.get('a')!.top).toBe(0);
  });

  it('rank 取「所有前驱的最大 rank + 1」（不是最短路径）', () => {
    const nodes = [
      { id: 'a', width: 10, height: 10 },
      { id: 'b', width: 10, height: 10 },
      { id: 'c', width: 10, height: 10 },
      { id: 'd', width: 10, height: 10 },
    ];
    // a→b→c→d 与 a→d：d 必须落在第 3 层（而不是被短路径拉到第 1 层）
    const positions = computeLayeredLayout(nodes, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
      { from: 'a', to: 'd' },
    ]);
    expect(positions.get('d')!.rank).toBe(3);
  });

  it('同层多节点按 gapY 依次排开；vertical 方向则是层自下而上推进、层内左右排开', () => {
    const nodes = [
      { id: 'a', width: 100, height: 40 },
      { id: 'b', width: 60, height: 30 },
      { id: 'c', width: 60, height: 30 },
    ];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
    ];
    const horizontal = computeLayeredLayout(nodes, edges, { gapX: 50, gapY: 20 });
    expect(horizontal.get('b')!.top).toBe(0);
    expect(horizontal.get('c')!.top).toBe(50); // 30 + gapY20

    const vertical = computeLayeredLayout(nodes, edges, { gapX: 50, gapY: 20, direction: 'vertical' });
    expect(vertical.get('a')!.top).toBe(0);
    expect(vertical.get('b')!.top).toBe(90); // 40 + gapX? no: 层间距用 gapX=50 → 40+50
    expect(vertical.get('b')!.left).toBe(0);
    expect(vertical.get('c')!.left).toBe(80); // 60 + gapY20
  });

  it('crossAlign: center 把层内节点块居中（编译器用它复刻"层内垂直居中"的观感）', () => {
    const nodes = [
      { id: 'a', width: 100, height: 40 },
      { id: 'b', width: 60, height: 30 },
      { id: 'c', width: 60, height: 30 },
    ];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
    ];
    const centered = computeLayeredLayout(nodes, edges, { gapX: 50, gapY: 20, crossAlign: 'center' });
    // 第一层只有 a：块高 40 → 居中后 top = -20；第二层块高 30+20+30 = 80 → b 的 top = -40
    expect(centered.get('a')!.top).toBe(-20);
    expect(centered.get('b')!.top).toBe(-40);
    expect(centered.get('c')!.top).toBe(10);
  });

  it('环安全：全环图也能给出确定结果（不死循环）', () => {
    const nodes = [
      { id: 'a', width: 10, height: 10 },
      { id: 'b', width: 10, height: 10 },
    ];
    const positions = computeLayeredLayout(nodes, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ]);
    expect(positions.size).toBe(2);
    expect(Number.isFinite(positions.get('a')!.left)).toBe(true);
  });

  it('无效边忽略；孤立节点给 rank 0；空输入给空结果', () => {
    const positions = computeLayeredLayout(
      [
        { id: 'a', width: 10, height: 10 },
        { id: 'lonely', width: 10, height: 10 },
      ],
      [{ from: 'a', to: '不存在' }]
    );
    expect(positions.get('lonely')!.rank).toBe(0);
    expect(positions.size).toBe(2);
    expect(computeLayeredLayout([], []).size).toBe(0);
  });
});
