# AGENTS.md — ice-render

## 项目定位

Canvas 2D 交互图形渲染引擎（MIT，作者 大漠穷秋）。运行时依赖仅 `lodash` 与 `gl-matrix`。
本文件是仓库级共享约定，agent 与人类协作者都应遵循。

## 引擎架构铁律（改动前必读）

- 运行时链路：`FrameManager`（全局单例，包装 rAF）→ `EventBus`（每 ICE 实例一条）→ 各 Manager 订阅 → `CanvasRenderer`。
- `ICE.init()` 中 Manager 启动有严格顺序：`EventBus` 最先；`linkSlotManager` 必须在 `renderer` 之后（它监听 renderer 事件）。
- 渲染策略：脏标记 `ICE.dirty` + 全量重绘，无局部重绘/脏矩形。每帧 `flattenTree` 展平组件树并按 `zIndex` 排序。
- 组件模型：`props`（构造入参，`lodash.merge`）与 `state`（`cloneDeep(props)`，动画改 state）分离，概念借鉴 React。
- 类继承：`ICEEventTarget → ICEComponent(abstract) → ICEPath(abstract) → ICEDotPath(abstract) → 图元`；`ICEGroup extends ICERect`；`ICEControlPanel extends ICEGroup`；`ICELinkSlot/ICELinkHook/RotateControl extends ICECircle`。
- 变换基于 `gl-matrix` 的 `mat2d`，自带 `gl-matrix-skew.js` 补 skew。
- **嵌套坐标系矩阵组合铁律（2026-09-08 修复重大 bug 后确立）**：组件的 `composedMatrix = T(absoluteOrigin) · absoluteLinearMatrix`，其中 `absoluteLinearMatrix = 祖先① · 祖先② · … · 自身线性矩阵`（列向量约定，越靠近根越外层）。`calcAbsoluteLinearMatrix()` 与 `composeMatrix()` 必须**实时重新计算每一层祖先的线性矩阵 / composedMatrix**，严禁读取祖先缓存的 `state.linearMatrix` / `state.composedMatrix` / `state.absoluteLinearMatrix`（这些默认是空数组 `[]`，且可能是上一帧脏值，是嵌套坐标算错的根因）。`moveGlobalPosition/setGlobalPosition/setGlobalRotate` 同样必须调 `parentNode.calcAbsoluteLinearMatrix()` 取新鲜值。回归用例见 `src/graphic/ICEComponent.nested-coordinate.test.ts`。
- 序列化：`Serializer`/`Deserializer` + `COMPONENT_TYPE_MAPPING` 做类名→构造函数映射；自定义组件需 `ice.registerType()` 后才能反序列化。

## 已知技术债（严重度）

- P0：零单元测试（已装 jest 29 但无 `.test.ts`，`package.json` 无 test script）。
- P1：`ice-flow` 声明 `"ice-render": "^0.0.47"`，引擎已 `1.0.4`，caret 跨主版本无法解析。
- P1：README 称"纯 TypeScript"，但残留 7 个未迁移 `.js`（`cross-platform/root.js`、`event/DOMEventInterceptor.js`、`geometry/GeoLine.js`、`geometry/GeoPoint.js`、`util/data-util.js`、`util/gl-matrix-skew.js`、`util/uuid.js`）；且 `tsconfig` 设 `allowJs: false`，`index.ts` 无扩展名导出这些模块，类型链断裂。
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
- 首批单测覆盖纯逻辑模块：`src/geometry/GeoUtil.ts`、`src/util/data-util.js`、`src/geometry/ICEBoundingBox.ts`。
- jest 走 babel 不走 `tsc`，因此 `tsconfig` 的 `allowJs:false` 不影响 `npm test`；但 `tsc --noEmit`（types:check）会因 .js 模块类型链断裂而报错，属已知技术债，不在日常测试范围。
