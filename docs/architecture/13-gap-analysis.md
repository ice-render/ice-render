# 13 · 能力缺口分析（对标主流引擎）

> 日期：2026-09-10
> 方法（评估当日口径，2026-09-11 已增至 67 个文件 / 12,500 余行）：通读 `src/` 全部 62 个文件（10,300 行）+ 构建/测试/CI/文档全量核对，并外部对标 12 个主流开源与商业图形/图表引擎（按约定去名化，仅以类别描述）。
> 约定：本文**不点名任何竞品**，一律以类别/通行做法描述。
> 目的：回答「对这样一款引擎，**应该做而没做**的是什么」，用于排优先级。**本文是评估记录，不是实现计划**；每项落地应另走 superpowers 闭环（spec → plan → TDD）。
>
> **阅读须知（2026-09-11 起）**：本文是**滚动更新**的文档 —— **§1 结论速览**每行都带「评估时 vs 当前」双列对照，
> **§8 进展表**是逐条落地记录与验证证据。§2 / §3 / §4 的正文**保留评估当天的原始描述与代码证据（含行号）**，
> 它回答的是「当时凭什么这样判断」，**不代表现在仍是缺口**；判断当前状态请以 §1 + §8 为准。
> 已修的条目在其小节顶部都加了「状态」行。

## 0. 范围与边界（先读）

`09-roadmap.md` 已明确划分「引擎原语 vs 应用层」：

- **不归引擎**（由 `ice-entity-designer` 等应用层实现）：undo/redo、多选交互 UX、编组、复制粘贴、图层/属性面板。
- **本文只列** roadmap 未覆盖、但属于引擎职责的缺口。

已确认的定位决策（2026-09-10）：

- **渲染后端不抽象**：引擎有意绑定 Canvas 2D，**不做 Renderer 抽象层**，不支持 WebGL / WebGPU / SVG 作为可替换后端。
- 因此下文所有条目**均不含**「抽象渲染层」「为将来换后端留口」类建议；涉及 SVG/Node 出图的邻近能力，只允许以**独立 exporter / 注入外部 ctx** 的形式提出（见 §6）。

## 1. 结论速览

> 换个视角的证据：两个真实应用（`ice-web-components` 的六页后台与全屏 Windows XP 桌面）跑下来的
> 复盘在 [15 · 应用驱动的引擎评估](15-app-driven-review.md) —— 那里记的是「哪里真的被卡住、归属是谁」，
> 与本文的「对标清单」互补。

> **这是一张会随进展更新的表**：左三列是 2026-09-10 评估时的判断，最后一列是 2026-09-11 的复核结果。
> 历史版本把 §1 当成不可变的「评估快照」，导致已完成的大项（输入层、HiDPI、插件、无障碍、文本排版……）
> 长期显示「完全没做」，极易造成重复投入 —— 因此改为双列对照。逐条进展与证据见 §8。

