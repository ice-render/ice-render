# 13 · 能力缺口分析（对标主流引擎）

> 日期：2026-09-10
> 方法：通读 `src/` 全部 62 个文件（10,300 行）+ 构建/测试/CI/文档全量核对，并外部对标 12 个主流开源与商业图形/图表引擎（按约定去名化，仅以类别描述）。
> 约定：本文**不点名任何竞品**，一律以类别/通行做法描述。
> 目的：回答「对这样一款引擎，**应该做而没做**的是什么」，用于排优先级。**本文是评估记录，不是实现计划**；每项落地应另走 superpowers 闭环（spec → plan → TDD）。

## 0. 范围与边界（先读）

`09-roadmap.md` 已明确划分「引擎原语 vs 应用层」：

- **不归引擎**（由 `ice-entity-designer` 等应用层实现）：undo/redo、多选交互 UX、编组、复制粘贴、图层/属性面板。
- **本文只列** roadmap 未覆盖、但属于引擎职责的缺口。

已确认的定位决策（2026-09-10）：

- **渲染后端不抽象**：引擎有意绑定 Canvas 2D，**不做 Renderer 抽象层**，不支持 WebGL / WebGPU / SVG 作为可替换后端。
- 因此下文所有条目**均不含**「抽象渲染层」「为将来换后端留口」类建议；涉及 SVG/Node 出图的邻近能力，只允许以**独立 exporter / 注入外部 ctx** 的形式提出（见 §6）。

## 1. 结论速览

| # | 缺口 | 等级 | 现状 |
|---|---|---|---|
| 1 | 输入层只有 mouse + keyboard，**无 pointer / touch / wheel / 手势** | **P0** | 完全没做 |
| 2 | **无框选，无多选**（`selectionList` 恒为单值） | **P0** | 完全没做 |
| 3 | 命中检测**每次全量 flattenTree + sort + 逐组件判定**，无空间索引、无视口裁剪 | **P0** | 完全没做 |
| 4 | dirty-rect 遇文本/点集/半透明**整场景回退全量**，真实场景基本失效 | **P0** | 已做但用不上 |
| 5 | 主画布**无 devicePixelRatio / HiDPI** 处理 | **P0** | 完全没做 |
| 6 | 文本**无自动换行 / 省略**，超宽时横向压缩字形 | P1 | 完全没做 |
| 7 | 文本含 **HTML 注入**；非 DOM 环境量不出尺寸 | P1 | 缺陷 |
| 8 | **无 SVG / PDF 导出，无 SVG 导入**（仅 toDataURL/toBlob） | P1 | 部分 |
| 9 | **无障碍零实现**（无 ARIA / DOM 镜像 / 键盘焦点） | P1 | 完全没做 |
| 10 | **无插件 / 扩展点**（仅 `registerType` 解决反序列化） | P1 | 完全没做 |
| 11 | 序列化以 **`constructor.name`** 为类型键；`COMPONENT_TYPE_MAPPING` 漏项 | P1 | 隐患 |
| 12 | 发行契约缺失：无 `exports` / `sideEffects` / CHANGELOG / 迁移指南；**CI 不跑可视化回归** | P1 | 部分 |
| 13 | 动画无 delay / 序列 / spring，且 `Math.floor` 掉精度 | P2 | 部分 |
| 14 | 布局**不随增删子组件自动重排**；容器 setState 递归置脏全部后代 | P2 | 部分 |
| 15 | 主题为模块级**全局单例**，多实例互相污染 | P2 | 部分 |
| 16 | 内部脆弱点若干（事件监听累积、销毁不彻底、死代码等） | P2 | 见 §4 |

## 2. P0 · 决定「是否算交互图形引擎」

### P0-1 输入模型只有鼠标 + 键盘

**证据**：`src/consts/DOM_EVENT_MAPPING_CONSTS.ts:13-30` 仅注册 `mousedown / mouseup / mousemove / click / dblclick / contextmenu` + `keydown / keyup`。全仓库检索 `wheel | pointer | touch | gesture | pinch` **零命中**。

**后果**：
- 触屏 / iPad / 触控笔不可用；拖拽依赖 `evt.movementX`（`graphic/ICEComponent.ts:274-281`），触摸事件下为 `undefined`。
- **无滚轮缩放、无双指缩放/旋转**。`setViewport()` 只能由应用层自行监听 wheel 驱动（`ICE.ts:382-390` 只提供 setter，无输入接入）。
- 无 `focus` / `blur` / `mouseenter` / `mouseleave`，无 hover 态。

**对标**：主流图形引擎普遍内建 drag 事件族（`dragstart/move/end`）；部分跨端引擎直接提供拖拽/旋转/缩放手势；图编辑器类框架把框选、右键菜单、键盘做成开箱扩展。

### P0-2 无框选、无多选

