# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [2.6.0] - 2026-09-14

本轮：**把主题机制的边界补齐** —— 一边给应用层让路（自带词汇别再被误报成问题），
一边把护栏立起来（注册表与 preset / type 对齐），再补上**主题变更通知**这个一直缺的信号。

### 新增

- **主题变更通知**：`ice.onThemeChange(fn): () => void`（返回的函数即退订）。
  `setTheme` / `setChrome` 应用完成、缓存失效之后广播一次，
  回调拿到 `{ theme, previous, kind }`（`kind: 'theme' | 'chrome'`）。
  - **为什么需要它**：以前 `setTheme` **不发任何信号**，应用层只有"自己是调用方"时才知道主题变了 ——
    图表 `theme:'auto'`（跟随引擎明暗）、设计器外壳（从引擎主题派生）这类**被动跟随**的场景
    只能等下一次重建。这是"引擎换了主题、上层纹丝不动"的根因，三条桥不必再各自发明同步时机。
  - 每个订阅者**互相隔离**：某个回调抛异常会被忽略并 `console.warn` 一次，不影响主题应用、也不影响其它订阅者。
  - 底层是 `ice.evtBus` 上的 `ICE_EVENT_NAME_CONSTS.THEME_CHANGE`；该常量与 `EventBus` 一样从包入口导出，
    不必硬编码字符串。`evtBus` 会在首次订阅时**按需创建**（`init()` 改为复用已有的那一条），
    因此 `new ICE()` → `onThemeChange()` → `init()` 这条顺序不会把订阅悄悄丢掉。
- 导出 `BUILTIN_THEME_NAMES`（内置主题名清单，与 `BUILTIN_PRESET_NAMES` 对齐）
  与 `ICE_EVENT_NAME_CONSTS`；新增类型 `ICEThemeChangeInfo`。

### 变更（破坏性：命名主题注册收紧）

- **`registerTheme(name, theme, options?)` 不再是裸赋值**，与 `registerPreset` / `registerType` 对齐：
  内置主题名（`default` / `dark`）**不允许覆盖**；同一个名字**重复注册抛错**，
  要覆盖须显式 `registerTheme(name, theme, { overwrite: true })`；名字非字符串 / 主题不是对象也明确抛错。
  **动机**：以前一个应用可以把内置 `dark` 静默换掉，整个页面跟着变；而 `themeSnapshot()` 存的是
  "相对命名主题的差异"，基线被悄悄替换会让已存快照还原出另一个样子。家族内没有依赖旧行为的用法。

### 变更：校验器不再把"应用自带词汇"当成错误

- `validateTheme()` 以前把所有不认识的 `semantic` 顶层键都判成
  「未知的语义 token「x」，**引擎不会读它**」——**这句文案本身就是错的**：
  `token('app.highlight')` 是能被解析的（`tokenValue` 按路径取，不限于内置名单）。
  现在分两类：
  - **疑似打错内置名** → `warning` / `unknown-semantic-token`，并给出候选名字
    （`primry` → "是不是想写 `primary`？"）。判定：归一化后同名，或**首字母相同且编辑距离 ≤ 2**
    —— `kind`（之于 `hint`）这类只差首字母的名字不会被误报；
  - **应用自带词汇** → `info` / `custom-semantic-token`（`ThemeDiagnostic.severity` 因此多了 `'info'`）。
  消费诊断时按 severity 过滤即可：`error` / `warning` 是要修的问题，`info` 只是说明。

### 验证

- `verify:full` 全绿：**1054** 单测（+16：注册表护栏 / 应用词汇 / 变更通知）+ 100 浏览器用例 + 4 套基准 + 包检查。
- 真实浏览器（`examples/theme/theme.html`）实测：`setTheme('dark')` 与 `setChrome(...)` 各触发一次通知
  （`kind` 分别为 `theme` / `chrome`，`previous` 正确），退订后不再收到，页面零报错。

### 修复：文本放不下时**不再压字形**

- **`fillText` / `strokeText` 不再传 `maxWidth`**。canvas 对第四个参数的语义是「把字形
  **横向压扁**」而不是截断 —— 表现是长文本挤成一团、还溢出盒子（事故现场：smart-water 顶部 Message
  的告警文案，中文一字约 13px，被压到约 7px/字的宽度里）。
- **溢出改为截断 + 省略号**：新增 `textOverflow: 'ellipsis' | 'clip'`（默认 `'ellipsis'`），
  按盒子内宽逐 grapheme 回退并追加 `ellipsis`（默认 `…`）；`'clip'` 保留「原样画出去、允许溢出」，
  交给调用方自己裁。截断算在 `getRenderLines()` 的显示行里，**画布 / SVG 导出 / 行盒三处同口径**；
  编辑态不截断（caret 按原始文本算）。
- **顺带修掉一个跨调用污染**：`splitGraphemes()` 以前把**缓存数组本身**返回给调用方，
  而截断逻辑用 `pop()` 就地回退 —— 谁截断谁改坏全局缓存。表现：先用 `ellipsis: '...'` 截过一次
  `abcdefgh`，再用默认 `…` 截同一段文本，结果从 `abcd…` 变成 `ab…`。现在返回副本。

### 验证（追加）

- `verify:full` 全绿：**1066** 单测（+12：溢出截断 / textOverflow / SVG 同口径 / grapheme 缓存污染）
  + 100 浏览器用例 + 4 套基准 + 包检查；**29 张 golden image 零差异**（示例里没有依赖压字形的场景）。
- 真实浏览器实测 smart-water 顶部 Message：放得下 → 完整显示且字形正常（面板按实测文字定宽）；
  放不下 → 末尾省略号截断，不再变形。

## [2.5.1] - 2026-09-14

补一个**遗漏的公共导出**：2.5.0 新增的家族色板常量只在模块内可见，应用层（`ice-chart`）
拿不到，就没法真正做到"共用一份色板"。纯增量，无行为变更。

### 新增

- 公共入口新增导出 `FAMILY_PALETTE` / `FAMILY_PALETTE_DARK` / `BOOTSTRAP_BASELINE`。
  `ice-chart` 直接 import 它们作为**唯一色板来源**，不再各存一份。

## [2.5.0] - 2026-09-14

本轮：**家族品牌基线落地为 Bootstrap 5**。这是一次**改变默认观感**的版本（语义色与数据系列配色都换了值），
机制与 API **完全不变**——应用层不需要改一行代码，但「没显式设主题」时引擎画出来的颜色会变。
按语义化版本给到 minor。

### 变更（破坏性：默认观感）

- **默认语义色从 Tailwind 值换成 Bootstrap 5 值**（`DEFAULT_THEME.semantic`）：
  `primary #3B82F6 → #0D6EFD`、`success → #198754`、`warning → #FFC107`、`danger → #DC3545`、
  `info → #0DCAF0`。**为什么**：`ice-chart`、`ice-web-components`、文档站门面本来就是 Bootstrap 值，
  引擎默认的 Tailwind 蓝是家族里唯一的"第三种蓝"；Bootstrap 也是这些库最常见的使用环境，对齐它是向现实靠拢。
- **灰阶阶梯刻意比 Bootstrap 默认更深一档**，保证 `text > muted > hint` 三档全部通过 WCAG AA：
  `text #212529`（对白底 15.4:1）、`muted #495057`（8.2:1）、`hint #6C757D`（4.7:1）、`border #DEE2E6`。
  （Bootstrap 自带的 `gray-500 #ADB5BD` 在纯白上只有 2.1:1，`ice.validateTheme()` 会直接判 error，
  所以 `hint` 取 gray-600；不要照抄 `gray-500`。）
- **数据系列配色抽出唯一来源**：新增导出 `FAMILY_PALETTE` / `FAMILY_PALETTE_DARK`，
  `DEFAULT_THEME.semantic.palette` 改为它的副本。此前引擎（Tailwind 500s）与 `ice-chart`
  （Bootstrap 蓝 + Tailwind 混合）各有一套 8 色，**同一份数据在两个产物里会得到不同颜色**；
  现在二者共用同一份（`ice-chart` 直接 import）。
- **`DARK_THEME` 换成 Bootstrap 5.3 的深色变体**：`background #212529`、`text #dee2e6`、
  `muted #ced4da`、`hint #adb5bd`、`border #495057`，彩色用亮一档的 `#3d8bfd / #479f76 / #ffda6a /
  #ea868f / #6edff6`，palette 用 `FAMILY_PALETTE_DARK`。
- **组件默认样式的兜底值**（主题缺字段时才命中的 `themeDefaultStyle` fallback）同步换成基线值。

### 不变（刻意保持）

