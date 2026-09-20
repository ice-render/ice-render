# AGENTS.md — ice-render

## 项目定位

Canvas 2D 交互图形渲染引擎（MIT，作者 大漠穷秋）。运行时依赖仅 `gl-matrix`（`lodash` 已用 `src/util/lang.ts` 自研工具替代）。
本文件是仓库级共享约定，agent 与人类协作者都应遵循。

> **目标运行时（2026-09-20 收敛）**：**现代浏览器 + Node/headless**。**小程序支持已整体移除** ——
> 不要再加 `wx.*` 适配、不要再为"没有原生 `Path2D` 也要能画"添加命令重放、也不要恢复
> 「小程序形状运行时」夹具（`tests/mini-program/` 已删）。可以假定 `Path2D` / DOM / PointerEvent 可用；
> 但 **Node/headless 仍须能跑**（SVG 导出走 `Path2DRecorder` 的命令流、无 rAF 时定时器兜底、
> `ICE.init(ctx)` 入口）—— 这是两条互不冲突的要求，别把"去小程序"顺手做成"去 headless"。
> **2026-09-20 补**：**Web Worker 也是一等宿主** —— `cross-platform/root.ts` 一律取 `globalThis`
> （window / self / global 同一个入口），`createOffscreenCanvas` 在没有 DOM 时走 `OffscreenCanvas`。
> 别再把取根写回 `window → global` 双探测：worker 里两者都不存在，引擎会取到空对象、连 `Path2D` 都看不见
> （症状是「帧照传、耗时正常、画面全空」）。回归 `e2e/visual/worker-perf.spec.ts`。

**现代 Canvas 能力铁律（2026-09-20 确立）**：规范里较新的成员可以**优先用**，但每一条都必须
①**带兜底**（headless 的 canvas 实现与浏览器跟进节奏不一）、②**有真机像素回归**、③**在
`docs/architecture/08-compatibility.md` 的账目表里有位置**。已采用：`Path2D.roundRect`（圆角矩形，
无原生时展开成等价 `arcTo`）、`ctx.filter`（写在 `style.filter`，画布可用、SVG 导出留白）、
`createConicGradient`、`ctx.letterSpacing` 一族。**两条硬约束**：命令流新增命令必须同步
`SvgExporter.commandsToPathData()`（否则静默画错，且对读 `_commands` 的第三方是破坏性变更）；
**滤镜的长度参数是设备像素、不随视图缩放**（`stroke`/`shadowBlur` 相反），凡按它扩边
（位图 / 脏矩形）都要除以渲染视口缩放，否则缩略视图下切掉滤镜尾巴。

**Worker 镜像协议铁律（2026-09-20 确立，阶段二第一块）**：主线程持有组件树与状态（唯一真相，
命中检测也在主线程），worker 只有一棵**镜像树**且只负责渲染。改这块时守四条：
① **状态推过去、不回传** —— worker 回给主线程的只有像素与统计，永远不要让它回传组件状态
（一旦双向就有冲突解决，v1 的简单性立刻没了）；
② **消息发出前必须过 `sanitizeTransferable()`** —— 函数 / DOM 节点 / `CanvasGradient` 这类值
结构化克隆带不走，`postMessage` 会抛 `DataCloneError` 让**整帧消息发不出去**（症状是"画面卡住不动"，
不是报错闪退）。过不去的值就地丢弃 + 记路径（`bridge.dropped`），别静默也别炸；
③ **采集点只有四处**（`ICEComponent.setState`、`ICE.addChild/removeChild`、`ICEGroup.addChild/removeChild`），
统一走 `src/worker/mirror-hooks.ts`；**别用包裹 `setState` 的方式采集** —— 动画写值通道走的也是
`setState`，包裹会漏掉动画，而那正是"镜像跟着动"的主路径；
④ **v1 的边界写进协议头注释**：状态增量、结构全量。要加子树增量之前先想清楚"id 对不上时怎么办"
（现在的答案是 `missing` → 主线程重发全量，限流 500ms）。回归：`tests/worker/`、
`e2e/visual/worker-mirror.spec.ts`。
⑤ **输入永远不跨线程**：DOM 事件、命中检测、拖拽、控制面板交互都在主线程。代价是主线程必须继续跑
渲染管线 —— 命中检测读的是**渲染期的世界盒快照**（`CanvasRenderer.getWorldBox` → `__snap`），
不跑管线就"从未渲染过的组件命中不到"。但主线程不必产出像素：`ICE.setPaintTarget(几何通道)`
把落墨换成"吞掉绘制调用、只留 `measureText`/`create*Gradient`"的桩（参考 `MirrorHost` 的
`createGeometryOnlyContext`），并关掉主线程的离屏位图缓存。
⑥ **工具层不镜像状态、不镜像结构**，只镜像**「面板显示给谁」**：控制面板/手柄由
`ICEControlPanelManager` 按目标自己造、两边 id 不同，主线程手柄的 `setState({display:false})`
发过去就是一堆未知 id（`missing` 风暴）。统一走 `ICEControlPanelManager.applySelection()` ——
顺带覆盖"点空白处只隐藏面板、不清空选中列表"这条语义（镜像选中列表会留下半个状态）。

## 引擎架构铁律（改动前必读）

- 运行时链路：`FrameManager`（全局单例，包装 rAF）→ `EventBus`（每 ICE 实例一条）→ 各 Manager 订阅 → `CanvasRenderer`。
- `ICE.init()` 中 Manager 启动有严格顺序：`EventBus` 最先；`linkSlotManager` 必须在 `renderer` 之后（它监听 renderer 事件）。
- 渲染策略：脏标记（`ICE.dirty` / 组件 `dirty`）+ 默认**脏矩形局部重绘**（`renderMode: 'dirty-rect'`，条件不满足时回退全量 `doRenderFull()`）；详见下方「脏矩形局部重绘铁律」。渲染队列（`componentQueue`/`toolsQueue`）带缓存：仅在结构变更（`addChild`/`removeChild` 等）时由 `CanvasRenderer.markQueueDirty()` 触发重建，**重建 = `flattenTree`（树序 + 兄弟按 zIndex，见「渲染顺序铁律」），不再全局排序**；稳态帧仅做 O(n) 的 `zIndex` 稳定性比对，树结构不变则复用队列，不重复递归展平。`zIndex` 变化会重建队列但**保留上屏快照**（成员没变 → 局部重绘仍然成立）。
- 组件模型：`props`（构造入参，`merge`）与 `state`（`cloneDeep(props)`，动画改 state）分离，概念借鉴 React；`merge`/`cloneDeep` 见 `src/util/lang.ts`。
- 类继承：`ICEEventTarget → ICEComponent(abstract) → ICEPath(abstract) → ICEDotPath(abstract) → 图元`；`ICEGroup extends ICERect`；`ICEControlPanel extends ICEGroup`；`ICELinkSlot/ICELinkHook/RotateControl extends ICECircle`；`ICEBezier extends ICEPolyLine`（复用 `curveType` 曲线绘制）。
- 变换基于 `gl-matrix` 的 `mat2d`，自带 `gl-matrix-skew.ts` 补 skew（gl-matrix 原生不支持）。
- **嵌套坐标系矩阵组合铁律（2026-09-08 修复重大 bug 后确立）**：组件的 `composedMatrix = T(absoluteOrigin) · absoluteLinearMatrix`，其中 `absoluteLinearMatrix = 祖先① · 祖先② · … · 自身线性矩阵`（列向量约定，越靠近根越外层）。`calcAbsoluteLinearMatrix()` 与 `composeMatrix()` 必须**实时重新计算每一层祖先的线性矩阵 / composedMatrix**，严禁读取祖先缓存的 `state.linearMatrix` / `state.composedMatrix` / `state.absoluteLinearMatrix`（这些默认是空数组 `[]`，且可能是上一帧脏值，是嵌套坐标算错的根因）。`moveGlobalPosition/setGlobalPosition/setGlobalRotate` 同样必须调 `parentNode.calcAbsoluteLinearMatrix()` 取新鲜值。回归用例见 `tests/graphic/ICEComponent.nested-coordinate.test.ts`。
- **变换手柄坐标铁律（2026-09-08 修复手柄脱离图元 bug 后确立）**：`TransformControlPanel.resizeEvtHandler`、`ResizeControl.moveGlobalPosition/resizeEvtHandler`、`RotateControl.rotateEvtHandler` 在把全局位移换算到本地时，必须调用 `calcAbsoluteLinearMatrix()` / `calcAbsoluteOrigin()` **实时重算**，严禁读取 `state.absoluteLinearMatrix` / `state.absoluteOrigin` 缓存（这些值在两次渲染之间会过期，连续拖动/缩放/旋转会导致手柄脱离宿主组件）。此外，**面板的 `left/top/width/height` 必须始终从目标组件重新推导**：`resizeEvtHandler`/`rotateEvtHandler` 改变目标后必须调用 `updatePanel()` 重新同步（面板宽高是目标旋转后包围盒的尺寸，随旋转变化，不能独立计算）。回归用例见 `tests/control-panel/transform-control.test.ts`。
- **变换手柄象限唯一性铁律（2026-09-08 修复手柄消失后确立）**：`toggleControlQuadrant(control, oldQuadrant, newQuadrant)` 必须把「原占据 newQuadrant 的手柄」顶替到 `oldQuadrant`（即 old↔new 互换），严禁用固定的「对角映射」(1↔3/2↔4)。此前当手柄跨到**相邻**象限（如 1→2）时会产出重复象限、两个手柄重叠、看起来消失一个。8 个 resize 手柄的象限必须始终保持唯一（`Set(quadrants).size === 8`）。回归用例见 `tests/control-panel/transform-control.test.ts` 与 `e2e/visual/interaction.spec.ts`。
- **命中检测铁律（2026-09-08 修复 N 层嵌套下点不中子组件后确立）**：`DOMEventDispatcher.findTargetComponent()` 必须跳过 `isControlPanel` 的控制面板本体（它是覆盖在目标上的工具层、zIndex 最高），否则面板会遮挡被选组件及其子组件，导致嵌套场景下点不中子组件。面板的子手柄（`ResizeControl`/`RotateControl`）不是 `isControlPanel`，仍需参与命中以保证缩放/旋转可用。回归用例见 `tests/event/DOMEventDispatcher.test.ts`。（2026-09-14 补：命中扫描的 z 序**必须与渲染队列同源**。`hitTestComponents` 改为走 `renderer.getOrderedQueues()`，复用那份「只在结构 / zIndex 变化时才重建」的队列并**倒序**扫描，不再每次命中都 `flattenAllComponents()` + `sort()` —— 实测 1 万组件下 0.8ms → 0.3ms/次，且不再每次命中分配一个上万元素数组（hover 类交互按 mousemove 调，GC 也省一份）。**两条路径必须给出同一结果**：没有渲染器（headless 建树 / 未 init）时才回退到旧的展平+排序，语义逐条对齐；回归用例 `tests/renderer/hit-test-ordered.test.ts` 用一个**独立预言机**（不做世界盒预筛、不复用队列）逐点比对 9800 个点，并带防空转护栏。另注意：**从未渲染过的组件没有合成矩阵 → 命中不到它**，这是既有语义、两条路径一致，别把它当 bug 修。）
- **事件系统铁律（2026-09-19 事件语义改版）**：① **`ICEEvent` 的 W3C 方法必须是真实现**（`preventDefault` / `stopPropagation` / `stopImmediatePropagation` / `composedPath` / `initEvent`）——旧实现全是 `throw new Error('Method not implemented.')`，应用一调用就把派发链打断（异常从监听器冒出去，后面的监听器与总线都收不到），下游被迫写了绕过代码；**别再把它们改回桩**。② **事件沿组件树冒泡**：命中组件（`AT_TARGET=2`）→ 各级父容器（`BUBBLING_PHASE=3`）→ 总线最后收一次；`evt.target` 恒为命中组件，`currentTarget` 随节点走。③ **`stopPropagation()` 只挡祖先，总线一定收到一次**：总线是引擎内部通道（控制面板选中 / 连线插槽 / 悬停 / 键盘作用域），让组件里的一次 `stopPropagation()` 掐掉它 = "看着只挡冒泡，实际引擎失灵"。④ **同一个 `ICEEvent` 一路传到底，不再层层包**：包一层会让上一个监听器打的标记落在副本上（冒泡/取消永不生效）、`param` 被覆盖成 `{}`。⑤ **构造函数平铺字段时不覆盖本类方法**（`NON_COPYABLE_KEYS`）：普通对象做的事件桩上 `preventDefault` 是**可枚举 own 属性**，拷进来就盖掉真实现（真实 DOM 事件的方法是原型上不可枚举的，所以旧实现没暴露这个坑）。⑥ **两套 API 是同一个实现、两种参数形状**（`on/off/once/suspend/resume/purgeEvents` 与 `addEventListener/removeEventListener/dispatchEvent` 共用 `__register` / `__remove`）——**谁也别在别处再写第二份注册逻辑**。`on` 第三参是 `scope`、第四参才是 `options`；`addEventListener` 第三参是 `options`/`capture` 布尔、没有 scope。`off` 按 `(fn, scope)` 精确匹配，`removeEventListener` **忽略 scope**（身份 = `(type, listener, capture)`）；`dispatchEvent` 按 W3C 返回 `!defaultPrevented`。`options` 支持 `{ once, passive, capture, signal }`：`passive` 里 `preventDefault()` 不生效（按事件名提醒一次）、`capture` 只作注册身份（无捕获阶段）、`signal` abort 自动摘除。`once` 是**监听记录上的标记**（不再是「自摘包装函数」），所以 `off/hasListener/removeEventListener` 用同一个身份匹配。`on/once/off/suspend/resume/purgeEvents` 一律返回 `this`，`off(name)`（不传回调）清空该事件的全部监听；引擎自造事件的 `timeStamp` 用**单调时钟**（`performance.now()` 时间原点）。⑦ **转发事件必须改写 `evt.target`**（转给谁就把 `target` 设成谁）：`ICEComponent` 的默认拖动/键盘处理带 `evt.target === this` 守卫，转发时不改 `target` 会被当成「冒泡上来的祖先事件」丢掉（例：`TransformControlPanel.keyboardEvtHandler`，回归在 `tests/control-panel/transform-control.test.ts`）。⑧ **容器的 click 处理只想认「点在自己身上」就用 `evt.target === this` 守卫**（冒泡之后子节点点击也会到容器）——这条在**新旧引擎上都成立**，是跨版本安全写法；`stopPropagation()` 只在新引擎生效（旧版会抛异常）。回归：`tests/event/bubbling-and-w3c.test.ts`（16 条）+ `tests/event/api-consistency.test.ts`（9 条）。
⑨ **事件名有类型**：`ICE_EVENT_NAME_CONSTS` 是 `as const`，`on/once/trigger` 对引擎名与 DOM 语义名给出强类型 （`ICEEventOf<K>` / `ICEEventParamMap`），自定义事件名回退 `any`；新增 **`tsconfig.typecheck.json`** 把 `tests/types` 纳入类型检查 （原 `tsconfig.json` 只 include `src`，那些类型断言本来是死的）——`npm run types:check` 跑两份，断言退化就红。- **输入矩形每帧重读铁律（2026-09-12 修复悬停整体错位后确立）**：`DOMEventDispatcher.__resolveCanvasRect`
  对**移动类事件**必须走 `ICE.refreshInputRect()`（只重读一次 `getBoundingClientRect()`；
  尺寸没变时平移已缓存的内容盒、不读 computedStyle），**不得缓存 rect，也不得做「一帧一次」的节流**。
  原因：页面滚动、画布**上方插入内容**（提示条 / 错误信息 / 广告位）都会让缓存整体过期，
  而移动事件是唯一高频入口 —— 不刷新就没人来纠正它，过期期间 `clientX - rect.left` 恒定偏移，
  命中检测 / 悬停 / 拖拽全部错位，直到用户点一下或滚一格（ice-chart 的示例页真实撞到过：
  图表创建后插入状态行把画布下推 26px，悬停直接落空）。实测一次 rect 读 **0.22µs**
  （每次读之前改样式、强制重排的最坏情况 **2.8µs**），相对每帧渲染可忽略。
  另一个坑：**做位移增量必须用「值快照」，不能拿上一次的 rect 对象引用做差** ——
  某些运行时（测试桩 / 小程序）返回同一个可变对象，增量恒为 0，内容盒再也不跟着走。
  回归用例见 `tests/ICE.input-rect.test.ts`、`tests/event/DOMEventDispatcher.input.test.ts`、
  `e2e/visual/input-rect-shift.spec.ts`。