**证据**：`ICE.ts:52` 声明 `selectionList`，注释写「支持 Ctrl 键同时选中多个组件」；但全仓库唯一赋值点是 `control-panel/ICEControlPanelManager.ts:92` → `this.ice.selectionList = [component]`，**长度恒为 1**。无 marquee（框选矩形）、无 Ctrl/Shift 多选、无批量变换。

**附带问题**：`README.md` 的核心特性写「完整事件系统……支持拖拽、框选、多选」——**与实现不符**，应修正措辞或补齐实现。

### P0-3 命中检测无空间索引、无视口裁剪

**证据**：
- `event/DOMEventDispatcher.ts:86-91`：**每次** mousedown / mouseup / click 都 `flattenTree` 整棵树 → `sort` → 对**每个**组件调 `containsPoint`（点集路径还走 O(顶点数) 射线法，`graphic/ICEDotPath.ts:65-80`）。
- `ICE.ts:408-420` 的公开 `hitTest()` 同样全量 flatten + sort。
- `renderer/CanvasRenderer.ts:181-204` 全量渲染遍历**整个** `componentQueue`，**不按视口矩形剔除**（视口缩放只在 `__collect` 里作为「回退全量」的条件出现，`CanvasRenderer.ts:231-234`）。

**后果**：1 万节点下每次点击 ≈ 1 万次命中计算 + 一次全树排序；拖拽时每帧如此，必然掉帧。

**对标**：主流图层化引擎的官方性能文档明确「Layer 会绘制所有节点，无论是否在舞台内」，需自行 culling，并提示上万节点要自建索引。业界标准做法是四叉树/R-tree + 视口裁剪。

### P0-4 dirty-rect 在真实场景几乎不触发

**证据**：`renderer/CanvasRenderer.ts:250-253` 与 `314-329` —— 只要场景中**存在任一**可见的 ICEText、点集路径（星形/正 N 边形/玫瑰），或任一非不透明落墨（rgba/hsla 色、阴影、`globalAlpha≠1`、非 `source-over` 合成）的组件，就**整体回退全量重绘**（`renderer/dirty-rect-util.ts:113-123` 的 `isOpaqueDrawing`）。

**后果**：ER 图 / 流程图 / 任何带文字的场景**必然命中该门控**，默认的 `dirty-rect` 实际等价于全量重绘。这是「优化做了但用不上」的典型——投入已经花了，收益被保守门控吃掉。

**缓解方向（2026-09-10 已落地）**：已从「整场景」放宽为「相交级」——
- 干净的 risky 组件（文本/点集路径/非不透明落墨）：仅当其盒与本次脏区域**相交**才回退
- **刚变脏的 risky 组件一律回退**：实测「文本内容变更」时字形+描边的墨迹会超出几何盒，
  在 clip 下重绘无法与全量逐像素一致（像素回归 step4 曾报 594 px 差异，差异色为文本的描边色）
- 干净且已离屏缓存的 risky 组件不再阻塞（主画布只是 drawImage 不透明位图）

实测：富场景（含旋转组/文本/星形/连线/半透明控制面板）的局部重绘执行次数由 **0 → 2**，
且 10 步逐像素比对仍 100% 一致。编辑器里控制面板长期存在，旧门控因此几乎永久失效，这是关键收益点。

### P0-5 主画布无 HiDPI 处理

**证据**：`ICE.ts:128-131` 直接读 `canvasEl.width/height`，未按 `devicePixelRatio` 缩放 canvas 尺寸，也未 `ctx.scale(dpr, dpr)`。`devicePixelRatio` 仅在离屏缓存路径使用（`renderer/ObjectCache.ts:254-256`）与 `cross-platform/root.ts:57-70` 定义。

**后果**：Retina / 高分屏下主画布发虚；若应用自行把 `canvas.width` 设为 CSS 宽 × dpr，则 `offsetX`（`DOMEventDispatcher.ts:82-84`）与 `canvasBoundingClientRect`（`ICE.ts:130`）又会失配，命中偏移。

**附加**：浏览器对 canvas 尺寸上限**不报错、静默失效**，大画布/导出场景需自检降级（业界有专门的 canvas 尺寸探测/降级方案）。

## 3. P1 · 能力与工程化

### P1-1 文本：无换行、无省略、无 grapheme 感知

**证据**：`graphic/text/ICEText.ts:440-465` 仅按 `\n` 拆行；`fillText(text, x, y, this.state.width)` 传入 maxWidth → 超宽时 canvas **横向压缩字形**而非换行。缺：自动折行、`maxLines` + 省略号、可配 `lineHeight`、`letterSpacing` / `wordSpacing`、RTL / `ctx.direction`、富文本（混排粗体/颜色）。