- **`base.color` 那套色 ramp 原样保留**：它是"原始色料"（global token），品牌决策落在 `semantic`
  （alias token）上——两者故意的分工。不要靠合并 token 词汇来替代品牌决策。
- **主题机制、API、三条应用桥、`setTheme` / `setChrome` / token 引用全部照旧**；没有新增第二套入口。
- **XP / arcade / 高对比等产品身份主题照旧保留**——它们是产品身份，不是家族基线。
- `ice-web-components` / `ice-chart` **零代码改动**（本就是 Bootstrap 值）。

### 验证

- `verify:full` 全绿：**1038** 单测 + 100 浏览器用例 + 4 套基准 + 包检查。
- golden image（29 张）**零差异**：示例页大多是显式配色，语义 token 换值不会波及它们——
  这也顺带验证了示例的确定性。

## [2.4.1] - 2026-09-14

本轮：**把主题的类型导出去**（应用层要写 `setChrome` / `setTheme` / 自定义预设 / 处理诊断，
缺类型就只能写 `any`），顺手把一个歧义导出改名。

### 新增

- 导出主题**类型**：`ICETheme` / `ICESemanticTheme` / `ICEChromeTheme` / `ICEThemeInput` /
  `ICEThemePatch` / `ICEThemeTokenRef` / `StylePresetFactory` / `ThemeDiagnostic`。
  （应用层的实际反馈：给 `setChrome(patch)` 传参数时拿不到 `ICEChromeTheme`，只能 `any` —— 那等于没有契约。）

### 变更（破坏性：导出改名）

- **默认导出的主题工具包从 `ICETheme` 改名为 `themeUtils`**。`ICETheme` 这个名字同时被
  「运行时工具包（baseTokens / DEFAULT_THEME / registerTheme / token … 的集合）」和
  「主题**类型** `{ base, semantic }`」占用，`import { ICETheme }` 拿到的是值还是类型说不清。
  现在各归各位：值 = `themeUtils`，类型 = 上面的 `export type`。
  家族内没有任何地方 import 这个默认导出，改名零影响。

### 变更：外观入口收拢到 `style`（`labelStyle` 并入 `style.label`）

- **连线标签的外观**从独立的 `labelStyle` 容器并入 `style.label` —— 与其它 style 键走**同一条解析路径**，
  因此可以引用主题 token、可以被 `props.states` 覆盖。「标签的颜色算不算主题可控」不再有两种答案。
  老的顶层 `labelStyle` 保留为**弃用别名**：构造时单向并入 `style.label`（`style.label` 优先），一处归一化。
- **`lineBorderColor` 支持主题引用**（`'$border'` / `token(...)`），读值处统一过 `resolveThemeValue` ——
  颜色归主题、几何量（`lineBorderWidth`）归 props。
- **写成规则**（`docs/architecture/21-theme-and-style.md` §8.5 + `AGENTS.md` 铁律）：
  外观一律进 `style`（子元素用 `style.<元素>` 嵌套，不新开 `xxxStyle` 容器）；
  顶层 props 只放两类东西 —— ① 动画要写的 key（引擎按顶层 `state[key]` 写值），
  ② 几何 / 缓存签名参数（`ObjectCache` 的内容签名与脏矩形外扩量直接读它们）。
  往这两类加字段要同步改动画写值通道与缓存签名；颜色类 props 必须支持主题引用。

### 验证

- `verify:full` 全绿：**1038** 单测 + 100 浏览器用例 + 4 套基准 + 包检查。

## [2.4.0] - 2026-09-14

本轮主题：**把主题与样式机制补完** —— 让「主题」真正能覆盖引擎画出来的每一层，
而不只是用了 `preset` 的那些组件；顺带堵掉两处入口不一致。

**这是 2.x 里第一个有视觉变更的版本**，升级前值得看一眼下面的「变更」小节（应用层不需要改代码，
但观感会变；两处是刻意收紧的行为）。本轮也刻意**不做旧写法兼容**——家族仍在发布初期，
能一次做干净就不留历史包袱。

### 新增

- **主题引用：样式在 paint 时解析**。`style: { fillStyle: token('primary') }`（或字符串简写
  `'$primary'` / `'$palette.2'` / `'$chrome.slot.fill'` / `'$base.radius.md'`）在**绘制那一刻**解析，
  因此 `setTheme()` 之后**任意组件**都会跟着换 —— 以前只有用了 `preset` 的组件能跟，
  自定义组件的颜色永远停在创建那一刻。token 名写错时**跳过赋值**保留 ctx 原值
  （赋成 `undefined` 会让整块画布消失）。渐变 stops 与 `shadow: 'md'` 的颜色也走同一条解析。
- **交互状态样式**：`props.states = { focus, hover, active, selected, disabled }` +
  `setInteractionState()` / `clearInteractionStates()`。叠加顺序 focus → hover → active →
  selected → disabled（越靠后越优先），刻意排在 `state.style` **之后**（后者在构造时是
  `props.style` 的副本，排前面会把状态补丁原样盖掉）。自动驱动 `ice.enableInteractionStates()`
  **默认关闭**：引擎的 mousemove 本来不做命中检测，打开等于每次移动加一次场景命中测试。
- **交互外壳 token（`semantic.chrome`）**：选中框 / 变换手柄 / 连线端点 / 连接插槽 / 对齐引导线 /
  连线标签 / 文本选区 / 阴影色 / 调试框 / 蚂蚁线管壁色，从**写死在 11 个文件里的 ~45 处色值**
  收进主题；配套 `ice.setChrome(patch)` 只改外壳。深色主题给了一套协调值。
- **主题作用域**：`new ICEGroup({ theme: {...} })` 只影响子树（分屏大屏 / 暗底卡片），
  合并结果按「主题版本 + 参与作用域的组件身份」缓存，无作用域时是零分配快路径。
- **主题进快照**：`{ theme: { name, patch? } }`。`patch` 是**相对命名主题的真实差异**
  （`deepDiff`），所以「当初怎么设置的」（整份主题对象 / 部分补丁 / `setChrome`）不影响存下来的内容；
  与命名主题一致时只写 `{ name }`；没动过主题不写该字段（旧快照格式不变）。
- **主题校验 `validateTheme()` / `ice.validateTheme()`**：未知语义 token（警告）、颜色类型不对、
  palette 为空、motion 缺 duration 或 easing（错误）、`text` / `muted` / `hint` 与背景的
  **WCAG 对比度**（< 3 报错、< 4.5 警告）。配套 `contrastRatio`。
- **预设注册 `registerPreset` / `unregisterPreset`**（与 `registerType` 同一套纪律）；
  **深合并工具** `mergeThemes` / `deepMerge` / `deepDiff` / `deepEqual`；
  **主题查询** `listThemes` / `getRegisteredTheme` / `resolveTheme`。
- **文档《21 · 主题与样式机制》**：四层 token、引用解析、状态样式、作用域、快照、校验、
  预设纪律、**热路径性能约束**与已知取舍。

### 变更（观感 / 行为，升级前请过一遍）

- **容器默认不再画自己的盒子**。`ICEGroup` 继承自 `ICERect`，历史上因为默认样式写死 `red/blue`，
  任何没显式给 `style` 的容器都会画一个**不透明红块**（引擎自己的叠层示例里"混出来的紫色"
  就是这么来的）。现在容器默认样式是**透明**：要背景 / 边框就显式给 `style` 或用 `preset`。
- **默认样式来自主题**：没写 `style` 的叶子图元默认 `fillStyle = semantic.primary`、
  `strokeStyle = semantic.border`，并随 `setTheme` 刷新（不再是写死的 red/blue）。
- **`STYLE_PRESETS` 变成只读视图**：读照常，写与删除**抛错**并指向 `registerPreset` /
  `unregisterPreset`。以前 `STYLE_PRESETS.card = fn` 能在实例上生成同名属性盖掉原型里的内置预设，
  「内置不可覆盖」一行赋值就绕过去了。
- **默认主题的 `muted` / `hint` 调深一档**（gray-600 / gray-500）：旧值（gray-500 / gray-400）
  在纯白上分别只有 4.83:1 与 2.54:1，后者连 WCAG AA 的一半都不到 —— 这是 `validateTheme()`
  上线后第一次跑就抓到的自家问题。
- **主题合并改深合并**：`{ motion: { duration: { fast: 50 } } }` 不再抹掉 `motion.easing`
  （旧实现下动画路径读 `motion.easing[名]` 会直接抛 TypeError）；`{ base: {...} }` 现在真的生效
  （旧实现忽略它、还会污染成 `semantic.base`）。平铺 semantic 的历史写法继续支持。
