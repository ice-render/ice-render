# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 拟定下一个版本号为 **1.1.0**（新增能力向后兼容，但含几处「修正类」行为变化，见下方「需要注意」）。

### 新增

- **端点箭头样式可配 `arrowStyle: 'filled' | 'hollow'`（默认 `'filled'` 实心）**：
  线条端点三角箭头此前只有描边（看起来是空心），现在默认用**线色**填充成实心；
  需要旧观感的显式传 `arrowStyle: 'hollow'`。填充色跟随线色（`strokeStyle`），未新增颜色配置项；
  `arrow: 'both'` 时两端共用同一开关。
- **输入层支持触控与触控笔**：按运行时能力自动选择输入通道——有 `PointerEvent` 走 `pointer*`，
  否则回退 `mouse* + touch*`（小程序）。新增滚轮通道 `ICE_WHEEL` 与 `ICE_POINTER*` / `ICE_TOUCH*` 事件名。
- **`ICE.zoomAt(screenX, screenY, factor, minScale?, maxScale?)`**：以屏幕点为锚点的视口缩放原语，
  接滚轮缩放只需一行。
- **主画布 HiDPI**：`ICE.init(el, { dpr })`，backing store 放大到内容盒尺寸 × dpr，渲染变换乘以 dpr。
- **文本排版能力**：`ICEText` 新增 `wrap`（按 `width` 自动换行）、`maxLines`（最大行数）、
  `ellipsis`（截断省略号）；断行按 grapheme cluster 切分（优先 `Intl.Segmenter`），
  emoji / ZWJ 序列不会被拆开。
- **序列化类型反查**：`ICE.getTypeId(Ctor)`；序列化写出稳定 typeId，不再依赖类的 JS 名。
  补上此前漏注册的 `ICERose`。
- **`SERIALIZATION_MIGRATIONS`**：可扩展的序列化格式迁移表，按目标版本升序逐级执行。
- **`Deserializer.unknownTypes`**：反序列化时未注册的类型会被记录（便于提示用户 `registerType` 后重载）。
- **`package.json` 增加 `exports` 与 `sideEffects: false`**：显式条件导出（`types` / `import` / `require`）
  与 tree-shaking 支持；保留 `./dist/*` 子路径以兼容既有的直接引用方式。
- **CI 增加可视化 / 示例回归任务**：`npm run test:visual:ci`（examples 冒烟 + 交互 + 像素一致性）。
- **插件机制 `ICE.use(plugin)` / `ICE.unuse(name)`**：开放三层注册点——
  ① `components`（自定义图元类型，自动注册并可通过 typeId 反查，因此可序列化）；
  ② `render(frame)`（每帧世界坐标叠加绘制，两条渲染路径都调用，局部帧在 clip 之内）；
  ③ `tools`（按 `match(component)` 挂载/摘除自定义工具，`exclusive` 可屏蔽内置变换/连线面板）。
  提供 `setup` / `teardown` 生命周期与幂等注册。
- **选中统一入口 `ICE.setSelection(components)`**：写 `selectionList` 并同步插件工具；
  返回值表示是否有「排他」插件工具命中（供调用方禁用内置面板）。
- **无障碍原语**：`ICE.getAccessibilityTree(options?)` 产出可访问节点快照（角色建议 / 可读名称 /
  屏幕坐标盒 / 层级 / tab 顺序 / 可聚焦性 / 选中态，只含已上屏组件且不修改任何组件 state）；
  `ICE.setFocusedComponent(componentOrId)` 让键盘事件派发给焦点组件。
  引擎**不自建 DOM 镜像层**——镜像的 DOM 结构、ARIA 与文案由应用层决定（参考实现见
  `examples/a11y/a11y-mirror.html`，设计说明见 `docs/architecture/14-accessibility.md`）。

- **包完整性门禁 `npm run pkg:check`**：`publint`（`exports`/`types`/`files` 契约）+ `attw`
  （类型在 `node10` / `node16`(CJS/ESM) / `bundler` 各解析模式下是否正确），已接入 CI。
- **jest 覆盖率门槛**：`collectCoverageFrom` 改为全量 `src`，并按实测基线设「只许上调」的棘轮门槛
  （语句 65 / 分支 58 / 函数 72 / 行 65）；CI 单测改为 `npm test -- --coverage`。