**进展（2026-09-10）**：自动换行 / `maxLines` + 省略号 / grapheme 感知已落地，**默认关闭**（`wrap: false`）以保持既有行为不变：
- `wrap: true` 按 `state.width` 贪心断行；`maxLines` 限制行数，末行逐 grapheme 回退加 `ellipsis`，保证「内容+省略号」不超宽
- 断行按 grapheme cluster 切分（优先 `Intl.Segmenter`，不可用则退化为码点），emoji / ZWJ 序列不被拆开
- 编辑态不换行（`caretIndex` 按原始文本计，换行会错位）
- 仍缺：`letterSpacing` / `wordSpacing`、RTL / `ctx.direction`、富文本、CJK 断行规则（标点避头尾）

**grapheme 问题**：`caretIndex` 按 UTF-16 码元计数（`ICEText.ts:242-273`），`ICEPolyLine.ts:787` 降级宽度估算用 `label.length * fontSize`——中文/emoji/ZWJ 序列下**光标定位与估算均不正确**。对标：主流引擎的新版本已引入 grapheme 感知布局；标准解法是 `Intl.Segmenter`（Baseline 2024）。

### P1-2 文本量测的 HTML 注入与非 DOM 退化（**安全缺陷**）

**证据**：`graphic/text/ICEText.ts:406` → `div.innerHTML = this.state.text.split('\n').join('<br>')`。若文本来自用户输入，含 `<img onerror=...>` 之类内容会**执行**。

**已修复（2026-09-10）**：改为 `div.textContent = text` + `white-space: pre` 承担换行，`innerHTML` 不再被写入；并加了回归用例锁死（断言 `textContent` 被设置、`innerHTML` 未被触碰）。
**仍缺**：非 DOM 运行时的量测仍是「先按默认 10×10、首帧渲染后由 `calcComponentParams` 重算」——可用但首帧前尺寸不准。

另：`ICEText.ts:379-428` 在无 `document` 的运行时（Node / 小程序）无法量测，退化到默认 `10×10`（除非调用方显式传 width/height）。

### P1-3 导出与互操作

**已有**（经代码核实，非缺失）：`ICE.ts:505-517` 有 `toDataURL` / `toBlob`；`ICE.ts:487-500` 有 `getImageData` / `putImageData` / `createImageData`。

**缺**：SVG 导出（矢量对接刚需）、PNG/JPEG 带背景/切边/多倍图导出、SVG 导入、剪贴板互操作、打印。详见 §6（须以独立 exporter 形式实现）。

### P1-4 无障碍零实现

**证据**：无 ARIA、无隐藏 DOM 镜像、无 `tabIndex` / focus 环、无 `drawFocusIfNeeded`。`event/ICEEvent.ts:51-58` 的 `preventDefault` / `stopPropagation` / `stopImmediatePropagation` **全部是 `throw new Error('Method not implemented.')`**；`event/DOMEventDispatcher.ts:75` 注释自认「**当前不支持 DOM 冒泡特性**」。

**后果**：canvas 内容对屏幕阅读器完全不可见；键盘事件只会派发给「上次点中的组件」（`DOMEventDispatcher.ts:45-51` 的 `componentCache`），没有 focus 概念。

**对标**：MDN 明确 `<canvas>` 只是位图、不向辅助技术暴露绘制对象，仅提供 fallback 文本；W3C 把 canvas 的命中测试、放大、动态焦点列为**未解决用例**。业界已有引擎用「隐藏 DOM 覆盖层 + accessible 标题/提示/类型/tabIndex 语义标注」的方案解决，可直接借鉴。

**进展（2026-09-10，方案 B：引擎只给原语）**：新增 `ICE.getAccessibilityTree()` 与 `ICE.setFocusedComponent()`，
**不自建 DOM 镜像层**——理由与方案 A 需要解决的问题见 [14 · 无障碍原语](14-accessibility.md)：
- `getAccessibilityTree(options)`：产出可访问节点快照（id / 角色建议 / 可读名称 / **屏幕坐标盒（CSS 像素，含视口换算）**
  / 层级 / 父 id / tab 顺序 / 选中态 / 可聚焦性）。只含已上屏组件；**不修改任何组件 state**
  （用缓存的 `composedMatrix`，不调 `composeMatrix()`，避免点集路径 `dots` 漂移）
- `setFocusedComponent(componentOrId)`：键盘事件改为派发给焦点组件；**未设置焦点时行为完全不变**
- 应用层负责 DOM 结构、ARIA、文案、焦点环（参考实现见 `examples/a11y/a11y-mirror.html`）
- **仍缺**：若要做方案 A（引擎内建镜像层），需要先解决生命周期同步、多运行时禁用、按需加载包体、
  镜像与画布命中坐标一致、焦点环绘制五个问题

### P1-5 无插件 / 扩展机制

**证据**：唯一扩展点是 `ICE.registerType()`（`ICE.ts:343-354`），且**只服务于反序列化的类名映射**。新增图元须手改 `consts/COMPONENT_TYPE_MAPPING.ts`。

**缺三层扩展点**（对标业界通行形态：自定义绘制/命中回调；按「画布/节点/边/工具/属性」分层的注册体系；Path 级扩展 + painter 模式）：
1. 自定义图元注册；
2. 自定义渲染 pass / 命中判定；
3. 自定义交互工具（控制面板、手势）。