- **还原顺序修正**：先切命名主题 → 再叠补丁 → 最后建组件（旧实现先叠补丁再切命名主题，
  补丁会被随后的命名主题整份覆盖）。

### 性能

`applyStyleToCtx()` 是每帧每组件都跑的热路径，新增机制必须不付代价：
样式里没有主题引用、也没有激活状态时走**快路径**（与加机制之前逐字同构），
微基准 **0.98× 基线**（`npm run bench:micro -- --check`）。
第一版用闭包实现时实测 1.88×、去掉闭包后 1.27×，最终按「快路径 + 原始应用方法」拆回来。

### 验证

- 单测 975 → **1032**；`verify:full` 全绿：单测 + 100 条浏览器用例（含像素快照）+ 4 套基准 + 包检查。
- 应用侧回归：`ice-chart`（367 单测 + 36 浏览器用例）、`ice-entity-designer`（350 + 78）、
  `ice-web-components`（1289 + 9）、`ice-smart-water`（83 + 35）全部在新引擎上通过。

## [2.3.2] - 2026-09-14

本轮主题：**把「1 万级场景」的渲染与交互热路径再压一档** —— 新增静态层位图、去掉两处每组件重复计算、
命中测试不再每次展平整棵树。**没有 API / 数据格式变更，应用层不需要做任何事**；所以按补丁级发布。

先给结论（同机真实浏览器 A/B，1600×1000 / dpr=1）：

- 「2000 文本 + 1000 折线 + 7000 矩形 + 200 个**分散**动画」：**23.75ms → 1.32ms/帧**
  （静态层位图；这是编辑器最典型、此前表现最差的形状：「每帧全量重画每一个组件」）。
- 「10,000 矩形全部动画」：**12.2ms → 9.9ms**（命令流重建信号 + 内容指纹）。
- 「2,000 文本全部动画」：**6.1ms → 5.3ms**。
- 「10,000 组件的 `ice.hitTest`」：**0.8ms → 0.3ms/次**（hover 类交互逐次 mousemove 调它）。

> 唯一需要下游知道的一条：静态层位图**默认开启**（它是纯渲染内部路径，像素口径沿用位图既定的
> 「alpha 逐位相同、预乘通道差 ≤3/255」）。若某个应用观察到异常，可用
> `ice.renderer.setStaticLayerEnabled(false)` 一键关掉并反馈。

### 变更

- **新增《20 · 引擎升版后的应用侧验证清单》**（2026-09-14，工程实践）：把"引擎升版 → 应用侧验证"固化成一页清单 —— 对齐依赖（含 `--prefer-online` 绕开本地 npm 缓存假报版本不存在）→ 门禁 → **全部示例页逐页冒烟**（内容像素占比判据，导航页列外）→ 按引擎改动类型定向检查（静态层读 `__layerBuilds` 确认是否真参与 + 层开/层关像素对照；hover 命中路径跑悬停探针；持久化改动做 save→load 往返）→ 发布。含像素对照的**两档口径**（简单场景 alpha 逐位/预乘 ≤3；密集重叠场景实测上界）、**归因顺序**（先量噪声底线 → 切组件缓存 → 单组件 → 主画布 vs 离屏 → 裁剪/陈旧），以及六个发布踩坑。

- **把「位图保真」的口径按场景写实：简单场景严格、密集场景另记实测上界（2026-09-14 文档/测试）**：
  起因是 2.3.2 的静态层在 ice-entity-designer 上做「层开 / 层关」像素对照时出现约 0.9% 的像素差。
  一串实验把静态层逐条排除 —— 单组件「直绘 vs 位图」0 差、主画布 vs 离屏画布 0 差、
  位图边界外扩 / 强制重建 / 关视口裁剪**都不能改变数值**；最后**把层在两侧都关掉、只切组件缓存开/关，
  差异与「层开 / 层关」一字不差** → 那个差是**组件级离屏缓存自身**的量化（2.3.1 及更早就有），
  静态层只是把它搬到了对照的另一侧。**静态层没有引入画质回归。**
  机制是固有的：位图是 8bit 预乘存储，贴回时还要与「底下已有的墨迹」再合成一次，
  而直接落墨时字形是直接栅格化到那块墨迹上的 —— 只在半透明边缘像素上有差。
  实测（密集文本、层两侧全关、只切缓存）：单个文本 **0 差**；300 文本不重叠 差异像素 1.34% /
  alpha 差 0.47% / 最大通道 5 / 最大预乘 2；重叠与加不透明底会更大。
  因此把口径写成两档：`offscreen-cache-fidelity.spec.ts` 继续用**简单场景的严格界**
  （alpha 差 <0.1%、预乘 ≤3/255），新增 `e2e/visual/component-cache-fidelity-repro.spec.ts`
  记录**密集场景的实测上界**（含约 2× 余量）。历史观测到的单像素 48/255 尚未在受控场景复现，
  留作独立问题，**不因此放宽任何一处界**。

- **命中测试不再「每次命中都展平整棵树 + 排序」（2026-09-14 性能）**：
  `hitTestComponents` 原先每次调用都 `flattenAllComponents()`（分配一个上万元素的数组）+ `sort()`
  再线性扫描，而它在线性交互热路径上 —— 应用层的 `ICEHoverManager`、`ice-chart` 的 `HitResolver`
  都是**逐次 mousemove** 调它。实测 1 万组件下 **0.8ms → 0.3~0.4ms/次**（同机 A/B，公共 API `ice.hitTest`），
  并且不再每次命中都分配并排序一个大数组（GC 也省一份）。
  做法：复用渲染器手里那份「只在结构 / zIndex 变化时才重建」的 z 序队列（`renderer.getOrderedQueues()`）
  **倒序**扫描，第一个命中即 z 序最高者；结构变更或 zIndex 变更时按需刷新，所以
  「点得到的位置」与「画出来的样子」仍然严格对齐。没有渲染器时回退到旧路径，两条路径语义逐条对齐。
  回归：`tests/renderer/hit-test-ordered.test.ts` 用一个**独立预言机**（不做世界盒预筛、不复用队列）
  在 6 类场景上逐点比对 9800 个点（含 zIndex 相同、工具层、裁剪、结构/zIndex 变更后立即命中、
  无渲染器回退），并带防空转护栏。
  顺带把 `__resetLeakyCtxState` 里那个 21 分支的字符串 `switch`（每个 style 键各走一次）换成查表。

- **新增「静态层位图」：一大段静态组件整层贴回，1 万级画布的静态帧从 20ms 量级降到 1ms 量级（2026-09-14 性能）**：
  「很多静态 + 少量分散动画」是编辑器最典型的场景，而此前它**每帧全量重画每一个组件** ——
  200 个分散动画会让脏区合并预算（6 块）撑不住、面积门（35%）必然触发，局部重绘整条退回全量。
  现在局部重绘不成立时改走**静态层位图**：把 z 序上**连续一大段**不需重画的组件整体光栅化成一张位图，
  每帧只「清屏 + 贴一张图 + 画剩下那几个」。成员集合 / 视口 / 结构变化才重建位图（成本 = 重画这些成员一次）。
  同机真实浏览器 A/B（`renderer.setStaticLayerEnabled(false)` 为对照）：
  混合编辑器场景（2000 文本 + 1000 折线 + 7000 矩形 + 200 个分散动画）**23.75 → 1.32ms/帧（18.0×）**；
  10000 静态 + 200 个铺满画布的动画 **11.83 → 1.30ms（9.1×）**。
  而「10000 静态 + 200 个聚在一角的动画」「2000 静态 + 50 个分散动画」两个场景**层不介入**（局部重绘已经够好）
  —— 它只在真正需要时才接管。
  **视口手势期间不建层**：位图的栅格是按当时的渲染视口对齐的，视口一变整层作废；此时「重建 + 贴回」
  比重画一遍还贵（多一次整层 blit），而下一帧又变。实测拖拽平移/滚轮缩放下每帧慢约 35%（13.0 → 17.6ms）。
  现在与组件级离屏缓存同一条纪律：**视口变化的帧一律不建位图**，手势停下后的第一帧再统一重建一次
  （实测回到 13.0ms 持平，建层次数 301 → 1）。另外 `setViewport()` 在**值没变**时不再
  `markQueueDirty()` —— 平移驱动里重复下发同一视口（钳制边界 / 视口跟随同步）很常见，
  每帧白打掉一次队列就等于每帧丢一次静态层。
  安全边界：① 只有 z 序上**连续**的干净段能成层（队列是全局 zIndex 排序，位图只能整层贴回，交错会改变叠放次序）；
  ② 有 `clipChildren` 祖先、`globalCompositeOperation` 非 `source-over`、`display:false` 的组件一律排除；
  ③ 位图栅格对齐纪律与离屏缓存完全一致（渲染视口缩放 + 整数设备像素落点 + 1:1 贴回）；
  ④ 渲染进离屏位图时若抛异常（运行时 ctx 能力不全 / 测试替身缺方法）**绝不能抛出去** ——
  那在帧回调里就是未捕获异常（小程序直接白屏）；现在捕获并整个会话关掉静态层，退回逐组件重画。
  像素验收：新增 `e2e/visual/static-layer-pixel.spec.ts`（dpr=1 与 dpr=2 各 10 步），
  判据取引擎既定的位图口径 —— **alpha 逐位相同、预乘通道差 ≤3/255**，实测 ≤1。
  单选/单元回归见 `tests/renderer/static-layer.test.ts`；文档见 [04](docs/architecture/04-rendering-performance.md)。
  顺带修掉 `bench/render.cjs` 的离屏 ctx 桩缺 `rect/closePath/arc/ellipse` 等方法的问题（它正是被这条路径打出来的）。

