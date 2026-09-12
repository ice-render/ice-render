# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 暂无（下一个版本发布前在这里累积）。

## [1.4.9] - 2026-09-12

### 修复

- **祖先半透明时不再走离屏缓存**（2026-09-12）：位图是 `build() → renderTo()` 用**当时**的
  `getEffectiveOpacity()` 烤出来的，而贴图路径 `draw()` 只做 `drawImage`（不叠 alpha）——
  于是「先建位图、后改不透明度」会把组件永久定格在那一刻：淡入的模态 / 抽屉 / 消息里，
  文字永远半透明；淡入起点 `opacity=0` 的直接烤成空位图，**底板出来了、文字整条不见**
  （`ice-web-components/examples/arcade.html` 的「已暂停」提示就是这么消失的）。
  现在 `isCachable()` 把「自身 × 祖先链」的有效不透明度纳入判定（与既有契约
  「不透明度 ≠ 1 时按非不透明落墨处理」一致），并且 `render()` 在组件因透明度变得不可缓存时
  丢掉旧位图，避免它在恢复不透明后被 `!dirty` 的静态命中又贴回来。
  回归：`tests/renderer/ObjectCache.test.ts`（祖先半透明 / 自身半透明 / 恢复后重建三条）。

## [1.4.5] - 2026-09-12

### 修复

- **移动事件的输入矩形不再缓存**（2026-09-12）：图表创建之后，页面在画布**上方**插入内容
  （提示条 / 错误信息 / 广告位）会把画布往下推，而 `DOMEventDispatcher` 只在非移动事件刷新矩形 ——
  之后每一次 `mousemove` 的 canvas 内坐标都偏移同样的距离，**命中 / 悬停 / 拖拽整体错位**，
  直到用户点一下或滚一格。现在移动事件走 `ICE.refreshInputRect()`：只重读一次
  `getBoundingClientRect()`（实测 0.22µs，强制重排最坏 2.8µs），尺寸没变时平移已缓存的内容盒，
  连 `getComputedStyle` 都不用读；尺寸变化时退回完整刷新。
  另外修掉一个自己踩的坑：做位移增量不能用上一次的 rect 对象引用做差（桩/小程序返回同一个可变对象，
  增量恒为 0）。回归：`tests/ICE.input-rect.test.ts`、`tests/event/DOMEventDispatcher.input.test.ts`、
  `e2e/visual/input-rect-shift.spec.ts`（回退修复即变红）。

## [1.3.0] - 2026-09-12

### 新增

- **子树不透明度 `state.opacity`**（2026-09-12）：
  `opacity` ∈ [0,1]（默认 1）作用于**本组件及其所有后代**。引擎把树拉平、逐个组件独立绘制，
  祖先的 ctx 状态不会自动继承给后代 —— 只设 `style.globalAlpha` 只能让组件**自身**变透明，
  淡入淡出 Modal / Drawer / Message 这类「整棵子树」的场景会只剩背景在变。
  实现：渲染时把自身与所有祖先的 opacity 相乘后叠到 `ctx.globalAlpha`（顶层组件直接返回，
  热路径上只是一次字段读），并在泄漏属性归位里显式复位 —— 它的值不在 `style` 键里，
  `__resetLeakyCtxState` 的两轮扫描发现不了，不复位会污染后续组件（回归测试抓到的）。
  `opacity ≠ 1` 的组件按「非不透明落墨」处理：不参与离屏缓存、脏矩形回退更保守。
  回归测试 `tests/graphic/opacity.test.ts`（5 项）。

## [1.2.0] - 2026-09-12

### 新增