**进展（2026-09-10）**：新增 `ICE.use(plugin)` / `ICE.unuse(name)` 与 `PluginHost`（`src/plugin/PluginHost.ts`），
开放三层注册点，并按 09-roadmap 边界保持在「原语」层面（不做应用层 UX）：

| 层 | 注册点 | 实现 |
|---|---|---|
| ① 组件 | `components: { typeId: Ctor }` | 宿主代为 `registerType`，因此自动获得 typeId 反查 → 自定义图元可序列化 |
| ② 渲染 | `render(frame)` | 每帧调用；坐标系为世界坐标（CTM = dpr·viewport，与组件一致）；两条渲染路径都调用，局部帧在 `clip` 之内 |
| ③ 交互 | `tools: [{ id, match(c), create(), exclusive?, onTargetChange? }]` | 复用既有 `toolNodes`：命中 `addTool`、失配 `removeTool`，实例跨选中复用；`exclusive` 命中时禁用内置变换/连线面板 |

- 生命周期：`use` 幂等（同名不重复 `setup`）；`unuse` 撤销渲染回调与工具并调用 `teardown`，
  **`components` 的类型注册保留**（反序列化仍可能依赖，撤销会让已存数据失效）
- 选中改为统一入口 `ICE.setSelection()` 并同步插件工具；`match` 抛错按未命中处理（不影响引擎）
- **仍缺**：自定义**命中判定**注册点（目前只能覆盖 `containsPoint`）、自定义布局/主题的正式注册协议、
  插件依赖声明与版本约束

### P1-6 序列化的类型键不健壮

**证据**：
- `persistence/Serializer.ts:70` 写 `type: component.constructor.name`。当前靠 `rollup.config.js:36-39` 的 `terser({ keep_classnames: true, keep_fnames: true })` 兜住压缩；一旦改用普通构建产物，或用户自定义子类名与映射不符，即失败。
- `persistence/Deserializer.ts:54-58` 对未知类型直接 `new Clazz(state)`（`Clazz` 为 `undefined`）→ 抛错，无跳过/容错。
- `consts/COMPONENT_TYPE_MAPPING.ts:27-39` **漏了 `ICERose`**（另有 `ICELinkSlot` / `ICELinkHook`）——这些类型**存得下、读不回**。

**方向（2026-09-10 已落地）**：改为「构造函数 → 注册名」**反查**（`ICE.getTypeId()`），与类的 JS 名解耦：
- 已注册类型：序列化写出注册名，terser 压缩改名不再破坏已存数据
- 未注册的自定义类型：仍回退 `constructor.name`（保持既有约定，不破坏下游）
- 补齐漏注册的 **`ICERose`**（此前存得下、读不回）
- 反序列化容错：未注册类型**跳过该节点（含子树）并记录到 `deserializer.unknownTypes`**，
  不再 `new undefined(...)` 抛错导致整份数据打不开
- 版本迁移改为可扩展的 `SERIALIZATION_MIGRATIONS`（按 `to` 升序逐级执行）；高于当前版本仍明确抛错
- 旧数据（type 写类名、无 version 字段）继续可加载

### P1-7 发行契约与质量门禁

**证据**：
- `package.json`：**无 `exports`**（无条件导出/双包危害风险）、**无 `sideEffects`**（tree-shaking 打折）、无 `peerDependencies`。`files` 仅 `dist/**/*`。
- `.github/workflows/ci.yml` 只跑 `lint → types:check → test → build`，**`test:visual`（Playwright golden）与 `bench` 均不在流水线**——可视化回归等于没有门禁。
- `jest.config.js`：`testEnvironment: node`，无覆盖率配置 / 门槛。
- 仓库**无 CHANGELOG、无迁移指南、无 CONTRIBUTING**。

**对标**：Node 官方就双包危害给出明确警告，业界用 **Are The Types Wrong (attw)** + **publint** 在 CI 自动检出 12 类产物问题；Playwright 官方要求 golden image 必须在**同一环境**生成基线（跨 OS/字体/DPR 会漂移）；成熟库普遍为每个大版本写独立升级指南，CHANGELOG 逐条记录行为变更。

**补充证据（2026-09-10 实测发现，三条都是「门禁实际失效」）：**
- **`.husky/pre-commit` 在 git 索引里是 `100644`**（不可执行）→ git 直接跳过该钩子，`lint-staged` 与 commitlint **从未真正运行**。注意 `core.fileMode=false`，工作副本的 chmod 不会被 git 记录，必须用 `git update-index --chmod=+x` 才能修正。
- **`eslint` 在 `master` 上就是红的**：报 194 个 error，只有两类可自动修规则（`prettier/prettier` 101 + `@typescript-eslint/no-var-requires` 12；其余是 warning）。CI 的 lint 步骤实际处于失败状态。
- **`.gitignore` 第 7 行 `*log*` 误伤 `CHANGELOG.md`** → 变更日志根本无法被 git 跟踪。这解释了「仓库为什么没有 CHANGELOG」——不是没人写，是写了也提交不进去。（同类问题作者已为 `logo` 做过显式放行。）