- **`ICE.findComponent` 支持递归查找**：先查顶层（同 id 顶层优先，保持既有优先级），再深度优先
  递归子树；工具层不参与查找。这样**「连线连接嵌套子组件」**才真正生效
  （此前只搜 `childNodes` 第一层，嵌套场景的连接会静默失效）。
- **动画关键帧时间轴**：`animations: { left: { keyframes: [{ offset, value, easing? }], duration } }`。
  `offset` 为 0~1 的时间占比，缺省时按数组顺序均分、超出会被夹紧、乱序会自动排序；`easing` 写在
  **段起始帧**上，只作用于该段（未写则回落到动画级 `easing`）；时间轴之外的取值分别是首帧 / 末帧值（不外推）。
- **弹簧类缓动**：`easing: 'spring' | 'springSoft' | 'springSnappy'`（欠阻尼谐振子解析解，自带过冲），
  并已接入主题 `motion.easing` token。缓动被拆成两层：新增 `EasingProgress`（归一化进度函数，
  纯函数、不读时钟，供关键帧段内缓动按任意局部进度求值；**模块内导出，未加入包入口**），
  `Easing` 保持历史的「值语义」签名不变（9 个既有函数体逐字未改）。
- **数组字段补间**：`transform.scale` / `transform.translate` / `transform.skew` 等数组字段按分量
  **逐元素插值**，可与关键帧、弹簧缓动组合。

### 修复

- **已销毁的连线仍被 `ROUND_FINISH` 驱动 → 未捕获异常**（应用层校验时发现）：
  `ICEPolyLine.afterAddHandler` 在 **ICE 总线**上注册 `once(ROUND_FINISH, syncConnections)`，
  该监听不在组件自己的 `listeners` 里，`purgeEvents()` 清不掉；而 `once` 内部会把回调包一层，
  外部用原始 `fn` 去 `off` **永远匹配不到包装函数**（因此无法提前摘除）。
  于是「新增连线 → 同一 tick 内又删除」时，下一轮渲染完成仍会触发 `syncConnections`，
  去写已销毁组件的 `this.ice.dirty` → `Cannot set properties of null (setting 'dirty')`。
  应用层 `ice-entity-designer` 连续 undo/redo 批量增删连线时必现。
  修复三处：① `once` 记录 `__onceOriginal`、`off` 同时匹配包装函数与原始回调（**框架级**修复，
  消灭「once 注册的监听无法 off」这个陷阱）；② `ICEPolyLine.destory()` 显式 `off` 掉总线监听；
  ③ `syncConnections()` 在未挂载/已销毁（`!this.ice`）时直接返回 —— 顺带修掉
  「未挂载时 `setState({ links })` 抛 TypeError」。回归用例见 `tests/event/once-off.test.ts`、
  `tests/link/polyline-destroy.test.ts`（修复前 4 failed / 修复后全绿）。
- **无 rAF 的运行时「启动即抛错」**：`root.requestFrame` 直接取 `requestAnimationFrame` 一族，
  都没有时是 `undefined`，而 `FrameManager.start()` 无条件调用它 → 在 **Node / headless（无 rAF）**
  以及部分小程序低版本基础库下引擎连启动都做不到（这是 headless 出图的两个阻塞点之一）。
  现加定时器兜底（浏览器早期 rAF polyfill 的经典做法）；另一阻塞点「文本量测依赖 DOM」
  此前已由 `ICEText` 的「canvas 优先量测 + DOM 降级」解决。
- **折线的包围盒退化成 ≈0（导致局部重绘漏画折线）**：`ICEPolyLine.calcComponentParams` 用
  「顶点对相减」（`points[1].x - points[0].x`）推导宽高，但 `ICEPolyLine.calc4VertexPoints()` 返回的
  是**沿路径排列的笔画带宽顶点**（不是包围盒的左上/右上角）→ 近似水平的折线算出 `width ≈ 0`。
  更关键的是存在**两条各自算盒子的路径**：`getMinBoundingBox()`（被折线覆盖为顶点盒，正确）与
  `ICEComponent.__paintWorldBox()`（按 width/height 推导，退化）。后者用于上屏快照盒，于是
  dirty-rect 按快照盒挑选「需要重画的对象」时会漏掉折线 → 被擦除区域内的折线笔迹丢失
  （表现为 full 与 dirty-rect 的像素分歧，且只在「连线真正连上嵌套宿主」时才暴露）。
  修法：抽 `ICEComponent.__localBox()` 作为本地盒**唯一来源**（两条路径都消费它，从此必然一致），
  折线覆盖该方法给出真实带宽盒；`calcComponentParams` 改为取带宽顶点 min/max；
  并修掉 `splitEndpointsTo4Points()` 的**循环依赖**（它拿 `state.height` 当线宽输入，而 height 又是
  它的输出 → 结果随上一次的 height 漂移，首帧还读到默认哨兵值 10）。