- **子树裁剪：`clipChildren`**（2026-09-12）：
  容器把 `state.clipChildren` 设为 `true` 后，**所有后代**都会被裁到自己的盒子内 —— 滚动容器、
  可裁剪视口这类需求的底座（此前引擎只有脏矩形用的 `ctx.clip`，没有任何容器级裁剪能力）。
  裁剪在**设备空间**建立，与脏矩形路径同一套做法（`setTransform(单位矩阵) → rect → clip →
  复原本组件 CTM`）：clip 记录在 ctx 的裁剪状态里，组件自己后续 `setTransform` 不会清掉它，
  `restore()` 才移除；多层裁剪容器会依次求交。祖先有旋转/斜切时按其世界 AABB 保守裁剪。
  配套两项：**命中检测**同样尊重裁剪区（滚动容器里滚出去的子组件点不到）；**被裁剪的组件
  不参与离屏缓存**（位图是单独渲染的、不含那层裁剪，贴回去会画到裁剪区外）。
  回归测试 `tests/graphic/clip-children.test.ts`（7 项）。

## [1.1.0] - 2026-09-12

> 相对 1.0.7：新增能力向后兼容，但含几处「修正类」行为变化，见下方「需要注意」。

### 修复

- **居中/右对齐的文字整体偏移半个到一个字宽 —— `ctx.textAlign` 被 canvas 二次应用**（2026-09-12）：
  `ICEText.doRender` 的水平对齐一直是**手工算 x**（「文字起点」语义），但 `applyStyleToCtx()`
  会把 `style.textAlign` 写进 ctx，canvas 于是又按其对齐一次：`center` 再左偏半个文字宽度、
  `right` 再左偏一个文字宽度（传了 `maxWidth` 时还会连带压缩字形）。
  实测（组件示例页抓到的真实 `fillText` 参数）：按钮 `x=-35.51` + `ctx.textAlign='center'` →
  文字中心左偏 **35.5px**；头像首字母因此**偏出圆形之外**；统计卡图标、复选框对勾、tab 标签同理。
  现在在居中/右对齐分支把 `ctx.textAlign` 复位为 `left`，与下方公式一致。`textBaseline` 不受影响：
  纵向本来就依赖 ctx（`middle` 分支算的是中线、其余分支算的是盒底），横向则完全由本方法接管。

- **`textAlign: 'center' / 'right'` 的起点公式把文字放到了盒边缘**（2026-09-12）：
  旧实现 `center` 时 `x = 0`、`right` 时 `x = localOrigin[0] - paddingRight` —— 等于把文字**起点**
  放到盒中心/右缘，`right` 会直接溢出到相邻列。现在按**逐行实测宽度**算起点：
  `center → x = -lineWidth / 2`，`right → x = localOrigin[0] - paddingRight - lineWidth`（flush-right，
  不溢出）。左对齐保持原逻辑，避免逐行 `measureText` 的开销。

- **`addChild(child, false)` 会吞掉「从未渲染过」的组件的脏标记**（2026-09-12）：
  `dirty` 在引擎里同时承担「本帧要重绘」与「几何缓存是否有效」两个语义，后者只在
  `ICEPath.doRender` 里以 `if (this.dirty) createPathObject()` 的形式被消费；而
  `ICEGroup.addChild(child, false)` 会执行 `this.dirty = markDirty`，把容器**自己**强制置干净 ——
  对从未绘制过的组件来说，几何缓存就永远不会建立，首帧自身画出来是**空路径**。
  线上表现：`UIButton` 构造函数里 `addChild(this.label, false)` 把自己置干净，按钮的圆角背景/边框
  全都不画，只剩白底白字的标签（`ice-web-components` 的 gallery 示例里 Primary / Danger / Small /
  Large 完全看不见）。凡「构造期用 `markDirty=false` 挂子组件、又没有被 `addChildren` 补一次置脏」
  的组件都会中招。现在新增 `__everRendered` 与 `__applyDirty()`：`markDirty=false` 只表示
  「这次操作不要主动置脏」，**不再**把从未渲染过的组件强制置干净；已上屏过的组件仍保留原有
  批量挂载的优化语义。回归测试 `tests/graphic/ICEGroup.add-child-dirty.test.ts`（3 项，改前 2 项红）。