**修复（2026-09-10）**：
- `.husky/pre-commit` 记录为 `100755`（并实测钩子生效：提交时 lint-staged 真正运行）
- `.eslintrc` 为 `tests/**`、`e2e/**` 关闭 `no-var-requires`（测试刻意用 `require` 处理 `jest.mock` 提升顺序）；全仓 prettier 格式化后用 AST 比对确认 7 个文件语法树完全一致（纯格式改动）→ `npm run lint` **0 error**
- `.gitignore` 显式放行 `CHANGELOG.md`，并新增 `CHANGELOG.md`（含升级注意事项）
- `package.json` 增加 `exports`（`types`/`import`/`require`/`default`）+ `sideEffects: false`，保留 `./dist/*` 子路径兼容历史直接引用；新增 `test:visual:ci` 脚本
- CI 新增 **visual 任务**（build → Playwright chromium → examples 冒烟 + 交互 + 脏矩形像素一致性）。**刻意排除 golden 图像比对**：基线按平台命名（`*-darwin.png`），跨平台必然失败——这也说明「把 golden 纳入 CI」不只是加个步骤，还要解决基线分平台的问题。

## 4. P2 · 一致性与内部脆弱点

### 4.1 动画（**2026-09-10 已修主要项**）
- ✅ **支持点路径**：动画键现支持 `'transform.rotate'` / `'style.globalAlpha'` 这类嵌套字段。旧实现直接 `newState[key] = value`，键里的点被当作**字面量键名** → 这些动画**静默失效**（既不报错也不生效），所以此前只能动画 `left/top/width/height` 这类顶层字段。
- ✅ **新增 `delay`**：延迟期内保持起始值，可让同一组件多属性错峰、或多组件形成序列（旧实现完全没有 delay）。
- ✅ **取整策略**：不再无条件 `Math.floor`，默认不取整（0→1 的透明度、角度、缩放不再失真），需要整数步进时显式 `round: true`。
- ✅ **非数值字段明确拒绝**：`transform.scale/translate/skew` 这类数组字段原会算出 `NaN` 并写进 state → **NaN 矩阵静默损坏渲染**；现在跳过并提示一次。
- ✅ `interactive` **保存并恢复原值**（旧实现每帧置回 `true`，会覆盖用户显式设置的 `interactive:false`）。
- ✅ 组件 `destory()` 时**从动画列表摘除**（旧实现不摘，销毁后仍被每帧 `setState`）。
- ✅ 一帧只取一次时间戳，同一帧内各属性时间一致。
- ⚠️ **仍缺**：keyframe 时间轴（多段序列）、spring/elastic/bounce 缓动、数组型字段的补间（需逐元素插值）。

### 4.2 布局（**2026-09-10 已修主要项**）
- ✅ `addChild` / `removeChild` 现在**立即重排**（旧实现只在 `setLayout()` 时排一次，之后增删都不重排 → 加进去的子组件位置全错、删掉后留下空位）。`addChildren` / `removeChildren` 批量操作只在结束后排一次，避免逐个重排的 O(n²)。
- ✅ **新增 measure 阶段**：`ICEGroup.doLayout()` 排布前先对每个子组件调 `measure()`（`calcComponentParams()`），使文本字形量测、点集路径 `calcDots` 在布局前完成 —— 旧实现读到的全是 `0` / 文本的 `10` 哨兵值。
- ✅ **新增的容器型子组件继承父层布局**（与 `setLayout()` 的传播规则一致），否则它内部的子组件不会被排布。
- ⚠️ **仍有成本**：`ICEGroup.setState` 递归把全部后代置脏 —— 移动一个大组会让所有后代重跑 `calcComponentParams`（文本会重新量测字形）。语义上后代确实需要重绘（父矩阵变了），但要避免「重绘」连带「重量测」，需要把 dirty 拆成 `dirty` + `paramsDirty` 两级。属后续优化，不在本轮范围。

### 4.3 主题（**2026-09-10 已修**）
- ✅ **主题改为实例级**：`ICE` 现在持有自己的 `theme`，`ice.setTheme()` 只改本实例（旧实现改的是模块级单例 → 同页面两个 ICE 实例/两套品牌互相污染）。模块级 `setTheme()` 仍作为「此后新建实例」的默认值，因此单实例场景行为不变。
- ✅ **preset 按所属实例的主题解析**：组件构造时仍用模块级默认主题（构造函数阶段还不知道归属哪个 ICE），加入实例时由 `addChild`/`addTool` 调 `__reapplyPreset(this.theme)` 纠正 —— 用户显式传入的样式仍优先。
- ✅ `AnimationManager` 的 motion token（`duration`/`easing` 语义名）也改用实例主题。
- ✅ 新增 `resolveTheme()`：解析主题但不修改任何全局状态（实例级主题的基础）。