- **事件来源契约铁律（2026-09-19 补，与事件系统铁律配套）**：`ICEEvent` 上 **`source` / `target` / `eventPhase` 是"引擎的派发结果"，不是事件源的属性** —— 三条都不能被传入对象的字段平铺覆盖（`NON_COPYABLE_FIELDS`）：
  ① **`evt.source`**：`'canvas'`（画布内的原始输入）/ `'window'`（画布外的原始输入 —— 原始输入监听挂在 window 上，工具栏按钮 / 页面空白也会到总线）/ `'engine'`（`trigger()` / `dispatchEvent()`）；
  ② **`evt.target` 要么是命中的组件、要么是 `null`，永远不是 DOM 元素**（DOM 元素在 `evt.originalEvent.target`）——以前从 DOM 事件平铺进来，应用只能靠 `instanceof` 猜；应用过滤画布外输入用 `evt.source !== 'canvas'`；
  ③ **总线那一段 `eventPhase` 恒为 `0`**（总线是传播终点）：没有命中组件的事件走不到组件链，必须在 `__dispatch` 里显式归零，否则会沿用 DOM 的 `BUBBLING_PHASE(3)`，同一个字段出现两种含义。
  回归：`tests/event/event-source.test.ts`（8 条，含"画布外输入仍会命中"这条已知行为的钉桩）。⚠️ 已知未改项：画布外输入**仍然做命中测试**（坐标按画布矩形换算，可能落到画布内并命中组件）——要改成"不做命中"需单独评估（会牵动键盘转发与 HTML 浮层）。
- **按需派发铁律（2026-09-20 补，性能向）**：`DOMEventDispatcher.__dispatch` 在入口问一句"这个事件名有人听吗"（`src/event/listened-event-names.ts` 的**单向登记表**，由 `ICEEventTarget.__register` 写入），没人听就**整段早退**。背景：一次原生指针输入派发两个名字（原生名 `pointermove` + 兼容名 `mousemove`），而引擎默认处理器挂在鼠标名上、应用只用其中一套 —— 没人听的那一次要白跑「祖先链数组 + 每层 `trigger` + 总线触发」；实测一次完整派发 **9.75 µs / 5.9 KB 分配**，早退 **3.3 ns**，典型 `ICE_POINTERMOVE` 全链路因此从 ~22 µs 降到 ~12 µs（指针移动是每帧级高频）。⚠️ **登记表只增不减是刻意的**：摘除路径有 `off`/`purgeEvents`/`once` 自摘/`signal.abort` 四条，漏一条就是"有人听却不派发"的正确性事故，而"多一次空派发"只是幂等白跑；**别为了"精确"去补摘除逻辑**。⚠️ 用"假组件 + `trigger` mock"的夹具/测试不走 `__register`，必须显式 `markEventNameListened(name)`。基准：`bench/micro/event-dispatch.bench.mjs`；回归：`tests/event/dispatch-on-demand.test.ts`。
- **外观入口铁律（2026-09-14 确立）**：**外观一律写进 `style`**（子元素用 `style.label` 这类嵌套，
  不要新开 `xxxStyle` 容器）；它才走"绘制那一刻解析"，才能引用主题 token、被 `props.states` 覆盖。
  **顶层 props 只放两类东西**：① 动画要写的 key（引擎按顶层 `state[key]` 写值，如 `lineDashOffset`），
  ② 几何 / 缓存签名参数（`ObjectCache` 的内容签名与脏矩形外扩量直接读它们，如 `lineDash` / `lineBorder*`）。
  往这两类里加字段要同步改动画写值通道与缓存签名；**颜色类的 props 必须支持主题引用**
  （读值处过 `resolveThemeValue`）。历史上唯一的违规项 `labelStyle` 已归并到 `style.label`。
- **主题桥铁律（2026-09-14 确立）**：引擎只提供主题**机制**，词汇表归应用层（同 i18n 边界）。
  应用接入时：① 应用的 token 是权威，桥**单向**（应用 → 引擎的 `setTheme` / `setChrome`），
  引擎**永不反向读**应用词汇；② 桥只映射「引擎自己画的那部分」（基础语义色 + `chrome`），
  不要 1:1 复制应用词汇（两边需求不重叠，复制只会让引擎变垃圾桶）；③ 每个应用一条桥、放在应用仓、
  带单测；④ **不要在应用里再实现一套主题解析**（优先级链 / 作用域 / 状态样式 / 序列化是引擎的职责）；
  ⑤ DSL 里能否用 `"$token"` 取决于**谁在画**：引擎绘制的图元能解析，应用自绘的颜色（如图表系列）
  只能用字面量，换主题走它自己的主题字段；⑥ 品牌基线（设计语言）是产品决策，别靠合并 token 词汇解决。
- **类型注册 / 序列化铁律（2026-09-13 命名空间化确立）**：类型标识（typeId）统一为 **`namespace:Type`**，且**只有这一种形式**（正则 `/^[a-z][a-z0-9-]*:[A-Za-z_][A-Za-z0-9_-]*$/`，工具函数 `src/util/type-id.ts`）。引擎内置用 `ice-render:*`，实体设计器 `ice-entity-designer:*`，图表 `ice-chart:*`，第三方用自己的小写包名。约定：① 内置类型在 `ICE` 构造函数里经 `registerType()` 注册（`src/consts/COMPONENT_TYPE_MAPPING.ts` 只提供条目表），**不再**在 `init()` 里拷贝映射；② `registerType(typeId, Ctor)` —— 同一 typeId 注册**不同**构造函数、或同一构造函数注册**第二个** typeId，都**明确抛错**（后者会让 `getTypeId` 反查歧义）；同一 typeId + 同一构造函数视为幂等；③ **不做旧名兼容**：家族仍在发布初期，不为无 namespace 的历史类名维护别名表——旧格式数据里的节点按「未注册类型」处理；④ `typeMapping` 是**无原型对象**，`getType('constructor')` 不会命中 `Object.prototype`；⑤ 序列化由 `ice.getTypeId(ctor)` **反查**（与类的 JS 名解耦，压缩改名不破坏已存数据），未注册类型才回退 `constructor.name`，此时 `Serializer.unregisteredTypes` 会记录并告警（回退名可能被下游 mangle，读不回来）；反序列化遇到未注册类型跳过该节点（含子树）并记入 `deserializer.unknownTypes`，不再整份数据打不开。格式带 `version` 与 `SERIALIZATION_MIGRATIONS`。回归用例见 `tests/persistence/type-id.test.ts`、`tests/persistence/type-registry.test.ts`。
- **渲染顺序铁律（2026-09-17 确立，v2.13.0）**：绘制顺序 = **树序（先父后子）+ 兄弟按 `state.zIndex` 升序**（相等保持加入顺序），**工具层整体画在组件层之上**（`componentQueue` → `toolsQueue`，两层不按 zIndex 交叉）。`zIndex` **只在兄弟之间**比较，不再是全局序列。旧实现"展平后全局排序"下，**父容器的 zIndex 只要比子组件大**就会反超并**盖住自己的整棵子树**（一片空白、不报错；`ice-web-components` 的 `ICEPanel` 是典型受害者）。三处同源，改一处必须改三处：`util/data-util.ts` 的 `flattenTree`（展平/命中回退）、`CanvasRenderer.__rebuildQueue`（不 global sort）、`SvgExporter`（导出顺序）；取数口径也只有一个：`util/data-util.ts` 的 `zIndexOf`。回归：`tests/renderer/render-order.test.ts`、`tests/renderer/hit-test-ordered.test.ts`（逐点预言机）、`e2e/visual/render-order.spec.ts`（真机像素）。
- **容器的派生部件先于内容 + 重排只作用于真实子节点（2026-09-19 补，与"渲染顺序铁律"同源）**：复合组件（`hasDerivedChildren() === true`）把"自己的底 / 标题 / 角标"也挂在 `childNodes` 里（形状由子组件绘制，菱形 / 事件圆 / 圆角框都靠它），`getSerializableChildren()` 声明的才是**真实子节点**。两条口径都落在 `util/data-util.ts`，**渲染与导出必须同源**（`flattenTree` / `SvgExporter.collectOrdered`；命中检测复用渲染队列，自动同源）：
  ① **`paintOrderChildrenOf(container)`：先派生部件、再真实子节点**（两组内各自按 zIndex 升序）—— 就是 CSS 的背景语义，容器的底永远画在内容之下。不这么做，底的 `zIndex` 一旦排在内容之后（默认 `'auto'` 就很容易）就会**把整段内容盖成一片底色**（2026-09 两个真实事故：BPMN 池里的任务矩形全部消失、状态机复合状态变成空框）；应用侧只能靠"给底写个更低的魔数"绕，而多低才算够低它自己也不知道。
  ② **`siblingScopeOf(container)`：四个 z 序 API（`bringToFront` / `sendToBack` / `moveUp` / `moveDown`）的作用域 = 真实子节点** —— 派生部件不是文档内容，被重编号会把容器内容盖掉，而且组件重建即复位，纯噪声。
  ⚠️ 递归展平时**不能**把 `paintOrderChildrenOf` 的产物再按 zIndex 洗一遍（`flattenTree` 因此拆出 `flattenOrdered`）：分组次序不是 zIndex 升序，洗一次就静默失效。没有 `getSerializableChildren()` 的组件**行为逐字不变**。回归：`tests/renderer/derived-children-paint-order.test.ts`（单元口径）+ `e2e/visual/render-order.spec.ts`（真机像素：三层嵌套下"底 zIndex 更大也先画"，配套 `examples/render-order/tree-order.html`）。