- **折线宽度/高度不再依赖「上一次的 height」**：同上，反复量测现在结果稳定。
- **直线（共线）折线的包围盒不含箭头 wing 的横向张开**：`calc4VertexPoints()` 在共线时走
  `splitEndpointsTo4Points()`，那条路径只按 `lineWidth` 沿线段方向外扩，**不含箭头三角形的张开**
  （默认 `arrowLength: 15` / `arrowAngel: 30°` ⇒ 距轴线 ±7.5px，远大于线宽的一半）。
  由于 `__localBox()` 同时供 `getMinBoundingBox()`（选择框/控制面板）与渲染器的 `__paintWorldBox()`
  （dirty-rect 上屏快照盒）消费，盒子偏小会导致**局部重绘把箭头裁掉**、选择框切到箭头。
  现由 `__localBox()` 并入箭头三角面的三个顶点（**不动** `splitEndpointsTo4Points()`，
  因此 `state.width/height` 的既有语义与命中判定都不受影响）。回归见 `tests/link/line-arrow.test.ts`。
- **`composeMatrix()` 会累积平移点集（潜在漂移）**：`ICEDotPath.calcLocalOrigin()` 会就地把 `dots` 平移到
  「以 origin 为原点」，而旧实现每次 compose 都**无条件**再平移一个 origin —— 连续 `composeMatrix()`
  会让点集依次偏移 1/2/3 个原点。因此此前所有调用方都必须严格保证「compose 之前先重算 dots」，
  一旦漏掉就会出现形状/命中检测偏移。现改为记录「已应用平移量」、只补差额，compose 变为**幂等**；
  `calcDots()` 成为重建点集的唯一入口（子类改为实现 `__calcDots()`）。
- **动画 `duration` 非法时永不结束**：`duration <= 0` 或缺失时会算出 `NaN` / `Infinity`，而结束判定是
  「值是否越过 `to`」——当 `from === to` 时该比较恒为 `false`，动画永远不结束，组件永久滞留在动画列表里
  **每帧空转 `setState`**。现在明确落到终点、结束，并 `console.warn` 一次。
- **未知缓动名会抛 `TypeError`**：`Easing[name]` 为 `undefined` 时直接调用会崩。现在回退 `linear` 并提示一次。
- **非法动画配置的告警会逐帧刷屏**：改为每个动画配置只告警一次（用 `WeakSet` 记录，
  不往会被序列化的 `props` 上塞标记字段）。
- **安全**：`ICEText` 的 DOM 降级量测由 `innerHTML` 拼接 `<br>` 改为 `textContent` + `white-space: pre`，
  用户文本中的 HTML 不再被当作标签执行。
- **画布带 `border` / `padding` 时命中检测整体偏移**：坐标换算与 dpr backing store 尺寸改用
  **内容盒**（`getBoundingClientRect()` 返回的是 border-box）。
- **页面滚动 / 布局变化后命中检测偏移**：canvas 矩形改为在非移动类输入事件上刷新
  （旧实现只在 `init` 时取一次）。
- **一个未知组件导致整份数据打不开**：反序列化遇到未注册类型时跳过该节点并记录，不再抛 `TypeError`。
- **`.husky/pre-commit` 缺少可执行位**：git 会直接跳过该钩子，导致 `lint-staged` / commitlint 从未真正运行。
- **`getMinBoundingBox(refresh=true)` 首次取值偏移**：旧实现先读 `state.localOrigin` 再调
  `composeMatrix()`，而 `localOrigin` 由后者内部派生 → 首次刷新读到初始 `(0,0)`，包围盒偏一个原点
  （控制面板 / 连线插槽首次定位偏移的根因）。
- **`AFTER_REMOVE` 从不触发**（死代码）：现由 `removeChild` / `removeTool` / `ICEGroup.removeChild`
  在 `destory()` **之前**触发（`destory` 会 `purgeEvents`，之后触发监听者收不到）。
