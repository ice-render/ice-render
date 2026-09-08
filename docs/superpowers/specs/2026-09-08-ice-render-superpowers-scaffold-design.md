# 为 ice-render 搭建 superpowers 工作流脚手架

- 日期：2026-09-08
- 状态：已批准（待写入 plans 并落地）
- 作者：WorkBuddy（基于与用户的 brainstorming 对齐）

## 1. 背景

ice-render 是 `大漠穷秋` 的 Canvas 2D 交互图形渲染引擎（MIT），当前 `v1.0.4`，位于
`/Users/felix/Windows-E-workspace/felix/ice-render/ice-render/`，是 `ice-render` 家族 6 个仓库中
唯一有 git 的正式核心工程（当前在 `dev` 分支，`origin/dev`）。

用户要求在本工程内"搭建好 superpowers 流程"，使后续演进（优先修技术债）能走标准的
superpowers 闭环：**brainstorm → spec → plan → TDD → code review → finish**。

superpowers 的相关技能（brainstorming / writing-plans / executing-plans /
systematic-debugging / receiving-code-review / requesting-code-review /
test-driven-development 等）在本环境已可用。本 spec 的任务是把这套方法论**落地到本工程**——
建立让闭环顺畅运转的"脚手架"，而非立即修技术债。

## 2. 范围

| 项 | 决定 |
|---|---|
| 作用仓库 | 仅 `ice-render/`（核心引擎，有 git） |
| 不纳入 | ice-entity-designer / ice-flow / *-demo / ice-render-doc / ice-render-lesson（多为无 git 或独立仓库） |
| 分支 | 直接在 `dev` 分支提交；不为此脚手架新建分支 |
| 业务代码 | `src/` 本次**零改动**；技术债修复留作后续 plan |

## 3. 目标与交付物（全量脚手架）

1. **AGENTS.md**：仓库级共享约定文档，让 agent 与人类协作者共享同一份项目上下文。
2. **可运行的 jest 基线**：`npm test` 能跑通，首批 ≥3 个纯逻辑单测全绿。
3. **目录约定**：建立 `docs/superpowers/specs/`（设计归档）与 `plans/`（实现计划归档）。

## 4. 目录结构（落地后）

```
ice-render/
├─ AGENTS.md                         # 新增：项目约定 + superpowers 协作入口
├─ jest.config.js                    # 新增：babel-jest 转换配置
├─ package.json                      # 改动：新增 "test": "jest" script
├─ docs/superpowers/specs/           # 新增：本设计文档归档于此
│   └─ 2026-09-08-ice-render-superpowers-scaffold-design.md
├─ plans/                            # 新增：writing-plans 阶段产出
└─ src/                              # 本次不改动
```

## 5. 工件一：AGENTS.md

从已沉淀的 `.workbuddy/memory/MEMORY.md` 提炼并升级为仓库级共享文档，至少包含：

- **项目定位**：单一 Canvas 2D 渲染引擎，运行时依赖仅 `lodash` 与 `gl-matrix`。
- **引擎架构铁律**（改动前必读）：
  - 运行时链路：`FrameManager`（全局单例，包装 rAF）→ `EventBus`（每 ICE 实例一条）→ 各 Manager 订阅 → `CanvasRenderer`。
  - `ICE.init()` 中 Manager 启动**有严格顺序**：`EventBus` 最先；`linkSlotManager` 必须在 `renderer` 之后（它监听 renderer 事件）。
  - 渲染策略：脏标记 `ICE.dirty` + **全量重绘**，无局部重绘/脏矩形。每帧 `flattenTree` 展平组件树并按 `zIndex` 排序。
  - 组件模型：`props`（构造入参，`lodash.merge`）与 `state`（`cloneDeep(props)`，动画改 state）分离，概念借鉴 React。
  - 类继承：`ICEEventTarget → ICEComponent(abstract) → ICEPath(abstract) → ICEDotPath(abstract) → 图元`；`ICEGroup extends ICERect`；`ICEControlPanel extends ICEGroup`；`ICELinkSlot/ICELinkHook/RotateControl extends ICECircle`。
  - 变换基于 `gl-matrix` 的 `mat2d`，自带 `gl-matrix-skew.js` 补 skew。
  - 序列化：`Serializer`/`Deserializer` + `COMPONENT_TYPE_MAPPING` 做类名→构造函数映射；自定义组件需 `ice.registerType()` 后才能反序列化。
- **技术债清单**（标注严重度，供后续 plan 排期）：
  - P0：零单元测试（已装 jest 29 但无 `.test.ts`，`package.json` 无 test script）。
  - P1：`ice-flow` 声明 `"ice-render": "^0.0.47"`，引擎已 `1.0.4`，caret 跨主版本无法解析。
  - P1：README 称"纯 TypeScript"，但残留 7 个未迁移 `.js`：`cross-platform/root.js`、`event/DOMEventInterceptor.js`、`geometry/GeoLine.js`、`geometry/GeoPoint.js`、`util/data-util.js`、`util/gl-matrix-skew.js`、`util/uuid.js`；且 `tsconfig` 设 `allowJs: false`，`index.ts` 无扩展名导出这些模块，类型链断裂。
  - P2：下游 `ice-entity-designer`/`ice-flow` 的 devDeps 冻在 2022（rollup 2 / TS 4.6 / eslint 6），与引擎（rollup 3 / TS 5.9 / eslint 8）工具链分叉。
  - P2：`CanvasRenderer.doRender()` 有未使用 `startTime` 死代码；`ICE.init()` 留 `//FIXME:防止 init 方法被调用多次`。