### 4.4 连线与工具
- `ICE.findComponent`（`ICE.ts:322-324`）**只搜 `childNodes` 第一层**，树内子组件无法被连线连接。
- 连接插槽为**全局共享的 5 个固定实例**（T/R/B/L/C，`graphic/link/ICELinkSlotManager.ts:204-288`），无法为多组件同时展示端口，也不支持自定义锚点。
- `ICELinkSlot.updatePosition` 在 `AFTER_RENDER` 内 `setState`（`graphic/link/ICELinkSlot.ts:91,97`）→ 置脏 → 下帧再渲染 → 再 setState：**只要有 linkable 组件，画面永不空闲**。

### 4.5 监听器与死代码（**2026-09-10 已修**）
- ✅ `TransformControlPanel.targetComponent` 与 `ICELinkSlot.hostComponent` 的 `once(BEFORE_REMOVE, 箭头函数)` 改为**具名属性 + `on`**，切换时由 setter `off`（`on` 对 `(fn, scope)` 幂等）。旧写法因 `once` 内部再包一层，箭头回调永远无法 `off`，反复选中会持续泄漏。
- ✅ `AFTER_REMOVE` 从死代码变为真正触发：`removeChild` / `removeTool` / `ICEGroup.removeChild` 都补上，且**必须在 `destory()` 之前**（`destory` 会 `purgeEvents`，之后触发监听者收不到）。
- ✅ `flattenTree` 的 `_pid` 改为优先 `props.id`（旧实现取 `node.id` 恒为 `undefined`），同时兼容「普通对象 + 顶层 id」的用法。
- ✅ `ICEComponent.destroy()` 作为 `destory()` 的拼写修正别名（历史拼写已发布，不能直接改名）。
- ✅ `ICELinkSlot.updatePosition` 位置未变时不再 `setState` —— 旧实现挂在宿主 `AFTER_RENDER` 上无条件置脏，导致「只要有 linkable 组件画面就永不空闲」。
- ✅ **`getMinBoundingBox(refresh=true)` 的取值顺序 bug**：旧实现**先读** `state.localOrigin` **再** `composeMatrix()`，而 `localOrigin` 是 `composeMatrix()` 内部才派生的 → 首次刷新读到初始 `(0,0)`，盒子**偏一个原点**。这正是连线插槽要靠「每帧重算」掩盖首次错误的根因。已改为先 compose 再读。
- ⚠️ **`findComponent` 只搜顶层**（未改，附原因）：改成递归后「连线连接嵌套子组件」会真正生效，但实测会激活「连线端点推导 vs 局部重绘」的既有像素不稳定（`dirty-rect-pixel` 富场景 step1 约 900 px 差异：full 画布为抗锯齿混合色、dirty-rect 画布为饱和纯色）。**修复顺序：先把连线端点改为渲染期自推导（不依赖宿主事件），再放开递归查找。** 顺带已移除 `createLink` 里对宿主 `AFTER_RENDER` 的依赖（局部帧的 render 事件只对脏区域内的组件触发，用它驱动几何会引入渲染模式相关的不一致）。回归用例见 `tests/consistency/consistency.test.ts`。

### 4.6 待复核项（未做行为验证）
以下为阅读代码时的疑点，**未经运行时验证**，落地前应先写复现用例：
- `TransformControlPanel.resizeEvtHandler`（`:238-288`）在中心原点约定下同时改 `width += 2*Δ` 与 `left -= Δ`，缩放时组件中心会移动，手感/几何是否与预期一致需核对。
- `ICEPolyLine.drawLabel`（`graphic/link/ICEPolyLine.ts:772-801`）先 `ctx.measureText(label)` 再设置 `ctx.font`（`:784` 早于 `:791`）→ 标签背景框可能按**上一次遗留字体**测量。
- `ICEDotPath.calcLocalOrigin`（`graphic/ICEDotPath.ts:87-98`）**原地平移 `state.dots`**；任何在 `dirty=false` 时触发 `composeMatrix()` 的调用（如 `getMaxBoundingBox(true)`、`getRotateAngle(true)`、`getLocalLeftTop(true)`）都可能让 dots 累积漂移。目前靠「先 dirty 渲染再读」与 ObjectCache 的显式 `calcComponentParams()` 规避（见 `renderer/ObjectCache.ts:179-185`），**属高危脆弱点**。

## 5. 明确不做（范围外）

| 事项 | 理由 |
|---|---|
| Renderer 抽象层 / 可替换渲染后端 | 引擎**有意绑定 Canvas 2D**（2026-09-10 定位决策） |
| WebGL / WebGPU 后端 | 同上；不再是「战略储备」 |
| undo/redo、多选 UX、编组、复制粘贴 | `09-roadmap.md` 划归应用层（引擎只需保证原语够用） |

## 6. 待定（取决于产品定位）