- **zIndex 是"0 = auto 层"的 CSS 口径（2026-09-19 改版，**默认值语义变了**）**：
  ① **默认 `zIndex` 是 `'auto'` 哨兵（`Z_INDEX_AUTO`），排序时当 `0` 用** —— 就是 CSS 的
    `z-index: auto` 那一档。同层没显式写过 zIndex 的兄弟
    彼此相等，次序退化为**加入顺序** —— 后加入的默认画在最上面。**"构造顺序计数器"（`instanceCounter`）
    已删除**：它的两个毒副作用（跨会话倒挂：打开元件多的文档后新建画到下面；"写死 `zIndex: 90`
    表示在最上层"不可靠：默认值跨实例还在涨）从根上消失，别再把它们修回来。
  ② **显式写的值是钉子，一视同仁地参与比较**（与 CSS 同义）：`-n` 压到 auto 层**之下**（背景），
    `+n` 抬到 auto 层**之上**（浮层）。⚠️ 正数钉住的兄弟会盖住**之后新加入**的 auto 组件 ——
    这是 CSS 口径（别再当 bug 修）；要"永远在最上"用工具层（`ice.addTool`）。
  ③ **四个 z 序 API 只在同一父容器内生效**：`bringToFront()` / `sendToBack()` / `moveUp()` /
    `moveDown()`（返回 `this` 可链式）。作用域 = 同层的**可排层**（排序键 ≤ 0：`'auto'` 与负值），
    重编号成 **`-(m-1) … 'auto'`（最上 = auto 层）**，不是"自己加一减一" ——
    平手时加减一挪不动。**auto 那一档留给最上层**是为了让"置顶之后新加入的组件仍然画在最上面"。
    口径唯一出处 `zIndexForPaintRank`。
    ⚠️ **父容器声明了 `getSerializableChildren()` 时，作用域再收窄到"真实子节点"**
    （`siblingScopeOf`）：容器的底 / 标题 / 角标是派生部件，不是文档内容，被重编号会把容器内容盖掉。
    ⚠️ **应用自己钉成正数的兄弟不参与、值也不会被改写**（浮层 / 水印 / 吸顶条永远是应用自己那一档）——
    2026-09-19 收紧：旧实现"整层重编号"会把钉子一起洗掉（置顶一次，浮层就掉下去了）。
    目标自己被钉住时退化处理：`bringToFront` → `max+1`；`sendToBack` → `min-1`；
    `moveUp/moveDown` → 只在正数钉子之间交换数值。
    `childNodes` 数组本身**保持加入顺序**，断言次序要看**绘制次序**，不要看数组。
  ④ **存盘：默认值（`'auto'`，等价于 0）不写、显式值原样写**（`Serializer.__encodeChildren`）。旧的"归一化成
    `0..n-1`"随计数器一起废掉 —— 它会把应用刻意钉的浮层值改写掉；现在文档里写的就是次序本身。
    读旧数据不受影响（`zIndex` 本来就是可选字段）。
    ⚠️ **但旧文档必须走 v1 → v2 迁移**（`SERIALIZATION_VERSION = 2` + `SERIALIZATION_MIGRATIONS`）：
    v1 的数字与 v2 的数字含义不同，不迁移就会出现"打开旧文档后新建的组件沉到最下面"（实测复现）。
    迁移按兄弟组把次序重编码成 `-(m-1) … 'auto'`，次序逐项不变；详见
    [06 序列化](docs/architecture/06-serialization.md)。改数据格式就照这个机制加一条迁移。
  ⑤ **工具层的 1e7 只是它自己的编号**（`consts/BIG_ZINDEX_NUMBER`）：工具层是**另一条队列**，
    永远整体画在组件层之上 —— 组件层写再大的 `zIndex` 也压不住工具层，两层之间没有数字比较。
    （不再是"组件层别用的保留号段"：没有计数器要保护了。）
  ⑥ **队列缓存不许因此退化**：`zIndex` **数值**变了但**次序**没变（批量重写成同一组值、
    动画缓动没跨过邻居）时**不重建队列**，只刷新快照 —— 判据是"每个父容器内是否仍按 zIndex
    非降序"（`CanvasRenderer.__zOrderStillSorted`：快照与判序都走 `zIndexOf` 归一化，只比相邻同组节点，O(n) 无分配）。
    次序真变了才整队重建（保留上屏快照）。这条别改回"发现 zIndex 变了就重建"。
  回归：`tests/graphic/z-index-order.test.ts`（默认 0 / 加入顺序 / 跨会话倒挂 / 正负钉子 /
  平手重编号 / 置顶后新建仍最上 / 存盘往返）+ `tests/renderer/CanvasRenderer.queue.test.ts`
  （数值变次序不变不重建 / 跨邻居重建 / 嵌套容器 / 两层队列互不影响）。
  ⑦ **改动 `zIndex` 要走 `setState({ zIndex })`（或配 `requestRepaint()`）**：渲染器只有在
    `ice.dirty` 为真时才跑队列检查（`CanvasRenderer.frameEvtHandler` 的守卫）。直接写
    `component.state.zIndex = x` **不会置脏** —— 检测本身可靠（下一次有脏帧就会按新值重排），
    但"这一刻没有别的待重绘"时画面不会自己刷新。家族里的 `raiseSubtree` 是"顺手也改了 left/top"
    才没暴露这个坑，别照抄。
- **主题写入契约（2026-09-17 确立，v2.14.0）**：一个 `ICE` 实例上的主题分**两层**，谁写哪层是定死的 ——
  ① **基座**：`ice.setTheme(...)` / `ice.setChrome(...)`（UI 主题、应用主题走这条）；
  ② **命名补丁**：`ice.setThemePatch(id, patch)` / `ice.clearThemePatch(id)`（**领域库**走这条：图表调色板、设计器外壳），
  `id` 约定用库名（`'ice-chart'` / `'ice-designer'`），同 id 再注册即替换。
  合成顺序 = `基座 → 命名补丁（按注册顺序）`，每次只重算一次并广播该实例。**优先级因此是定死的**：
  `setTheme` / `setChrome` 在**最底层**，命名补丁在它之上 —— 所以**应用要覆盖领域库的 token，
  得用自己的补丁**（`setThemePatch('host', …)`，注册在领域库之后），**写基座压不住补丁**；
  要整个撤掉某库的外壳用 `clearThemePatch(id)`。这条契约解决的是历史上最坑的一类不一致：
  两边都直接改实例主题 → **后写的赢** —— 换 UI 主题会把图表主题抹掉、换图表主题会把 UI 主题抹掉，成败取决于调用顺序
  （`ice-agent-console` 的 `view/diagram-layer.ts` 注释里记过这个坑）。**领域库不要再调 `setTheme` / `setChrome`**；
  应用也不要调 `setThemePatch`（那是库的活）。补丁**不进快照**（它是库装载时重新注册的运行时约定）。回归：`tests/theme/theme-patch.test.ts`。
- **位图缓存 × 全局状态的铁律（2026-09-17 确立，v2.14.1）**：引擎里有**三份"画出来是什么"的缓存** ——
  ① 组件级离屏缓存 `ObjectCache`（文本/连线/点集/半透明，静态命中路径只判 `!component.dirty && cache && 视口一致`）；
  ② 静态层位图 `CanvasRenderer.__layer`（**整段**位图，成员集合/渲染视口/队列结构三者之一变了才重建）；
  ③ 上屏快照 `__snap`（停用，供局部重绘算脏区）。
  **任何改变"画出来是什么"的全局状态，都必须显式声明它作废哪几份缓存** —— 第一例就是换主题：
  主题引用是 paint 时解析的，而 `__reapplyPreset()` 只对「用了 preset / 没写 style」的组件 `setState`，
  **写了引用但没用 preset** 的组件不会被置脏，于是第 ① ② 份缓存会把**烤着旧主题颜色**的位图原样贴回来
  （表现：热切换后文本停在旧色，浅色主题的深字压深底上；`?theme=` 刷新路径正常，因为整棵树重建了）。
  修法：`ICE.__recomposeTheme()`（四条主题入口的汇合点）里调 `renderer.invalidateObjectCache()`
  （它同时丢 ① 与 ②）+ `requestRepaint()`（保证有帧）。
  回归：`tests/theme/theme-cache-invalidation.test.ts`（四条入口）、`e2e/visual/theme-cache-pixel.spec.ts`
  （**像素**判据：热切换后的画布必须与"开机即深色"逐像素一致 —— 样式值/画布指纹都看不出这个缺陷）。
- **文本语言也是"画出来是什么"（2026-09-18 补）**：同一个汉字有简/繁/日/韩多套字形，
  Canvas 按元素的 **`lang`** 选字形（2025 年才进 CanvasTextDrawingStyles，Chrome 136+），
  `dir` 影响双向文本排布。**离屏层必须与主画布同语言** —— 静态层位图与组件缓存位图都要走
  `root.createOffscreenCanvas(w, h, sourceEl)`，由它从主画布镜像 `lang` / `dir`
  （不支持的运行时忽略；小程序宿主对象写不进去时静默跳过）。宿主若在主画布上显式写了 `lang`
  而离屏层不跟随，字形就会分叉：只有几个像素的差异，肉眼几乎看不出，却会让"逐像素一致"的
  像素回归在最不该红的时候红。回归：`tests/renderer/offscreen-text-lang.test.ts`。
- **请求重绘用 `ice.requestRepaint()`（v2.14.0）**：在 `setState` 之外改了会影响画面的东西（自绘 painter 读了新数据、
  换视口、字体/图片刚就绪、要作废静态层）时用它，**不要再写 `ice.dirty = true`**（直摸内部字段，无文档无保证）。
  它等价于"置脏 + 标记渲染队列重排"，幂等可链式。回归：`tests/renderer/request-repaint.test.ts`。
