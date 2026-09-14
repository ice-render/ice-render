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
- **输入矩形每帧重读铁律（2026-09-12 修复悬停整体错位后确立）**：`DOMEventDispatcher.__resolveCanvasRect`
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
- **类型注册 / 序列化铁律（2026-09-13 命名空间化确立）**：类型标识（typeId）统一为 **`namespace:Type`**，且**只有这一种形式**（正则 `/^[a-z][a-z0-9-]*:[A-Za-z_][A-Za-z0-9_-]*$/`，工具函数 `src/util/type-id.ts`）。引擎内置用 `ice-render:*`，实体设计器 `ice-entity-designer:*`，图表 `ice-chart:*`，第三方用自己的小写包名。约定：① 内置类型在 `ICE` 构造函数里经 `registerType()` 注册（`src/consts/COMPONENT_TYPE_MAPPING.ts` 只提供条目表），**不再**在 `init()` 里拷贝映射；② `registerType(typeId, Ctor)` —— 同一 typeId 注册**不同**构造函数、或同一构造函数注册**第二个** typeId，都**明确抛错**（后者会让 `getTypeId` 反查歧义）；同一 typeId + 同一构造函数视为幂等；③ **不做旧名兼容**：家族仍在发布初期，不为无 namespace 的历史类名维护别名表——旧格式数据里的节点按「未注册类型」处理；④ `typeMapping` 是**无原型对象**，`getType('constructor')` 不会命中 `Object.prototype`；⑤ 序列化由 `ice.getTypeId(ctor)` **反查**（与类的 JS 名解耦，压缩改名不破坏已存数据），未注册类型才回退 `constructor.name`，此时 `Serializer.unregisteredTypes` 会记录并告警（回退名可能被下游 mangle，读不回来）；反序列化遇到未注册类型跳过该节点（含子树）并记入 `deserializer.unknownTypes`，不再整份数据打不开。格式带 `version` 与 `SERIALIZATION_MIGRATIONS`。回归用例见 `tests/persistence/type-id.test.ts`、`tests/persistence/type-registry.test.ts`。
- **渲染队列缓存铁律（2026-09-08 性能优化确立）**：任何改变组件树结构的入口——`ICE.addChild/addChildren/removeChild/removeChildren/clearAll/addTool/removeTool`、`ICEGroup.addChild/addChildren/removeChild/removeChildren`——都必须经 `renderer.markQueueDirty()` 通知渲染器重建队列；否则稳态帧会沿用过期队列，导致新增/删除的组件不被渲染或绘制顺序错乱。`zIndex` 变更（经 `setState`）无需手动标记，渲染器在稳态帧通过 O(n) 比对自动重排序。仓库内所有结构性入口已挂接该调用。回归用例见 `tests/renderer/CanvasRenderer.queue.test.ts`。
- **多实例 / 分层渲染铁律（2026-09-13 确立）**：① 同一页面可以有多个 `ICE` 实例（`FrameManager` 是全局单例、天然同帧），**分层渲染（静态层 + 动画层）由应用按配方组织**：层数 ≤2~3、静态层只在内容变化时置 `dirty`、动画元素放上层、上层默认 `setInputPassthrough(true)`、两层 `ICE.linkViewport(a, b)` 绑定视口；每层内存 ≈ `宽×高×4B×dpr²`（1600×1000：dpr=1 约 6.4MB、dpr=2 约 25.6MB）。实测 10000 静态元素 + 200 动画标记：单画布 26~34ms/帧 → 分层 0.4~0.6ms（`npm run bench:layers`，动画期间静态层重绘 0 次）。② **事件归属**：全局拦截器把原生输入广播给所有总线，因此"按下/滚轮"事件必须按**目标 canvas** 过滤 —— 目标是**别人的 canvas** → 本实例忽略；否则分层里"上层 pointer-events:none"形同虚设（下层照样被点中）。**移动/抬起事件不得过滤**（无 PointerCapture 的 mouse 回退路径下，拖拽途中指针划过另一张画布会丢事件）。回归见 `tests/ICE.layered-input.test.ts`、`tests/event/DOMEventDispatcher.multi-instance.test.ts`、`e2e/visual/layered.spec.ts`、`examples/animation/layered-canvas.html`。③ **跨层迁移**（拖拽期间把元素提升到动画层）用 `sourceIce.moveComponentTo(component, targetIce, targetParent?)`：保持世界坐标、不销毁、子树递归重绑、动画注册与选中态由目标实例接管；配套 `ice.detachChild()`（摘除不销毁）与 `rebindComponentTree()`（**必须显式重绑**：`ICEGroup` 的 AFTER_ADD 子树同步是 `once`，对「已经挂过」的容器不会再触发 —— 少了这步，搬过去之后后代仍把事件发到旧实例）。分层导出：矢量用 `exportSvg([layerA, layerB], { area: 'viewport' })`（数组序 = 叠加序，content 模式各层共用覆盖全部层的包围盒 → 层间按世界坐标对齐；单层传单个 target 输出不变），位图用 `composeLayersDataURL([layerA, layerB], { background })`（`ice.toDataURL()` 只拿得到自己那一层）。回归见 `tests/export/svg-export.test.ts`、`tests/export/compose-layers.test.ts`、`e2e/visual/layered.spec.ts`。
- **挂载去重性能铁律（2026-09-10 确立）**：`ICE.addChild/addTool`、`ICEGroup.addChild` 的重复检测必须用 `WeakSet`（O(1)），严禁 `childNodes.indexOf()`（O(n)）。批量挂载 N 个组件时 indexOf 累计是 O(n²)，压测中 10 万→100 万构建时间因此被放大到数十倍；改 WeakSet 后 100 万构建从 ~41s 降到 ~6s。删除路径（`removeChild/removeTool`）须同步 `WeakSet.delete`，否则组件删除后无法重新挂载。回归用例见 `tests/ICE.add-child.test.ts`。
- **默认 props/state 原型共享铁律（2026-09-10 确立）**：`ICEComponent` 的默认 props 与 state 都改为 `Object.create(DEFAULT_PROPS)` 原型继承共享默认（`DEFAULT_PROPS` 顶层不冻结、嵌套 `style/transform/lineDash/animations` 冻结）；`id`/`zIndex` 每实例单独生成。`merge` 对「继承的嵌套对象」做写时复制（先 cloneDeep 到 own 再递归合并），严禁原地合并到共享默认对象，否则一个组件改 style 会串味到所有组件。state 是独立对象：用户传入字段深拷贝到 own、运行时派生字段（`linearMatrix/composedMatrix/localOrigin/absoluteOrigin`）预分配 own 空值，因此任何「直接写 state」（含跨组件写 `el.state.interactive` 等）都不会污染 props 或共享默认。内存收益：100 万最小矩形堆增量从 ~2.0GB 降到 ~0.87GB（省约 56%）。回归用例见 `tests/graphic/ICEComponent.props-sharing.test.ts` 与 `tests/persistence/serialization.test.ts`。
- **视口缩放铁律（2026-09-10 确立，路线 B）**：画布缩放是「视图缩放」而非「图元缩放」，通过 `ICE.viewport = { scale, tx, ty }` 实现（屏幕 = 世界 * scale + translate），默认单位视口不影响既有行为。约束：① `setViewport()` 只改视口状态并 `markQueueDirty()` 回退一次全量，**严禁修改任何组件的 state**；② 组件 `render()` 在主 ctx 应用**渲染视口**（CTM = `getRenderViewport() · composedMatrix`；渲染视口 = 视口 × dpr），`renderTo()`（离屏缓存）把渲染视口编码进**自己的 base 矩阵**；③ 命中检测 `DOMEventDispatcher` 必须先把屏幕坐标 `screenToWorld()` 回世界坐标再 `containsPoint`；④ dirty-rect 的脏区在世界坐标里收集、`clearRect`/`clip` 在**渲染坐标**里，换算只有 `mapBoxToRender()` 一处（视口缩放/平移与 `dpr>1` 都走这条路，**不再回退全量**）；⑤ 离屏缓存的贴图是**整数设备像素落点 + 1:1**（详见「组件级离屏缓存铁律」的保真契约）。回归用例见 `tests/ICE.viewport.test.ts`、`e2e/visual/viewport.spec.ts`、`examples/viewport/viewport-zoom.html`。
- **对齐吸附铁律（2026-09-10 确立）**：`AlignmentGuideManager` 默认禁用，应用层 `ice.alignmentGuide.enable(options)` 显式启用，未启用时零开销、零副作用。约束：① 吸附是「视图交互」层，只监听被拖组件的 `AFTER_MOVE` 修正 `left/top`，并在工具层（toolNodes）画提示线，严禁修改组件其他 state；② **吸附必须 X/Y 两轴分别计算**（`computeSnap` 返回 `{x,y}`，两轴各自取最小 delta），不能只返回单轴，否则「本已对齐的轴」会以 delta=0 抢占另一轴的吸附；③ 阈值是屏幕像素，计算时按 `1/viewport.scale` 换算成世界坐标；④ 提示线是临时组件，拖拽结束必须清除；⑤ 支持边缘/中心/等间距（source 中心位于两目标中心中点），三类均可配置开关。回归用例见 `tests/control-panel/AlignmentGuideManager.test.ts`、`e2e/visual/alignment.spec.ts`、`examples/alignment/alignment-snap.html`。
- **判类型不得依赖类名铁律（2026-09-11 确立，2026-09-13 补 typeId 格式约定）**：**严禁**用 `component.constructor.name === 'Xxx'` 判类型。消费者的打包器会把类名 mangle（实测 webpack 生产构建下 `Entity`/`Relation` → `Dr`/`Br`），这类判断会**静默失效**：分拣结果恒为空、`setXxx` 变 no-op、`toSchemaObject` 返回空，而页面不报任何错。正确做法：① 引擎内用 `ice.getTypeId(ctor)`（注册名反查）；② 需要「纯函数、不依赖 ICE 实例」的场景在类上加 `static readonly typeId`（属性名默认不被压缩，子类可继承），**值必须是 canonical typeId（`namespace:Type`，见上方序列化铁律）**；判断时用 `ice.getType(x.typeId) === X` 解析（这样旧快照里的无 namespace 别名也能命中），跨实例 / 不持有 ICE 时用 `x instanceof X`；③ 组件间做身份判断可用 `instanceof`。注意本缺陷在包内**测不出来**——开发态不压缩、本项目 rollup 又配了 `keep_classnames`，只有下游打包才现形，因此必须显式模拟改名来回归（`ice-entity-designer` 的 `tests/designer/type-mangling.test.ts` 用 `Object.defineProperty(Class, 'name', ...)` 做了示范，并配了 ESLint `no-restricted-syntax` 门禁）。
- **矩阵计算零分配铁律（2026-09-08 性能优化确立）**：`calcLinearMatrix` 复用 `state.linearMatrix`；`calcAbsoluteLinearMatrix` 复用每实例的 `__absScratchA/__absScratchB` 做祖先连乘；`composeMatrix` 复用 `state.composedMatrix` 与平移 scratch `__transScratch`。这些缓冲是普通数组（非 `mat2d.create()` 的 `Float32Array`），以保持矩阵为 `Array` 类型，兼容序列化与 `Array.isArray` 约定。改动矩阵逻辑时不得重新引入每帧 `mat2d.x([], ...)` 式的新数组分配。
- **脏矩形局部重绘铁律（2026-09-09 v1 确立）**：默认渲染路径为 `dirty-rect`（`ICE.init(ctx, { renderMode })` 可切 `'full'`；`renderer.setRenderMode/__forceFullRender` 为内部测试钩子，非公开 API）。全量路径 `doRenderFull()` 原样保留为参考与回退。约束：① 组件渲染上下文必须自包含——`render()` 末尾 `__resetLeakyCtxState()` 把本组件写过的泄漏属性（shadow/globalAlpha/globalCompositeOperation/lineCap/lineJoin/miterLimit/textAlign/textBaseline/虚线）归位，这是 full 与 partial 逐像素一致的前提；② 结构变更（markQueueDirty）仍回退全量并重建快照（WeakMap，存每组件上次上屏的世界盒）；③ **相交级门控**（2026-09-10 由 v1「整场景」细化而来）：干净的「非不透明落墨 / 点集路径(dot-path) / ICEText」只在与本次脏区**相交**时才回退全量；已离屏缓存的同类组件不阻塞局部重绘（主画布只是 `drawImage` 不透明位图）。**刚变脏的「非文本」risky 组件也放行**（old∪new 盒已并入脏区，clip 切不到墨迹）；刚变脏的**文本**只有「仅位置变化 + 已缓存」才放行（字形墨迹可能超出几何盒）。③' **`coalesceRegions` 必须带「划算护栏」**：只合并「合并后面积 ≤ 两块面积之和 × 2」的盒，且 `maxRegions` 是**软**上限（没有划算的合并时宁可多留几块，超 24 才塌缩成一个并集盒）—— 否则细长盒（横跨画布的关系连线）会被串成一个整屏大盒，`面积占比 > 0.35` 那条门会把局部重绘**永久**挡在门外（编辑器实测 100% 回退）。实测富场景（含旋转组/文本/星形/连线/半透明控制面板）局部重绘执行次数由 **0 → 2**，10 步逐像素比对仍 100% 一致；④ `display:false` 组件擦除旧区域后清脏位并删快照，避免「永久脏组件」把后续局部帧反复顶成全量；⑤ 局部帧 `BEFORE_RENDER/AFTER_RENDER` 仅对区域内的组件触发（有意的可观测差异，内部无依赖）。
- **组件级离屏缓存铁律（2026-09-10 确立，v3 扩展 dot-path/半透明 shape）**：`CanvasRenderer` 内置 `ObjectCache`（`WeakMap`，与快照同生命周期、不污染组件 state/props），缓存「非编辑态、可见」的 `ICEText`、「封闭点集路径」（星形/正N边形/玫瑰，面积 `>= 40000`（200x200）；排除连线类 `isLine` 与蚂蚁线 `lineDashFlow`）与「半透明普通 path 图形」（rgba/阴影/globalAlpha/composite；排除容器/图片/连线）。约束：① `ICEComponent.renderTo(targetCtx, baseMatrix)` 把组件渲染重定向到离屏 ctx，最终 CTM = `baseMatrix · composedMatrix`，`render()` 语义保持不变；② 缓存命中帧（未 dirty 且已有 cache）直接 `drawImage`，跳过 `measureText/fillText/strokeText` 或 `calcDots/路径重建/fill/stroke`；③ 纯平移（内容指纹 + 线性部分 a,b,c,d 不变、仅 e,f 变化）复用位图，只刷新贴图位置，不重建；④ 仅当内容指纹（`ObjectCache.contentKey`）或线性变换变化时才重建位图；⑤ **像素保真契约（2026-09-11 修正，硬性）**：位图必须与「直接落墨」逐像素一致，否则缓存就是**画质回归**。做法是把位图栅格**对齐到主画布的设备像素栅格**：光栅化缩放取渲染视口的 `scale`（`getRenderViewport().scale`，已含 dpr 与视口缩放，**不要用 `root.devicePixelRatio`**），base 矩阵显式写成 `[rs,0,0,rs, ox-dx, oy-dy]`（不是 `translate(-minX,-minY)`），贴图落点 `dx/dy` 取**整数设备像素**、以 1:1 贴回（`drawImage(img, dx, dy)`，**不传目标宽高**）。于是 `device(world) = world*rs + (ox,oy)` 被「位图内坐标 + 整数平移」精确复现，全程零重采样。
  另外：① **不要**依赖 `ctx.scale()` 放大离屏上下文 —— `renderTo()` 内部的 `setTransform()` 会把整条 CTM 覆盖掉（踩过这个坑，是死代码）；② 子类在 `super.doRender()` 之后复原变换必须用 **`applyActiveTransform()`**（它同时适配主画布与离屏通道），**严禁** `applyTransformToCtx(null, true)` —— 那条路径按主画布视口重算，会丢掉位图原点的平移（连线箭头/标签会在缓存位图里整块消失）；③ 重建位图前要扣回旧条目的字节数（否则总预算被提前耗尽）；④ 缓存只在**视口稳定**的帧生效：`CanvasRenderer` 每帧开头调 `cache.beginFrame()`，视口变过的那一帧 `isCachable` 一律返回 false（位图栅格已错位、重建代价与直接落墨同阶），手势停下后的第一帧再统一重建。回归用例见 `tests/renderer/offscreen-cache-fidelity.test.ts` 与 `e2e/visual/offscreen-cache-fidelity.spec.ts`（6 配置 × 12 步：alpha 零差异、预乘通道差 ≤3/255、墨迹守恒）。