- **每组件热路径去掉两处重复计算：命令流重建 + 内容指纹（2026-09-14 性能）**：
  ① `ICEPath` 原先以 `dirty` 决定是否重建命令流，而 `dirty` 的语义是"本帧要重绘" ——
  **平移动画每帧都置脏，几何却一动没动**，每帧白重建 `Path2D` + 重放整条命令流。
  改为双信号判据：派生参数重算过（`refreshParams()` 消费掉一次 `paramsDirty`）**或**几何签名
  （`__pathSignature()`：宽高/半径/本地原点/dots·points 内容/closePath/curveType）变了才重建。
  签名**默认保守**（未覆盖签名的类维持旧行为），只有读的 state 字段封闭的 4 个内置 builder 声明精确签名，
  因此自定义子类（BPMN 形状 / 进度环 / Spinner 等自己实现 `createPathObject()`）语义不变。
  ② `ObjectCache.render()` 原先每帧给每个已缓存组件拼一个 40 段字符串再 `!==`，
  改为**向量采样 + 逐项比较**（`contentKeyVector()` + `keyEquals()`），字符串形态只在真要重建位图时拼；
  判定口径**严于**原字符串比较（判"不同"只会多重一次位图，不会贴旧位图）。
  同机真实浏览器 A/B：10,000 矩形全动画 **11.2 → 9.9ms（−11%）**、全量写 `left` **10.6 → 9.5ms（−10%）**、
  2,000 文本全动画 **5.8 → 5.4ms（−9%）**；四套基准门禁同步复核全部快于基线
  （场景 B 0.94×、文本静态 0.87×、文本动画 0.82×）。回归：
  `tests/renderer/path-rebuild-signal.test.ts`、`tests/renderer/offscreen-content-key-fastpath.test.ts`，
  以及 `ObjectCache.test.ts` 新增的"廉价前置判断"等价性用例；
  文档见 [04](docs/architecture/04-rendering-performance.md) 的「每组件热路径」小节与 `AGENTS.md` 的
  「路径命令流重建信号铁律」。

- **`AnimationTimeline` 播完之后 `play()` 成了空操作（2026-09-14 修）**：时间轴跑完后 `playing` 仍是 `true`，
  于是再次 `play()` 会被开头那句 `if (this.playing && !this.paused) return this;`（"已经在播就不重复启动"）
  吞掉 —— **"重播"按钮点了没反应**，`isPlaying()` 也一直说谎（示例页的"暂停/继续"按钮因此永远走 pause 分支）。
  现在全部键跑完即把 `playing` 置回 false（注意顺序：先 resolve `finished`，它依赖 `playing`）。
  回归：`tests/animation/animation-timeline.test.ts` 新增用例「播完之后 play() 必须从头重播」；
  真实浏览器路径由 ice-render-dsl 的编排 e2e 覆盖（`e2e/orchestration.spec.ts` 的"重播回起点"）。

- **基准门禁补齐：Node 侧两条热路径也能"判定"了**（2026-09-14）：`bench/render.cjs` 与 `bench/micro`
  此前只打印数字，性能有没有退化完全靠人记得跑、记得上次是多少。现在两者都有 `--check`：
  与入库基线（`bench/baselines/render.json`、`bench/micro/baseline.json`）对比，
  超宽松倍数（2.0× / 2.5×）即非 0 退出；`--update-baseline` 是有意刷新基线的入口。
  随之接进门禁：`verify` 里 `bench 2000 -- --check`、`verify:full` 追加 `bench:micro -- --check`。
  基线为 2026-09-14 实测（Apple M4）：场景 A 1.05ms / 场景 B 1.75ms / refreshQueue 0.011ms /
  文本缓存加速比 8.7×，与 2.3.0、1.4.10 跨版本复核均在 ±3% 内（无退化）。

## [2.3.1] - 2026-09-14

本轮主题：**把"连线端点手柄（hook）/ 连接插槽（slot）"这条交互链路修通、修准**。
两个用例（ice-entity-designer 的 `entity-editor` 与 `bpmn-editor`）里，点连线看不到端点手柄、
拖到手柄后放不下、手柄与插槽还整体错位 —— 根因都在引擎侧。

### 修复

- **连线端点手柄被 `transformable` 连带禁用**（2026-09-13）：`ICEControlPanelManager` 原来用**同一个**
  `transformable` 决定"要不要给这个组件控制面板"。但线条型组件的面板是 **LineControlPanel（两端
  ICELinkHook 端点手柄）**，语义是"拖动端点改变连接关系"，与"旋转/缩放手柄"是两回事。
  于是下游踩坑：应用层为了"记法不可变换"给连线设 `transformable: false`，**端点手柄与连接插槽一起没了**
  （ice-entity-designer 的 8 个域包全是这个症状：点连线看不到 hook，也没法把线拖到别的组件上）。
  现在线条组件改用新的 `linkEditable`（默认 `true`）单独控制端点手柄；`transformable` 只管变换手柄，
  要禁止改连接写 `linkEditable: false`。
- **拖拽归属：抬起事件必须回到"按下的那个组件"**（2026-09-13）：派发器对抬起事件按当前位置重新命中检测，
  于是"按下 A → 拖到 B 上松手"时 A 收不到 mouseup。对端点手柄是致命的 —— 它要在 mouseup 时
  （`HOOK_MOUSEUP` → `ICELinkSlotManager`）把连线改接到落点插槽上，收不到就"拖得动、放不下"。
  现在派发器记住按下的组件，抬起时先把事件补派给它，再按老规矩派发给命中组件（总线仍只触发一次）。
  回归：`tests/event/DOMEventDispatcher.drag-owner.test.ts`。

- **"端点手柄与插槽位置错乱"（两个真实缺陷，2026-09-13 实测于 ice-entity-designer 的 bpmn-editor.html）**：
  ① `LineControlPanel` 给面板自身设了 `top: -5`，而两个端点手柄是它的**子组件** ——
     手柄位置是按连线端点算的绝对坐标，于是整体偏离端点 5px（实测端点 [148,576] vs 手柄中心 [148,571]）。
     改为 `top: 0`，手柄中心与连线端点严格重合。回归 `tests/control-panel/line-control-panel.test.ts`。
  ② `ICELinkSlot.hostComponent` 的 setter 只订阅新宿主的 `AFTER_RENDER`、**不立刻重算位置** ——
     钩子先掠过一个很大的泳道、再落到泳道里的任务上时，插槽继续留在泳道边上
     （实测：碰撞已命中任务，插槽却仍铺在 1180×150 的泳道上）。现在 setter 里立刻 `updatePosition()`。
     回归 `tests/link/link-slot.test.ts`。
  端到端回归：ice-entity-designer 的 `e2e/link-hooks-bpmn.spec.ts`（真浏览器：手柄中心 == 连线端点；
  拖到任务上后，插槽中心 == 该任务的 T/R/B/L/C）。

> 两处一起修，ice-entity-designer 才恢复"点连线 → 出现端点手柄 → 拖到另一个实体上 → 连接关系改变"，
> 该仓新增 e2e `e2e/link-hooks.spec.ts` 钉住整条用户路径。

## [2.3.0] - 2026-09-13

本轮主题：**动画机制从「能动」走到「可控 + 可控性可验证」**（写值通道 → 分层渲染 → 帧调度 →
表达力 → 编排），并顺手修掉两个真实缺陷（聚合退化的卡帧、时间轴重播）。
唯一需要应用层动手的是一条**行为变更**：空闲停帧之后，"监听 `ICE_FRAME_EVENT`"不再等于
"帧还会来"——自己做逐帧计算的应用要显式 `ice.setContinuousFrames(true)`（见下文 ⚠️）。