| # | 缺口 | 等级 | 评估时现状（2026-09-10） | **当前状态（2026-09-11 复核）** |
|---|---|---|---|---|
| 1 | 输入层只有 mouse + keyboard，无 pointer / touch / wheel / 手势 | **P0** | 完全没做 | ✅ **已做**：`pointer*` / `touch*` / `wheel` 三通道，按运行时能力自动选择。多指手势按 §5 边界归应用层 |
| 2 | 无框选、无多选（`selectionList` 恒为单值） | **P0** | 完全没做 | ➖ **引擎侧原语已给**（`setSelection(components)` 支持多选）；框选 UX 归应用层（§5） |
| 3 | 命中检测每次全量 flattenTree + sort + 逐组件判定 | **P0** | 完全没做 | ⚠️ **部分**：已做视口裁剪 + O(1) 包围盒预筛（实测 1.89x）；画布点击与 `ICE.hitTest()` 已收敛为**同一实现** `hitTestComponents()`。**空间索引（四叉树 / R-tree）仍未做**（上万节点且大部分在屏内时才划算） |
| 4 | dirty-rect 遇文本 / 点集 / 半透明整场景回退全量 | **P0** | 已做但用不上 | ✅ **已修**（两层）：门控放宽到「相交级」；**并解开「非单位视口」与「dpr≠1」两个回退**（脏区世界坐标收集 → 渲染坐标裁剪），分散脏区改为**多块裁剪**。回归见 §8（zoom / dpr2 / multi 四个像素场景全部「局部执行 > 0 且逐像素一致」） |
| 5 | 主画布无 devicePixelRatio / HiDPI 处理 | **P0** | 完全没做 | ✅ **已做**：`ICE.init(el, { dpr })`（默认 1，零行为变化）；且 `dpr>1` 下**不再牺牲局部重绘** |
| 6 | 文本无自动换行 / 省略，超宽时横向压缩字形 | P1 | 完全没做 | ✅ **已做**（`wrap` / `maxLines` / `ellipsis` / grapheme 分段，默认关闭）。仍缺 `letterSpacing` / RTL / 富文本 / CJK 避头尾 |
| 7 | 文本含 HTML 注入；非 DOM 环境量不出尺寸 | P1 | 缺陷 | ✅ **已修**：改用 `textContent`；量测改为 canvas 优先 + DOM 降级 |
| 8 | 无 SVG / PDF 导出，无 SVG 导入 | P1 | 部分 | ✅ **SVG 导出 + 无头出图已做**（`ice.toSvg()` / `exportSvg()` 与画布共用命令流；`ICE.headless()` 让 Node 建树出图不依赖 DOM / rAF；`examples/node/export.mjs` 落盘 SVG、可选转 PNG）。**仍未做**：PDF 导出、SVG 导入、剪贴板 / 打印（见 §6 与 §8） |
| 9 | 无障碍零实现（无 ARIA / DOM 镜像 / 键盘焦点） | P1 | 完全没做 | ✅ **已给原语**：`getAccessibilityTree()` / `setFocusedComponent()`（方案 B：DOM 镜像交应用层，见 [14](14-accessibility.md)） |
| 10 | 无插件 / 扩展点（仅 `registerType`） | P1 | 完全没做 | ✅ **已做**：`ICE.use()` 三层注册点。仍缺「自定义命中判定」注册协议（见 [09 路线图](09-roadmap.md)） |
| 11 | 序列化以 `constructor.name` 为类型键；映射漏项 | P1 | 隐患 | ✅ **已修**：`getTypeId()` 反查 + 补 `ICERose` + 反序列化容错 + 迁移表。⚠️ 该缺陷**随后在下游应用层复现过一次**（引擎修了、应用层漏改），见 §8 末条 |
| 12 | 发行契约缺失；CI 不跑可视化回归 | P1 | 部分 | ✅ **已做**：`exports` / `sideEffects` / CHANGELOG / `publint`+`attw` / 覆盖率门槛 / CI 接可视化回归。**2026-09-12 复核**：GitHub Actions 上的 `ci.yml` 是真在跑的（累计 121 次运行，dev / master 最近全绿），镜像也已是同步状态；⚠️ **下游两仓（ice-entity-designer / ice-entity-designer-dsl）尚无 CI**，各自的门禁目前只靠本地 `npm run` 系列 |
| 13 | 动画无 delay / 序列 / spring，且 `Math.floor` 掉精度 | P2 | 部分 | ✅ **已做**（另加关键帧时间轴、数组字段补间，结束判定改按时间） |
| 14 | 布局不随增删自动重排；容器 setState 递归置脏全部后代 | P2 | 部分 | ✅ **已做**（自动重排 + 排布前 measure + `dirty`/`paramsDirty` 拆级） |
| 15 | 主题为模块级全局单例，多实例互相污染 | P2 | 部分 | ✅ **已修**（主题改为实例级，含 preset 与 motion token） |
| 16 | 内部脆弱点若干（事件监听累积、销毁不彻底、死代码等） | P2 | 见 §4 | ✅ **已修**（§4.3–4.5）；§4.6 三条待复核项已全部核实（两条确认无问题、一条已修） |
| 17 | `display: false` 只判组件自身，子组件照样渲染/命中 | **P1** | 评估时未列 | ✅ **已修**：`isEffectivelyVisible()` 沿父链判断，渲染/命中/a11y/离屏缓存统一消费（与 props 文档承诺的「整棵子树」一致） |
| 18 | 布局只在 `setLayout`/`addChild` 时排一次，子项改尺寸不重排 | P2 | 评估时未列 | ✅ **已修**：`ICEGroup.requestLayout()`（下一帧合并重排，布局期间不自激）+ `getPreferredSize()` 转发 |
| 19 | 修饰键（Shift/Ctrl/Alt/Meta）根本到不了组件 | P1 | 评估时未列 | ✅ **已修**：输入归一化显式透传（DOM 原型上的不可枚举 getter 靠 `ICEEvent` 的 `for...in` 拷贝带不过来）；据此实现 `Shift` 等比缩放与旋转吸附 15° |
| 20 | 拖拽移出画布丢事件（无 `setPointerCapture`） | P1 | 评估时未列 | ✅ **已修**：`pointerdown` 捕获、`pointerup/cancel` 释放 |
| 21 | 渐变只能塞原生 `CanvasGradient`，**不可序列化** | P1 | 评估时未列 | ✅ **已做**：声明式 `fillGradient`/`strokeGradient`（纯对象、可进 JSON、可写进主题 preset） |
| 22 | 几何能力（求交/采样/点在多边形）全是私有实现，未上提 | P2 | 评估时未列 | ✅ **已做**：`GeoUtil.pointInPolygon` / `distanceToSegment` / `distanceToPolyline` / `samplePolyline` / `segmentIntersect`，图元改为消费公共实现 |
| 23 | 产物内联 gl-matrix 但**没有保留其版权声明**；`rollup` 的 `external` 是死代码 | P1 | 评估时未列 | ✅ **已修**：产出 `dist/THIRD-PARTY-NOTICES.txt`；删掉 `external` 死代码并在注释里写明「全部内联 = 零运行时依赖」的取舍 |

## 2. P0 · 决定「是否算交互图形引擎」

### P0-1 输入模型只有鼠标 + 键盘

> **状态（2026-09-11）：✅ 已完成** —— `pointer*` / `touch*` / `wheel` 三通道按运行时能力自动选择，拖拽不再依赖 `evt.movementX`。下方为评估时的原始记录。

**证据**：`src/consts/DOM_EVENT_MAPPING_CONSTS.ts:13-30` 仅注册 `mousedown / mouseup / mousemove / click / dblclick / contextmenu` + `keydown / keyup`。全仓库检索 `wheel | pointer | touch | gesture | pinch` **零命中**。

**后果**：
- 触屏 / iPad / 触控笔不可用；拖拽依赖 `evt.movementX`（`graphic/ICEComponent.ts:274-281`），触摸事件下为 `undefined`。
- **无滚轮缩放、无双指缩放/旋转**。`setViewport()` 只能由应用层自行监听 wheel 驱动（`ICE.ts:382-390` 只提供 setter，无输入接入）。
- 无 `focus` / `blur` / `mouseenter` / `mouseleave`，无 hover 态。

**对标**：主流图形引擎普遍内建 drag 事件族（`dragstart/move/end`）；部分跨端引擎直接提供拖拽/旋转/缩放手势；图编辑器类框架把框选、右键菜单、键盘做成开箱扩展。

### P0-2 无框选、无多选

> **状态（2026-09-11）：➖ 引擎侧原语已给，交互 UX 归应用层** —— `setSelection(components)` 支持多选；marquee 框选按 §5 边界由应用层实现。

**证据**：`ICE.ts:52` 声明 `selectionList`，注释写「支持 Ctrl 键同时选中多个组件」；但全仓库唯一赋值点是 `control-panel/ICEControlPanelManager.ts:92` → `this.ice.selectionList = [component]`，**长度恒为 1**。无 marquee（框选矩形）、无 Ctrl/Shift 多选、无批量变换。

**附带问题（已处理）**：README 的核心特性曾写「完整事件系统……支持拖拽、框选、多选」——与实现不符。现措辞已改为「支持拖拽与方向键微调」，不再声称框选/多选。

### P0-3 命中检测无空间索引、无视口裁剪

> **状态（2026-09-11）：⚠️ 部分完成** —— 视口裁剪 + O(1) 包围盒预筛已落地（实测 N=6000、屏外 50% 提速 1.89x）；**空间索引（四叉树 / R-tree）仍未做**，理由见 §7。下方为评估时的原始记录。

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

> **状态（2026-09-11）：✅ 已完成** —— `ICE.init(el, { dpr })`，并把坐标换算与命中统一改走内容盒语义。下方为评估时的原始记录。

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
- `persistence/Serializer.ts:70` 写 `type: component.constructor.name`。当前靠 `rollup.config.mjs:36-39` 的 `terser({ keep_classnames: true, keep_fnames: true })` 兜住压缩；一旦改用普通构建产物，或用户自定义子类名与映射不符，即失败。
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