- **渲染队列缓存铁律（2026-09-08 性能优化确立）**：任何改变组件树结构的入口——`ICE.addChild/addChildren/removeChild/removeChildren/clearAll/addTool/removeTool`、`ICEGroup.addChild/addChildren/removeChild/removeChildren`——都必须经 `renderer.markQueueDirty()` 通知渲染器重建队列；否则稳态帧会沿用过期队列，导致新增/删除的组件不被渲染或绘制顺序错乱。`zIndex` 变更（经 `setState`）无需手动标记，渲染器在稳态帧通过 O(n) 比对发现后**整队重建**（重建保留上屏快照，见上一条）。仓库内所有结构性入口已挂接该调用。回归用例见 `tests/renderer/CanvasRenderer.queue.test.ts`。
- **多实例 / 分层渲染铁律（2026-09-13 确立）**：① 同一页面可以有多个 `ICE` 实例（`FrameManager` 是全局单例、天然同帧），**分层渲染（静态层 + 动画层）由应用按配方组织**：层数 ≤2~3、静态层只在内容变化时置 `dirty`、动画元素放上层、上层默认 `setInputPassthrough(true)`、两层 `ICE.linkViewport(a, b)` 绑定视口；每层内存 ≈ `宽×高×4B×dpr²`（1600×1000：dpr=1 约 6.4MB、dpr=2 约 25.6MB）。实测 10000 静态元素 + 200 动画标记：单画布 26~34ms/帧 → 分层 0.4~0.6ms（`npm run bench:layers`，动画期间静态层重绘 0 次）。② **事件归属**：全局拦截器把原生输入广播给所有总线，因此"按下/滚轮"事件必须按**目标 canvas** 过滤 —— 目标是**别人的 canvas** → 本实例忽略；否则分层里"上层 pointer-events:none"形同虚设（下层照样被点中）。**移动/抬起事件不得过滤**（无 PointerCapture 的 mouse 回退路径下，拖拽途中指针划过另一张画布会丢事件）。回归见 `tests/ICE.layered-input.test.ts`、`tests/event/DOMEventDispatcher.multi-instance.test.ts`、`e2e/visual/layered.spec.ts`、`examples/animation/layered-canvas.html`。③ **跨层迁移**（拖拽期间把元素提升到动画层）用 `sourceIce.moveComponentTo(component, targetIce, targetParent?)`：保持世界坐标、不销毁、子树递归重绑、动画注册与选中态由目标实例接管；配套 `ice.detachChild()`（摘除不销毁）与 `rebindComponentTree()`（**必须显式重绑**：`ICEGroup` 的 AFTER_ADD 子树同步是 `once`，对「已经挂过」的容器不会再触发 —— 少了这步，搬过去之后后代仍把事件发到旧实例）。分层导出：矢量用 `exportSvg([layerA, layerB], { area: 'viewport' })`（数组序 = 叠加序，content 模式各层共用覆盖全部层的包围盒 → 层间按世界坐标对齐；单层传单个 target 输出不变），位图用 `composeLayersDataURL([layerA, layerB], { background })`（`ice.toDataURL()` 只拿得到自己那一层）。回归见 `tests/export/svg-export.test.ts`、`tests/export/compose-layers.test.ts`、`e2e/visual/layered.spec.ts`。
- **挂载去重性能铁律（2026-09-10 确立）**：`ICE.addChild/addTool`、`ICEGroup.addChild` 的重复检测必须用 `WeakSet`（O(1)），严禁 `childNodes.indexOf()`（O(n)）。批量挂载 N 个组件时 indexOf 累计是 O(n²)，压测中 10 万→100 万构建时间因此被放大到数十倍；改 WeakSet 后 100 万构建从 ~41s 降到 ~6s。删除路径（`removeChild/removeTool`）须同步 `WeakSet.delete`，否则组件删除后无法重新挂载。回归用例见 `tests/ICE.add-child.test.ts`。
- **默认 props/state 原型共享铁律（2026-09-10 确立）**：`ICEComponent` 的默认 props 与 state 都改为 `Object.create(DEFAULT_PROPS)` 原型继承共享默认（`DEFAULT_PROPS` 顶层不冻结、嵌套 `style/transform/lineDash/animations` 冻结）；`id`/`zIndex` 每实例单独生成。`merge` 对「继承的嵌套对象」做写时复制（先 cloneDeep 到 own 再递归合并），严禁原地合并到共享默认对象，否则一个组件改 style 会串味到所有组件。state 是独立对象：用户传入字段深拷贝到 own、运行时派生字段（`linearMatrix/composedMatrix/localOrigin/absoluteOrigin`）预分配 own 空值，因此任何「直接写 state」（含跨组件写 `el.state.interactive` 等）都不会污染 props 或共享默认。**内存数字（2026-09-15 用 `npm run bench:mem` 重测，口径 = node + 每档独立进程 + 造对象前后各两次 gc 的真增量）**：「默认配置」（`props`+`state`）那部分 0.98KB/图元，整个 `ICERect` 2.4KB/图元；同场景「每实例显式传入整份默认表」7.7KB/图元（省约 69%），100 万最小矩形堆增量约 2.3GB（10 万 232MB / 50 万 1156MB）。**旧文档里的 ~2.0GB → ~0.87GB 已作废**：那组数来自浏览器 `performance.memory.usedJSHeapSize`（已用堆**绝对值**、带采样/量化），不是 node 的堆增量，别再引用；另外 `style` 是例外（按主题每实例派生，不在共享默认里）。回归用例见 `tests/graphic/ICEComponent.props-sharing.test.ts` 与 `tests/persistence/serialization.test.ts`；内存门禁见 `npm run bench:mem -- --check`（已纳入 `verify:full`）。
- **视口缩放铁律（2026-09-10 确立，路线 B）**：画布缩放是「视图缩放」而非「图元缩放」，通过 `ICE.viewport = { scale, tx, ty }` 实现（屏幕 = 世界 * scale + translate），默认单位视口不影响既有行为。约束：① `setViewport()` 只改视口状态并 `markQueueDirty()` 回退一次全量，**严禁修改任何组件的 state**；② 组件 `render()` 在主 ctx 应用**渲染视口**（CTM = `getRenderViewport() · composedMatrix`；渲染视口 = 视口 × dpr），`renderTo()`（离屏缓存）把渲染视口编码进**自己的 base 矩阵**；③ 命中检测 `DOMEventDispatcher` 必须先把屏幕坐标 `screenToWorld()` 回世界坐标再 `containsPoint`；④ dirty-rect 的脏区在世界坐标里收集、`clearRect`/`clip` 在**渲染坐标**里，换算只有 `mapBoxToRender()` 一处（视口缩放/平移与 `dpr>1` 都走这条路，**不再回退全量**）；⑤ 离屏缓存的贴图是**整数设备像素落点 + 1:1**（详见「组件级离屏缓存铁律」的保真契约）。回归用例见 `tests/ICE.viewport.test.ts`、`e2e/visual/viewport.spec.ts`、`examples/viewport/viewport-zoom.html`。
- **对齐吸附铁律（2026-09-10 确立）**：`AlignmentGuideManager` 默认禁用，应用层 `ice.alignmentGuide.enable(options)` 显式启用，未启用时零开销、零副作用。约束：① 吸附是「视图交互」层，只监听被拖组件的 `AFTER_MOVE` 修正 `left/top`，并在工具层（toolNodes）画提示线，严禁修改组件其他 state；② **吸附必须 X/Y 两轴分别计算**（`computeSnap` 返回 `{x,y}`，两轴各自取最小 delta），不能只返回单轴，否则「本已对齐的轴」会以 delta=0 抢占另一轴的吸附；③ 阈值是屏幕像素，计算时按 `1/viewport.scale` 换算成世界坐标；④ 提示线是临时组件，拖拽结束必须清除；⑤ 支持边缘/中心/等间距（source 中心位于两目标中心中点），三类均可配置开关。回归用例见 `tests/control-panel/AlignmentGuideManager.test.ts`、`e2e/visual/alignment.spec.ts`、`examples/alignment/alignment-snap.html`。
- **对齐"不跳"铁律（2026-09-15 因 ice-smart-water 工艺图拖动乱跳确立）**：症状是**引导线每步换一条 +
  图元被正负交替地拽**（实测 24 步里 19 步在吸附、相邻步位移变化最大 18 世界 px）。三条根因与对应机制：
  ① **不能每帧重挑"最近候选"** —— `computeSnap` 接受 `locked`（上一帧的命中），只要它还在
  `threshold + hysteresis` 内就继续用它（**粘性目标**）。判据：锁定期间 `guideValue` 不变、`delta` 随源盒增长。
  ② **等间距候选默认关闭**（`spacing: false`）：它是「任意两个目标中心的中点」这种全图级别的线，
  O(n²) 且最不可预期 —— 实测 34 个单元下它把"≤4px 命中候选线"的概率从 60% 抬到 75%（边缘+中心时 36% vs 49%）。
  ③ **修正量不做整数取整**：`Math.round(delta)` 会把连续的候选切换放大成整数级跳变（8/−4/4/−2 反复）。
  另：**`proximity`（相关性门控）默认 0 = 关闭** —— 实测它能把吸附概率砍半（80 屏幕 px 时 11/24 → 7/24），
  但会挡掉合法的远距离对齐（引擎对齐示例需要 ≥120、设计器流程图回归需要 ≥105 屏幕 px），
  所以只留给"版面极密且不需要跨行对齐"的应用显式打开；**密集版面的应用应该收紧 `threshold`**：
  `ice-entity-designer` 用 2（引擎默认 3）。回归：`tests/control-panel/alignment-dense.test.ts`（5 例，含新旧对照）。
- **判类型不得依赖类名铁律（2026-09-11 确立，2026-09-13 补 typeId 格式约定）**：**严禁**用 `component.constructor.name === 'Xxx'` 判类型。消费者的打包器会把类名 mangle（实测 webpack 生产构建下 `Entity`/`Relation` → `Dr`/`Br`），这类判断会**静默失效**：分拣结果恒为空、`setXxx` 变 no-op、`toSchemaObject` 返回空，而页面不报任何错。正确做法：① 引擎内用 `ice.getTypeId(ctor)`（注册名反查）；② 需要「纯函数、不依赖 ICE 实例」的场景在类上加 `static readonly typeId`（属性名默认不被压缩，子类可继承），**值必须是 canonical typeId（`namespace:Type`，见上方序列化铁律）**；判断时用 `ice.getType(x.typeId) === X` 解析（这样旧快照里的无 namespace 别名也能命中），跨实例 / 不持有 ICE 时用 `x instanceof X`；③ 组件间做身份判断可用 `instanceof`。注意本缺陷在包内**测不出来**——开发态不压缩、本项目 rollup 又配了 `keep_classnames`，只有下游打包才现形，因此必须显式模拟改名来回归（`ice-entity-designer` 的 `tests/designer/type-mangling.test.ts` 用 `Object.defineProperty(Class, 'name', ...)` 做了示范，并配了 ESLint `no-restricted-syntax` 门禁）。
- **矩阵计算零分配铁律（2026-09-08 性能优化确立）**：`calcLinearMatrix` 复用 `state.linearMatrix`；`calcAbsoluteLinearMatrix` 复用每实例的 `__absScratchA/__absScratchB` 做祖先连乘；`composeMatrix` 复用 `state.composedMatrix` 与平移 scratch `__transScratch`。这些缓冲是普通数组（非 `mat2d.create()` 的 `Float32Array`），以保持矩阵为 `Array` 类型，兼容序列化与 `Array.isArray` 约定。改动矩阵逻辑时不得重新引入每帧 `mat2d.x([], ...)` 式的新数组分配。
- **别给组件类加实例字段（2026-09-15 实测确立，代价 3~4×）**：给 `ICEComponent` / `ICERect` / `ICEGroup` 这类
  每帧被遍历的类**新增一个实例字段**（`private foo = x`），会把实例属性挤出 V8 的「对象内属性」区，
  渲染热路径（每帧读 `state`/`dirty`/`parentNode`）随之慢 **3~4×**。
  实测（`node bench/render.cjs 2000` 场景 A 静态重绘）：**0.055ms → 0.21ms**；换成无关字段名同样复现，
  把字段加在子类 `ICERect` 上同样复现，而只加**方法**（原型上的）没有影响。
  新能力需要"每实例一个值"时，按这两条办：① 只在布局期/序列化期读写的，用**模块级 `WeakMap` 侧表**
  （范例：`setMinimumSize()` 的声明值，见 `src/graphic/ICEComponent.ts` 的 `MIN_SIZE`）；
  ② 属于文档内容的，写进 `state`（`grow` / `margin` / `gridSpan` / `layoutConstraint` 就是这么放的）。
  判据：改完必须 `npm run bench 2000 -- --check`，**看场景 A 的绝对值有没有从 0.05ms 量级跳到 0.2ms**。
