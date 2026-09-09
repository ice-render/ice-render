# 04 · 渲染与性能

## 渲染策略：脏标记 + 脏矩形局部重绘（默认），条件回退全量

引擎采用「脏标记 + 惰性渲染」，并在 v1（2026-09-09）起把默认绘制路径从「整屏全量重绘」升级为「**脏矩形局部重绘**」：

1. **脏标记** `ice.dirty`：任何状态变化（`setState`、增删组件）置 `true`；渲染器仅在为真时工作。
2. **帧入口决策**：`refreshQueue()` 后，若 `renderMode==='dirty-rect'` 且场景满足局部条件 → `doRenderDirtyRect()`；否则回退 `doRenderFull()`（旧全量逻辑**原样保留**，为参考与兜底）。
3. **局部重绘**：只 `clearRect` 脏区域（脏组件**旧世界盒 ∪ 新世界盒 + paint pad**，整像素对齐）；区域内按 z 序重画与区域相交的组件。渲染器用 `WeakMap` 保存每组件「上次实际绘制的世界轴对齐盒」快照，用于旧区域擦除与相交判断。
4. **组件上下文自包含**：每个组件 render 末尾把本组件写过的泄漏 ctx 属性（shadow/globalAlpha/composite/lineCap/lineJoin/miterLimit/textAlign/textBaseline/虚线）归位为 canvas 默认值——这是 full 与 partial **逐像素一致**的前提。

```mermaid
graph TD
    EV[ICE_FRAME_EVENT] --> D{dirty?}
    D -- 否 --> SKIP[跳过，无开销]
    D -- 是 --> RQ[refreshQueue<br/>队列重建/复用]
    RQ --> G{renderMode='dirty-rect'<br/>且场景允许局部?}
    G -- 否/回退条件 --> FULL[doRenderFull<br/>clearRect 整屏 + 全量重绘]
    G -- 是 --> C[doRenderDirtyRect<br/>收集脏区 old∪new + pad]
    C --> CLR[clearRect 脏区]
    CLR --> LOOP[区域内按 z 序补画相交组件<br/>+ 工具层]
    LOOP --> FIN[dirty=false + ROUND_FINISH]
    FULL --> FIN
```

**v1 场景级门控与回退条件**（几何纯函数见 `src/renderer/dirty-rect-util.ts`，阈值常量在 `CanvasRenderer`）：

| 条件 | 动作 | 原因 |
|---|---|---|
| 结构变更（`markQueueDirty`） | 全量并重建快照 | 队列/层级整体变化，旧盒不可复用 |
| 快照未 prime（结构变更后首帧） | 全量 | 旧区域未知，无法擦除 |
| 无可见脏组件且无隐藏擦除（手动置脏/图片 onload 帧） | 全量 | 保语义 |
| 脏可见组件占比 > 20% | 全量 | 相交裁剪收益小 |
| 脏区域面积 / 画布面积 > 35% | 全量 | 接近整屏成本 |
| 场景含可见 dot-path（折线/星形等）或 ICEText 或非不透明落墨（alpha 色/阴影/globalAlpha/合成模式） | 全量 | **v1 保守**：clip 边界与半透明落墨/字形/折线抗锯齿相交会产生接缝 |
| 新/旧包围盒含 NaN；ctx 无 clip/save/restore（老小程序 canvas） | 全量 | 安全兜底 |

> v1 局部重绘只服务于「全不透明、无文本、无点集路径」的场景（编辑器里的大多数实体/卡片/表格），其余场景自动回退全量，正确性优先。按区域相交细化的局部化、以及 dot-path/文本/半透明的专项支持记入后续路线图。

## 渲染队列（flattenTree + 排序 + 缓存）

每帧需要把组件树"展平"成有序数组再渲染：

- `flattenTree(childNodes)` 递归遍历，产出 `componentQueue`（普通组件）与 `toolsQueue`（工具组件），同时标注 `_level`/`_pid`。
- 两个队列各自按 `state.zIndex` **升序**排序，确定绘制顺序。

**性能优化（2026-09-08 引入）**：渲染队列带缓存。

- 仅当组件树**结构变化**（`addChild`/`removeChild`/`addTool`/`removeTool` 等）时，由 `renderer.markQueueDirty()` 触发重建（重新 flatten + sort）。
- 稳态帧只做一次 **O(n) 的 zIndex 稳定性比对**：若所有 `zIndex` 未变，直接复用上一帧的队列数组，不重复递归展平、不重新分配数组。
- `zIndex` 变化（经 `setState`）无需手动标记，稳态比对会自动发现并重新排序。

**铁律**：所有改变组件树结构的入口都必须调用 `renderer.markQueueDirty()`，否则稳态帧会沿用过期队列，导致增删组件不渲染或层级错乱。回归用例见 `tests/renderer/CanvasRenderer.queue.test.ts`。

## 矩阵零分配

矩阵运算在动画（每帧全量 compose）场景下是最大开销之一。引擎把热路径的矩阵计算改为**复用缓冲、零分配**：

| 方法 | 复用对象 |
|---|---|
| `calcLinearMatrix()` | 复用 `state.linearMatrix`（原地 identity + skew/rotate/scale） |
| `calcAbsoluteLinearMatrix()` | 复用每实例 `__absScratchA/B` 两个缓冲做祖先连乘 |
| `composeMatrix()` | 复用 `state.composedMatrix` + 平移 scratch `__transScratch` |
| `calcAbsoluteOrigin()` | 复用 `__originScratch` + 原地 `transformMat2d` |

两点关键约定：

1. **这些缓冲是普通数组**（非 `mat2d.create()` 返回的 `Float32Array`），以保持矩阵为 `Array` 类型，兼容 `Array.isArray` 与序列化。
2. **优化不得破坏语义**：`calcAbsoluteLinearMatrix` 仍要实时重算祖先（见 [03](03-coordinate-system.md)），零分配只是复用存储、不是复用缓存值。

`applyStyleToCtx` 同样做了零分配：用 `for...in` 直接遍历 `props.style`/`state.style` 写 `ctx`，**不用** `Object.keys`（会分配 key 数组、加重 GC）也不做对象展开合并。

## 渲染循环内的细节

- `doRender()` 先 `clearRect(0,0,canvasWidth,canvasHeight)` 全量清屏。
- 对每个组件注入 `root/ctx/evtBus/ice` 后调用 `component.render()`（稳态下这些引用已一致，跳过重复注入）。
- 一轮结束后 `ice.dirty=false`，并触发 `ROUND_FINISH` 事件（供 `linkSlotManager` 等订阅）。

## 性能基线

`bench/render.cjs` 提供可复跑的引擎级基准（node + stub ctx，测的是**引擎 JS 逻辑开销，不含光栅化**）：

```bash
npm run bench            # 默认 1000 组件
node bench/render.cjs 5000
```

参考数据（N=5000，2026-09-08 优化后）：

| 场景 | 每帧耗时 |
|---|---|
| 静态重绘（稳态，仅 `ice.dirty`） | ~0.8ms |
| 动画（每帧全量 compose） | ~5.9ms |

> 光栅化开销需在真实浏览器用 DevTools Performance 面板另测；可视化回归用 `npm run test:visual`（见 `e2e/visual/README.md`）。