### 4.1 动画（**2026-09-11 已完成**）
- ✅ **支持点路径**：动画键现支持 `'transform.rotate'` / `'style.globalAlpha'` 这类嵌套字段。旧实现直接 `newState[key] = value`，键里的点被当作**字面量键名** → 这些动画**静默失效**（既不报错也不生效），所以此前只能动画 `left/top/width/height` 这类顶层字段。
- ✅ **新增 `delay`**：延迟期内保持起始值，可让同一组件多属性错峰、或多组件形成序列（旧实现完全没有 delay）。
- ✅ **取整策略**：不再无条件 `Math.floor`，默认不取整（0→1 的透明度、角度、缩放不再失真），需要整数步进时显式 `round: true`。
- ✅ **非数值字段明确拒绝**：`transform.scale/translate/skew` 这类数组字段原会算出 `NaN` 并写进 state → **NaN 矩阵静默损坏渲染**；现在跳过并提示一次。
- ✅ `interactive` **保存并恢复原值**（旧实现每帧置回 `true`，会覆盖用户显式设置的 `interactive:false`）。
- ✅ 组件 `destory()` 时**从动画列表摘除**（旧实现不摘，销毁后仍被每帧 `setState`）。
- ✅ 一帧只取一次时间戳，同一帧内各属性时间一致。
- ✅ **关键帧时间轴**（2026-09-11）：`keyframes: [{ offset, value, easing? }]`。`offset` 为 0~1 时间占比，
  缺省按顺序均分、超界夹紧、乱序自动排序；`easing` 写在**段起始帧**上，只作用于「该帧 → 下一帧」这一段
  （未写则回落到动画级 `easing`）；时间轴之外保持首/末帧值，不外推。
- ✅ **弹簧类缓动**（2026-09-11）：`spring` / `springSoft` / `springSnappy`（欠阻尼谐振子解析解，自带过冲），
  并接入主题 `motion.easing` token。为此把缓动拆成两层：新增 **`EasingProgress`**（归一化进度函数，
  纯函数、不读时钟 —— 关键帧段内缓动需要在任意局部进度上求值，而 `Easing` 的「值语义 + 自读 `Date.now()`」
  签名做不到；仅在模块内导出，未加入包入口），`Easing` 保持历史签名不变（9 个既有函数体逐字未改）。`tests/animation/easing-progress.test.ts` 在 0~1 网格上锁定
  两层等价（实测偏差 < 1e-12），防止实现漂移。
- ✅ **数组型字段补间**（2026-09-11）：`transform.scale` / `transform.translate` / `transform.skew` 等
  按分量逐元素插值，可与关键帧、弹簧缓动组合；仅「两端长度不一致」「含非数字」被拒绝。
- ✅ **结束判定由「值是否越过 to」改为按时间**（2026-09-11）：这是弹簧过冲能正常工作的前提
  ——按值判定会在第一帧过冲（值越过 `to`）处就误判结束。顺带修掉 `duration <= 0` 且 `from === to` 时
  算出 `NaN`、比较恒 `false` 导致**永不结束、每帧空转 `setState`** 的缺陷（现在落到终点并结束）。
- ✅ 未知缓动名不再抛 `TypeError`（回退 `linear` 并提示一次）；非法配置的告警由**逐帧刷屏**改为每配置只告警一次
  （`WeakSet` 记录，不往会被序列化的 `props` 上塞标记字段）。

### 4.2 布局（**2026-09-11 已完成**）
- ✅ `addChild` / `removeChild` 现在**立即重排**（旧实现只在 `setLayout()` 时排一次，之后增删都不重排 → 加进去的子组件位置全错、删掉后留下空位）。`addChildren` / `removeChildren` 批量操作只在结束后排一次，避免逐个重排的 O(n²)。
- ✅ **新增 measure 阶段**：`ICEGroup.doLayout()` 排布前先对每个子组件调 `measure()`（`calcComponentParams()`），使文本字形量测、点集路径 `calcDots` 在布局前完成 —— 旧实现读到的全是 `0` / 文本的 `10` 哨兵值。
- ✅ **新增的容器型子组件继承父层布局**（与 `setLayout()` 的传播规则一致），否则它内部的子组件不会被排布。
- ✅ **`dirty` 拆成 `dirty` / `paramsDirty` 两级**（2026-09-11）：`dirty` = 需要重绘；`paramsDirty` = 自身派生参数（尺寸 / 点集 / 文本量测）需要重算，只取决于自身 `state`。
  - 祖先变换变化时，后代只置 `dirty`（绝对矩阵变了，必须重绘），**不再连带重量测**；统一入口 `refreshParams()` 负责「按需重算 + 清标志」。
  - 实测（4 rect + 4 小星形 + 2 可缓存大星形 + 2 文本，移动整组一帧）：`calcComponentParams` **10 → 0**、`calcDots` **6 → 0**，而必须发生的重绘仍是 8 次（不受影响）。
  - 文本本就靠离屏缓存避开了重测（实测 0 次），因此本项的真实收益集中在**点集类图元**（星形/玫瑰线/正多边形/折线）不再重跑 `calcDots()`。
- ✅ **顺带修掉一个潜在漂移**（2026-09-11）：`ICEDotPath.calcLocalOrigin()` 会就地把 `dots` 平移到「以 origin 为原点」，旧实现**每次 compose 都无条件再平移一个 origin** —— 实测连续三次 `composeMatrix()`，`dots` 依次偏移 1/2/3 个原点。这意味着「跳过重算」根本不可能安全落地（跳过重算就会累积漂移）。现改为记录「已应用平移量」、只补差额，`composeMatrix()` 对 dots 变为**幂等**；`calcDots()` 成为重建 dots 的唯一入口（子类实现 `__calcDots()`）。这条不变量也顺带消除了 ObjectCache / `__freshBox` / `getMinBoundingBox(true)` 之间「必须严格配对调用」的隐式约束。