- **监听器累积**：`TransformControlPanel.targetComponent` 与 `ICELinkSlot.hostComponent` 原用
  `once(BEFORE_REMOVE, 箭头函数)`，因 `once` 内部再包一层而**永远无法 `off`**，反复选中会持续泄漏；
  改为具名属性 + `on`，切换时摘除。
- **只要存在 linkable 组件画面就永不空闲**：`ICELinkSlot.updatePosition` 挂在宿主 `AFTER_RENDER` 上
  无条件 `setState`；现仅位置真正变化时才置脏。
- **`flattenTree` 的 `_pid` 恒为 `undefined`**（旧实现取 `node.id`，而 id 在 `props` 上）。
- **连线标签的背景框按「上一次遗留字体」量宽**：`ICEPolyLine.drawLabel()` 原先**先** `ctx.measureText(label)`、
  **后**设 `ctx.font`。canvas 的 `font` 是跨调用遗留状态，于是量到的宽度来自上一次绘制留下的字体，
  背景框与实际字形不符（框过宽或过窄）。现把 `ctx.font` 提到 `measureText` 之前；
  回归用例 `tests/link/link-label.test.ts` 用「宽度随 font 变化」的 ctx 桩把调用顺序钉死。
- **连线端点不再依赖宿主 `AFTER_RENDER`**：局部重绘帧的 render 事件只对脏区域内的组件触发，
  用它驱动几何会让两条渲染路径产生不同结果；改为在建立连接时直接同步（内部会现场重算矩阵）。

### 主题能力变更（需要注意）

- **主题改为实例级**：`ice.setTheme()` 现在只改**本实例**，不再修改模块级默认主题。
  这样同页面多个 `ICE` 实例可以有各自的主题（多品牌/多租户/明暗并存）。
  模块级 `setTheme()` 仍可用，语义是「此后新建实例的默认值」。
- **preset 在加入实例时按该实例主题解析**：组件构造阶段仍按模块级默认主题展开
  （那时还不知道归属哪个 ICE），`addChild`/`addTool` 时会用实例主题再解析一次。
  用户显式传入的样式依旧优先于 preset。
- **motion token 也随实例主题**：动画里的 `duration: 'normal'` / `easing: 'out'`
  语义名按实例主题解析。
- 单实例、未显式设置主题的项目**行为完全不变**。

### 布局能力变更（需要注意）

- **布局随增删自动重排**：`ICEGroup.addChild` / `removeChild` 会立即重排，`addChildren` /
  `removeChildren` 在批量结束后排一次。旧版本只在 `setLayout()` 时排一次，之后的增删不会重排
  （加进去的子组件位置错、删掉后留空位）。**如果你的应用此前手工补了 `doLayout()` 调用，可以去掉。**
- **新增 measure 阶段**：排布前会对每个子组件调 `measure()`（刷新尺寸/点集/文本量测），
  因此首次布局就能拿到真实宽高（旧版本读到的是 `0` 或文本的 `10` 哨兵值）。
- **新增的容器型子组件继承父层布局**（与 `setLayout()` 的传播规则一致）。

### 动画能力变更（需要注意）

- **动画键支持点路径**：`animations: { 'transform.rotate': {...} }`、`'style.globalAlpha'` 现在真正生效。
  旧版本这类键会被当成**字面量键名**而静默失效（既不报错也不生效）；如果你此前因此写了外部补间，可以迁回。
- **默认不再取整**：旧版本对所有动画属性 `Math.floor`，会让 0→1 的透明度、角度、缩放失真。
  现默认保留小数（平滑）；需要整数步进（例如像素位移要锐利边缘）时显式加 `round: true`。
- **新增 `delay`**（毫秒）：延迟期内保持起始值，可做多属性错峰/多组件序列。
- **数组字段改为支持补间**：`transform.scale/translate/skew` 等数组型字段现在**逐元素插值**
  （旧版本会写出 `NaN` 导致矩阵损坏、组件消失）。只有「两端长度不一致」或「含非数字」才拒绝并
  `console.warn` 一次。此前若为此把缩放动画拆成外部补间，可以迁回 `animations`。