- **脏矩形局部重绘铁律（2026-09-09 v1 确立）**：默认渲染路径为 `dirty-rect`（`ICE.init(ctx, { renderMode })` 可切 `'full'`；`renderer.setRenderMode/__forceFullRender` 为内部测试钩子，非公开 API）。全量路径 `doRenderFull()` 原样保留为参考与回退。约束：① 组件渲染上下文必须自包含——`render()` 末尾 `__resetLeakyCtxState()` 把本组件写过的泄漏属性（shadow/globalAlpha/globalCompositeOperation/lineCap/lineJoin/miterLimit/textAlign/textBaseline/虚线）归位，这是 full 与 partial 逐像素一致的前提；② 结构变更（markQueueDirty）仍回退全量并重建快照（WeakMap，存每组件上次上屏的世界盒）；③ **相交级门控**（2026-09-10 由 v1「整场景」细化而来）：干净的「非不透明落墨 / 点集路径(dot-path) / ICEText」只在与本次脏区**相交**时才回退全量；已离屏缓存的同类组件不阻塞局部重绘（主画布只是 `drawImage` 不透明位图）。**刚变脏的「非文本」risky 组件也放行**（old∪new 盒已并入脏区，clip 切不到墨迹）；刚变脏的**文本**只有「仅位置变化 + 已缓存」才放行（字形墨迹可能超出几何盒）。③' **`coalesceRegions` 必须带「划算护栏」**：只合并「合并后面积 ≤ 两块面积之和 × 2」的盒，且 `maxRegions` 是**软**上限（没有划算的合并时宁可多留几块，超 24 才塌缩成一个并集盒）—— 否则细长盒（横跨画布的关系连线）会被串成一个整屏大盒，`面积占比 > 0.35` 那条门会把局部重绘**永久**挡在门外（编辑器实测 100% 回退）。实测富场景（含旋转组/文本/星形/连线/半透明控制面板）局部重绘执行次数由 **0 → 2**，10 步逐像素比对仍 100% 一致；④ `display:false` 组件擦除旧区域后清脏位并删快照，避免「永久脏组件」把后续局部帧反复顶成全量；⑤ 局部帧 `BEFORE_RENDER/AFTER_RENDER` 仅对区域内的组件触发（有意的可观测差异，内部无依赖）。
- **组件级离屏缓存铁律（2026-09-10 确立，v3 扩展 dot-path/半透明 shape）**：`CanvasRenderer` 内置 `ObjectCache`（`WeakMap`，与快照同生命周期、不污染组件 state/props），缓存「非编辑态、可见」的 `ICEText`、「封闭点集路径」（星形/正N边形/玫瑰，面积 `>= 40000`（200x200）；排除连线类 `isLine` 与蚂蚁线 `lineDashFlow`）与「半透明普通 path 图形」（rgba/阴影/globalAlpha/composite；排除容器/图片/连线）。约束：① `ICEComponent.renderTo(targetCtx, baseMatrix)` 把组件渲染重定向到离屏 ctx，最终 CTM = `baseMatrix · composedMatrix`，`render()` 语义保持不变；② 缓存命中帧（未 dirty 且已有 cache）直接 `drawImage`，跳过 `measureText/fillText/strokeText` 或 `calcDots/路径重建/fill/stroke`；③ 纯平移（内容指纹 + 线性部分 a,b,c,d 不变、仅 e,f 变化）复用位图，只刷新贴图位置，不重建；④ 仅当内容指纹或线性变换变化时才重建位图；内容指纹按**向量逐项比较**（`ObjectCache.contentKeyVector` + `keyEquals`，复用缓冲、零分配），字符串形态（`contentKey()`）由同一份向量拼出、只在真要重建时才拼 —— 原实现每帧给每个已缓存组件拼一个 40 段长串，实测占文本静态帧的 ~13%；⑤ **像素保真契约（2026-09-11 修正，硬性）**：位图必须与「直接落墨」逐像素一致，否则缓存就是**画质回归**。做法是把位图栅格**对齐到主画布的设备像素栅格**：光栅化缩放取渲染视口的 `scale`（`getRenderViewport().scale`，已含 dpr 与视口缩放，**不要用 `root.devicePixelRatio`**），base 矩阵显式写成 `[rs,0,0,rs, ox-dx, oy-dy]`（不是 `translate(-minX,-minY)`），贴图落点 `dx/dy` 取**整数设备像素**、以 1:1 贴回（`drawImage(img, dx, dy)`，**不传目标宽高**）。于是 `device(world) = world*rs + (ox,oy)` 被「位图内坐标 + 整数平移」精确复现，全程零重采样。
  另外：① **不要**依赖 `ctx.scale()` 放大离屏上下文 —— `renderTo()` 内部的 `setTransform()` 会把整条 CTM 覆盖掉（踩过这个坑，是死代码）；② 子类在 `super.doRender()` 之后复原变换必须用 **`applyActiveTransform()`**（它同时适配主画布与离屏通道），**严禁** `applyTransformToCtx(null, true)` —— 那条路径按主画布视口重算，会丢掉位图原点的平移（连线箭头/标签会在缓存位图里整块消失）；③ 重建位图前要扣回旧条目的字节数（否则总预算被提前耗尽）；④ 缓存只在**视口稳定**的帧生效：`CanvasRenderer` 每帧开头调 `cache.beginFrame()`，视口变过的那一帧 `isCachable` 一律返回 false（位图栅格已错位、重建代价与直接落墨同阶），手势停下后的第一帧再统一重建。回归用例见 `tests/renderer/offscreen-cache-fidelity.test.ts` 与 `e2e/visual/offscreen-cache-fidelity.spec.ts`（6 配置 × 12 步：alpha 零差异、预乘通道差 ≤3/255、墨迹守恒）。**注意这组口径只在「简单场景」成立**（少量大对象、互不重叠、透明底）；**密集文本 / 重叠 / 底下已有墨迹**时实测上界另计：差异像素占比 ≤1.4%、alpha 差占比 ≤0.5%、单像素最大通道差 ≤5、最大预乘差 ≤2（2026-09-14 实测，含重叠与不透明底的更差组合见 `e2e/visual/component-cache-fidelity-repro.spec.ts` 的文件头表格）。机制是「8bit 预乘位图贴回时与已有墨迹再合成一次」，属固有代价，不是赋值写错。
⑤' **连线可以缓存**（2026-09-11）：`isLine` 不再一律排除，改为「按**设备像素面积**设上限」（单条 ≤200 万设备像素 ≈8MB、总量 ≤32MB、排除蚂蚁线 `lineDashFlow`）。连线横跨画布，排除它就等于「干净连线与脏区相交 → 回退全量」长期命中，富场景局部重绘 100% 失效。
⑤ **dots 与合成矩阵的配合**：`ICEDotPath.calcLocalOrigin()` 会把 `dots` 平移到「以 origin 为原点」，实现为**只补「目标平移量 − 已应用平移量」的差额**，因此 `composeMatrix()` 对 dots **幂等**（旧实现每次 compose 都无条件再平移一个 origin，连续 compose 会累积偏移，曾迫使所有调用方「compose 前先重算 dots」）。`ObjectCache.render` 在 dirty 分支用 `refreshParams()` **按需**刷新点集（自身派生参数变脏时才重算），再 `composeMatrix()`；⑥ 已缓存组件在 `__sceneAllowsPartial` 中视为「不透明位图贴图」，不再因字形/点集路径/半透明落墨的 clip 边界 AA 问题阻塞局部重绘（像素一致性回归见 `e2e/visual/dirty-rect-pixel.spec.ts` 的 `?opaque=1&text=1`、`?opaque=1&star=1` 与 `?opaque=1&alpha=1`）；⑦ 离屏 canvas 走 `root.createOffscreenCanvas` 平台抽象（浏览器 `document.createElement('canvas')` / 小程序 `wx.createOffscreenCanvas({type:'2d'})`），尺寸按「渲染视口缩放 × 世界盒尺寸」算（含四周各 1px 透明余量，用于吸收贴图取整误差）；⑧ 缓存是运行时状态，严禁写入组件 `state/props`（序列化安全）。**性能铁律：大量小图形（面积 < 40000）不缓存，否则 drawImage 反超直接 fill/stroke（见 perf 回退记录）**。回归用例见 `tests/renderer/ObjectCache.test.ts`、`tests/renderer/CanvasRenderer.cache.test.ts`、`tests/graphic/ICEComponent.render-to.test.ts`、`tests/cross-platform/root.offscreen.test.ts`。
- **静态层位图铁律（2026-09-14 确立）**：`CanvasRenderer.__renderWithStaticLayer()` 把 z 序队列里**最长的一段连续可入层组件**整体光栅化成一张位图，之后每帧只「清屏 + 贴一张图 + 画剩下的」。局部重绘不成立（脏区分散、合并预算与面积门挡下）时才接管；**成员集合 / 渲染视口 / 队列结构**任一变化才重建。约束：① **只有 z 序上连续的干净段能成层** —— 位图只能整层贴回，交错就会改变叠放次序（顺序 = 树序，见「渲染顺序铁律」）；成员数下限 256。② 排除三类：有 `clipChildren` 祖先、`globalCompositeOperation` 非 `source-over`、`display:false`。③ 位图栅格对齐纪律与离屏缓存**逐字相同**（缩放取渲染视口 scale / 整数设备像素落点 / `drawImage(img, dx, dy)` 不传目标宽高）；**贴之前必须把 CTM 归回单位变换** —— 组件渲染不还原 CTM，沿用上一个组件的矩阵会把整层画歪。④ **渲染进离屏位图时抛异常绝不能漏出去**：此刻在帧回调里，抛出去就是未捕获异常（小程序直接白屏）；捕获后整个会话关掉静态层、退回逐组件重画（与 `ObjectCache` 降级口径一致）。实测（编辑器典型场景：2000 文本 + 1000 折线 + 7000 矩形 + 200 个分散动画）：**23.75ms → 1.32ms（18.0×）**；10000 静态 + 200 个铺满画布的动画 11.83 → 1.30ms；而「动画聚在一角」「小场景」两种情况下层**不介入**（局部重绘已够好）。像素口径同离屏缓存（alpha 逐位相同、预乘通道差 ≤3/255，实测 ≤1）；**层与直绘混排时**受组件缓存口径影响（密集文本的实测上界见「离屏缓存铁律」那条）。回归：`tests/renderer/static-layer.test.ts`、`e2e/visual/static-layer-pixel.spec.ts`（含 dpr=2）。

- **路径命令流重建信号铁律（2026-09-14 确立）**：`ICEPath` 的命令流只在**几何真的变了**时才重建，判据是两路信号取并集：① 派生参数被重算过（`refreshParams()` 消费掉一次 `paramsDirty` → `paramsRev` 自增）；② 几何签名变了（`__pathSignature()`，宽高/半径/本地原点/dots·points 内容/closePath/curveType…）。**不要退回「`dirty` 就重建」**——平移动画每帧都会置 `dirty`，重建 `Path2D` + 重放命令流的开销实测占 10k 全动画场景的 ~2.3ms/帧。约束：① 签名的**安全边界**是「默认保守」：`__pathSignature()` 默认返回 `null` = 无法判定 = 维持 `dirty` 即重建；只有读的 state 字段封闭的 4 个内置 builder（矩形/椭圆/点集/折线）覆盖它。**自定义子类只要在自己的 `createPathObject()` 里读了别的 state 字段（BPMN 形状 / 进度环 / Spinner 都如此），就不要覆盖签名方法**，否则改了那个字段不会重建。② 几何并不总是组件自己算的：容器在 `calcComponentParams()` 里**直接写后代 state** 是既有写法（见 ice-entity-designer 的 `Entity`），此时后代的 `paramsDirty` 不会置位 —— 这正是必须有「签名」而**不能**只看 `paramsDirty` 的原因。③ `dots` 会被就地改写（`calcLocalOrigin()` 按 origin 差额平移），所以点集签名必须比**内容**，不能退化成比数组引用。

- **`dirty` / `paramsDirty` 两级脏标记铁律（2026-09-11 确立）**：`dirty` = 需要重绘；`paramsDirty` = 自身派生参数（尺寸 / 点集 / 文本量测）需要重算，**只取决于自身 state，与祖先变换无关**。约束：① 容器 `setState` 递归给后代**只置 `dirty`，绝不置 `paramsDirty`**（祖先移动只需重绘，不需重量测）；② 所有要用派生参数的地方一律调 `refreshParams()`（按需重算 + 清标志），**不要直接调 `calcComponentParams()`**；③ 子类 `calcComponentParams()` 里的早退判断用 `this.paramsDirty`，**不要用 `this.dirty`**；④ 绕过 `setState` 直接改 `state` 几何的内部路径（如折线 `followComponent` / `recalculateRoute` 改 `state.points`）必须显式补 `this.paramsDirty = true`；⑤ 点集类子类实现 `__calcDots()`，**不要覆盖 `calcDots()`**（它是维护「已应用平移量」的唯一入口，覆盖会让幂等补偿失效）。实测（移动整组一帧）：`calcComponentParams` **10 → 0**、`calcDots` **6 → 0**，必须发生的重绘次数不变（8 次）。回归用例见 `tests/renderer/params-dirty.test.ts`。