- **离屏缓存（`ObjectCache`）与直接落墨逐像素不一致 —— 缓存一直在悄悄降画质**（2026-09-11）：
  位图的**光栅化缩放**取的是 `root.devicePixelRatio`，而主画布的实际设备比例是 `ice.dpr`（默认 1）；
  贴图还用**世界尺寸**（`lw/lh`）当 `drawImage` 的目标矩形、落点带小数（paint pad 之后是亚像素值），
  并且依赖一句 `ctx.scale(dpr,dpr)` —— 而那一句会被 `renderTo()` 内部的 `setTransform()`
  **整条覆盖**，本来就是死代码。三个问题叠加的结果是「位图被缩放着贴回」，任何 `dpr≠1`
  或视口缩放都会触发双线性重采样。
  实测（`ice-entity-designer`，视口 scale≈0.386）：开启缓存相对「直接落墨」会改变 **1.6%~2.1% 的像素**、
  **丢失 8.5%~15.5% 的墨迹**（视网膜屏上缓存文字只剩约 30% 墨迹）。
  现在改为：位图按**渲染视口**的缩放（`getRenderViewport().scale`，已含 dpr 与视口缩放）光栅化，
  base 矩阵显式写成 `[rs,0,0,rs, ox-dx, oy-dy]`；贴图落点取整到**整数设备像素**、1:1 贴回
  （`drawImage(img, dx, dy)`，不传目标宽高）——**全程零重采样**。
  改后同样的应用实测：**缓存与直接落墨逐像素 0 差异**，墨迹差 **−15px / 0.019%**。
  另外修掉两处相关缺陷：① 子类在 `super.doRender()` 之后用 `applyTransformToCtx(null, true)` 复原变换，
  在离屏通道里会按主画布视口重算、丢掉位图原点的平移（表现为**连线箭头与标签在缓存位图里整块消失**），
  现在统一走新的 `applyActiveTransform()`（同时适配主画布与离屏通道）；② 重建位图时没有扣回旧条目的
  字节数，导致 `MAX_CACHE_BYTES` 总预算被提前耗尽（现在记账精确）。
  回归用例：`tests/renderer/offscreen-cache-fidelity.test.ts`、
  `e2e/visual/offscreen-cache-fidelity.spec.ts`（6 个配置 × 12 步，断言 alpha 零差异、预乘通道差 ≤3/255、
  墨迹守恒）。
- **`coalesceRegions` 会把细长脏盒串成一个整屏大盒，导致局部重绘永远回退全量**（2026-09-11）：
  原来的合并策略是「相交就合并」，于是编辑器里拖动一个实体时，8 条横跨画布的关系连线
  旧/新盒互相交叉，22 个脏盒被串成**一个覆盖整屏的大盒**（实测面积占画布 **1.004**），
  永远撞上「脏区面积占比 > 0.35 回退全量」——而 22 个盒的**实际面积之和只有画布的 6%**。
  现在加了两条约束：① **合并护栏** —— 只有「合并后面积 ≤ 两块面积之和 × 2」才合并
  （相邻/嵌套/同向延展的正常合并比值 ≈1.0~1.3，不受影响）；② `maxRegions` 从**硬上限**改为**软上限**
  —— 没有划算的合并时就多留几块（每块区只是一遍 O(组件数) 的 AABB 过滤），
  区数超过 24 才塌缩成一个并集盒、交给面积阈值回退全量。
  回归用例：`tests/renderer/dirty-rect-util.test.ts`。
- **`ICEPolyLine.__localBox()` 并入连线标签矩形**（2026-09-11）：标签画在折线中点、天然可能超出
  「折线带宽」盒，走离屏缓存时会被位图裁掉。现在盒 = 折线带宽顶点 ∪ 箭头三角面 ∪ 标签矩形，
  由 `__measureLabelBoxForBounds()` 统一口径（量完恢复 `ctx.font`，盒子计算不留渲染副作用）。