- **动画结束判定改为按时间**：达到 `duration` 即结束并**精确落到终点值**，不再用「值是否越过 `to`」判断。
  对既有单调缓动的结果没有差异；但这是弹簧类缓动（值会过冲越过 `to`）能正常工作的前提。
- **非法 `duration`（0 / 缺失 / 非数字）不再无限空转**：见「修复」。
- **`interactive` 不再被动画覆盖**：动画期间会保存并恢复原值（旧版本每帧强制置 `true`）。
- **组件销毁会自动摘除动画**（旧版本销毁后仍被每帧 `setState`，CPU/内存双泄漏）。

### 已知限制（仍未修）

> 2026-09-11 复核：原小节里仅存的一条写着「已修」，属自相矛盾，已按当前真实剩余项重写。
> 完整的「已做 / 未做」对照见 [docs/architecture/09-roadmap.md](docs/architecture/09-roadmap.md) 与
> [13-gap-analysis.md](docs/architecture/13-gap-analysis.md) §1。

- **含折线的富场景会稳定回退全量重绘**：折线的描边在 `clip` 下会丢失抗锯齿一致性，
  因此只要折线带宽盒与脏区相交就回退（这是**正确的保守行为**——此前「能走局部」恰恰是因为折线包围盒退化、
  漏画了折线）。要恢复局部重绘，需先解决折线描边的 clip-AA 一致性。
- **错切（skew）没有变换手柄**：skew 变换本身可用（`gl-matrix-skew.ts`），缺的是控制面板上的手柄 UI。
- **无空间索引**：命中检测与渲染已做视口裁剪 + 包围盒预筛，但「上万节点且大部分在屏内」时仍是 O(n)。
- **小程序真机未验证**：`PolyfillPath2D`、离屏 canvas、字体加载在低版本基础库上的逐像素一致性与可用性
  需真机确认（自动化测试覆盖不到）。
- **无 SVG / PDF 导出、无 SVG 导入**：需独立 exporter，且只能近似（阴影 / 虚线流动 / 字形 / `Path2D` 命令为 canvas 特有）。
- **控制面板的「按组件类型展现不同工具」尚未抽象**（插件机制的 `tools` 注册点可视为第一层）。
- **缩放手柄拖过对边时中心会跳变**：宽高变负时用 `Math.abs()` 兜底而不做 clamp（小体感问题）。

### 性能

- **移动容器不再连带重量测后代**：新增 `paramsDirty`，把「需要重绘」（`dirty`）与「自身派生参数需要重算」
  拆开。祖先变换变化时后代只置 `dirty`（必须重绘），不再重跑 `calcComponentParams()`。
  实测（4 rect + 4 小星形 + 2 大星形 + 2 文本，移动整组一帧）：`calcComponentParams` **10 → 0**、
  `calcDots` **6 → 0**，必须发生的重绘次数不变（8 次）。收益集中在点集类图元（星形 / 玫瑰线 / 正多边形 / 折线）
  不再重跑 `calcDots()`。
- **视口裁剪**：全量帧跳过「未变脏 + 有上屏快照 + 与可见区不相交」的组件。
  实测 N=6000、屏外 50%：4.44 ms/帧 → 关闭裁剪 8.38 ms/帧（**1.89x**）。
- **命中检测包围盒预筛**：复用渲染快照做 O(1) 拒绝，避免对屏外组件做矩阵反变换 + 形状判定。
- **脏矩形门控由「整场景」放宽到「相交级」**：编辑器场景（含文本 / 星形 / 半透明控制面板）此前
  几乎永久回退全量，实测富场景局部重绘执行次数 **0 → 2**，且 10 步逐像素比对仍 100% 一致。

### 需要注意（升级前请确认）

> **箭头默认由「空心描边」变为「实心填充」（行为变更）**：线条端点三角箭头现在默认 `arrowStyle: 'filled'`，
> 用**线色**填充。需要保持旧观感的，显式传 `arrowStyle: 'hollow'`。
> `stroke: false` 的折线仍然不画箭头 —— 与改动前一致（那条路径既不描边也不填充，本就看不见箭头）。

1. **`dpr` 默认 1、`wrap` 默认 `false`**：不显式开启时行为与 1.0.4 完全一致。
2. **命中检测坐标改为内容盒语义**：画布带 `border` / `padding` 的项目，命中位置会被**修正**
   （此前偏一个边框宽）；若你的应用曾按偏移值做过补偿，请一并去掉。