- **包围盒唯一来源铁律（2026-09-11 确立）**：组件的**本地盒**只能由 `ICEComponent.__localBox()`（返回 `[x0,y0,x1,y1]`，默认 `[0,0,width,height]`）提供 —— `getMinBoundingBox()` 与渲染器的 `__paintWorldBox()` **都消费它**，因此二者必然一致。约束：① **不要**让任何一条路径自己去推导盒子（历史上 `__paintWorldBox()` 用 width/height、`getMinBoundingBox()` 被折线单独覆盖，两条路径不一致 → 上屏快照盒退化 → dirty-rect 漏画折线，这类 bug 只在「连线连上嵌套宿主」时才暴露，极难定位）；② 几何不遵守「自本地 (0,0) 起、尺寸 = width/height」约定的组件（如 `ICEPolyLine`：原点固定在起点、点集可含负坐标）**必须覆盖 `__localBox()`**；③ `calcComponentParams()` 里的宽高推导**不得用「顶点对相减」**（`points[1].x - points[0].x`）——`calc4VertexPoints()` 的返回顺序对非 bbox 角点无保证，必须取全部顶点的 min/max；④ 派生量之间不得有循环依赖（反例：`splitEndpointsTo4Points()` 曾用 `state.height` 当线宽输入，而 height 又是它的输出 → 结果随上一次的值漂移、首帧读到默认哨兵值）。回归用例见 `tests/link/polyline-basics.test.ts`（两条盒路径逐位一致）、`e2e/visual/dirty-rect-pixel.spec.ts`。

- **`once` 可摘除铁律（2026-09-11 确立）**：`ICEEventTarget.once(name, fn, scope)` 内部会把 `fn` 包成 `callback` 再 `on`，因此**必须在包装函数上留 `__onceOriginal = fn`**，`off` 也要同时匹配「包装函数」与「原始回调」——否则外部 `off(name, fn, scope)` 永远删不掉一次监听，只能等它自己触发一次。约束：① 注册在**跨组件 / 总线级**（如 `ice.evtBus`）上的监听，组件 `destory()` 时 `purgeEvents()` 清不掉（它清的是本组件的 `listeners`），**必须在 `destory()` 里显式 `off`，且要在 `super.destory()`（会置空 `evtBus`）之前**；② 事件回调要能容忍「组件已销毁」：写 `this.ice.xxx` 前先判空（全仓 `this.ice.dirty` 唯一一处漏判就在 `ICEPolyLine.syncConnections`，正是应用层 undo/redo 崩溃的来源）。回归用例见 `tests/event/once-off.test.ts`、`tests/link/polyline-destroy.test.ts`。

### 性能相关铁律（2026-09-11 因一次真实回归确立）