### 4.3 主题（**2026-09-10 已修**）
- ✅ **主题改为实例级**：`ICE` 现在持有自己的 `theme`，`ice.setTheme()` 只改本实例（旧实现改的是模块级单例 → 同页面两个 ICE 实例/两套品牌互相污染）。模块级 `setTheme()` 仍作为「此后新建实例」的默认值，因此单实例场景行为不变。
- ✅ **preset 按所属实例的主题解析**：组件构造时仍用模块级默认主题（构造函数阶段还不知道归属哪个 ICE），加入实例时由 `addChild`/`addTool` 调 `__reapplyPreset(this.theme)` 纠正 —— 用户显式传入的样式仍优先。
- ✅ `AnimationManager` 的 motion token（`duration`/`easing` 语义名）也改用实例主题。
- ✅ 新增 `resolveTheme()`：解析主题但不修改任何全局状态（实例级主题的基础）。

### 4.4 连线与工具（**2026-09-11 已完成**）
- ✅ **`ICE.findComponent` 改为递归查找**（2026-09-11）：先查顶层（同 id 顶层优先，保持既有优先级），
  再深度优先递归子树；**工具层不参与查找**（工具是 UI 覆盖层，不应成为连线端点）。
  这样「连线连接嵌套子组件」在引擎侧真正生效。
  - 该项此前被**误判**为「放开递归会与局部重绘冲突」：实测 step1 有约 900 px 差异，于是记为
    「前置条件：先把连线端点改为渲染期自推导」。2026-09-11 把那个前置条件做完后复测，差异只降到
    489 px —— 说明方向错了。
  - **真正的根因**：折线的包围盒是**退化的**。`ICEPolyLine.calcComponentParams` 用「顶点对相减」
    （`points[1].x - points[0].x`）推导宽高，而 `ICEPolyLine.calc4VertexPoints()` 返回的是沿路径
    排列的**笔画带宽顶点**（不是包围盒的左上/右上角）→ 近似水平的折线算出 `width ≈ 0`；同时
    `ICEComponent.__paintWorldBox()` 又是**另一条**由 width/height 推导盒子的路径（`getMinBoundingBox()`
    被折线覆盖过、`__paintWorldBox()` 没有）→ 上屏快照盒退化 → 局部重绘按快照盒挑选「需要重画的对象」
    时**漏掉折线** → 被擦除区域内的折线笔迹丢失。
  - 修法：把「本地盒」抽成唯一来源 `ICEComponent.__localBox()`（`getMinBoundingBox()` 与
    `__paintWorldBox()` 都消费它，从此**必然一致**），折线覆盖该方法给出真实带宽盒；
    `calcComponentParams` 改为取带宽顶点的 min/max；并修掉 `splitEndpointsTo4Points` 的
    **循环依赖**（它用 `state.height` 当线宽输入，而 height 又是它的输出 → 结果随上一次的 height 漂移，
    首帧还读到默认哨兵值 10）。
  - **副作用（需知）**：折线连上后包围盒变真实、且在大场景里往往很大，而折线属于「clip 会切断描边
    抗锯齿」的风险类别 → 富场景会**稳定回退全量**（`dirty-rect-pixel:rich` 的 `局部执行=0`）。
    这是**正确的保守行为**：此前「能走局部重绘」恰恰是因为盒子退化漏画了折线。要恢复局部重绘，
    需要先解决折线描边的 clip-AA 一致性（与 [04](04-rendering-performance.md) 里 v2 的门控细化是同一件事）。
- 连接插槽为**全局共享的 5 个固定实例**（T/R/B/L/C，`graphic/link/ICELinkSlotManager.ts:204-288`），无法为多组件同时展示端口，也不支持自定义锚点。
- `ICELinkSlot.updatePosition` 在 `AFTER_RENDER` 内 `setState`（`graphic/link/ICELinkSlot.ts:91,97`）→ 置脏 → 下帧再渲染 → 再 setState：**只要有 linkable 组件，画面永不空闲**。

### 4.5 监听器与死代码（**2026-09-10 已修**）
- ✅ `TransformControlPanel.targetComponent` 与 `ICELinkSlot.hostComponent` 的 `once(BEFORE_REMOVE, 箭头函数)` 改为**具名属性 + `on`**，切换时由 setter `off`（`on` 对 `(fn, scope)` 幂等）。旧写法因 `once` 内部再包一层，箭头回调永远无法 `off`，反复选中会持续泄漏。
- ✅ `AFTER_REMOVE` 从死代码变为真正触发：`removeChild` / `removeTool` / `ICEGroup.removeChild` 都补上，且**必须在 `destory()` 之前**（`destory` 会 `purgeEvents`，之后触发监听者收不到）。
- ✅ `flattenTree` 的 `_pid` 改为优先 `props.id`（旧实现取 `node.id` 恒为 `undefined`），同时兼容「普通对象 + 顶层 id」的用法。
- ✅ `ICEComponent.destroy()` 作为 `destory()` 的拼写修正别名（历史拼写已发布，不能直接改名）。
- ✅ `ICELinkSlot.updatePosition` 位置未变时不再 `setState` —— 旧实现挂在宿主 `AFTER_RENDER` 上无条件置脏，导致「只要有 linkable 组件画面就永不空闲」。
- ✅ **`getMinBoundingBox(refresh=true)` 的取值顺序 bug**：旧实现**先读** `state.localOrigin` **再** `composeMatrix()`，而 `localOrigin` 是 `composeMatrix()` 内部才派生的 → 首次刷新读到初始 `(0,0)`，盒子**偏一个原点**。这正是连线插槽要靠「每帧重算」掩盖首次错误的根因。已改为先 compose 再读。
- ✅ **`findComponent` 递归查找**（2026-09-11 已完成，详见 §4.4）：本条目此前写成「未改，附原因」，与 §4.4 自相矛盾，已更正。保留一条记录是因为它的排错过程有参考价值——当时把像素差异归因为「连线端点推导 vs 局部重绘」，做完那一步后差异只从 900px 降到 489px，说明方向错了；真根因是**折线包围盒退化**（两条算盒路径不一致）。教训：出现像素差异时，先验证「包围盒 / 上屏快照是否可信」，再怀疑渲染策略。

### 4.6 待复核项（**2026-09-11 已全部核实**）
> **2026-09-11 全部核实完毕**：两条确认代码本来就对（并各补了回归测试），一条是真缺陷（已修）。
> 修订前这三条以「未经运行时验证的疑点」口吻记着，容易被误读成「已知有三个 bug」。

**4.6.1 缩放手柄的几何（结论：正确，已补回归测试）**

