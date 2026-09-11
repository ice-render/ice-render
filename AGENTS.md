# AGENTS.md — ice-render

## 项目定位

Canvas 2D 交互图形渲染引擎（MIT，作者 大漠穷秋）。运行时依赖仅 `gl-matrix`（`lodash` 已用 `src/util/lang.ts` 自研工具替代）。
本文件是仓库级共享约定，agent 与人类协作者都应遵循。

## 引擎架构铁律（改动前必读）

- 运行时链路：`FrameManager`（全局单例，包装 rAF）→ `EventBus`（每 ICE 实例一条）→ 各 Manager 订阅 → `CanvasRenderer`。
- `ICE.init()` 中 Manager 启动有严格顺序：`EventBus` 最先；`linkSlotManager` 必须在 `renderer` 之后（它监听 renderer 事件）。
- 渲染策略：脏标记（`ICE.dirty` / 组件 `dirty`）+ 默认**脏矩形局部重绘**（`renderMode: 'dirty-rect'`，条件不满足时回退全量 `doRenderFull()`）；详见下方「脏矩形局部重绘铁律」。渲染队列（`componentQueue`/`toolsQueue`）带缓存：仅在结构变更（`addChild`/`removeChild` 等）时由 `CanvasRenderer.markQueueDirty()` 触发 `flattenTree`+`sort` 重建；稳态帧仅做 O(n) 的 `zIndex` 稳定性比对，树结构不变则复用队列，不重复递归展平。
- 组件模型：`props`（构造入参，`merge`）与 `state`（`cloneDeep(props)`，动画改 state）分离，概念借鉴 React；`merge`/`cloneDeep` 见 `src/util/lang.ts`。
- 类继承：`ICEEventTarget → ICEComponent(abstract) → ICEPath(abstract) → ICEDotPath(abstract) → 图元`；`ICEGroup extends ICERect`；`ICEControlPanel extends ICEGroup`；`ICELinkSlot/ICELinkHook/RotateControl extends ICECircle`；`ICEBezier extends ICEPolyLine`（复用 `curveType` 曲线绘制）。
- 变换基于 `gl-matrix` 的 `mat2d`，自带 `gl-matrix-skew.ts` 补 skew（gl-matrix 原生不支持）。
- **嵌套坐标系矩阵组合铁律（2026-09-08 修复重大 bug 后确立）**：组件的 `composedMatrix = T(absoluteOrigin) · absoluteLinearMatrix`，其中 `absoluteLinearMatrix = 祖先① · 祖先② · … · 自身线性矩阵`（列向量约定，越靠近根越外层）。`calcAbsoluteLinearMatrix()` 与 `composeMatrix()` 必须**实时重新计算每一层祖先的线性矩阵 / composedMatrix**，严禁读取祖先缓存的 `state.linearMatrix` / `state.composedMatrix` / `state.absoluteLinearMatrix`（这些默认是空数组 `[]`，且可能是上一帧脏值，是嵌套坐标算错的根因）。`moveGlobalPosition/setGlobalPosition/setGlobalRotate` 同样必须调 `parentNode.calcAbsoluteLinearMatrix()` 取新鲜值。回归用例见 `tests/graphic/ICEComponent.nested-coordinate.test.ts`。
- **变换手柄坐标铁律（2026-09-08 修复手柄脱离图元 bug 后确立）**：`TransformControlPanel.resizeEvtHandler`、`ResizeControl.moveGlobalPosition/resizeEvtHandler`、`RotateControl.rotateEvtHandler` 在把全局位移换算到本地时，必须调用 `calcAbsoluteLinearMatrix()` / `calcAbsoluteOrigin()` **实时重算**，严禁读取 `state.absoluteLinearMatrix` / `state.absoluteOrigin` 缓存（这些值在两次渲染之间会过期，连续拖动/缩放/旋转会导致手柄脱离宿主组件）。此外，**面板的 `left/top/width/height` 必须始终从目标组件重新推导**：`resizeEvtHandler`/`rotateEvtHandler` 改变目标后必须调用 `updatePanel()` 重新同步（面板宽高是目标旋转后包围盒的尺寸，随旋转变化，不能独立计算）。回归用例见 `tests/control-panel/transform-control.test.ts`。
- **变换手柄象限唯一性铁律（2026-09-08 修复手柄消失后确立）**：`toggleControlQuadrant(control, oldQuadrant, newQuadrant)` 必须把「原占据 newQuadrant 的手柄」顶替到 `oldQuadrant`（即 old↔new 互换），严禁用固定的「对角映射」(1↔3/2↔4)。此前当手柄跨到**相邻**象限（如 1→2）时会产出重复象限、两个手柄重叠、看起来消失一个。8 个 resize 手柄的象限必须始终保持唯一（`Set(quadrants).size === 8`）。回归用例见 `tests/control-panel/transform-control.test.ts` 与 `e2e/visual/interaction.spec.ts`。
- **命中检测铁律（2026-09-08 修复 N 层嵌套下点不中子组件后确立）**：`DOMEventDispatcher.findTargetComponent()` 必须跳过 `isControlPanel` 的控制面板本体（它是覆盖在目标上的工具层、zIndex 最高），否则面板会遮挡被选组件及其子组件，导致嵌套场景下点不中子组件。面板的子手柄（`ResizeControl`/`RotateControl`）不是 `isControlPanel`，仍需参与命中以保证缩放/旋转可用。回归用例见 `tests/event/DOMEventDispatcher.test.ts`。
- 序列化：`Serializer`/`Deserializer` + `COMPONENT_TYPE_MAPPING` 做「注册名 ↔ 构造函数」双向映射；写出时用 `ice.getTypeId(ctor)` **反查注册名**（与类的 JS 名解耦，压缩改名不破坏已存数据），未注册类型才回退 `constructor.name`。格式带 `version` 与 `SERIALIZATION_MIGRATIONS`；未注册类型反序列化时跳过该节点并记入 `deserializer.unknownTypes`，不再整份数据打不开。自定义组件需 `ice.registerType()` 后才能反序列化。
- **渲染队列缓存铁律（2026-09-08 性能优化确立）**：任何改变组件树结构的入口——`ICE.addChild/addChildren/removeChild/removeChildren/clearAll/addTool/removeTool`、`ICEGroup.addChild/addChildren/removeChild/removeChildren`——都必须经 `renderer.markQueueDirty()` 通知渲染器重建队列；否则稳态帧会沿用过期队列，导致新增/删除的组件不被渲染或绘制顺序错乱。`zIndex` 变更（经 `setState`）无需手动标记，渲染器在稳态帧通过 O(n) 比对自动重排序。仓库内所有结构性入口已挂接该调用。回归用例见 `tests/renderer/CanvasRenderer.queue.test.ts`。
- **挂载去重性能铁律（2026-09-10 确立）**：`ICE.addChild/addTool`、`ICEGroup.addChild` 的重复检测必须用 `WeakSet`（O(1)），严禁 `childNodes.indexOf()`（O(n)）。批量挂载 N 个组件时 indexOf 累计是 O(n²)，压测中 10 万→100 万构建时间因此被放大到数十倍；改 WeakSet 后 100 万构建从 ~41s 降到 ~6s。删除路径（`removeChild/removeTool`）须同步 `WeakSet.delete`，否则组件删除后无法重新挂载。回归用例见 `tests/ICE.add-child.test.ts`。
- **默认 props/state 原型共享铁律（2026-09-10 确立）**：`ICEComponent` 的默认 props 与 state 都改为 `Object.create(DEFAULT_PROPS)` 原型继承共享默认（`DEFAULT_PROPS` 顶层不冻结、嵌套 `style/transform/lineDash/animations` 冻结）；`id`/`zIndex` 每实例单独生成。`merge` 对「继承的嵌套对象」做写时复制（先 cloneDeep 到 own 再递归合并），严禁原地合并到共享默认对象，否则一个组件改 style 会串味到所有组件。state 是独立对象：用户传入字段深拷贝到 own、运行时派生字段（`linearMatrix/composedMatrix/localOrigin/absoluteOrigin`）预分配 own 空值，因此任何「直接写 state」（含跨组件写 `el.state.interactive` 等）都不会污染 props 或共享默认。内存收益：100 万最小矩形堆增量从 ~2.0GB 降到 ~0.87GB（省约 56%）。回归用例见 `tests/graphic/ICEComponent.props-sharing.test.ts` 与 `tests/persistence/serialization.test.ts`。
- **视口缩放铁律（2026-09-10 确立，路线 B）**：画布缩放是「视图缩放」而非「图元缩放」，通过 `ICE.viewport = { scale, tx, ty }` 实现（屏幕 = 世界 * scale + translate），默认单位视口不影响既有行为。约束：① `setViewport()` 只改视口状态并 `markQueueDirty()` 回退一次全量，**严禁修改任何组件的 state**；② 组件 `render()` 在主 ctx 应用视口（CTM = `viewport · composedMatrix`），`renderTo()`（离屏缓存）不应用视口（缓存位图是世界坐标）；③ 命中检测 `DOMEventDispatcher` 必须先把屏幕坐标 `screenToWorld()` 回世界坐标再 `containsPoint`；④ dirty-rect 在视口非单位时回退全量（世界盒与屏幕 clearRect/clip 不一致）；⑤ 离屏缓存 drawImage 按视口缩放/平移到屏幕。回归用例见 `tests/ICE.viewport.test.ts`、`e2e/visual/viewport.spec.ts`、`examples/viewport/viewport-zoom.html`。
- **对齐吸附铁律（2026-09-10 确立）**：`AlignmentGuideManager` 默认禁用，应用层 `ice.alignmentGuide.enable(options)` 显式启用，未启用时零开销、零副作用。约束：① 吸附是「视图交互」层，只监听被拖组件的 `AFTER_MOVE` 修正 `left/top`，并在工具层（toolNodes）画提示线，严禁修改组件其他 state；② **吸附必须 X/Y 两轴分别计算**（`computeSnap` 返回 `{x,y}`，两轴各自取最小 delta），不能只返回单轴，否则「本已对齐的轴」会以 delta=0 抢占另一轴的吸附；③ 阈值是屏幕像素，计算时按 `1/viewport.scale` 换算成世界坐标；④ 提示线是临时组件，拖拽结束必须清除；⑤ 支持边缘/中心/等间距（source 中心位于两目标中心中点），三类均可配置开关。回归用例见 `tests/control-panel/AlignmentGuideManager.test.ts`、`e2e/visual/alignment.spec.ts`、`examples/alignment/alignment-snap.html`。
- **判类型不得依赖类名铁律（2026-09-11 确立）**：**严禁**用 `component.constructor.name === 'Xxx'` 判类型。消费者的打包器会把类名 mangle（实测 webpack 生产构建下 `Entity`/`Relation` → `Dr`/`Br`），这类判断会**静默失效**：分拣结果恒为空、`setXxx` 变 no-op、`toSchemaObject` 返回空，而页面不报任何错。正确做法：① 引擎内用 `ice.getTypeId(ctor)`（注册名反查）；② 需要「纯函数、不依赖 ICE 实例」的场景在类上加 `static readonly typeId`（属性名默认不被压缩，子类可继承）；③ 组件间做身份判断可用 `instanceof`。注意本缺陷在包内**测不出来**——开发态不压缩、本项目 rollup 又配了 `keep_classnames`，只有下游打包才现形，因此必须显式模拟改名来回归（`ice-entity-designer` 的 `tests/designer/type-mangling.test.ts` 用 `Object.defineProperty(Class, 'name', ...)` 做了示范，并配了 ESLint `no-restricted-syntax` 门禁）。
- **矩阵计算零分配铁律（2026-09-08 性能优化确立）**：`calcLinearMatrix` 复用 `state.linearMatrix`；`calcAbsoluteLinearMatrix` 复用每实例的 `__absScratchA/__absScratchB` 做祖先连乘；`composeMatrix` 复用 `state.composedMatrix` 与平移 scratch `__transScratch`。这些缓冲是普通数组（非 `mat2d.create()` 的 `Float32Array`），以保持矩阵为 `Array` 类型，兼容序列化与 `Array.isArray` 约定。改动矩阵逻辑时不得重新引入每帧 `mat2d.x([], ...)` 式的新数组分配。
- **脏矩形局部重绘铁律（2026-09-09 v1 确立）**：默认渲染路径为 `dirty-rect`（`ICE.init(ctx, { renderMode })` 可切 `'full'`；`renderer.setRenderMode/__forceFullRender` 为内部测试钩子，非公开 API）。全量路径 `doRenderFull()` 原样保留为参考与回退。约束：① 组件渲染上下文必须自包含——`render()` 末尾 `__resetLeakyCtxState()` 把本组件写过的泄漏属性（shadow/globalAlpha/globalCompositeOperation/lineCap/lineJoin/miterLimit/textAlign/textBaseline/虚线）归位，这是 full 与 partial 逐像素一致的前提；② 结构变更（markQueueDirty）仍回退全量并重建快照（WeakMap，存每组件上次上屏的世界盒）；③ **相交级门控**（2026-09-10 由 v1「整场景」细化而来）：干净的「非不透明落墨 / 点集路径(dot-path) / ICEText」只在与本次脏区**相交**时才回退全量；**刚变脏的同类组件一律回退**（实测文本内容变更时墨迹会超出几何盒，clip 下重绘无法与全量逐像素一致）；已离屏缓存的同类组件不阻塞局部重绘（主画布只是 `drawImage` 不透明位图）。实测富场景（含旋转组/文本/星形/连线/半透明控制面板）局部重绘执行次数由 **0 → 2**，10 步逐像素比对仍 100% 一致；④ `display:false` 组件擦除旧区域后清脏位并删快照，避免「永久脏组件」把后续局部帧反复顶成全量；⑤ 局部帧 `BEFORE_RENDER/AFTER_RENDER` 仅对区域内的组件触发（有意的可观测差异，内部无依赖）。
- **组件级离屏缓存铁律（2026-09-10 确立，v3 扩展 dot-path/半透明 shape）**：`CanvasRenderer` 内置 `ObjectCache`（`WeakMap`，与快照同生命周期、不污染组件 state/props），缓存「非编辑态、可见」的 `ICEText`、「封闭点集路径」（星形/正N边形/玫瑰，面积 `>= 40000`（200x200）；排除连线类 `isLine` 与蚂蚁线 `lineDashFlow`）与「半透明普通 path 图形」（rgba/阴影/globalAlpha/composite；排除容器/图片/连线）。约束：① `ICEComponent.renderTo(targetCtx, baseMatrix)` 把组件渲染重定向到离屏 ctx，最终 CTM = `baseMatrix · composedMatrix`，`render()` 语义保持不变；② 缓存命中帧（未 dirty 且已有 cache）直接 `drawImage`，跳过 `measureText/fillText/strokeText` 或 `calcDots/路径重建/fill/stroke`；③ 纯平移（内容指纹 + 线性部分 a,b,c,d 不变、仅 e,f 变化）复用位图，只刷新贴图位置，不重建；④ 仅当内容指纹（`ObjectCache.contentKey`）或线性变换变化时才重建位图；⑤ **dots 与合成矩阵的配合**：`ICEDotPath.calcLocalOrigin()` 会把 `dots` 平移到「以 origin 为原点」，实现为**只补「目标平移量 − 已应用平移量」的差额**，因此 `composeMatrix()` 对 dots **幂等**（旧实现每次 compose 都无条件再平移一个 origin，连续 compose 会累积偏移，曾迫使所有调用方「compose 前先重算 dots」）。`ObjectCache.render` 在 dirty 分支用 `refreshParams()` **按需**刷新点集（自身派生参数变脏时才重算），再 `composeMatrix()`；⑥ 已缓存组件在 `__sceneAllowsPartial` 中视为「不透明位图贴图」，不再因字形/点集路径/半透明落墨的 clip 边界 AA 问题阻塞局部重绘（像素一致性回归见 `e2e/visual/dirty-rect-pixel.spec.ts` 的 `?opaque=1&text=1`、`?opaque=1&star=1` 与 `?opaque=1&alpha=1`）；⑦ 离屏 canvas 走 `root.createOffscreenCanvas` 平台抽象（浏览器 `document.createElement('canvas')` / 小程序 `wx.createOffscreenCanvas({type:'2d'})`），物理尺寸按 `root.devicePixelRatio` 缩放；⑧ 缓存是运行时状态，严禁写入组件 `state/props`（序列化安全）。**性能铁律：大量小图形（面积 < 40000）不缓存，否则 drawImage 反超直接 fill/stroke（见 perf 回退记录）**。回归用例见 `tests/renderer/ObjectCache.test.ts`、`tests/renderer/CanvasRenderer.cache.test.ts`、`tests/graphic/ICEComponent.render-to.test.ts`、`tests/cross-platform/root.offscreen.test.ts`。
- **`dirty` / `paramsDirty` 两级脏标记铁律（2026-09-11 确立）**：`dirty` = 需要重绘；`paramsDirty` = 自身派生参数（尺寸 / 点集 / 文本量测）需要重算，**只取决于自身 state，与祖先变换无关**。约束：① 容器 `setState` 递归给后代**只置 `dirty`，绝不置 `paramsDirty`**（祖先移动只需重绘，不需重量测）；② 所有要用派生参数的地方一律调 `refreshParams()`（按需重算 + 清标志），**不要直接调 `calcComponentParams()`**；③ 子类 `calcComponentParams()` 里的早退判断用 `this.paramsDirty`，**不要用 `this.dirty`**；④ 绕过 `setState` 直接改 `state` 几何的内部路径（如折线 `followComponent` / `recalculateRoute` 改 `state.points`）必须显式补 `this.paramsDirty = true`；⑤ 点集类子类实现 `__calcDots()`，**不要覆盖 `calcDots()`**（它是维护「已应用平移量」的唯一入口，覆盖会让幂等补偿失效）。实测（移动整组一帧）：`calcComponentParams` **10 → 0**、`calcDots` **6 → 0**，必须发生的重绘次数不变（8 次）。回归用例见 `tests/renderer/params-dirty.test.ts`。