这两项**不需要**渲染层抽象，但需要独立模块；是否做由产品决定：

1. **SVG 导出**：独立 exporter，遍历组件树、复用图元几何参数生成 SVG 标签。**诚实边界**：阴影、虚线流动、`measureText` 字形、Path2D 命令是 canvas 特有，导出只能近似，做不到像素级一致。
2. **Node / SSR / headless 出图**：同样无需抽象层——`ICE.init(ctx)` 已支持直接传 `CanvasRenderingContext2D`（`ICE.ts:133-135`），接 `node-canvas` / `skia-canvas` 即可。真正的阻塞是两件独立的事：
   - `cross-platform/root.ts:20-25`：`root.requestFrame` 在 Node 为 `undefined` → `FrameManager.start()`（`FrameManager.ts:39-42`）直接抛错；
   - 文本量测在无 DOM 环境退化（见 P1-2）。

   ⚠️ 即使**不做** Node 出图，这两点（尤其是文本量测退化）也建议修——它们同时影响小程序低版本基础库。

## 7. 建议落地顺序（收益 / 成本比排序）

1. **输入层改用 Pointer Events**（`pointerdown/move/up` + `wheel` + `touch`），一次拿到触控、笔、滚轮；破坏面集中在 `DOM_EVENT_MAPPING_CONSTS.ts` + `DOMEventInterceptor` + `ICEGroup` 拖拽路径。
2. **空间索引 + 视口裁剪**：节点增删移时维护四叉树，渲染与命中检测都走索引。
3. **主画布 HiDPI**：`init` 内按 dpr 设 canvas 尺寸并 `ctx.scale`，命中检测统一走 `screenToWorld`。
4. **框选 + 多选原语**：让 `selectionList` 支持多值 + marquee。
5. **文本**：自动换行 / 省略号、去掉 `innerHTML` 注入、非 DOM 环境量测可用、`Intl.Segmenter` 断字。
6. **序列化改显式 typeId 注册表**：补 `ICERose` 等漏项 + 反序列化容错 + 迁移。
7. **发行与门禁**：`exports` / `sideEffects`、attw + publint 入 CI、`test:visual` 入 CI + 覆盖率门槛、CHANGELOG + 迁移指南。
8. **dirty-rect 门控细化**：从「整场景」放宽到「相交级」，让含文本场景真正用上局部重绘。

## 附录 A · 业界通行做法要点（去名化，可作 PRD 参考）

按引擎类型归纳「最值得借鉴的一点」，不点名具体产品：

| 引擎类别 | 最值得借鉴 |
|---|---|
| 图层化 Canvas 引擎 | Layer = 独立 Canvas + hit canvas 双画布；`listening(false)` / `cache()` / `perfectDrawEnabled(false)` 三个性能开关；grapheme 感知文本 |
| SVG/Canvas 双解析引擎 | SVG ↔ Canvas 双向解析；画布内富文本（含 IME / 路径文字）；逐大版本升级指南 |
| 多后端 + 扩展架构引擎 | 全系统 extension 化（逻辑与后端解耦）；按需加载的无障碍模块（DOM 覆盖层）；分档文本方案（矢量 / 位图 / HTML） |
| 图表底层渲染库 | 一套场景图驱动多后端；显式 `dispose()` 生命周期；仓库自带 benchmark |
| 图编辑器框架 | 框选 / 对齐线 / 小地图 / 快捷键 / 历史记录等开箱扩展 |
| 商业图组件库 | Selection / ContextMenu / Keyboard / Halo / FreeTransform / Minimap 全套插件 |
| 轻量跨端图形库 | 小体积；跨端拖拽/旋转/缩放手势一体化 |
| 矢量几何优先的脚本引擎 | 向量几何为一等公民；SVG 导入导出 |

## 附录 B · 证据速查（代码）

| 主题 | 位置 |
|---|---|
| 事件注册表（唯一输入源） | `src/consts/DOM_EVENT_MAPPING_CONSTS.ts:13-30` |
| 命中检测全量扫描 | `src/event/DOMEventDispatcher.ts:79-109`、`src/ICE.ts:408-420` |
| 事件无冒泡（自认） | `src/event/DOMEventDispatcher.ts:75`；`src/event/ICEEvent.ts:51-58` |
| dirty-rect 场景门控 | `src/renderer/CanvasRenderer.ts:250-253,314-329` |
| 不透明判定 | `src/renderer/dirty-rect-util.ts:113-123` |
| 主画布读尺寸（无 dpr） | `src/ICE.ts:122-135` |
| 文本绘制 / 量测 / innerHTML | `src/graphic/text/ICEText.ts:379-428,406,440-465` |
| 序列化类型键 | `src/persistence/Serializer.ts:70`；`src/consts/COMPONENT_TYPE_MAPPING.ts:27-39` |
| 反序列化无容错 | `src/persistence/Deserializer.ts:54-58` |
| 类型注册唯一扩展点 | `src/ICE.ts:343-354` |
| 动画 floor / interactive 覆盖 | `src/animation/AnimationManager.ts:56-58,102` |
| 容器递归置脏 / 不重排 | `src/graphic/container/ICEGroup.ts:122-143,186-204` |
| 主题全局单例 | `src/theme/ICETheme.ts:130-131` |
| 连线只搜顶层 | `src/ICE.ts:322-324` |
| 插槽 AFTER_RENDER 内 setState | `src/graphic/link/ICELinkSlot.ts:91,97` |
| 监听器累积 | `src/control-panel/transform-controls/TransformControlPanel.ts:374-382`、`src/graphic/link/ICELinkSlot.ts:98-108` |
| CI 未跑 e2e | `.github/workflows/ci.yml` |
| 打包字段缺失 | `package.json` |