⑤' **连线可以缓存**（2026-09-11）：`isLine` 不再一律排除，改为「按**设备像素面积**设上限」（单条 ≤200 万设备像素 ≈8MB、总量 ≤32MB、排除蚂蚁线 `lineDashFlow`）。连线横跨画布，排除它就等于「干净连线与脏区相交 → 回退全量」长期命中，富场景局部重绘 100% 失效。
⑤ **dots 与合成矩阵的配合**：`ICEDotPath.calcLocalOrigin()` 会把 `dots` 平移到「以 origin 为原点」，实现为**只补「目标平移量 − 已应用平移量」的差额**，因此 `composeMatrix()` 对 dots **幂等**（旧实现每次 compose 都无条件再平移一个 origin，连续 compose 会累积偏移，曾迫使所有调用方「compose 前先重算 dots」）。`ObjectCache.render` 在 dirty 分支用 `refreshParams()` **按需**刷新点集（自身派生参数变脏时才重算），再 `composeMatrix()`；⑥ 已缓存组件在 `__sceneAllowsPartial` 中视为「不透明位图贴图」，不再因字形/点集路径/半透明落墨的 clip 边界 AA 问题阻塞局部重绘（像素一致性回归见 `e2e/visual/dirty-rect-pixel.spec.ts` 的 `?opaque=1&text=1`、`?opaque=1&star=1` 与 `?opaque=1&alpha=1`）；⑦ 离屏 canvas 走 `root.createOffscreenCanvas` 平台抽象（浏览器 `document.createElement('canvas')` / 小程序 `wx.createOffscreenCanvas({type:'2d'})`），尺寸按「渲染视口缩放 × 世界盒尺寸」算（含四周各 1px 透明余量，用于吸收贴图取整误差）；⑧ 缓存是运行时状态，严禁写入组件 `state/props`（序列化安全）。**性能铁律：大量小图形（面积 < 40000）不缓存，否则 drawImage 反超直接 fill/stroke（见 perf 回退记录）**。回归用例见 `tests/renderer/ObjectCache.test.ts`、`tests/renderer/CanvasRenderer.cache.test.ts`、`tests/graphic/ICEComponent.render-to.test.ts`、`tests/cross-platform/root.offscreen.test.ts`。
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