`TransformControlPanel.resizeEvtHandler` 在中心原点约定下同时改 `width += 2Δ` 与 `left -= Δ`。
静态推导：`left' + width'/2 = (left − Δ) + (width + 2Δ)/2 = left + width/2` —— **中心恰好守恒，这正是想要的**
（组件 transform 原点在本地中心，若不守恒则每拖一次都会「跑位」）。已为 8 个象限各加一条断言
（`tests/control-panel/transform-control.test.ts`），实测中心全部保持不动。

- **未处理的边界（实测确认）**：把某个手柄拖过**对边**（使宽/高变负）时，代码用 `Math.abs(newWidth)` 兜底而不做 clamp，
  中心会跳变（实测 `quadrant 1`、width 200 拖 -150：得到 `width 100 / left 250`，中心由 200 跳到 300）。
  属小体感问题，未改；若要修，应在 `resizeEvtHandler` 里对最小尺寸做 clamp，并在越界时一并钳住 `left/top`。

**4.6.2 连线标签的背景框量宽时机（结论：真缺陷，已修）**

`ICEPolyLine.drawLabel()` 原先**先** `ctx.measureText(label)`、**后**设 `ctx.font`。canvas 的 `font` 是跨调用遗留状态，
因此量到的宽度来自「上一次绘制留下的字体」，背景框与实际字形不符（框过宽或过窄）。
已把 `ctx.font` 提到 `measureText` 之前；`tests/link/link-label.test.ts` 用「宽度随 font 变化」的 ctx 桩把顺序钉死
（改回旧顺序该用例立即转红）。

**4.6.3 `ICEDotPath.calcLocalOrigin` 的累积漂移（结论：已修）**

原实现**原地平移 `state.dots`**，任何在 `dirty=false` 时触发 `composeMatrix()` 的调用都会让点集累积偏移
（实测连续三次 compose，`dots` 依次偏 1/2/3 个原点）。已改为「记录已应用平移量、只补差额」，
`composeMatrix()` 对 dots **幂等**，`calcDots()`（子类实现 `__calcDots()`）成为重建点集的唯一入口。
详见 §4.2。这条不变量也顺带消除了 ObjectCache / `__freshBox` / `getMinBoundingBox(true)` 之间
「必须严格配对调用」的隐式约束。
## 5. 明确不做（范围外）

| 事项 | 理由 |
|---|---|
| Renderer 抽象层 / 可替换渲染后端 | 引擎**有意绑定 Canvas 2D**（2026-09-10 定位决策） |
| WebGL / WebGPU 后端 | 同上；不再是「战略储备」 |
| undo/redo、多选 UX、编组、复制粘贴 | `09-roadmap.md` 划归应用层（引擎只需保证原语够用） |

## 6. 待定（取决于产品定位）

这两项**不需要**渲染层抽象；**2026-09-12 复核：第 1、2 项已落地**，本节保留剩余边界：

1. ~~**SVG 导出**~~ ✅ **已落地**（`ice.toSvg()` / `exportSvg()`，2026-09-12 发 1.4.2–1.4.6）：遍历组件树、复用与画布同一套绘制命令流生成 SVG（渐变、虚线、阴影、子树透明度、裁剪、连线标签、实心箭头都在内）。**诚实边界**：虚线流动、`measureText` 字形的次像素差异仍是近似的，做不到逐像素一致。剩余：PDF 导出、SVG 导入、剪贴板 / 打印。
2. ~~**Node / SSR / headless 出图**~~ ✅ **硬阻塞已全部解除**：`ICE.headless()` 不需要 canvas 元素即可建树，`root.requestFrame` 有定时器兜底，文本量测 canvas 优先 + DOM 降级；`examples/node/export.mjs` 是可直接跑的样板（SVG 落盘，装了 `@resvg/resvg-js` 时再出 2× PNG）。历史阻塞记录如下：
   - `cross-platform/root.ts:20-25`：`root.requestFrame` 在 Node 为 `undefined` → `FrameManager.start()`（`FrameManager.ts:39-42`）直接抛错；
   - 文本量测在无 DOM 环境退化（见 P1-2）。

## 7. 落地顺序回顾（原「建议落地顺序」，2026-09-11 复核）
> 原为 2026-09-10 拟定的「建议落地顺序（收益/成本比）」。**2026-09-11 复核：8 项里 6 项已落地、1 项部分、1 项划归应用层。**
> 因此本节改为「回顾 + 剩余」，不再当作待办列表读。

| 原序 | 事项 | 结果 |
|---|---|---|
| 1 | 输入层改用 Pointer Events（`pointerdown/move/up` + `wheel` + `touch`） | ✅ 已做。破坏面确实集中在小范围：`DOM_EVENT_MAPPING_CONSTS` + `DOMEventInterceptor` + `ICEGroup` 拖拽路径 |
| 2 | 空间索引 + 视口裁剪 | ⚠️ **只做了一半**：视口裁剪与 O(1) 包围盒预筛已落地（1.89x）；**四叉树 / R-tree 仍未做**，理由见下 |
| 3 | 主画布 HiDPI | ✅ 已做（`init(el, { dpr })` + 内容盒坐标语义） |
| 4 | 框选 + 多选原语 | ➖ 引擎侧给了 `setSelection(components)` 多选原语；**marquee 框选交互按 §5 边界归应用层** |
| 5 | 文本：自动换行 / 省略号、去掉 `innerHTML`、非 DOM 量测、`Intl.Segmenter` 断字 | ✅ 已做（`wrap` / `maxLines` / `ellipsis` / grapheme，默认关闭；量测 canvas 优先 + DOM 降级） |
| 6 | 序列化改显式 typeId 注册表 | ✅ 已做（`getTypeId` 反查 + 补 `ICERose` + 容错 + 迁移表） |
| 7 | 发行与门禁：`exports`/`sideEffects`、attw + publint、`test:visual` 入 CI、覆盖率门槛、CHANGELOG | ✅ 已做。⚠️ 唯一未完成的是**让 CI 真的跑起来**（需要 runner；当前 Gitee 主仓无 CI 配置，GitHub 是落后镜像） |
| 8 | dirty-rect 门控由「整场景」放宽到「相交级」 | ✅ 已做（富场景局部重绘 0 → 2 次，像素仍一致） |