### 变更

- **连线可以走离屏缓存了**（2026-09-11，此前一律排除 `isLine`）：排除的理由是「位图可能很大」，
  代价是 `__riskyIntersectsRegions` 里「干净但不可缓存的 risky 组件与脏区相交 → 回退全量」这条
  常态命中 —— 连线横跨画布，任何脏区都与它相交。现在改为「允许缓存，但按**设备像素面积**设上限」
  （单条 ≤200 万设备像素 ≈8MB，总量 ≤32MB，排除蚂蚁线 `lineDashFlow`）。
  实测收益（`ice-entity-designer`，拖动实体）：局部重绘计划成立次数 **0 → 20**，
  渲染耗时 **3.3ms/帧 → 2.2ms/帧（−31%）**，且「局部 ≡ 全量」逐像素 **0 差异**。
- **`ObjectCache` 只在「视口稳定」的帧生效**（2026-09-11）：新增 `beginFrame()`，渲染器每帧开头调用；
  视口一变，所有位图的栅格都要重算（代价与这一帧直接落墨同阶），因此变化的那一帧直接停用缓存、
  落到直接绘制路径，手势停下后的第一帧再统一重建 —— 避免缩放/平移过程中的整屏位图重建。
- **`maxRegions` 语义**：见上方「修复」第 2 条（硬上限 → 软上限）。

### 新增

- **连线形态可配 `linkShape: 'visio' | 'bezier'`（默认 `'visio'`）**：
  `ICEVisioLink` 此前只画 Visio 形态（正交折线 + 出口点 + 路径评分）。现在可切**普通贝塞尔曲线**：
  从两端点与**插槽外法线**构造三次贝塞尔（控制点伸出长度 = 两端直线距离 × 0.45，下限 24px），
  再按距离自适应等分采样（8~24 段）成密集折线。采样点**写回 `state.points`** 而不是只算 dots ——
  因为 `isDotsOnSameLine()` / `getLabelPosition()` 只读 points，只留首尾两点会被判「共线」，
  包围盒就退化成「弦 ± 线宽」，曲线鼓出的部分会落在盒外（dirty-rect 局部重绘会把曲线裁掉）。
  绘制仍走既有折线通路（描边 + 箭头），因此命中检测、箭头、label 都无需改动。
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

### 新增（2026-09-11 第二轮）

- **声明式渐变 `style.fillGradient` / `style.strokeGradient`**：用纯对象描述 `linear` / `radial` / `conic`
  渐变（`{ type, from/to | center/radius/innerRadius | startAngle, stops }`，坐标是组件本地坐标）。
  与手搓 `CanvasGradient` 的关键差别：**可序列化**（纯对象，存盘不丢，手搓的会被 `NON_SERIALIZABLE_KEYS`
  一类机制剔除）与**可写进主题 preset**（随 `setTheme` 重新按新主题色展开，内置 `preset: 'gradient'`）。
  渲染时按描述对象**引用**缓存 `CanvasGradient`（`refreshParams` 失效），`stops` 支持 `[[offset,color]]`
  与 `[{offset,color}]` 两种写法；运行时缺 `createConicGradient` 时退回中间色纯色，不会「什么都没画出来」。
  渐变在样式应用的最后一步写入，保证压过同层 `fillStyle`（不依赖 style 的键序）。
- **布局响应式重排**：子组件改 `width/height` 后，父容器会在**下一帧**重排（`ICEGroup.requestLayout()`，
  一帧内多次请求合并成一次，布局执行期间的子项变化不会自激）。此前只在 `setLayout()`/`addChild()` 排一次，
  改子项尺寸不会触发重排、兄弟节点停在老位置。另新增 `ICEGroup.getPreferredSize()` 转发布局策略。