- **包围盒唯一来源铁律（2026-09-11 确立）**：组件的**本地盒**只能由 `ICEComponent.__localBox()`（返回 `[x0,y0,x1,y1]`，默认 `[0,0,width,height]`）提供 —— `getMinBoundingBox()` 与渲染器的 `__paintWorldBox()` **都消费它**，因此二者必然一致。约束：① **不要**让任何一条路径自己去推导盒子（历史上 `__paintWorldBox()` 用 width/height、`getMinBoundingBox()` 被折线单独覆盖，两条路径不一致 → 上屏快照盒退化 → dirty-rect 漏画折线，这类 bug 只在「连线连上嵌套宿主」时才暴露，极难定位）；② 几何不遵守「自本地 (0,0) 起、尺寸 = width/height」约定的组件（如 `ICEPolyLine`：原点固定在起点、点集可含负坐标）**必须覆盖 `__localBox()`**；③ `calcComponentParams()` 里的宽高推导**不得用「顶点对相减」**（`points[1].x - points[0].x`）——`calc4VertexPoints()` 的返回顺序对非 bbox 角点无保证，必须取全部顶点的 min/max；④ 派生量之间不得有循环依赖（反例：`splitEndpointsTo4Points()` 曾用 `state.height` 当线宽输入，而 height 又是它的输出 → 结果随上一次的值漂移、首帧读到默认哨兵值）。回归用例见 `tests/link/polyline-basics.test.ts`（两条盒路径逐位一致）、`e2e/visual/dirty-rect-pixel.spec.ts`。