### 修复

- **`coalesceRegions` 的 O(k³) 聚合退化（会把一帧卡死几秒~几分钟）**（2026-09-13）：
  "区数超上限后反复合并「面积增量最小」的两块"这一步是 O(k²)，最多跑 k 轮 → 整体 O(k³)。
  脏块一多（≥25 块、彼此不直接相接但合并划算，例如大量分散的小动画元素）就会指数级变慢 ——
  实测 100 块 108ms / 300 块 2.7s / 600 块 21.9s / **1000 块 111s**（一帧 = 一次卡死）。
  现在加了**聚合预算** `MAX_COALESCE_REGIONS = 32`：超过预算不再精挑细选，直接塌缩成一个
  并集盒交给面积阈值判定（保守解：最多回退全量重绘，绝不会画错）。修完 1000 块 **1ms**，
  单测钉住（含"2000 脏块 <200ms"）。

### 变更

- **脏区门控维持「计数门」**（2026-09-13）：原计划把 `FULL_FALLBACK_DIRTY_RATIO = 0.2`（脏组件数占比）
  换成"以脏区**面积**为主判据"，实测后**否决** —— 脏区散开时并集盒必然撞 0.35 面积阈值、面积门救不了，
  反而让注定回退全量的帧多花 ~30%（先收集再聚合）；成片脏区的交叉点在 20~30% 且低于测量噪声。
  "1 万图元里 2000 个分散在动"这个场景的正解是**分层渲染**（见 [18 §3.1](docs/architecture/18-animation-architecture.md)），
  不是这道门。数据见 [18 §3.3](docs/architecture/18-animation-architecture.md) 与
  [04 优化方向](docs/architecture/04-rendering-performance.md)。

- **动画写值通道 + 设备像素量化**（2026-09-13，见 [18 · 动画机制](docs/architecture/18-animation-architecture.md)）：
  动画此前每帧走 `setState` → 无条件置 `paramsDirty` → **离屏位图每帧重建**（1000 个文本 35.1ms/帧）。
  现在：
  - `ICEComponent.setState(patch, options?)` 支持显式 `{ paramsDirty: false }`（省略 = 旧行为）；
  - `ICEComponent.ANIMATION_SAFE_KEYS` + `isAnimationSafeKey(path)`：子类声明「纯绘制/变换」键白名单
    （基类：位置/`transform.*`/透明度/显示/zIndex/fill/stroke；`ICEText` 额外放行光标、选区、
    颜色、装饰线等**不参与量测**的键）。**未知键与未声明的组件一律保守地照旧置脏** —— 第三方组件零风险；
  - `AnimationManager` 只在"本帧写出的键全是安全键"时跳过派生参数重算；
  - `AnimationManager.snapToDevicePixel`（默认开）：把**飞行中的纯平移**吸附到设备像素栅格，
    让位移满足位图纯平移复用要求的"整数设备像素"；只对当前可离屏缓存的组件生效，
    **动画终点值永远精确写入**（`to: 100.5` 落在 100.5），单条动画可 `snapToDevicePixel: false` 关掉。
  - 实测（`npm run bench:anim`）：1,000 个文本的平移动画 **35.1ms → 2.7ms/帧**（位图重建 40000 → 0，
    复用率 100%）；矩形对照不变。门槛已接进 `verify:full`。
- **分层渲染原语**（2026-09-13，见 [18 · 动画机制 §3.1](docs/architecture/18-animation-architecture.md)）：
  引擎**不做**自动分层（层的划分有产品语义），而是给三个原语 + 一套配方：
  - `ICE.linkViewport(a, b)` / `ice.followViewport(source)`：两层视口双向/单向同步（`setViewport` /
    `zoomAt` 都覆盖、`destroy()` 自动解绑、内部防回环）；
  - `ice.setInputPassthrough(true)`：覆盖层 canvas 置 `pointer-events: none`（关闭时还原为空，不覆盖应用样式）；
  - **多实例事件归属**：`DOMEventDispatcher` 现在按**目标 canvas** 过滤"按下/滚轮"事件 ——
    目标是别人的 canvas 就忽略。此前同页多实例是全局广播，点上层画布会同时驱动下层实例的命中检测，
    "上层穿透"因此形同虚设（移动/抬起事件仍不过滤，避免拖拽途中丢事件）。
  实测（`npm run bench:layers`，10000 静态元素 + 200 动画标记）：单画布 26~34ms/帧 → 分层
  **0.4~0.6ms/帧（≈60×）**，动画期间静态层重绘 **0** 次；门槛已接进 `verify:full`。
  配套示例 `examples/animation/layered-canvas.html`（两层 + 视口同步 + 穿透开关）与
  `e2e/visual/layered.spec.ts`（5 条真实浏览器断言：两层都出画、视口始终一致、
  穿透时点得到下层 / 关掉穿透就点不到、暂停整层动画不影响另一层）。
- **跨实例迁移原语**（2026-09-13，18 §3.1 的 ②-2 切片）：`ice.moveComponentTo(component, targetIce, targetParent?)`
  `ice.detachChild(component)` + `rebindComponentTree(component, ice)`：
  - `moveComponentTo` 把组件（连同整棵子树）搬到另一个 `ICE` 实例，**保持世界坐标**（按矩阵换算，
    不照抄 left/top）、**不销毁**（组件自身监听/子树/动画配置都保留）、`ice/ctx/evtBus` 递归重绑、
    动画注册与选中态由目标实例接管；目标父级必须属于目标实例，同实例迁移返回 false（那是 addChild/adoptChild 的活）。
  - `detachChild` = "摘除但不销毁"（`removeChild` 会 `destory()` 清事件，不能用于迁移）。
  - `rebindComponentTree`：**显式子树重绑**。修掉一个真实缺口 —— `ICEGroup` 的 AFTER_ADD 子树同步钩子是
    `once`（只首次挂载触发），对"已经挂过"的容器迁移时不会重绑后代，表现为"搬过去之后后代的事件仍发到旧实例"。
  - 用途：分层渲染里"拖拽期间把元素提升到动画层、松手放回"（`examples/animation/layered-canvas.html` 已演示）。
  回归：`tests/ICE.move-component.test.ts`（9 条：世界坐标换算/子树重绑/动画注册迁移/选中态/防御/队列标记）
  + `e2e/visual/layered.spec.ts` 新增 1 条真实浏览器用例（提升→重绑→动画注册→放回，世界坐标 ≤1px）。

- **多层导出合成**（2026-09-13，18 §3.1 的 ②-3 切片）：分层渲染是**多张 canvas**，
  `ice.toDataURL()` 只拿得到自己那一层，导出"用户看到的整张图"必须按层合成：
  - `exportSvg([layerA, layerB], options)` / `exportSvgResult(...)`：**矢量合成**。
    数组顺序 = 叠加顺序（第一层在下）；`area: 'content'`（默认）各层共用覆盖全部层的内容包围盒
    → 层间按世界坐标对齐；`area: 'viewport'` 取第一层的视口与画布尺寸。**单层传单个 target 时输出与历史逐字节一致**。
  - `composeLayersDataURL([layerA, layerB], opts)` / `composeLayersToCanvas(...)`：**位图合成**
    （PNG 截图 / 缩略图）。按层序 `drawImage` 叠加，尺寸缺省取各层 canvas 的最大者，可给背景色；
    运行时无离屏画布能力时抛稳定错误码 `ICE_OFFSCREEN_CANVAS_UNSUPPORTED`。
  - 示例 `examples/animation/layered-canvas.html` 增加"导出 SVG / 导出 PNG（两层合成）"两个按钮。
  回归：`tests/export/svg-export.test.ts` 新增 4 条（单层数组=单目标逐字节一致 / 层序 / 世界坐标对齐的并集 /
  空数组安全）+ `tests/export/compose-layers.test.ts` 5 条（层序、尺寸取最大与显式尺寸、背景、类型、错误码）
  + `e2e/visual/layered.spec.ts` 新增 1 条真实浏览器用例（SVG 含两层内容且 1024×640、PNG 为 1024×640）。