- **`display: false` 的子树语义**：新增 `ICEComponent.isEffectivelyVisible()`（沿父链判断，顶层走 O(1) 快路径），
  渲染、命中检测、离屏缓存、无障碍快照统一用它。此前只判组件自身，隐藏父容器后子组件照样被画、照样能点中。
- **变换手柄修改键约束**：`Shift` 拖角手柄保持宽高比、`Shift` 拖旋转手柄吸附 15°（`ROTATE_SNAP_STEP`）。
  同时在输入归一化层**透传修饰键**（`shiftKey/ctrlKey/altKey/metaKey`）—— 它们是 DOM 事件原型上的
  不可枚举 getter，`ICEEvent` 的 `for...in` 拷贝带不过来，此前组件永远拿不到。
- **指针捕获**：`pointerdown` 时把指针捕获到画布、`pointerup/cancel` 释放。此前拖拽（拖组件/拖手柄/拖连线钩子）
  时指针移出画布就收不到后续事件，表现为「拖着拖着不跟手」甚至「松手了还在拖」。
- **公共几何 API**（`GeoUtil`）：`pointInPolygon`、`distanceToSegment`、`distanceToPolyline`、
  `samplePolyline`、`segmentIntersect`。这些原先都以私有实现散落在图元里（`ICEDotPath` 的射线法、
  `ICEPolyLine` 的点-线段距离），现在图元改为消费公共实现，应用层做自己的命中/碰撞/路径计算不必再抄。

### 修复（2026-09-11 第三轮）

- **每次渲染约 15% 的开销回归**（本批改动自己引入的，靠补测发现）：`isEffectivelyVisible()` 每帧被调用
  3~4 次/组件，而组件多层嵌套 → 每次都沿父链走到底。5000 图元场景实测 场景A 2.20→2.51ms（+14.5%）、
  场景C 0.090→0.111ms（+21%）；把它临时短路成旧语义即回到基线，证明回归全部来自该函数体。
  修法是**可见性代际缓存**（模块级 epoch，display 变化与树结构变化时自增，每代每组件只走一次父链）。
  同时修掉两个同源缺口（`ICEGroup.setState` 是独立实现、不调 `super.setState`）：隐藏「分组」不失效后代
  可见性缓存、分组改尺寸不请求父容器重排 —— 后者是上一轮「布局响应式」遗留的漏洞。做法是把这两件事抽成
  `setState` 的前/后置钩子。对照复测：新 2.18~2.26ms vs 旧 2.19~2.38ms（区间重叠，回归消除）。
- **富场景局部重绘：放开「仅位置变化」的变脏 risky 组件**：此前「刚变脏的 risky 组件一律回退」，
  导致编辑器里拖动含文本的实体时 100% 回退（应用实测 22/22 帧）。判据细化为：
  内容/几何变了（`paramsDirty`）→ 一律回退；仅位置变化且非文本 → 放行（盒 + paint pad 已覆盖墨迹）；
  仅位置变化且是文本 → 必须有离屏缓存。实现上必须在收集阶段先快照 `paramsDirty`
  （`__freshBox()` 会把它清掉，不先快照会把「内容变了」误判成「只是平移」）。
- **基准脚本长期静默失效**：`bench/render.cjs` 默认产物路径指向早已改名的 `dist/index.cjs.js`，
  `npm run bench` 直接跑不起来（也因此没人发现上面那个 15% 回归）；README 里「5000 图元 0.8ms」
  实测是 2.2ms。现在路径已修、加 `tests/tooling/bench-smoke.test.ts` 守住「脚本可执行 + 指标齐全」、
  CI 加 bench 步骤，文档数字改为「用 `npm run bench 5000` 复现 + 标注机器与日期」。

### 修复（2026-09-11 第二轮）