- **动画性能预算铁律（2026-09-13 实测确立，详见 [04 · 渲染与性能](docs/architecture/04-rendering-performance.md#动画机制压测)）**：
  引擎**没有**「每个动画一个定时器」——全局只有一个 rAF 每帧派发一次 `ICE_FRAME_EVENT`，
  `AnimationManager` 一次 O(n) 遍历插值；实测 tween 只占单帧的 **1%~5%**（1 万动画 0.6ms / 2 万 1.3ms），
  成本全在重绘。三条红线：① **脏组件占比 > 20% 必然整屏重绘**（`FULL_FALLBACK_DIRTY_RATIO = 0.2`；
  实测 1 万图元里 1500 个动 = 4.7ms 走局部，2100 个动 = 12.7ms 回退全量，**2.7× 断崖**）；
  ② **文本动画比矩形贵一到两个数量级**（2,000 个：矩形 2.7ms vs 文本 91.8ms），
  因为文本属 risky 类别 + 动画写值走 `setState` → 每帧 `paramsDirty` → 离屏位图每帧重建
  （插桩实测：只置 `dirty` 时 2.6ms/23000 次位图复用，走 `setState` 时 34.8ms/0 次复用，**13×**）；
  ③ **`stagger` / 入场动画 = 脏比≈100%**，做编排功能前必须先解决重绘路径，否则"错峰"比"一起动"更慢。
  **已落地（2026-09-13）**：动画写值专用通道（`setState(patch, { paramsDirty })` + 组件
  `ANIMATION_SAFE_KEYS` 白名单；未知键/未声明的第三方组件一律保守置脏）+ 设备像素量化
  （`AnimationManager.snapToDevicePixel`，默认开、可单条关，终点值精确写入）——
  1,000 个文本平移动画 **35.1ms → 2.7ms**（位图复用率 100%），门禁 `npm run bench:anim -- --check`（已进 `verify:full`）。
  **已落地（2026-09-13）**：动画写值通道 + 设备像素量化、分层渲染原语（视口绑定/输入穿透/事件归属/跨实例迁移/多层导出）、
  动画结构化诊断（`validateAnimations` + `getDiagnostics`）、**帧调度**（空闲停帧 `FrameManager.needsFrame/wake`、
 次要动画 `fps` 降频、`prefers-reduced-motion` 折叠为终态）。**脏区门控已定案（2026-09-13）**：维持计数门（"换成面积门"实测后否决，数据见 18 §3.3）。
 **`coalesceRegions` 聚合预算铁律**：「挑代价最小的两块合并」是 O(k²)、最多跑 k 轮 → O(k³)，脏块上百即可把一帧卡死（实测 1000 块 111s）；
 预算 `MAX_COALESCE_REGIONS = 32` 之外**直接塌缩成并集盒**交给面积阈值（保守解：最多回退全量，绝不画错）。
 **不要把这道预算换成"更聪明的合并"**——除非有新的区域模型实测支撑（探针脚本一律不入库）；
  **表达力已开放**（缓动传函数 / `registerEasing`、颜色与带单位数字串插值、生命周期回调、`direction: reverse|alternate`）；**编排与运行时控制已落地**（`animationManager.timeline()` 的 add/at/stagger/play/pause/resume/stop/restart/finished，`component.setAnimation/removeAnimation`、`manager.replay/isAnimating`；**注意 `props.animations` 默认值是被冻结的共享对象，运行时挂动画必须走 `setAnimation` 写时复制**）。**尚未做**：OffscreenCanvas/GPU 后端。
  **目标架构、红线与验收指标见 [18 · 动画机制](docs/architecture/18-animation-architecture.md)**
  （含"不用 CSS 变换做图元动画"的决策记录）。

- **任何触碰每帧热路径的改动，都必须做「同时刻新旧对照」的基准测量**，不能只看单次数值：
  `npm run bench 5000`（场景 A 静态重绘 / B 动画全量 compose / C 文本缓存命中 / D 文本重建缓存）。
  做法是：改动前先 `git stash`（或切上一提交）构建并测 3 次，改动后同样测 3 次，**比较中位数区间是否重叠**。
  本机负载可达 load 4~5，单次读数会有 ±10% 噪声；实测同一版本组内波动 <1.5%，所以「3 次中位数区间不重叠」
  才是真回归。
  先例：可见性判定（`isEffectivelyVisible`）每帧被调 3~4 次/组件、且组件多层嵌套，实现里沿父链走导致
  5000 图元场景 **+15%**；因为没做对照，是靠后来补测才发现的。修法是「代际缓存」（`bumpVisibilityEpoch`）。
- **基准脚本本身也要被门禁守住**：`bench/render.cjs` 曾引用早已改名的 `dist/index.cjs.js`，
  于是 `npm run bench` 直接跑不起来、README 的性能数字也无法复现，且因为不在任何门禁里长期没人发现。
  现在有 `tests/tooling/bench-smoke.test.ts` 用 N=200 真跑一遍（**不断言耗时**，CI 机器不可控）。
- **性能数字不写死在文档里**：写「用 `npm run bench 5000` 复现」+ 标注实测机器与日期，
  否则跨机器差数倍的数字会变成不可复现的宣称（README 旧版本的「5000 图元 0.8ms」实测是 2.2ms）。
- **噪声大到一定程度时，要如实说「测不出来」而不是硬报一个差值**：本机 load 到 5 时实测同级读数
  波动可达 ±25%~110%（sceneA 单侧 220~469 fps），此时「中位数差 7%」完全落在噪声里，不能当结论。
  判据是**看读数带是否重叠**（改动前后各 3~5 次、交错执行），重叠就是没测出来。
- **`isCachable` / `applyTransformToCtx` / `doRender` 等「每组件每帧」的方法里不许做多余工作**：
  一次真实的 −4.4% 回归就是这么来的（在 `isCachable` 顶部无条件取了一次渲染视口）。
  修法是把只在某个分支才需要的取值**下沉进那个分支**、把能内联的紧循环计算内联。
  加东西前先问：5000 图元 × 60fps 时这段代码每秒要跑多少次？

- **i18n 边界铁律（2026-09-13 确立）**：**引擎不做 i18n**（没有词条表、没有 locale 状态、不做语言切换；同页两个应用不能各用各的语言，这类全局状态一旦进内核就退不出去）。边界是：**应用层**管词条 / 复数 / 日期数字货币格式化（`Intl`/ICU），把最终字符串交给引擎；**组件库**可以有自己的内置文案但要「可配置 + 不持全局状态」；**引擎**只负责让这些字符串显示正确 —— ① 断行策略（`wordBreak: 'normal'` 拉丁词不硬拆、CJK 逐字断 + 禁则；`'break-all'` 保留旧的逐 grapheme 贪心）；② 文字方向（`ICEText.direction` + `textAlign: 'start' | 'end'`，写 `ctx.direction` 时**特性检测**、渲染完归位 `inherit`；SVG 导出口径一致）；③ 输入法（透明 `<input>` + `compositionend`）；④ **稳定错误码**（`ICE_ERROR_CODES` / `getICEErrorCode(err)`，错误常被应用直接展示，只有中文 message 会迫使应用匹配字符串）；⑤ 中立性（不规范化、不做 locale 格式化、文本逐字节往返）。完整契约与缺口清单见 `docs/architecture/17-i18n-boundary.md`，回归见 `tests/graphic/text-wrap.test.ts`、`tests/graphic/text-direction.test.ts`、`tests/graphic/text-i18n.test.ts`、`tests/util/errors.test.ts`。

- **文本渲染自包含与自动尺寸铁律（2026-09-13 确立，A 组修复）**：① `style` 会**透传**到 ctx
  （`__applyStyleProp` 末行 `ctx[prop] = value`），因此**任何新增的 style→ctx 键都必须同时在
  `ICEComponent.LEAKY_CTX_PROPS` 登记**，`__leakyIndex()` 的 case 号必须与数组下标一致，虚线位一律用
  `LEAKY_LINE_DASH_BIT`（由数组长度推导）——漏登就会把状态漏给同帧后面的组件，破坏「组件渲染自包含」与
  脏矩形 / 离屏缓存的像素契约。② `ICEText` 的自动尺寸以「**调用方是否显式给尺寸**」判断
  （构造参数 → `__autoWidth`/`__autoHeight`；`setState({width/height})` 也会关掉对应方向的自动量测），
  **不再把构造参数里的默认值 `10` 当哨兵**。③ 自定义字体加载完成（`ICE.loadFont()`）后引擎会自动
  `remeasureTexts()` 标脏重测（`ICEText.remeasureText()` 只标脏，重算在下一帧）。④ 无 DOM 运行时的
  光标 / 编辑按 **grapheme** 移动，`renderCaret()` 对多行、RTL、`textAlign: start/end` 都要正确。
  回归用例见 `tests/graphic/text-bugfixes.test.ts`、`e2e/visual/offscreen-cache-fidelity.spec.ts`。

- **文本度量必须在「基准态」量（2026-09-20 定位，一次真实事故）**：`ICEText.__measureByCanvas()`
  量字形墨迹时，**必须先把 ctx 归到「单位变换 + `textBaseline: 'alphabetic'`」**，量完原样还原。
  原因：canvas 的 `actualBoundingBoxAscent/Descent` 是**相对当前 `textBaseline`** 报告的，真机实测
  （Chromium，`bold 18px Arial` 量 `rotated`）：`alphabetic` → 12.885/0.211；`bottom`（引擎默认）
  → 16.916/**-3.820**；`top` → -1.084/14.180。引擎按「上=ascent、下=descent」拼盒高，负 descent 被
  `Math.max(0, …)` 丢掉 → 盒高按 16.916 算（正确 13.096）。**危险之处在于"量到哪条基线"取决于量测
  发生在哪一帧、在哪个通道**：离屏缓存会把组件重新量一遍（此时 ctx 已是「缓存位图 ctx + 该组件的
  CTM + 已应用的 style」），于是**同一个组件的世界几何随缓存开关而变** —— 症状表现为「缩放视图下
  开缓存与关缓存的渲染对不上（最大预乘差 132/255）」，根因却是度量被渲染状态污染。
  纪律：**任何"用 ctx 量出来的几何"都不得受当前渲染状态影响**；量测前后要还原（调用方可能正处在
  渲染中途，`applyActiveTransform()` 还指着那条 CTM）。回归：`tests/graphic/text-measure.test.ts`
  的「量测期间把 ctx 归到 alphabetic 基线」、`e2e/visual/offscreen-cache-fidelity.spec.ts`。

- **文本排版属性铁律（2026-09-13 确立，B 组）**：① `lineHeight` / `letterSpacing` / `textDecoration` 是
  **正式排版属性**，解析规则只能有一处（`src/graphic/text/text-style.ts`）——量测、换行、渲染、SVG 导出
  四处必须同口径，任何一处各自 `parseFloat` 都会漂移（`letterSpacing` 只透传给 ctx 的旧行为就是
  「屏幕上有间距、盒子宽度不含间距」）。② `letterSpacing` 必须**在量测之前**写进 `ctx.letterSpacing`
  （canvas 的 `measureText` 含尾随间距），不要自己再加一遍。③ 文本装饰线是引擎自绘：下划线在基线下方
  `0.12em`，**会溢出几何盒**，落墨盒（`stylePaintPad()`）与离屏缓存的 `contentKey` 都必须覆盖它。
  ④ `ObjectCache.contentKey` 的文本分支必须包含「只改墨迹、不改矩阵」的属性（排版属性、`selectionStart/End`、
  `wrap/wordBreak/maxLines/ellipsis`）——漏一项就会出现「属性改了画面不动」的贴旧位图 bug。
  ⑤ 光标 / 选区 / 命中的**行带**必须按 `textBaseline` 与真实字形/字体度量推导（`__lineBoxes()` 是唯一入口），
  不能只按 `y + 行号 × 行高` 推（`textBaseline: 'top'` 下会整体错位）。⑥ 多行编辑用透明 `<textarea>`
  （回车换行、Ctrl/Cmd+Enter 提交），单行仍是 `<input>`（回车提交）。回归见
  `tests/graphic/text-layout.test.ts`、`tests/graphic/text-editing-selection.test.ts`、
  `e2e/visual/text-advanced.spec.ts`、`examples/text/text-advanced.html`。

- **文本溢出铁律（2026-09-14 确立，C 组）**：① **禁止把宽度当 `fillText/strokeText` 的 `maxWidth` 传下去** ——
  canvas 对 `maxWidth` 的语义是**把字形横向压扁**（不是截断），长中文会被挤成一团、还溢出盒子
  （smart-water 顶部 Message 的实测事故）。溢出只有两种处理：截断（默认 `textOverflow: 'ellipsis'`，
  grapheme 回退 + 省略号）或显式 `'clip'` 交给调用方裁。
  ② 截断算在 `getRenderLines()` 的**显示行**里（写进 `state.lines`，派生缓存、不进快照），
  因此画布、SVG 导出、行盒（光标/选区/命中）三处必然同口径；`textOverflow` 必须进
  `ObjectCache.contentKey` 的文本分支（漏了就「属性改了画面不动」）。
  ③ **`splitGraphemes()` 返回的数组是副本**，调用方可以就地 `pop()`；直接把缓存数组交出去
  会让「谁 pop 谁改坏全局缓存」（表现为同一段文本第二次截断少截几个字）。
  ④ 编辑态不截断：caret / 选区是按原始文本算的。
  回归见 `tests/graphic/text-overflow.test.ts`。

- **布局铁律（2026-09-14 确立 D 组，2026-09-15 对齐 Swing 修订）**：设计思想是 Java Swing 的
  `LayoutManager`（策略模式）—— 容器持有策略、策略只算位置。定死这几条口径，新增布局必须照办：
  ① **策略只摆位置**：`layoutContainer(container)` 里写子项的位置/尺寸；"什么时候排"归 `ICEGroup`
  （`setLayout` / 增删子项立即排、子项改尺寸合并到下一帧、布局期间不自激）。
  ② **尺寸协商只有一条路：问子项的 `getPreferredSize()`**（`preferredSizeOf`），不要直接读
  `state.width/height`（旧口径，已废）。子项怎么答：叶子 = 显式尺寸或当前盒子；容器 = 有布局就报
  策略算出的**内容尺寸**（对齐 Swing `Container.getPreferredSize() → preferredLayoutSize`）；
  `setPreferredSize()` 声明过就报声明值。**构造期给的 `width/height` 是边界（`setBounds` 语义），
  不是首选尺寸**，所以"父布局不许顶掉调用方给的尺寸"这条旧顾虑要用 `setPreferredSize()` 表达。
  ③ **没有 `fitContent` 也能嵌套**：`fitContent` 只是"把自身尺寸调成内容尺寸"的可选行为，不再是
  子容器对外报自然尺寸的前提。
  ④ **布局不继承**：父容器 `setLayout()` **不**下灌给子容器（对齐 Swing `Container.setLayout`：
  父布局只给子容器摆位置）。子容器要自动排布就自己 `setLayout()`。重排由 `doLayout()` 末尾的
  **自顶向下校验趟**驱动（对齐 `Container.validateTree()`：谁失效排谁，没失效的子树整棵跳过，
  中间层容器没有布局也要穿过去）。
  ⑤ **交叉轴对齐用布局自己的参数**：`ICEBoxLayout.align`（`start` / `center` / `end` / **`stretch`**）、
  `ICEFlowLayout.crossAlign`（行内）。`stretch` 是 Swing BoxLayout 的默认口径（交叉轴撑满），
  纵向堆叠 + 拉满宽度的场景不要自己在组件里写；`grow`（主轴）与 `stretch`（交叉轴）可以同时用。
  ⑥ **首选尺寸要算上换行**：`ICEFlowLayout.getPreferredSize()` 在容器有确定宽度时按该宽度分行
  （Swing `preferredLayoutSize` 用 `target.getWidth()` 就是这么算的）；容器宽度未定（0）视为单行，
  别在 0 宽上无限换行。**显隐是布局输入**：`setState({display})` 会请求父容器重排
  （对齐 `Component.setVisible()` → `invalidateParent()`），布局器统一用 `layoutChildren()` 跳过不可见子项。
  ⑦ **内外距只有一套实现**：容器的 `padding`、子项的 `margin` 一律走
  `contentBox()` / `outerSizeOf()` / `placeChild()` / `placeChildSized()`，新布局不许自己再算一遍
  （否则「屏幕上是 8px、盒子按 0 算」这类漂移一定会出现）。
  ⑧ **每个布局都要实现 `getPreferredSize(container)`**（内容首选尺寸，含 padding/margin），
  否则 `fitContent` 对它无效；返回 `[0,0]` 表示"我对尺寸没有意见"，容器会保留调用方给的尺寸。
  ⑨ **不可见子项口径对齐 Swing**：`FlowLayout` / `BoxLayout` / `BorderLayout` / `OverlayLayout`
  用 `layoutChildren()` 跳过不可见子项；**`GridLayout` 不跳过**（不可见项照样占格子）。
  ⑩ **布局要能被序列化**：新布局必须实现 `toJSON()`（报**构造参数**，运行时缓存别报），
  并把类型登记进 `src/consts/LAYOUT_TYPE_MAPPING.ts`（`ice-render:XxxLayout`）。
  布局是"怎么排"，属于文档内容 —— 不登记的话快照往返会丢策略（"存盘再打开版式散了"）。
  读回时类型没注册 → 跳过策略但保留坐标 + 记入 `unknownTypes`（与组件同口径，不炸整份数据）。
  ⑪ **`GridLayout` 有两种格宽口径**：`cellSizing: 'content'`（默认，列宽取该列最宽子项）与
  `'equal'`（各格等分容器并把子项摆成格子大小 —— Swing `GridLayout` 的口径）。
  `equal` 模式下 `getPreferredSize()` **返回 `[0,0]` 不表态**：子项被拉成格子大小后再量它们
  等于量容器自己（自指反馈，容器只会越量越大），容器多大由调用方给的尺寸决定。
  ⑫ **构造参数取默认值用 `??` 不用 `||`** —— `gap: 0` / `currentIndex: 0` 必须能表达。
  ⑬ 子项上的布局声明（`margin` / `grow` / `gridSpan` / `layoutConstraint`）放 `state`
  （随快照走），非法约束值要**提示一次**而不是静默落默认值。
  回归见 `tests/layout/`（含 `layout-swing-semantics.test.ts` / `layout-composition.test.ts`）、
  `e2e/visual/visual.spec.ts` 的 golden 图。

## 已知技术债（严重度）

> 复核日期 **2026-09-11**。此前本节长期停留在「8 suite / 36 用例」等早期口径，与仓库实际严重脱节，已按实测重写。

- ~~P0：零单元测试~~ → **已偿还**：jest 单测 **140 个 suite / 1173 个用例**（2026-09-17 实测），`jest.config.js` 配了「只许上调」的覆盖率门槛（语句 65 / 分支 58 / 函数 72 / 行 65），CI 用 `npm test -- --coverage` 跑。可视化/交互/像素一致性另有 Playwright（`e2e/`，`npm run test:visual`，**100 条**，2026-09-17 实测）。

  > 数字只是**当天的快照**（加一条测试它就会变），别拿它当断言 —— 要看当前值就 `npx jest --listTests | wc -l` / `npm test` 直接跑。这里保留数字是为了"这套东西有多厚"，不是为了精确。
- ~~P2：`tests/` 里 49 个 HTML 全是无断言的手测 demo~~ → **已收敛**：重命名为 `examples/`，由 `examples/generate-index.cjs` 生成导航页（**92 个示例**，2026-09-17 实测），自动化单测统一放顶层 `tests/`（镜像 `src/` 结构）。
  生成器跳过 `assets` / `node_modules` / 点开头目录（2026-09-13 修：此前会误收 `examples/mini-program/node_modules/**` 里第三方自带的示例 html，导航页从 88 条变 95 条）；`tests/tooling/examples-index.test.ts` 会静态校验「导航页 ↔ 磁盘示例文件」双向一致，所以新增示例后忘了重新生成也会红。
- ~~P1：`ice-flow` 的 `ice-render` 版本声明写错~~ → **已修复**（改为 `^1.0.4`；下游 `.npmrc` 配 `legacy-peer-deps` 解 `rollup-plugin-uglify` 的 ERESOLVE）。
- ~~P1：README 称"纯 TypeScript"但残留 7 个 `.js`~~ → **已偿还**：全部迁移为 `.ts`，`types:check` 与 `build:types` 零错误。
- ~~P2：`CanvasRenderer.doRender()` 未使用 `startTime` 死代码；`ICE.init()` 留有 `//FIXME:防止 init 方法被调用多次`~~ → **已偿还**（两者均已不存在）。
- **P2（仍在）**：下游 `ice-entity-designer` 的 `rollup` 2 / `typescript` 4.6 与引擎（rollup 3 / TS 5.9）仍分叉（eslint 已统一到 8）。副作用之一：`typescript@4.6.2` 的已发布包里带着 `prepare: gulp build-eslint-rules`，导致用 `file:` 链接该包的工程 `npm install` 会以 `code 127` 失败（需 `--ignore-scripts`；升到 TS 5.6+ 可根治）。
- **P2（仍在）**：`src/` 里还有 **9 处 TODO/FIXME**（2026-09-18 复核）。此前这一行记的是 23 处，
  其中「尺寸/样式应做成可配置参数」那批**已经做完** —— 控制面板手柄尺寸现在由
  `ICE.init(ctx, { controlPanel: { resizeControlSize, rotateControlSize, rotateControlOffsetY, lineControlSize } })`
  传入（默认值不变，非法值退回默认），另外清掉了三条**已经过期**的注释
  （`destory()` 停动画 ×2、`DOMEventDispatcher` 的面板遮挡）。
  剩下 9 处分布在 `ICEText.ts`(4) 与其余 5 个文件各 1 处，**实质缺口只有两条**：
  - `ICEControlPanelManager` 的「按组件类型展现不同操作工具」需要进一步抽象（`src/control-panel/ICEControlPanelManager.ts`）——插件机制已提供 `tools` 注册点，可视为该抽象的第一层。
  - `TransformControlPanel` 的**斜切（skew）手柄**未做（引擎的 skew 变换本身可用，缺的是手柄 UI）。

  其余 7 处更接近「未来能力」而不是缺陷：`ICEText` 的沿路径排字 / 量测性能与无 DOM 运行时兼容 /
  位置精度，`ICEEventTarget` 的 W3C 事件 API 对齐，`cross-platform/root` 的 Node canvas，
  `ICEVisioLink` 想去掉对 `GeoPoint` / `GeoLine` 的依赖。

## 成员顺序（2026-09-17 定）

家族的应用层（各仓的页面 / 示例页）按这个顺序排类成员，正则 `S*T*F*C*(A|M)*`：

```
static 常量/字段  →  static 方法  →  实例字段  →  构造函数  →  访问器 / 实例方法
```

**本仓是引擎，`src/` 不强制这条** —— 存量里有一批刻意的"就近放置"：静态工厂/工具方法放在
类尾（`ICE.linkViewport` / `headless`、`GeoUtil.*`）、私有 scratch 字段紧挨着用到它的方法
（`ICEPolyLine.__polyBoxScratch`、`ICEText.__editInput`、`ICEComponent` 的
`ANIMATION_SAFE_KEYS` + `isAnimationSafeKeyFor()`）。2026-09-17 全仓体检（372 个类）里有
46 个类、144 处成员偏离，**不搬迁**，理由两条：

1. **代价不对称**：收益只是"读起来齐"；代价是引擎里 144 处成员搬家（其中约 78 处是**字段**），
   而 **TS 里字段的声明顺序是有语义的** —— 初始化按声明顺序执行，还影响 V8 的 class shape，
   每一处都要人工确认初始化表达式互不依赖。为排版动引擎不划算；要做也得先只挪方法（约 66 处、
   零风险），字段单独当一次重构排期。
2. **这条顺序本身不是权威规定**：Google Java Style §3.4.2 明确说 class 成员顺序
   "**没有唯一正确的配方**"（要的是每种顺序都讲得通、维护者能解释），Google 的 TypeScript
   指南对顺序**完全沉默**（全文 "ordering" 出现 0 次）。

**新代码照契约写；老代码遇到再改**（Boy Scout）。别为排版发起全量搬迁的提交。

## superpowers 协作约定

本工程使用 superpowers 闭环开发：

1. 任何新功能 / 修债 → 先 `brainstorm` 出 spec，写入 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`。
2. 用 `writing-plans` 生成实现计划，写入 `plans/`。
3. TDD 实现：测试先行，`npm test` 必须全绿。
4. 用 `requesting-code-review` 做代码审查。
5. 用 `finishing-a-development-branch` 收尾。

## git 约定

### 家族 e2e / 预览端口分配（2026-09-15 确立）

**家族应用层写法（单一来源）**：页面怎么写 —— 一页一类、`onUpdate()` 由谁在什么时候调用、
稳定结构与可变内容的边界、四个入口（引擎原语 / 组件库 / 设计器 / DSL）怎么选、验收清单 ——
正文在 `ice-web-components/docs/guides/app-pages.md`；容器契约在
`ice-web-components/docs/guides/layout.md` 第六节。各应用仓的 AGENTS 只记自己特有的部分。

各仓常常在同一台机器上同时跑 e2e / 预览，**端口必须一仓一个、并写进各仓 config 注释**：

| 仓 | 端口 | 用途 |
|---|---|---|
| `ice-render` | **8090** | `playwright.config.ts`（examples 冒烟 + 视觉基准） |
| `ice-entity-designer` | **8091** | 端到端回归 |
| `ice-smart-water` | **8092** | 端到端回归 + `scripts/shoot-screenshots.mjs` + `webpack devServer` |
| `ice-web-components` | **8093** | examples 冒烟 |
| `ice-render-dsl` | **8094** | 示例页 e2e |
| `ice-entity-designer-react-demo` | **8095** | 静态预览（webpack dev 仍用 8080） |
| `ice-chart` | **5177** | `scripts/serve-examples.cjs`（Vite 号段） |
| `ice-chart-dsl` | **8096** | 示例页冒烟（2026-09-15 补） |
| `ice-entity-designer-dsl` | **8097** | 示例页冒烟（2026-09-15 补） |
| `ice-game` | **8098** | 游戏厅首页与各游戏页 e2e（可用 `ICE_GAME_PORT` 覆盖） |
| `ice-agent-console` | **8099** / **8100** | AG-UI 后端 **8099** + 页面 **8100**（本仓有两个服务，所以占两个号） |
| `ice-web-components-dsl` | **8101** | 示例页冒烟 |

新增仓 / 新增服务时**先在这里登记**再写进配置。

**`reuseExistingServer` 一律 `false`**：端口被别的仓的服务占着时要**响亮失败**。
2026-09-15 踩过：`ice-smart-water/scripts/shoot-screenshots.mjs` 私自用了 8093，而
`ice-web-components` 的 playwright 也是 8093 且 `reuseExistingServer: true` —— 于是
web-components 的 e2e 静默复用了 smart-water 的服务目录，9 个用例全红（页面 404），
看起来像组件库坏了，实际是端口串号。排查成本远高于少一次"复用自己 dev server"的便利。

- 核心引擎在 `dev` 分支开发，远程 `origin/dev`（Gitee）+ `github-origin/dev`（GitHub），两处都要推。
- **分支与发版铁律（2026-09-13 确立）**：开发一律在 `dev`（或从它切出来的临时分支）上做，
  `master` 只做集成与发版；**发版前必须先把 `dev` 合并进 `master`，再从 `master` 发版**
  （`git checkout master && git merge --no-ff dev` → 跑门禁 → `npm publish`）。
  **禁止**直接在 `master` 上写实现，也禁止只更新 `dev` 而让 `master` 停在旧版本 ——
  本仓 2026-09-13 就踩过：远端默认分支是 `master`，而 2.x 全发在 `dev` 上，
  仓库首页长期显示 1.4.10 时代的代码（后来才补上快进）。远端默认分支必须指向 `master`，
  且发版后它与 `dev` 内容一致。
- **引擎升版后的应用侧验证铁律（2026-09-14 确立）**：升级引擎版本的应用工程，"对齐 devDependency + 跑门禁"只是及格线，还必须做两件事 —— ① **全部示例页逐页冒烟**（判据：无 pageerror + `window.ICE` 存在 + 画布**内容像素占比** > 2%；导航页无画布列外）；② **按引擎改动类型做定向检查**（静态层读 `renderer.__layerBuilds` 确认是否真参与 + 层开/层关像素对照；hover/命中路径跑悬停探针；动了持久化就做 save→load 往返）。像素对照的**两档口径**、**归因顺序**（先量噪声底线 → 再切组件缓存 → 单组件 → 主画布 vs 离屏 → 裁剪/陈旧）与六个发布踩坑（npm 本地缓存假报版本不存在、第二远端名 `github-origin`/`origin-github` 并存、推送瞬时失败先 fetch 再重试、CHANGELOG 约定各仓不同、历史未打 tag）全部见 `docs/architecture/20-engine-upgrade-verification.md`。
- 提交信息遵循 `@commitlint/config-conventional`（已在 devDeps）。
- **破坏性变更写在 CHANGELOG 的「### 变更（破坏性：…）」小节，提交信息不要用 `!` 标记**
  （2026-09-13 确立：本仓历史上从未用过 `!`，破坏性靠 CHANGELOG 小节 + 版本号表达；
  用 `!` 会与"按真实影响定版本"的做法打架——例如内部字段语义调整但无消费者读取，属修复级）。
- **版本号按「对真实消费者是否有影响」判断**：改 API / 数据格式且下游会受影响 → 主/次版本；
  只是内部字段语义或元信息调整、没有消费者依赖 → 修复级（例：`2.0.1` 的 `createTime` 语义调整）。

### 连线端点手柄与拖拽归属（2026-09-13 确立）

- **端点手柄 ≠ 变换手柄**：线条型组件的控制面板是 `LineControlPanel`（两端 `ICELinkHook`），
  语义是"拖动端点改变连接关系"，由组件 state 的 **`linkEditable`（默认 true）** 单独控制；
  `transformable` 只管旋转/缩放手柄。**应用层"记法不可变换"只能写 `transformable: false`**，
  用它去关端点手柄会让 hook / slot 一起消失（ice-entity-designer 8 个域包踩过）；真要禁止改连接写 `linkEditable: false`。
  回归：`tests/control-panel/control-panel-selection-gate.test.ts`。
- **拖拽归属**：`DOMEventDispatcher` 在按下时记住 drag owner，抬起时**先补派给它**再按命中结果派发
  （总线仍只触发一次）。没有这条，"按下 A → 拖到 B 上松手"时 A 收不到 mouseup —— 端点手柄正是靠
  `mouseup → HOOK_MOUSEUP → ICELinkSlotManager` 才把连线改接到落点插槽，丢了就"拖得动、放不下"。
  回归：`tests/event/DOMEventDispatcher.drag-owner.test.ts`。
- 两者合起来才是完整用户路径：**点连线 → 出端点手柄 → 拖到别的组件上出插槽 → 松手改接**
  （ice-entity-designer 的 `e2e/link-hooks.spec.ts` 钉住整条链路）。
- **定位铁律（2026-09-13 实测 bpmn-editor 后确立）**：① `LineControlPanel` 自身必须落在原点
  （两个端点手柄是它的子组件，面板一带偏移手柄就整体偏离端点）；② `ICELinkSlot` 的
  `hostComponent` setter **必须立刻 `updatePosition()`** —— 只订阅新宿主的 `AFTER_RENDER`
  会让插槽沿用**上一个宿主**的位置（钩子掠过大泳道再落到小任务上时，插槽留在泳道边上）。
  回归：`tests/control-panel/line-control-panel.test.ts`、`tests/link/link-slot.test.ts`、
  ice-entity-designer 的 `e2e/link-hooks-bpmn.spec.ts`。


## 提交前自检

- 一条命令跑完全部门禁：**`npm run verify`**（lint → types:check → build → jest → bench 2000 → pkg:check）；
  需要浏览器回归时用 `npm run verify:full`（再追加 Playwright 全量、bench:anim / bench:layers / bench:micro）。
- **性能门禁（2026-09-14 补）**：`bench/render.cjs` 与 `bench/micro` 以前只打印数字、靠人眼看，
  现在都能判定 —— `npm run bench <N> -- --check`（基线 `bench/baselines/render.json`）、
  `npm run bench:micro -- --check`（基线 `bench/micro/baseline.json`），实测超基线 2.0× / 2.5× 即非 0 退出。
  **改完性能相关代码要跑 `verify:full`**；确有必要刷新基线时才用 `--update-baseline`（并在提交信息里说明原因）。
- CI（`.github/workflows/ci.yml`，跑在 GitHub 镜像上）执行的是同一批步骤；**主仓 Gitee 没有 runner**，
  所以 Gitee 侧的改动质量完全依赖本地跑 `npm run verify`。

## 测试约定

- `npm test` 运行 jest（node 环境，babel-jest 编译 TS/JS）。
- 单测统一放在顶层 `tests/` 目录（镜像 `src/` 结构，如 `tests/graphic/` 对应 `src/graphic/`），**不混入源码目录**；`jest.config.js` 的 `testMatch` 为 `**/tests/**/*.test.ts`。
- 测试文件从 `tests/<子目录>/` 导入源码用相对路径 `../../src/...`；涉及 DOM/Canvas 的模块需 `jest.mock('../../src/cross-platform/root', ...)` + `global.Path2D` 桩（node 环境无 window）。
- `npm test` 走 jest（babel-jest），`npm run types:check` 走 `tsc --noEmit`，`npm run build` 走 `tsc --emitDeclarationOnly` + rollup。迁移完成后三者均应零错误。