- **动画配置的结构化校验与诊断（Agent 侧闭环）**（2026-09-13）：
  - 新增 `validateAnimations(animations, options?)`（`src/animation/validate-animations.ts`，**纯函数**：不依赖 ICE 实例、
    不改传入对象、不 console）：把"什么算合法动画配置"变成可编程接口，产出
    `{ severity, code, message, path }[]`，码为 `ICE_ANIM_*`（`ICE_ANIMATION_DIAGNOSTIC_CODES`）：
    `KEY_INVALID` / `DURATION_INVALID` / `DELAY_INVALID` / `ITERATION_INVALID` / `EASING_UNKNOWN` /
    `VALUE_NOT_INTERPOLATABLE` / `KEYFRAMES_INVALID` / `INFINITE_LOOP`（warning）/
    `KEY_AFFECTS_MEASUREMENT`（warning：动画尺寸/文本这类会每帧重量测的属性）。
    传 `isSafeKey` 即可让"是否影响派生参数"与 `ANIMATION_SAFE_KEYS` 白名单同源。
  - `AnimationManager.getDiagnostics()` / `clearDiagnostics()`：**运行期**真实发生的拒绝与缓动回退也记同一组码
    （按 `code|path` 去重），应用层/Agent 不必再靠 console 文本判断配置被跳过。
  - `ICEComponent.isAnimationSafeKeyFor(Ctor, path)`：下游（DSL / Agent 校验）没有实例也能按类型问"这个属性动画安全吗"。
  - 顺带修正白名单语义：基类（不量测的图形）放行整条 `style.*`（矩形动画颜色不再被误判成"影响派生参数"）；
    `ICEText` 显式列出基类项而**不继承** `style.*`（字号/字间距/行高会改变盒子，仍必须走 `paramsDirty`）。
  回归：`tests/animation/validate-animations.test.ts`（10 条）、`tests/animation/animation-diagnostics.test.ts`（5 条）、
  `tests/graphic/animation-write-channel.test.ts` 增静态查询与白名单语义断言。

### 变更

- **帧调度与合规（④）**（2026-09-13）：
  - **空闲停帧**：`FrameManager` 从"无条件续帧"改为"按需续帧"——宿主（ICE 实例）用 `needsFrame()` 回答
    "这一帧还要吗"（脏 / 动画在推进 / `setContinuousFrames(true)`）；`ice.dirty = true`、`AnimationManager.add()`、
    `resume()` 都会 `wake()` 唤醒。真实浏览器实测：静止页面 500ms 内 **0 次帧回调**（改造前约 30 次），
    有动画时恢复、暂停与结束后再次归零。`ICE.destroy()` 的顺序随之调整（先清场景再注销总线），
    否则清理阶段的置脏会把刚停下的循环又拉起来。
    - ⚠️ **应用层迁移（破坏性行为变更）**：若你自己 `evtBus.on('ICE_FRAME_EVENT', …)` 做**逐帧计算**
      （时钟、令牌仿真、自绘指示器、自定义补间…），必须调 `ice.setContinuousFrames(true)`，
      否则引擎的空闲停帧会让你的逐帧逻辑**停摆**（"挂了监听"不再等于"帧还会来"）。
      用完记得归还（`setContinuousFrames(false)`），别把宿主的常驻帧诉求一起关掉。
      这不是理论风险：`ice-entity-designer` 的 BPMN 令牌仿真就是这样被真实浏览器 e2e 抓出来的
      （令牌停在第 2 个节点不动），修复见该仓 `src/bpmn/BpmnSimulator.ts` 的 `__acquireContinuousFrames`。
  - **次要动画降频**：动画配置新增 `fps`（如 `fps: 30`）——按时间降采样，跳过帧不改变运动曲线，终点仍精确。
  - **减少动态效果**：`prefers-reduced-motion: reduce`（或 `ice.setReducedMotion(true)`）下动画**直接落终态**，
    并记 `ICE_ANIM_REDUCED_MOTION` 运行期诊断；`AnimationManager.reducedMotion` 构造时读系统偏好。
  - 拖拽期间跳过命中检测：确认是**既有行为**（移动类事件本就不做命中检测），本轮补回归钉住。
  回归：`tests/FrameManager.idle.test.ts`（6）、`tests/animation/animation-scheduling.test.ts`（6，含 fps 采样、
  reduced-motion 折叠、帧需求）、`e2e/visual/animation-scheduling.spec.ts`（4 条真实浏览器：空闲停帧三段态 /
  置脏唤醒 / reduced-motion 落终态 / 正常偏好对照组）。

- **动画表达力：应用层自定义动画（⑤）**（2026-09-13）：
  - **自定义缓动**：`easing` 可直接传函数 `(t) => number`（只对这条动画生效），或 `registerEasing(name, fn)`
    注册后按名字用（新增 `easing-registry.ts`：`registerEasing` / `unregisterEasing` / `resolveEasing` /
    `easingNames` / `customEasingNames`；内置缓动不可覆盖，重名抛 `ICE_ANIM_EASING_NAME_CONFLICT`）。
  - **颜色与带单位数字串插值**（新增 `interpolators.ts`，校验与运行时同源）：支持
    `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa` / `rgb()` / `rgba()` 与 `'12px'`（单位须一致）；
    颜色在 sRGB 空间插值、输出统一 `rgb()` / `rgba()`。此前"颜色动画不支持"的坑填上了
    （`ICE_ANIM_VALUE_NOT_INTERPOLATABLE` 不再对颜色报错）。
  - **生命周期回调**：`onStart` / `onUpdate` / `onRepeat` / `onComplete`，回调上下文
    `{ component, key, value, progress, iteration, animation }`；回调异常只记 `ICE_ANIM_CALLBACK_ERROR`
    并忽略，不打断帧循环。
  - **往返方向**：`direction: 'normal' | 'reverse' | 'alternate'`（alternate 与 loop/iterationCount
    组合即 yoyo，奇数轮反向）；校验器新增 `ICE_ANIM_DIRECTION_INVALID`。
  回归：`tests/animation/interpolators-easing-registry.test.ts`（10）、`tests/animation/animation-expressiveness.test.ts`（9）、
  `e2e/visual/animation-expressiveness.spec.ts`（2 条真实浏览器：颜色动画真的画上画布 + 自定义缓动 +
  回调链 + alternate 往返）。

- **编排（时间轴 / 错峰）与运行时控制**（2026-09-13，⑥）：
  - `ice.animationManager.timeline()`：`add(component, config, { at })`（绝对毫秒或 `'+=N'` 相对上一条）、
    `stagger(components, config, { each, at })`（"卡片依次滑入"）、`play/pause/resume/stop/restart`、
    `duration` / `isPlaying()` / `finished`（Promise）。**它是调度器而非新的求值器**：`play()` 把 `at` 折算成
    `delay` 写进 `props.animations`，推进仍由 `AnimationManager` 完成 —— 缓动/关键帧/量化/缓存复用/空闲停帧
    自动生效。`play()` 每次都从头播放，`restart()` 即"点击重播"。
  - 运行时控制：`component.setAnimation(key, cfg)` / `removeAnimation(key)`（免"必须构造时声明"）、
    `manager.replay(component)` / `isAnimating(component)`。
  - **修掉两个真实缺陷**（都由真实浏览器 e2e 抓出）：① 没在构造时声明 `animations` 的组件，
    `props.animations` 继承的是**冻结的共享默认对象**，运行时挂动画会抛
    "Cannot add property …: object is not extensible" → `setAnimation` 内部做**写时复制**；
    ② 时间轴 `stop()` 后再 `play()` 会沿用上一次的 `startTime`，elapsed 一夜之间变成"已经跑很久"，
    编排被压缩/直接跳终点 → `play()` 现在每次都重置运行时状态；顺带把 `finished` 的计数从"轨道"改为"键"
    （一条轨道可挂多个属性，否则 Promise 会提前 resolve）。
  回归：`tests/animation/animation-timeline.test.ts`（11 条）+ `e2e/visual/animation-timeline.spec.ts`
  （2 条真实浏览器：错峰入场各卡片依次开始且最终全部落位；重播/停止冻结/暂停继续）+
  示例 `examples/animation/animation-timeline.html`（自定义缓动 + 错峰入场 + 重播按钮，进 examples 冒烟）。

  **待做**：OffscreenCanvas/GPU 后端（脏区门控已于 2026-09-13 定案：维持计数门，见本文"修复/变更"与 18 §3.3）。

## [2.2.0] - 2026-09-13

### 新增

