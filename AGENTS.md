# AGENTS.md — ice-render

## 项目定位

Canvas 2D 交互图形渲染引擎（MIT，作者 大漠穷秋）。运行时依赖仅 `gl-matrix`（`lodash` 已用 `src/util/lang.ts` 自研工具替代）。
本文件是仓库级共享约定，agent 与人类协作者都应遵循。

## 引擎架构铁律（改动前必读）

- 运行时链路：`FrameManager`（全局单例，包装 rAF）→ `EventBus`（每 ICE 实例一条）→ 各 Manager 订阅 → `CanvasRenderer`。
- `ICE.init()` 中 Manager 启动有严格顺序：`EventBus` 最先；`linkSlotManager` 必须在 `renderer` 之后（它监听 renderer 事件）。
- 渲染策略：脏标记 `ICE.dirty` + 全量重绘，无局部重绘/脏矩形。渲染队列（`componentQueue`/`toolsQueue`）带缓存：仅在结构变更（`addChild`/`removeChild` 等）时由 `CanvasRenderer.markQueueDirty()` 触发 `flattenTree`+`sort` 重建；稳态帧仅做 O(n) 的 `zIndex` 稳定性比对，树结构不变则复用队列，不重复递归展平。
- 组件模型：`props`（构造入参，`merge`）与 `state`（`cloneDeep(props)`，动画改 state）分离，概念借鉴 React；`merge`/`cloneDeep` 见 `src/util/lang.ts`。
- 类继承：`ICEEventTarget → ICEComponent(abstract) → ICEPath(abstract) → ICEDotPath(abstract) → 图元`；`ICEGroup extends ICERect`；`ICEControlPanel extends ICEGroup`；`ICELinkSlot/ICELinkHook/RotateControl extends ICECircle`。
- 变换基于 `gl-matrix` 的 `mat2d`，自带 `gl-matrix-skew.ts` 补 skew（gl-matrix 原生不支持）。
- **嵌套坐标系矩阵组合铁律（2026-09-08 修复重大 bug 后确立）**：组件的 `composedMatrix = T(absoluteOrigin) · absoluteLinearMatrix`，其中 `absoluteLinearMatrix = 祖先① · 祖先② · … · 自身线性矩阵`（列向量约定，越靠近根越外层）。`calcAbsoluteLinearMatrix()` 与 `composeMatrix()` 必须**实时重新计算每一层祖先的线性矩阵 / composedMatrix**，严禁读取祖先缓存的 `state.linearMatrix` / `state.composedMatrix` / `state.absoluteLinearMatrix`（这些默认是空数组 `[]`，且可能是上一帧脏值，是嵌套坐标算错的根因）。`moveGlobalPosition/setGlobalPosition/setGlobalRotate` 同样必须调 `parentNode.calcAbsoluteLinearMatrix()` 取新鲜值。回归用例见 `tests/graphic/ICEComponent.nested-coordinate.test.ts`。
- **变换手柄坐标铁律（2026-09-08 修复手柄脱离图元 bug 后确立）**：`TransformControlPanel.resizeEvtHandler`、`ResizeControl.moveGlobalPosition/resizeEvtHandler`、`RotateControl.rotateEvtHandler` 在把全局位移换算到本地时，必须调用 `calcAbsoluteLinearMatrix()` / `calcAbsoluteOrigin()` **实时重算**，严禁读取 `state.absoluteLinearMatrix` / `state.absoluteOrigin` 缓存（这些值在两次渲染之间会过期，连续拖动/缩放/旋转会导致手柄脱离宿主组件）。此外，**面板的 `left/top/width/height` 必须始终从目标组件重新推导**：`resizeEvtHandler`/`rotateEvtHandler` 改变目标后必须调用 `updatePanel()` 重新同步（面板宽高是目标旋转后包围盒的尺寸，随旋转变化，不能独立计算）。回归用例见 `tests/control-panel/transform-control.test.ts`。
- **变换手柄象限唯一性铁律（2026-09-08 修复手柄消失后确立）**：`toggleControlQuadrant(control, oldQuadrant, newQuadrant)` 必须把「原占据 newQuadrant 的手柄」顶替到 `oldQuadrant`（即 old↔new 互换），严禁用固定的「对角映射」(1↔3/2↔4)。此前当手柄跨到**相邻**象限（如 1→2）时会产出重复象限、两个手柄重叠、看起来消失一个。8 个 resize 手柄的象限必须始终保持唯一（`Set(quadrants).size === 8`）。回归用例见 `tests/control-panel/transform-control.test.ts` 与 `e2e/visual/interaction.spec.ts`。
- **命中检测铁律（2026-09-08 修复 N 层嵌套下点不中子组件后确立）**：`DOMEventDispatcher.findTargetComponent()` 必须跳过 `isControlPanel` 的控制面板本体（它是覆盖在目标上的工具层、zIndex 最高），否则面板会遮挡被选组件及其子组件，导致嵌套场景下点不中子组件。面板的子手柄（`ResizeControl`/`RotateControl`）不是 `isControlPanel`，仍需参与命中以保证缩放/旋转可用。回归用例见 `tests/event/DOMEventDispatcher.test.ts`。
- 序列化：`Serializer`/`Deserializer` + `COMPONENT_TYPE_MAPPING` 做类名→构造函数映射；自定义组件需 `ice.registerType()` 后才能反序列化。
- **渲染队列缓存铁律（2026-09-08 性能优化确立）**：任何改变组件树结构的入口——`ICE.addChild/addChildren/removeChild/removeChildren/clearAll/addTool/removeTool`、`ICEGroup.addChild/addChildren/removeChild/removeChildren`——都必须经 `renderer.markQueueDirty()` 通知渲染器重建队列；否则稳态帧会沿用过期队列，导致新增/删除的组件不被渲染或绘制顺序错乱。`zIndex` 变更（经 `setState`）无需手动标记，渲染器在稳态帧通过 O(n) 比对自动重排序。仓库内所有结构性入口已挂接该调用。回归用例见 `tests/renderer/CanvasRenderer.queue.test.ts`。
- **矩阵计算零分配铁律（2026-09-08 性能优化确立）**：`calcLinearMatrix` 复用 `state.linearMatrix`；`calcAbsoluteLinearMatrix` 复用每实例的 `__absScratchA/__absScratchB` 做祖先连乘；`composeMatrix` 复用 `state.composedMatrix` 与平移 scratch `__transScratch`。这些缓冲是普通数组（非 `mat2d.create()` 的 `Float32Array`），以保持矩阵为 `Array` 类型，兼容序列化与 `Array.isArray` 约定。改动矩阵逻辑时不得重新引入每帧 `mat2d.x([], ...)` 式的新数组分配。