3. **反序列化不再因未知类型抛错**：改为跳过 + 记录。若依赖「抛错以发现未注册类型」，
   请改用 `deserializer.unknownTypes`。
4. **序列化写出的 `type` 优先用注册名**：已注册类型（含内置）写注册名而非 `constructor.name`。
   旧数据（写类名）仍可加载、无需迁移；但若在外部对 JSON 里的 `type` 做了字符串匹配，需要同步。
5. **输入通道切到 `pointer*`**：`'mousedown'` / `'mousemove'` / `'mouseup'` 等既有事件名仍会被派发
   （由 pointer 事件归一化而来），既有代码无需改动；新增可用 `'pointerdown'` 等原生名。
6. **CI 不跑 golden 图像比对**：`e2e/visual/visual.spec.ts` 的基线图按平台命名（`*-darwin.png`），
   跨平台必然失败。请在生成基线的同一环境本地运行 `npm run test:visual`。

### 需要注意（打包产物路径变更，**可能影响深链引用**）

- **入口文件名变更**：`dist/index.js` → **`dist/index.mjs`**（ESM）、`dist/index.cjs.js` → **`dist/index.cjs`**（CJS）。
  原因：旧布局下 package.json 没有 `type` 字段，按 Node 规范 `.js` 即 CJS，而 ESM 产物却叫 `.js`
  —— 包元数据与实际产物不一致，导致 **TS 在 ESM 解析模式下把类型当 CJS 处理**（`attw` 报
  `Unexpected module syntax`，`publint` 报 types 歧义）。现代 Node（≥22.7）的语法探测会掩盖运行时症状，
  但旧版 Node 与严格工具链不会。
- **影响面**：用裸包名 `ice-render`（经 `exports` 解析）的用法**不受影响**；
  但**直接写死文件路径**的深链引用（如 `ice-render/dist/index.js`）会 404，需改为 `.mjs` / `.cjs`。
  一次性 CDN 引用 `dist/index.umd.js` **未变**。
- 同时：`rollup.config.js` → `rollup.config.mjs`（因为新增了 `"type": "commonjs"`）；
  `repository` 字段由字符串改为 `{ type, url }` 对象式。
- 若你更在意深链兼容性，建议把这一批次发为 **2.0.0**；否则请在 1.1.0 的升级说明里保留本段。

### 需要注意（自定义组件）

- **自定义组件若覆盖了 `calcComponentParams()`**：它现在由 `refreshParams()` 按需调用（仅在 `paramsDirty` 为真时）。
  引擎已在 `setState` 里同时置 `dirty` 与 `paramsDirty`，因此既有组件无需改动。
  但如果你有**绕过 `setState` 直接改 `state`** 再依赖渲染时自动重算的写法，需要补一句 `this.paramsDirty = true;`。
  另：**不要在 `calcComponentParams()` 里用 `this.dirty` 做早退判断**（改用 `this.paramsDirty`，或干脆交给 `refreshParams()`）。
- **点集类自定义组件请实现 `__calcDots()` 而不是 `calcDots()`**：`calcDots()` 现在是维护「已应用平移量」的唯一入口，
  覆盖它会让幂等补偿失效（旧代码覆盖 `calcDots()` 的，改名即可，`state.dots` 的写法不变）。

### 工程

- **提交 `package-lock.json`，CI 改用 `npm ci`**：`.gitignore` 第 9 行的 `*lock*` 把 lockfile 一并忽略了
  （与当初 `*log*` 误伤 CHANGELOG 是同一类问题），因此它从未被跟踪，CI 每次 `npm install` 都重新解析
  依赖范围、安装不可复现。现显式放行 lockfile，并把两个 job 的安装步骤改为 `npm ci`
  （lockfile 与 `package.json` 不同步时会直接失败，正是想要的效果；已用 `npm ci --dry-run` 验证同步）。
  降级后本包唯一平台相关可选依赖是 darwin 的 `fsevents`，Linux CI 会自动跳过，无跨平台风险。

- `.eslintrc` 为 `tests/**`、`e2e/**` 关闭 `@typescript-eslint/no-var-requires`
  （测试中刻意使用 `require` 处理 `jest.mock` 的提升顺序）。
- 全仓 prettier 格式化，`npm run lint` 由「194 error」变为 **0 error**（CI 的 lint 步骤由红转绿）。