- **i18n 边界与引擎侧原语**（2026-09-13）：明确「引擎不做 i18n，但必须让 i18n 显示正确」的契约
  （见 `docs/architecture/17-i18n-boundary.md` / AGENTS.md「i18n 边界铁律」），并补上三块原语：
  - **断行策略** `ICEText.wordBreak: 'normal' | 'break-all'`（默认 `'normal'`）：拉丁词不再被硬拆、
    CJK 逐字断并做禁则（行首禁标点 / 行尾禁开括号）、**无空格脚本（泰/老挝/高棉/缅甸）按词典分词断行**
    （复用 `Intl.Segmenter` 的 word 粒度，不需 locale；宿主不支持则退回逐字），单个词整行放不下时才硬拆；
    `'break-all'` 保留旧的逐 grapheme 贪心。实现 `src/graphic/text/text-wrap.ts`。
  - **文字方向** `ICEText.direction: 'ltr' | 'rtl' | 'auto'` + `textAlign: 'start' | 'end'`：
    `'auto'` 按首个强方向字符判定；渲染时写 `ctx.direction`（**特性检测**，运行时没有该成员就跳过），
    渲染结束归位 `inherit`（不破坏「组件渲染自包含」与脏矩形/离屏缓存契约）；SVG 导出输出
    `direction="rtl"` 并按方向映射 `text-anchor`。实现 `src/graphic/text/text-direction.ts`。
  - **稳定错误码** `ICE_ERROR_CODES` / `iceError()` / `getICEErrorCode()` / `isICEError()`：
    引擎错误带 `code`（`ICE_*`）与结构化 `details`，应用层据此映射自己的语言包，
    不必再匹配中文 message。实现 `src/util/errors.ts`。
- 以上三者随包导出（`toIsoTime`、错误码、`TYPE_ID_PATTERN` 等工具同理）。
- **文本排版正式配置**（2026-09-13，B 组第 5 项）：`lineHeight` / `letterSpacing` / `textDecoration`
  从「随 style 透传给 ctx 的野生键」变成引擎正式支持的排版属性，**量测 / 换行 / 渲染 / SVG 导出四处同一口径**
  （解析规则集中在 `src/graphic/text/text-style.ts`）：
  - `style.lineHeight`：数字按 **px**；字符串支持 `'2'`（无单位 = **倍数**）/ `'40px'` / `'1.5em'` / `'150%'`；
    `0` / 空 / `'normal'` = 引擎默认（`max(字形墨迹高, 字号 × 1.35)`，即既有行为）。显式配置后**单行也按它算盒高**。
  - `style.letterSpacing`：数字按 px；字符串支持 `'2px'` / `'0.2em'` / `'20%'`。量测前写进 `ctx.letterSpacing`
    （canvas 的 `measureText` 会把间距算进宽度，含最后一个字符后的间距），因此**盒子宽度 = 浏览器实际排版宽度**，
    换行 / 省略号也按含间距的宽度断行；SVG 导出输出 `letter-spacing`。
  - `style.textDecoration`：`'none' | 'underline' | 'line-through' | 'overline'`（可空格组合）。
    canvas 没有原生支持，由引擎按行自绘（颜色 `textDecorationColor` 留空跟随 `fillStyle`，粗细
    `textDecorationWidth` 留 0 按 `字号/14`）；SVG 导出输出 `text-decoration`。
  - 注意：下划线画在基线下 `0.12em`，会**溢出**「贴合字形墨迹」的几何盒 —— 脏矩形 / 离屏缓存的落墨盒
    已把它算进 `stylePaintPad()`（否则下划线会被裁掉半截）。
- **多行编辑**（B 组第 6 项）：`ICEText.multiline: true`（文本里已有 `\n` 时也自动按多行处理）——
  编辑态改挂透明 `<textarea>`（保留换行、不自动折行、不出滚动条），回车插入 `\n` 而不是提交，
  `Escape` 提交、`Ctrl/Cmd + Enter` 提交；无 DOM 运行时的 keydown 降级路径同步支持。单行编辑行为不变（回车提交）。
- **选区与按字形命中**（B 组第 7 项）：新增 `selectionStart` / `selectionEnd` 状态与
  `setSelection(start, end)` / `getSelection()` / `selectAll()` / `clearSelection()`；无 DOM 运行时
  选区由引擎自绘（`style.selectionColor`，DOM 编辑态交给浏览器的 input/textarea）；
  新增 `getCaretIndexAt(localX, localY)` —— 按**行带 + grapheme 边界中点**把本地坐标换算成光标下标（RTL 反向量）；
  编辑态的 `containsLocalPoint` 改为**按文本行**判定（点在 padding / 盒子空白处不算命中），非编辑态仍是盒子语义。
  行带按 `textBaseline`（top / middle / bottom / alphabetic）与真实字形 / 字体度量推导，
  `textBaseline: 'top'` 这类非默认基线下的光标与选区不再整体错位。

### 变更

- **引擎对文本保持中立**（2026-09-13，写进契约）：不做 Unicode 规范化 / 大小写折叠、不做任何
  locale 相关的默认格式化（时间戳固定 ISO 8601 UTC）、序列化逐字节保留用户文本。
- **`getRenderLines()` 行宽缓存**（B 组第 8 项）：逐行宽度在量测阶段顺手记入缓存（`__lineWidthCache`），
  居中 / 右对齐、装饰线、光标、选区、SVG 导出共用，不再各自 `measureText()` 一遍；`setState`（置 `paramsDirty`）
  与 `remeasureText()` 清空缓存，缓存 key 还带「行内容 + 字体 + 字间距」自我纠正。
- **离屏缓存指纹补齐文本墨迹属性**（同上）：`ObjectCache.contentKey` 的文本分支新增
  `lineHeight / letterSpacing / textDecoration* / selectionColor / direction / wrap / wordBreak / maxLines /
  ellipsis / selectionStart / selectionEnd` —— 这些属性只改墨迹、不改合成矩阵，漏进指纹就会出现
  「属性改了画面不动」（贴回旧位图）的隐蔽 bug。

### 修复

- **文本子系统四项契约级缺陷**（2026-09-13，审计 + 回归确立，铁律见 AGENTS.md）：回归用例
  `tests/graphic/text-bugfixes.test.ts`（8 条），视觉回归 `e2e/visual/offscreen-cache-fidelity.spec.ts`。
  - **`style` 透传的 ctx 状态泄漏**：`style` 是**透传**给 canvas 的（`__applyStyleProp` 末行 `ctx[prop] = value`），
    旧实现只把 shadow / globalAlpha / lineCap / textAlign 等 11 个属性列入归位表 —— 用户只要写一个没登记的键
    （`letterSpacing`、`direction`、`filter`、`imageSmoothingQuality`…），它就会**漏给同一帧后面绘制的组件**，
    破坏「组件渲染自包含」，也就是脏矩形局部重绘 / 离屏缓存的像素契约。现在归位表补齐到 21 项，
    虚线位改由数组长度推导（`LEAKY_LINE_DASH_BIT`）——**新增 style→ctx 键必须同步登记**。
  - **无 DOM 运行时的编辑不按 grapheme**：Backspace / Delete / 左右方向键改按 grapheme 边界移动
    （`a👍b` 退格删整个 emoji，而不是留下半个代理对）；`renderCaret()` 重写，光标位置对**多行**
    （按 `\n` 折行定位）、**RTL**（从右边缘往左量）与 `textAlign: start/end/center/right` 都正确。
  - **自定义字体加载完成后不重测**：`ice.loadFont()` resolve 后自动 `remeasureTexts()`，
    首帧用回退字体量出的宽高与换行不再残留（i18n 场景下中文字体按需加载最容易踩）；
    `ICEText.remeasureText()` 只标脏，真正的重算发生在下一帧渲染。
  - **「默认值 10 = 未设置」哨兵**：文本的自动尺寸改为按「**调用方是否显式给尺寸**」判定 ——
    构造参数与 `setState({ width / height })`（含布局管理器分配的尺寸）都算显式，此后不再被量测覆盖；
    `new ICEText({ width: 10, height: 10 })` 因此不再被悄悄放大，未给尺寸时行为不变。引擎内 10 处
    依赖旧哨兵语义的测试/视觉夹具一并清理（`tests/persistence/derived-children.test.ts`、
    `tests/renderer/CanvasRenderer.dirty-rect-gate.test.ts`、
    `e2e/visual/fixtures/{offscreen-cache-fidelity,dirty-rect-compare}.html`）。

## [2.1.1] - 2026-09-13

### 修复

- **首次写出即定下 `createTime`**（2026-09-13）：`Serializer` 在没有现成 `createTime` 时，
  以前只取 `now` 却不记住它 —— 于是**同一会话里每次序列化都会得到不同的 `createTime`**
  （"首次创建时刻"名不副实，`undo/redo` 依赖的「同一份内容序列化结果稳定」也不成立）。
  现在首次写出会把它写进 `ice.documentMeta`，之后一直沿用；`clearAll()` 后重新定。
  回归用例用假时钟推进 5 秒再写一次，专门钉死这个坑（此前的用例靠"同一毫秒碰巧相等"假通过）。

## [2.1.0] - 2026-09-13

### 新增