## 已知技术债（严重度）

- P0（已偿还）：零单元测试 → 已建立 jest 单测（8 suite / 36 用例）：`GeoUtil`、`data-util`、`ICEBoundingBox`、`nested-coordinate`(回归嵌套坐标 bug)、`CanvasRenderer.queue`(回归渲染队列缓存)、`EventBus`、`serialization`(序列化 round-trip)、`transform-edge`(旋转包围盒/深嵌套/组合变换)。`npm test` 全绿。
- P2（已收敛）：原 `tests/` 目录 49 个 HTML 全为手测 demo（零断言），已重命名为 `examples/`，并生成 `examples/index.html` 导航页、修正 arcTo 拼写、transform 类归位。自动化单测统一放在顶层 `tests/` 目录（镜像 `src/` 结构），与源码分离。
- P1（已修复）：`ice-flow` 曾声明 `"ice-render": "^0.0.47"`（caret 跨主版本无法解析到 `1.0.4`），已改为 `^1.0.4`；并为 `ice-entity-designer`/`ice-flow` 增加 `.npmrc`(`legacy-peer-deps`) 解决 `rollup-plugin-uglify` 的 ERESOLVE。
- P1（已偿还）：README 曾称"纯 TypeScript"但残留 7 个 `.js`，且 `allowJs:false` 导致类型链断裂。现已全部迁移为 `.ts`（`cross-platform/root`、`event/DOMEventInterceptor`、`geometry/GeoLine`、`geometry/GeoPoint`、`util/data-util`、`util/gl-matrix-skew`、`util/uuid`），去掉 `.js` 扩展名 import，`types:check`（tsc --noEmit）零错误、`build:types` 产出完整声明。
- P2：下游 `ice-entity-designer`/`ice-flow` 的 devDeps 冻在 2022（rollup 2 / TS 4.6 / eslint 6），与引擎（rollup 3 / TS 5.9 / eslint 8）工具链分叉。
- P2：`CanvasRenderer.doRender()` 有未使用 `startTime` 死代码；`ICE.init()` 留 `//FIXME:防止 init 方法被调用多次`。

## superpowers 协作约定

本工程使用 superpowers 闭环开发：

1. 任何新功能 / 修债 → 先 `brainstorm` 出 spec，写入 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`。
2. 用 `writing-plans` 生成实现计划，写入 `plans/`。
3. TDD 实现：测试先行，`npm test` 必须全绿。
4. 用 `requesting-code-review` 做代码审查。
5. 用 `finishing-a-development-branch` 收尾。

## git 约定

- 核心引擎在 `dev` 分支开发，远程 `origin/dev`。
- 提交信息遵循 `@commitlint/config-conventional`（已在 devDeps）。

## 测试约定

- `npm test` 运行 jest（node 环境，babel-jest 编译 TS/JS）。
- 单测统一放在顶层 `tests/` 目录（镜像 `src/` 结构，如 `tests/graphic/` 对应 `src/graphic/`），**不混入源码目录**；`jest.config.js` 的 `testMatch` 为 `**/tests/**/*.test.ts`。
- 测试文件从 `tests/<子目录>/` 导入源码用相对路径 `../../src/...`；涉及 DOM/Canvas 的模块需 `jest.mock('../../src/cross-platform/root', ...)` + `global.Path2D` 桩（node 环境无 window）。
- `npm test` 走 jest（babel-jest），`npm run types:check` 走 `tsc --noEmit`，`npm run build` 走 `tsc --emitDeclarationOnly` + rollup。迁移完成后三者均应零错误。