## 已知技术债（严重度）

> 复核日期 **2026-09-11**。此前本节长期停留在「8 suite / 36 用例」等早期口径，与仓库实际严重脱节，已按实测重写。

- ~~P0：零单元测试~~ → **已偿还**：jest 单测 **101 个 suite / 788 个用例**（2026-09-13 实测），`jest.config.js` 配了「只许上调」的覆盖率门槛（语句 65 / 分支 58 / 函数 72 / 行 65），CI 用 `npm test -- --coverage` 跑。可视化/交互/像素一致性另有 Playwright（`e2e/`，`npm run test:visual`，**75 条**）。
- ~~P2：`tests/` 里 49 个 HTML 全是无断言的手测 demo~~ → **已收敛**：重命名为 `examples/`，由 `examples/generate-index.cjs` 生成导航页（88 个示例），自动化单测统一放顶层 `tests/`（镜像 `src/` 结构）。
  生成器跳过 `assets` / `node_modules` / 点开头目录（2026-09-13 修：此前会误收 `examples/mini-program/node_modules/**` 里第三方自带的示例 html，导航页从 88 条变 95 条）；`tests/tooling/examples-index.test.ts` 会静态校验「导航页 ↔ 磁盘示例文件」双向一致，所以新增示例后忘了重新生成也会红。
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

- 核心引擎在 `dev` 分支开发，远程 `origin/dev`（Gitee）+ `github-origin/dev`（GitHub），两处都要推。
- **分支与发版铁律（2026-09-13 确立）**：开发一律在 `dev`（或从它切出来的临时分支）上做，
  `master` 只做集成与发版；**发版前必须先把 `dev` 合并进 `master`，再从 `master` 发版**
  （`git checkout master && git merge --no-ff dev` → 跑门禁 → `npm publish`）。
  **禁止**直接在 `master` 上写实现，也禁止只更新 `dev` 而让 `master` 停在旧版本 ——
  本仓 2026-09-13 就踩过：远端默认分支是 `master`，而 2.x 全发在 `dev` 上，
  仓库首页长期显示 1.4.10 时代的代码（后来才补上快进）。远端默认分支必须指向 `master`，
  且发版后它与 `dev` 内容一致。
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