## 附录 C · 证据速查（外部，仅中立标准与工具）

- MDN canvas 无障碍：<https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas>
- W3C Canvas 无障碍用例：<https://www.w3.org/WAI/PF/HTML/wiki/Canvas_Accessibility_Use_Cases>
- Playwright 快照测试：<https://playwright.dev/docs/test-snapshots>
- Node 包 `exports` / 双包危害：<https://nodejs.org/api/packages.html>
- Are The Types Wrong：<https://arethetypeswrong.github.io/>
- publint：<https://publint.dev/>

> 说明：竞品相关的官方文档与仓库链接按约定不在本文列出。需要对着具体实现核对时，可在内部调研记录中查阅。

## 8. 进展（滚动更新）

| 日期 | 条目 | 状态 |
|---|---|---|
| 2026-09-10 | P0-1 输入层：pointer / touch / wheel 通道 + 坐标换算与 canvas 矩形刷新修正 | ✅ 已完成（单测 + Playwright 交互/像素回归全绿） |
| 2026-09-10 | 视口原语：`ICE.zoomAt(screenX, screenY, factor)` 锚点缩放（wheel 接滚轮一行可用） | ✅ 已完成 |
| 2026-09-10 | P0-3 视口裁剪 + 命中检测包围盒预筛（实测 N=6000、屏外 50% 提速 1.89x） | ✅ 已完成 |
| 2026-09-10 | P0-5 主画布 HiDPI（`ICE.init(el, { dpr })`）+ canvas 内容盒坐标修正 | ✅ 已完成（默认 dpr=1 零行为变化） |
| 2026-09-10 | P0-4 dirty-rect 门控由「整场景」放宽到「相交级」 | ✅ 已完成（富场景局部重绘 0 次 → 2 次，像素仍 100% 一致） |
| 2026-09-10 | P0-1 剩余：多指手势（pinch 缩放 / 双指旋转） | ⏳ 待做（按 09-roadmap 边界，属应用层 UX；引擎侧原语已具备） |
| 2026-09-10 | P1-1 文本：自动换行 / maxLines 省略 / grapheme 分段 | ✅ 已完成（默认关闭，零行为变化） |
| 2026-09-10 | P1-2 文本量测 HTML 注入（安全） | ✅ 已修复（textContent + white-space:pre） |
| 2026-09-10 | P1-6 序列化 typeId 反查 + 反序列化容错 + 迁移框架（补 ICERose） | ✅ 已完成 |
| 2026-09-10 | P1-7 发行门禁：exports/sideEffects、CI 接可视化回归、CHANGELOG、husky 权限位、lint 转绿 | ✅ 已完成 |
| 2026-09-10 | P1-5 插件三层注册点（组件/渲染/交互工具）+ 生命周期 `use`/`unuse` | ✅ 已完成 |
| 2026-09-10 | P1-4 无障碍原语（`getAccessibilityTree` / `setFocusedComponent`，方案 B）+ 文档 14 + 示例 | ✅ 已完成 |
| 2026-09-10 | P2 一致性簇：AFTER_REMOVE、监听器累积、插槽每帧置脏、`flattenTree` 的 `_pid`、`destroy` 别名、`getMinBoundingBox` 取值顺序 | ✅ 已完成 |
| 2026-09-10 | P2 `findComponent` 递归查找 | ⏸ 已定位并给出修复顺序（需先改连线端点为渲染期自推导），当前保留保守行为 |
| 2026-09-10 | P2 动画：点路径 / delay / 取整策略 / 拒绝 NaN / interactive 保留 / 销毁摘除 | ✅ 已完成 |
| 2026-09-10 | P2 动画剩余：keyframe 时间轴、spring 类缓动、数组字段补间 | ⏳ 待做 |
| 2026-09-10 | P2 布局：增删自动重排、排布前测量、新容器继承布局 | ✅ 已完成 |
| 2026-09-10 | P2 布局剩余：dirty 拆成 dirty/paramsDirty 以省掉后代重量测 | ⏳ 待做 |
| 2026-09-10 | P2 主题实例级隔离（多画布/多品牌互不污染，含 preset 与 motion token） | ✅ 已完成 |