- **`once` 可摘除铁律（2026-09-11 确立）**：`ICEEventTarget.once(name, fn, scope)` 内部会把 `fn` 包成 `callback` 再 `on`，因此**必须在包装函数上留 `__onceOriginal = fn`**，`off` 也要同时匹配「包装函数」与「原始回调」——否则外部 `off(name, fn, scope)` 永远删不掉一次监听，只能等它自己触发一次。约束：① 注册在**跨组件 / 总线级**（如 `ice.evtBus`）上的监听，组件 `destory()` 时 `purgeEvents()` 清不掉（它清的是本组件的 `listeners`），**必须在 `destory()` 里显式 `off`，且要在 `super.destory()`（会置空 `evtBus`）之前**；② 事件回调要能容忍「组件已销毁」：写 `this.ice.xxx` 前先判空（全仓 `this.ice.dirty` 唯一一处漏判就在 `ICEPolyLine.syncConnections`，正是应用层 undo/redo 崩溃的来源）。回归用例见 `tests/event/once-off.test.ts`、`tests/link/polyline-destroy.test.ts`。

## 已知技术债（严重度）

> 复核日期 **2026-09-11**。此前本节长期停留在「8 suite / 36 用例」等早期口径，与仓库实际严重脱节，已按实测重写。

- ~~P0：零单元测试~~ → **已偿还**：jest 单测 **68 个 suite / 531 个用例**，`jest.config.js` 配了「只许上调」的覆盖率门槛（语句 65 / 分支 58 / 函数 72 / 行 65），CI 用 `npm test -- --coverage` 跑。可视化/交互/像素一致性另有 Playwright（`e2e/`）。
- ~~P2：`tests/` 里 49 个 HTML 全是无断言的手测 demo~~ → **已收敛**：重命名为 `examples/`，由 `examples/generate-index.cjs` 生成导航页（86 个示例），自动化单测统一放顶层 `tests/`（镜像 `src/` 结构）。
- ~~P1：`ice-flow` 的 `ice-render` 版本声明写错~~ → **已修复**（改为 `^1.0.4`；下游 `.npmrc` 配 `legacy-peer-deps` 解 `rollup-plugin-uglify` 的 ERESOLVE）。
- ~~P1：README 称"纯 TypeScript"但残留 7 个 `.js`~~ → **已偿还**：全部迁移为 `.ts`，`types:check` 与 `build:types` 零错误。
- ~~P2：`CanvasRenderer.doRender()` 未使用 `startTime` 死代码；`ICE.init()` 留有 `//FIXME:防止 init 方法被调用多次`~~ → **已偿还**（两者均已不存在）。
- **P2（仍在）**：下游 `ice-entity-designer` 的 `rollup` 2 / `typescript` 4.6 与引擎（rollup 3 / TS 5.9）仍分叉（eslint 已统一到 8）。副作用之一：`typescript@4.6.2` 的已发布包里带着 `prepare: gulp build-eslint-rules`，导致用 `file:` 链接该包的工程 `npm install` 会以 `code 127` 失败（需 `--ignore-scripts`；升到 TS 5.6+ 可根治）。
- **P2（仍在）**：`src/` 里还有 **23 处 TODO/FIXME**，集中在 `TransformControlPanel.ts`(6)、`ICEText.ts`(4)、`ICEVisioLink.ts`(3)、`LineControlPanel.ts`(3)。其中只有两条是实质性缺口，其余是「尺寸/样式应做成可配置参数」这类小项：
  - `ICEControlPanelManager` 的「按组件类型展现不同操作工具」需要进一步抽象（`src/control-panel/ICEControlPanelManager.ts:27`）——插件机制已提供 `tools` 注册点，可视为该抽象的第一层。
  - `TransformControlPanel` 的**斜切（skew）手柄**未做（引擎的 skew 变换本身可用，缺的是手柄 UI）。

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