**为什么第 2 项只做了一半**：视口裁剪 + 包围盒预筛已把「屏外大量节点」的场景处理掉，而四叉树 / R-tree 的收益要到
「上万节点且**大部分在屏内**」才显著 —— 这属于需要实测数据驱动的优化，不适合在没有目标场景前先做。
如果将来要接的路由 / 流程图场景会到那个规模，再按实测决定是否引入索引（并应同时决定索引维护在 `addChild/removeChild/setState` 哪一层）。
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
> 复核日期 **2026-09-11**。原表是 2026-09-10 评估时的行号定位，其中多数条目已在后续提交中**被修掉或搬走**，
> 继续保留会误导（例如「打包字段缺失」「CI 未跑 e2e」早已不成立）。现按「仍未做的项」+「已建成的关键机制」重写。

**A. 仍未做 / 部分做的项在哪**

| 主题 | 位置 |
|---|---|
| 缺空间索引（命中/渲染仍为全量或预筛） | `src/event/DOMEventDispatcher.ts`（`flattenTree` 后逐组件判定）、`src/ICE.ts` 的 `hitTest()` |
| 缺 SVG / PDF 导出、SVG 导入（仅有位图导出） | `src/ICE.ts` 的 `toDataURL` / `toBlob` / `getImageData` |
| 缺自定义命中判定注册协议 | `src/graphic/ICEComponent.ts` 的 `containsPoint` / `containsLocalPoint`（protected，只能靠继承覆盖） |
| 缺错切（skew）手柄 | `src/control-panel/transform-controls/TransformControlPanel.ts`（`TODO:添加斜切手柄？`） |
| 控制面板抽象待重构 | `src/control-panel/ICEControlPanelManager.ts`（FIXME：按组件类型展现不同工具） |
| CI 无 runner | `.github/workflows/ci.yml` 存在且内容完整，但主仓在 Gitee（无对应 CI 配置），GitHub 为落后镜像 |

**B. 已建成的关键机制在哪（供二次开发定位）**

| 主题 | 位置 |
|---|---|
| 输入通道选择与坐标换算 | `src/consts/DOM_EVENT_MAPPING_CONSTS.ts`、`src/event/DOMEventInterceptor.ts`、`src/event/DOMEventDispatcher.ts` |
| 视口（世界↔屏幕） | `src/ICE.ts` 的 `setViewport` / `zoomAt` / `screenToWorld`，`src/renderer/CanvasRenderer.ts` 的 CTM 组合 |
| 精确命中判定 | `ICEEllipse.containsLocalPoint`（椭圆方程）、`ICEDotPath.containsLocalPoint`（射线法）、`ICEPolyLine.containsLocalPoint`（点-线段距离） |
| 脏矩形门控与快照 | `src/renderer/CanvasRenderer.ts`、`src/renderer/dirty-rect-util.ts` |
| 本地盒唯一来源 | `src/graphic/ICEComponent.ts` 的 `__localBox()`（`getMinBoundingBox()` 与 `__paintWorldBox()` 都消费它） |
| 两级脏标记 | `src/graphic/ICEComponent.ts` 的 `dirty` / `paramsDirty` + `refreshParams()` |
| 序列化类型反查 | `src/ICE.ts` 的 `registerType` / `getTypeId`；`src/persistence/Serializer.ts`、`Deserializer.ts`、`SERIALIZATION_MIGRATIONS` |
| 插件注册点 | `src/plugin/PluginHost.ts` + `src/ICE.ts` 的 `use` / `unuse` / `setSelection` |
| 无障碍原语 | `src/ICE.ts` 的 `getAccessibilityTree` / `setFocusedComponent` |
| 动画（关键帧 / 弹簧 / 数组） | `src/animation/AnimationManager.ts`、`src/animation/Easing.ts`（`EasingProgress` 与 `Easing` 两层） |
| 跨平台适配层 | `src/cross-platform/root.ts`（`requestFrame` 兜底 / `createPath2D` / `loadFont` / `createOffscreenCanvas` / `devicePixelRatio`） |
## 附录 C · 证据速查（外部，仅中立标准与工具）