- **脏矩形局部重绘此前在「非单位视口」与「dpr≠1」下直接回退全量**：`__collect()` 曾用
  `if (vp.scale !== 1 || vp.tx !== 0 || vp.ty !== 0) return null` 与 `if (dpr !== 1) return null` 兜底，
  理由是「世界盒与屏幕 clearRect/clip 不一致」。但这两类恰好是真实场景（编辑器必然缩放平移；
  高分屏要开 dpr 才不发虚），等于招牌优化在最需要的地方完全失效。现在改为把脏区经
  `mapBoxToRender()` 映射到**渲染坐标**（`dpr · viewport`，向外取整防接缝）后再 clear/clip，
  相交判定仍在世界坐标里做。回归：`e2e/visual/dirty-rect-pixel.spec.ts` 新增 `?zoom=1`、`?hidpi=1`、
  `?zoom=1&hidpi=1` 三个场景，断言「局部重绘执行次数 > 0」且 10 步逐像素与全量 100% 一致。
- **分散脏区被并成一个大盒 → 极易回退全量**：新增 `coalesceRegions()`，把脏区聚合成若干块
  **互不相接**的裁剪区（上限 6 块，超出时合并「面积增量最小」的两块），逐块 clear + clip。
  此前画布对角两处小脏点会被并成一个覆盖大半画布的大盒，直接撞「脏区面积 > 35%」阈值。
- **命中检测有两份几乎相同的实现**（`DOMEventDispatcher` 与 `ICE.hitTest`）→ 收敛为
  `hitTestComponents()` 单一实现（含 z 序、控制面板过滤、有效可见性、包围盒预筛），避免
  「点得到但 `hitTest` 找不到」这类不一致；`flattenTree(childNodes)+flattenTree(toolNodes)`
  的重复也收敛为 `flattenAllComponents()`。
- **交互式连线连不上嵌套子组件**：`ICELinkSlotManager` 的碰撞检测只遍历顶层 `childNodes`，
  现在改用拉平后的全集并按 z 序取最上层（与点击语义一致）。同时修掉「命中后从不重置
  `collision`」——旧实现在钩子离开组件后仍把插槽粘在原处不消失。
- **`gl-matrix` 的版权声明缺失 + rollup `external` 是死代码**：产物内联了 gl-matrix（MIT），
  但此前 banner 只有引擎自己的 MIT，不满足「保留版权声明」；现在 `rollup-plugin-license` 产出
  `dist/THIRD-PARTY-NOTICES.txt`。同时删掉 `rollup.config.mjs` 里定义后从未被引用的 `external`
  —— 它是地雷：谁把它接上就会去 require 一个只声明在 `devDependencies` 的包，下游直接炸。
  文档里「运行时仅 gl-matrix 一个库」的说法一并改为「零运行时依赖（内联）」。

### 修复

- **相邻两点重合时箭头算出 NaN**：`ICEPolyLine.doCalcArrowPoints()` 用 `p2 / hypot(p2)` 归一化切线方向，
  两点重合（例如两端点完全重合的退化连线、或贝塞尔零长退化）时会得到 `0/0 = NaN`，
  而 NaN 一旦写进点集会**污染包围盒与命中判定**（且不报错）。现加零向量短路：方向无定义时返回
  退化的三角面（三点重合），保持点集有限。
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
>
> **`linkShape: 'bezier'` 的四点须知**：① 它与 `curveType` 的 `quadratic/cubic` **互斥**
> （后者会把采样点当控制点、且与箭头插入点冲突），bezier 模式下 `curveType` 会被强制成 `'straight'`；
> ② `escapeDistance` / `routeOffset` **只服务正交路径**，bezier 用内部常量（本次未新增 `curveOffset` 配置项）；
> ③ 采样点写回 `state.points`，引擎 `Serializer` 里的连线点数会从 2~4 个涨到最多 25 个
> （每条约 +270B；应用层自己的项目快照是白名单、不含 `points`，**持久化体积不受影响**）；
> ④ 插槽正对且共线时（典型「右出左进且 y 对齐」）贝塞尔**就是一条直线** —— 这是插槽法线语义的固有结果。

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