- **superpowers 协作约定**：本工程如何使用闭环——任何新功能/修债都先 brainstorm 出 spec 写入 `docs/superpowers/specs/`，再 `writing-plans` 出 `plans/`，TDD 实现，最后 `requesting-code-review` + `finishing-a-development-branch`。

## 6. 工件二：测试基础设施（jest 基线）

### 6.1 配置

- 新增 `jest.config.js`：
  - `transform`：默认 `babel-jest` 即可（babel 29.7.0 已在，`.babelrc` 含 `@babel/preset-env` + `@babel/preset-typescript`，可编译 TS/JS）。
  - `testEnvironment: 'node'`（首批纯逻辑，不碰 DOM，无需 jsdom）。
  - `testMatch: ['**/src/**/*.test.ts']`。
  - `moduleFileExtensions: ['ts','js','json']`。
- `package.json` 新增 `"test": "jest"` script（当前缺 test script、无 jest 字段）。

### 6.2 首批单测覆盖范围（刻意避开 `allowJs:false` 与 `.js` 桥接冲突）

| 模块 | 测什么 | 理由 |
|---|---|---|
| `src/geometry/GeoUtil.ts` | 几何计算辅助函数（如点到线段距离等） | 纯 TS、无 DOM、无 js 依赖 |
| `src/util/data-util.js` 导出的 `flattenTree` / `getVal` | 组件树展平、属性取值 | 引擎渲染核心逻辑，纯函数；jest 走 babel 直接编译 `.js`，不受 `tsconfig` 影响 |
| `src/animation/Easing.ts` | 缓动函数数值正确性 | 纯 TS 数学函数，零副作用 |
| （备选）`src/geometry/ICEBoundingBox.ts` | 包围盒计算（若其实现不依赖 `root`/window 上下文） | 几何纯逻辑，需先确认无 DOM 依赖再纳入 |

- **关键约束**：jest 经 babel 编译，**不经过 `tsc`**，因此 `tsconfig` 的 `allowJs:false` 不影响 `npm test` 跑通。类型检查报错（既有技术债）不在本次范围。
- 首批单测**只断言纯逻辑数值/结构正确性**，不启动 `ICE` 实例、不创建 `canvas`、不触发 `FrameManager`。

### 6.3 预期

`npm test` 退出码 0，首批 ≥3 个测试套件全绿。

## 7. 工件三：specs / plans 目录

- `docs/superpowers/specs/`：本设计文档写入并提交（命名 `YYYY-MM-DD-<topic>-design.md`）。
- `plans/`：本目录建立，供 `writing-plans` 阶段填充实现计划文件。
- 两个目录均进 git（首个 spec 文件使 `specs/` 自然非空；`plans/` 可放 `.gitkeep` 或首个 plan 后再补）。

## 8. 与既有 git / husky / lint 的衔接

- 改动直接在 `dev` 分支提交（用户已在该分支做依赖升级，不顺手开新分支）。
- 现有 `husky` 8 + `lint-staged` 的 eslint/prettier 钩子**不动**。
- **不**在脚手架阶段加 pre-commit test hook：当前零测试，强制会阻塞所有提交，反碍演进。预 commit test 留作测试基线建立后的后续技术债项。

## 9. 成功标准

1. `ice-render/AGENTS.md` 写入并 `git add` + 提交。
2. `npm test` 跑通，首批 ≥3 个单测全绿。
3. `docs/superpowers/specs/` 与 `plans/` 建立，本 spec 已写入并提交。
4. `src/` 业务代码零改动（脚手架阶段不修技术债）。

## 10. 非目标（明确排除）

- 不迁移遗留 `.js` → `.ts`（属 P1 技术债，后续 plan）。
- 不修复 `ice-flow` 依赖版本（属 P1 技术债，后续 plan）。
- 不升级下游 `ice-entity-designer`/`ice-flow` 工具链（属 P2 技术债，后续 plan）。
- 不新增任何运行时功能或图元。
- 不配置 pre-commit test hook。

## 11. 后续演进路线（本脚手架落地后）

每个技术债子项 / 新功能都走独立 superpowers 闭环：

1. 修技术债优先（用户已选定方向）：
   - P0 补测试：在 jest 基线上逐步为 `ICEBoundingBox`、`GeoUtil`、序列化、事件系统等补单测，建立回归护栏。
   - P1 修 `ice-flow` 依赖版本 + 迁移 7 个 `.js` 模块并开启 `allowJs`/补全类型。
   - P2 清理死代码、升级下游工具链。
2. 健康后进入新功能开发（全程 TDD + code review）。

每个子项：brainstorm 小 spec → `writing-plans` → TDD → `requesting-code-review` → `finishing-a-development-branch`。