- MDN canvas 无障碍：[https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas)
- W3C Canvas 无障碍用例：[https://www.w3.org/WAI/PF/HTML/wiki/Canvas_Accessibility_Use_Cases](https://www.w3.org/WAI/PF/HTML/wiki/Canvas_Accessibility_Use_Cases)
- Playwright 快照测试：[https://playwright.dev/docs/test-snapshots](https://playwright.dev/docs/test-snapshots)
- Node 包 `exports` / 双包危害：[https://nodejs.org/api/packages.html](https://nodejs.org/api/packages.html)
- Are The Types Wrong：[https://arethetypeswrong.github.io/](https://arethetypeswrong.github.io/)
- publint：[https://publint.dev/](https://publint.dev/)

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
| 2026-09-11 | P2 `findComponent` 递归查找 | ✅ 已完成（真根因是折线包围盒退化：`__paintWorldBox` 与 `getMinBoundingBox` 两条盒路径不一致 → 局部重绘漏画折线；已抽 `__localBox` 统一并修掉 `splitEndpointsTo4Points` 的循环依赖） |
| 2026-09-10 | P2 动画：点路径 / delay / 取整策略 / 拒绝 NaN / interactive 保留 / 销毁摘除 | ✅ 已完成 |
| 2026-09-11 | P2 动画剩余：keyframe 时间轴、spring 类缓动、数组字段补间 | ✅ 已完成（含结束判定改按时间、非法 duration 空转修复；单测 + 示例集成全绿） |
| 2026-09-10 | P2 布局：增删自动重排、排布前测量、新容器继承布局 | ✅ 已完成 |
| 2026-09-11 | P2 布局剩余：dirty 拆成 dirty/paramsDirty 以省掉后代重量测 | ✅ 已完成（实测移动整组：params 10→0、calcDots 6→0；附带修掉 compose 累积平移 dots 的漂移） |
| 2026-09-10 | P2 主题实例级隔离（多画布/多品牌互不污染，含 preset 与 motion token） | ✅ 已完成 |
| 2026-09-11 | §6 阻塞点：无 rAF 运行时（Node / headless / 小程序低版本）启动即抛错 | ✅ 已修（`root.requestFrame` 加定时器兜底；另一阻塞点「文本量测依赖 DOM」此前已由 canvas 优先量测解决） |
| — | §7-2 的**空间索引**（四叉树 / R-tree） | ❌ **未做**（只做了「视口裁剪 + 命中检测 O(1) 包围盒预筛」，见 P0-3 行。全屏内的大规模场景命中仍是 O(n)；索引收益要到「上万节点且大部分在屏内」才显著） |
| 2026-09-12 | P1-3 导出与互操作 · **SVG 导出**（`ice.toSvg` / `exportSvg`，与画布同一套绘制命令流）+ **路径命令流底座**（`src/graphic/path`，为 SVG / 服务端出图打底） | ✅ 已完成（1.4.2；补丁：`closePath` 按位置进命令流、连线标签进导出、实心端点箭头导出为填充路径） |
| 2026-09-12 | P1-3 导出与互操作 · **无头实例 `ICE.headless()`**（Node / 服务端建树出图，不依赖 DOM 与 rAF；导出前刷新派生几何）+ `examples/node/export.mjs` | ✅ 已完成（1.4.4） |
| 2026-09-12 | P1-3 剩余：**PDF 导出、SVG 导入、PNG·JPEG 带背景/切边/多倍图、剪贴板、打印** | ❌ **未做**（PNG 可先走「SVG → resvg / headless Chrome」外部链路；导入类需要独立解析器） |
| 2026-09-12 | **已修**：`getSerializableChildren()` 钩子 —— 「既是复合组件、又是容器」的组件（流程图 / BPMN 节点与池）可以只序列化真实子节点。修复 **BPMN 池/泳道快照往返丢元素**（3 个元素只剩 1 个）；不实现的组件行为不变 | ✅ 已完成（1.4.8，带引擎单测 + IED 单测/ e2e 回归） |
| 2026-09-12 | **新发现（下游核对）**：引擎 `ICEPolyLine` 的默认 `transformable` 是 `true`，而四个下游域包（ER / UML / 状态机 / 甘特）都得各自显式设成 `false` 才对（流程图与电力的连线已设对）。连线让用户缩放/旋转没有图纸意义 —— 建议引擎把连线基类的默认改成 `transformable: false`（下游显式覆盖仍生效）。⚠️ 属公共库默认值变更，按 §8/16 号文档的规矩单独评估 | ⏳ **待评估**（下游已各自设 false，不影响正确性） |
| 2026-09-12 | **新发现（下游实测）**：用「首尾重复点」表达闭合的折线（如电缆终端喇叭口 `[[a],[b],[c],[d],[a]]`）会让引擎拿**零尺寸离屏 canvas** 去 `drawImage`，控制台报 `The image argument is a canvas element with a width or height of 0`。开放折线（去掉末尾重复点）正常；`ICEPolyLine` 的闭合成因（`closePath` / 点集退化）待查 | ⚠️ **未修**（下游已规避：改用开放折线；修法方向是缓存前对盒做尺寸兜底） |
| 2026-09-12 | 事件总线：`trigger` 遍历监听快照，修「同一事件上多个 `once` 监听被跳过」（实测 5 个只触发 0/2/4） | ✅ 已修复（1.4.7，带回归测试） |
| 2026-09-11 | §7-7 余项：`attw` + `publint` 入 CI、jest 覆盖率门槛 | ✅ 已完成（`npm run pkg:check`；覆盖率门槛按实测基线设棘轮。**首跑即发现真实打包缺陷**：ESM 入口被声明为 CJS → 已修，见下条） |
| 2026-09-11 | 打包契约：ESM/CJS 入口被声明为 CJS（类型解析错误） | ✅ 已修（`dist/index.js`→`index.mjs`、`index.cjs.js`→`index.cjs`；import 条件用 `.d.mts`；`rollup.config.js`→`.mjs`。**深链旧文件名的用法会断**，见 CHANGELOG「需要注意」） |
| — | P0-2 的 marquee 框选交互、P0-1 的多指手势 | ➖ **不做**（§5 明确划归应用层 UX；引擎侧原语已给：`setSelection(components)` 多选、`zoomAt` 锚点缩放。客观上是「未实现」，但按边界不算引擎欠账） |
| 2026-09-11 | 连线标签背景框按「上一次遗留字体」量宽（§4.6.2） | ✅ 已修（`drawLabel` 先设 `ctx.font` 再 `measureText`；新增 `tests/link/link-label.test.ts`，用「宽度随 font 变化」的 ctx 桩把顺序钉死） |
| 2026-09-11 | §4.6 三条「待复核项」全部核实结案 | ✅ 4.6.1 缩放手柄中心守恒（补 8 象限回归）、4.6.3 dots 幂等（此前已修）；4.6.2 是真缺陷已修。另记录一条未处理边界：拖过对边致宽高为负时 `Math.abs` 会让中心跳变 |
| 2026-09-11 | §1 结论速览由「不可变评估快照」改为「含当前状态的双列对照」 | ✅ 文档自身的可维护性修复：§1 长期显示「完全没做」，是本次评估中最容易误导排期的一处 |
| 2026-09-11 | 线条端点箭头改为**默认实心**（`arrowStyle: 'filled' | 'hollow'`） | ✅ 已做（箭头三角形一直是把顶点插进折线点集、只描边 → 空心；现按线色单独填充一次，`both` 两端共用同一开关）。顺带修掉同源缺陷：**共线（直线）折线的包围盒不含箭头 wing 的横向张开**（默认 ±7.5px），会让 dirty-rect 快照盒偏小、局部重绘裁掉箭头 —— 现在 `__localBox()` 并入箭头三角面顶点。回归见 `tests/link/line-arrow.test.ts`（13 例） |
| 2026-09-11 | 连线形态可切：`linkShape: 'visio' | 'bezier'`（贝塞尔 = 插槽法线方向的三次曲线采样） | ✅ 已做（`ICEVisioLink.__calcDots()` 分支；采样点写回 `state.points` 以保证包围盒/标签/局部重绘正确；bezier 下拦掉正交路由）。顺带修 `doCalcArrowPoints` 零切线 NaN。回归见 `tests/link/visio-bezier.test.ts`（10 例） + 应用层 `e2e/entity-editor.spec.ts` 的连线形态用例 |
| 2026-09-11 | **同一类缺陷在下游应用层复现**：`ice-entity-designer` 仍有 10 处 `constructor.name === 'Entity'` 判类型 | ✅ 已修（改用 `static typeId` 稳定标识 + `component_type_util.ts` 统一判型 + ESLint 门禁 + 显式模拟改名的回归测试）。**教训**：引擎在 P1-6 修掉「类型键依赖类名」后，只在引擎侧加了防线；下游打包器 mangle 类名会让应用层同类判断**静默失效**（`entities` 恒空、update/remove 变 no-op，页面零报错），而包自身构建配了 `keep_classnames`，包内测试永远发现不了 |

| 2026-09-11 | 脏矩形局部重绘**支持非单位视口与 `dpr>1`**：脏区经 `mapBoxToRender()` 映射到渲染坐标后再 clear/clip | ✅ 已做（去掉 `__collect()` 里两条「视口非单位 / dpr≠1 就回退全量」的兜底）。回归：`e2e/visual/dirty-rect-pixel.spec.ts` 的 `?zoom=1` / `?hidpi=1` / `?zoom=1&hidpi=1` 三个场景均断言「局部执行 > 0」且 10 步逐像素一致（旧代码下三条全红） |
| 2026-09-11 | **多块脏矩形**：`coalesceRegions()` 把分散脏区聚合成互不相接的多块裁剪区 | ✅ 已做（此前并成单个 AABB，画布对角两处小脏点会圈进大半画布、直接撞 35% 阈值）。回归：单测 17 例 + `?multi=1` 像素场景 |
| 2026-09-11 | `display:false` 的**子树语义**（`isEffectivelyVisible()`） | ✅ 已做。回归：`tests/graphic/effectively-visible.test.ts`（4 例，含命中）+ dirty-rect 的「父容器隐藏」两例；反证：把渲染守卫改回只判自身 → 如期转红 |
| 2026-09-11 | 命中检测两份实现收敛为 `hitTestComponents()`；`flattenAllComponents()` 消重 | ✅ 已做（行为等价，577 例全绿后继续；`ICE.hitTest` 与画布点击再也不会不一致） |
| 2026-09-11 | 交互式连线支持**嵌套子组件** + 修掉「碰撞点粘住不重置」 | ✅ 已做（改用拉平全集 + z 序取最上层，与点击语义一致）。回归：`tests/link/link-slot-collision.test.ts`（4 例）；反证 3 例转红 |
| 2026-09-11 | 声明式渐变 `fillGradient` / `strokeGradient` | ✅ 已做（可序列化、可主题 preset、按引用缓存、渐变最后应用；conic 缺 API 退回纯色）。回归：`tests/graphic/gradient.test.ts`（11 例）+ 示例页 `examples/theme/gradient.html` |
| 2026-09-11 | 布局响应式重排（子项改尺寸触发） | ✅ 已做（一帧合并、布局期间不自激）。回归：`tests/layout/layout-responsive.test.ts`（5 例）；反证 3 例转红 |
| 2026-09-11 | 修改键透传 + `Shift` 等比缩放 / 旋转吸附 15° | ✅ 已做。回归：`tests/event/DOMEventDispatcher.input.test.ts`（修饰键透传）+ `tests/control-panel/transform-constraints.test.ts`（约束算法）+ `e2e/visual/interaction.spec.ts` 两条真实按键用例 |
| 2026-09-11 | 指针捕获（拖出画布不丢事件） | ✅ 已做（`pointerdown` 捕获 / `pointerup`、`pointercancel` 释放，异常吞掉不影响派发）。回归：dispatcher 输入测试 +2 例 |
| 2026-09-11 | 公共几何 API（`GeoUtil`） | ✅ 已做（5 个函数，图元改为消费公共实现）。回归：`tests/geometry/geo-util-extras.test.ts`（16 例），原有命中测试全绿 |
| 2026-09-11 | 依赖合规与打包契约：第三方版权声明 + 删 `external` 死代码 + 更正「运行时仅 gl-matrix」的说法 | ✅ 已做（`dist/THIRD-PARTY-NOTICES.txt`；README 与 08 文档改为「零运行时依赖（内联）」） |

| 2026-09-11 | **补测基准，发现并修掉一次自引入的每帧 ~15% 开销回归**（`isEffectivelyVisible` 每帧 3~4 次 × 多层父链遍历） | ✅ 已做：改成可见性「代际缓存」（`bumpVisibilityEpoch`）。对照复测 新 2.18~2.26ms vs 旧 2.19~2.38ms（区间重叠）。**教训**：碰热路径的改动必须做同时刻新旧对照（load 4~5 下单次读数有 ±10% 噪声），已写进 AGENTS.md 的「性能相关铁律」 |
| 2026-09-11 | 顺带修掉两个同源缺口：隐藏「分组」不失效后代可见性缓存 / 分组改尺寸不请求父容器重排 | ✅ 已做（抽 `setState` 前/后置钩子 `__beforeStateMerge`/`__afterStateMerge`，自身与 `ICEGroup` 都成对调用）。后者是上一轮「布局响应式」遗留漏洞 |
| 2026-09-11 | **基准脚本与文档数字的可复现性**：`npm run bench` 因产物改名长期跑不起来、README 的「5000 图元 0.8ms」实测 2.2ms | ✅ 已做：修路径 + `tests/tooling/bench-smoke.test.ts` 门禁（反证：改回坏路径即转红）+ CI 加 bench 步骤 + 文档改为「用 `npm run bench 5000` 复现并标注机器/日期」+ 新增 `npm run verify` 一条命令跑全部门禁 |
| 2026-09-11 | 富场景局部重绘：放开「仅位置变化」的变脏 risky 组件 | ✅ 已做（内容变了仍一律回退；非文本平移放行；文本平移需命中离屏缓存）。回归：门控契约单测 9 例 + 像素场景 11 个全部 10/10 一致 + 新增 `?opaque=1&grouptext=1` 断言 `perStep[3] > 0`。**仍未解**：干净不可缓存的连线（见下条） |
| 2026-09-11 | 应用层实测钉出局部重绘的真实瓶颈：**干净、不可缓存的 `ICEPolyLine`（关系连线）与脏区相交** | ⏳ **待产品决策**（`ice-entity-designer` 里仍 100% 回退）：① 缓存连线位图；② 接受 clip 边缘 AA 接缝（放弃「full/partial 逐像素一致」不变量）。已排除的猜测：文本缓存命中率 100%、工具层不阻塞。详见 [04](04-rendering-performance.md) 与 [09 路线图](09-roadmap.md) 的「仍未做」 |

> **说明**：上表只记录「决定要做的项」的进展。因此**表内全绿 ≠ 报告里的缺口全部清零** ——
> 仍未建的项（空间索引、SVG/PDF 导出与互操作、动画帧对 risky 图元的局部重绘）见 §1 速览与
> [09 路线图](09-roadmap.md) 的「仍未做」表；明确划归应用层的项（框选交互、多指手势）见 §5 边界。
> `§1 结论速览` 是**滚动更新**的双列表（左三列是评估当天判断，最后一列是当前状态），不再当快照用。