- **导出 `toIsoTime(value)`**（2026-09-13）：把任意历史时间值（ISO 字符串 / `2022/1/1 00:00:00`
  这类 `toLocaleString` 产物 / epoch 毫秒 / `Date`）归一化成 ISO 8601 UTC；解析不了返回 `undefined`。
  下游包在自己的快照格式里带 `createTime` 时直接复用它，保证「历史格式 → ISO」的规则只有一份。

### 修复

- **载入失败不再改动文档元信息**（2026-09-13）：`Deserializer` 读 `createTime` 的时机从"解析前"
  挪到 `migrate()` **之后** —— 此前载入一个版本不支持的数据（`migrate` 抛错）会先把该数据里的
  `createTime` 写进 `ice.documentMeta`，一次失败的载入污染了当前文档的出生时间。

## [2.0.1] - 2026-09-13

### 修复

- **时间戳有了真正的语义：`createTime` 跨保存保留**（2026-09-13）：以前两个字段都是"这一次写出的时刻"，
  于是 `createTime` 名不副实（重新打开再保存就变了）。现在 `Deserializer` 会把读到的 `createTime`
  记到 `ice.documentMeta.createTime`（归一化成 ISO 8601 UTC），`Serializer` 写出时优先沿用它，
  `lastModifyTime` 才是本次写出的时刻；`ice.clearAll()` 清空即视为新文档、并清掉该值。
  数据里没有 / 解析不了（历史脏值）则回退到当前时刻。回归用例见 `tests/persistence/serialization.test.ts`。
- **序列化时间戳改用 ISO 8601 UTC**（2026-09-13）：`createTime` / `lastModifyTime` 从
  `new Date().toLocaleString()` 改为 `new Date().toISOString()`（如 `2026-09-13T04:12:33.123Z`）。
  旧实现在 **zh-CN 机器上写 `2026/9/13 12:12:33`、en-US 机器上写 `9/13/2026, 12:12:33 PM`**
  ——同一份工程换个运行环境，导出数据就不一样，而且不能直接排序/比对。新格式定长、字典序即时间序、
  任何语言与工具都能解析。两个字段**只是导出元信息**（引擎不读、反序列化不依赖），因此不需要迁移；
  需要「导出结果逐字节可比」的场景请自行丢弃它们（`ice-entity-designer` 的 `FlowDesigner` 已这么做）。

## [2.0.0] - 2026-09-13

### 变更（破坏性：自研 / 第三方自定义类型需要迁移）

- **类型标识统一为 `namespace:Type`**（2026-09-13）：`ICE.registerType()` 的第一个参数从
  「全局类名」改为 **canonical typeId**，格式 `/^[a-z][a-z0-9-]*:[A-Za-z_][A-Za-z0-9_-]*$/`
  （工具函数 `src/util/type-id.ts`）。引擎内置改为 `ice-render:*`（`ice-render:Rect`、
  `ice-render:Group`…），下游各自用自己的包名（`ice-entity-designer:*`、`ice-chart:*`、
  第三方 `my-app:*`）。**为什么要改**：无 namespace 的类名是一张全局平面表，ICE 家族
  （引擎 / 实体设计器 / 图表 / 业务方）各自的自定义图元必然撞名，而旧的注册表对该情况
  **静默覆盖**（ice-chart 甚至专门 `try/catch` 吞掉了重复注册异常）——撞名后已存数据会错乱，
  且没有任何信号。现在冲突一律显式化。
- **注册冲突明确抛错**（2026-09-13）：① 同一 typeId 注册**不同**构造函数 → 抛错；
  ② 同一构造函数注册**第二个** canonical typeId → 抛错（否则 `getTypeId()` 反查歧义，
  写出哪个名字取决于注册顺序）；③ 同一 typeId + 同一构造函数 → 幂等，不抛错。
- **不做旧名兼容**（2026-09-13）：家族仍在发布初期（引用者少、无历史包袱），因此引擎不维护
  「旧的无 namespace 类名 → 新 typeId」的别名表。`ICERect` 之类的旧写法、`ice-chart` 的旧 kebab 名
  （`ice-plot-area`）、`ice-entity-designer` 的旧领域名（`FlowNode`…）一律不再被识别；
  旧格式数据里的节点按「未注册类型」处理（跳过 + 记入 `deserializer.unknownTypes`），改数据即可。
- **注册表改为无原型对象**（2026-09-13）：`ice.typeMapping` 不再是 `{}`，
  否则 `getType('constructor')` / `getType('toString')` 会命中 `Object.prototype` 上的成员，
  把脏数据变成 `new Object(state)` 或抛出「别名冲突」的假错误。

### 新增

- **`Serializer.unregisteredTypes`**（2026-09-13）：序列化时未注册的类型仍回退写出
  `constructor.name`（保持既有约定），但会被去重记录并告警 —— 回退名在下游打包后可能被
  mangle，静默写出去等于埋雷。应用层可据此提示用户先 `registerType()`。
  对应地，反序列化侧的未注册类型仍记录在 `deserializer.unknownTypes`。
- **`ICE.hasType(typeId)` / `ICE.getRegisteredTypeIds()`**（2026-09-13）：查询当前实例的
  canonical 注册表（便于自检命名空间是否规范）。
- **插件注册失败的错误信息带上插件名**（2026-09-13）：`ICE.use(plugin)` 的 `components`
  里出现非法 / 冲突的 typeId 时，报错形如 `插件 "xxx" 注册组件类型失败：...`。

## [1.4.10] - 2026-09-13

### 新增

- **「小程序形状」运行时回归**（2026-09-13）：新增 `tests/mini-program/`，把 `document` / `window` /
  `Path2D` / `requestAnimationFrame` / `FontFace` / `OffscreenCanvas` 全部摘掉，只留 `wx.*`，
  画布对象就是小程序 canvas 节点本来的样子（只有 `width` / `height` / `getContext`），每次提交都验证：
  启动、出帧（无 rAF 走定时器兜底）、路径命令重放（无原生 `Path2D`）、离屏缓存与降级、
  文本量测降级、触摸输入归一化、序列化往返、SVG 导出，外加一条「不许触碰小程序 Canvas 2D 子集之外
  成员」的越界检查。这一层当场抓出并修掉了下面五个缺陷。
- **小程序接入示例与宿主契约**（2026-09-13）：`examples/mini-program/` 提供开发者工具可直接打开的
  页面（含触摸坐标适配层），文档补「宿主最少要做什么」与「自动验证到哪一层 / 哪些只有真机才能覆盖」。
- **模拟器级端到端脚本**（2026-09-13）：`examples/mini-program/e2e/smoke.js` 用官方
  `miniprogram-automator` 在真实小程序运行时里跑「加载 → `ICE.init` → 触摸拖拽 → 图元位移 → 截图」，
  本地手动执行（不进 CI，见脚本头部说明）。

### 修复

- **`ICE.init()` 不再无条件调用 `canvasEl.getBoundingClientRect()`**（2026-09-13）：小程序 canvas 节点
  没有这个方法，此前会**启动即崩**。新增 `ICE.readCanvasRect()`：缺失时退回「原点 (0,0) + 画布自身
  尺寸」，正好对上小程序「触摸坐标相对画布」的语义，宿主不需要再包一层假 DOM。
- **老基础库没有 `wx.createOffscreenCanvas` 时不再在帧回调里抛错**（2026-09-13）：`ObjectCache`
  建位图失败会向上抛，而它发生在帧回调里 —— 未捕获异常＝小程序白屏。现在捕获后整体关闭缓存、
  退化为直接落墨，并记住该运行时没有离屏能力。
- **无 DOM 时文本量测不再靠抛异常降级**（2026-09-13）：`ICEText.__measureByDOM()` 在没有 `document`
  的运行时（小程序 / headless）会先抛错再被吞掉，控制台刷错误日志；现在直接按 state 尺寸兜底。
- **控制面板不再假定 `evt.target` 存在**（2026-09-13）：小程序合成的事件对象没有 `target`
  （浏览器里它恰好是 canvas 元素，所以这个空值一直没暴露），此前会直接崩。
- **`fromJSONObject()` 的延迟回调不再写已销毁实例**（2026-09-13）：它在 300ms 后写
  `eventDispatcher.stopped`，若实例在窗口期内 `destroy()`，`eventDispatcher` 已置空 →
  定时器里抛未捕获异常。

### 验证

- 单测：**93 套件 / 728 用例**（含新增的 15 条小程序形状运行时用例）；
- 模拟器级：`examples/mini-program` 在真实小程序运行时里 5/5 断言通过
  （页面加载 + `ICE.init`、引擎建图、触摸拖拽使方块从 (40,40) 移动到 (240,220)、截图存档）。

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
