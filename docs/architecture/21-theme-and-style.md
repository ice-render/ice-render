# 主题与样式机制

> 定位：**引擎提供机制，应用层决定语义**（与 i18n 边界同一条原则）。
> 引擎保证「同一个值在任何地方都一致地解析出来」，但不规定你的品牌色叫什么、什么时候变。

## 1. 四层结构

```
① base      原始值：颜色 ramp / spacing / radius / fontSize / fontFamily / fontWeight
② semantic  语义：primary / text / border / background / palette / motion / chrome
③ chrome    交互外壳：选中框 / 手柄 / 连接插槽 / 引导线 / 连线标签 / 选区 / 阴影色 / 调试框
④ preset    组件预设：card / panel / button / title / …（引用 ②③①）
```

优先级链：**用户在 props 里显式给的值 > preset > 主题（semantic / base）> 引擎默认**。

## 2. 主题的三种用法

```ts
import { token, registerTheme, DEFAULT_THEME, DARK_THEME, mergeThemes } from 'ice-render';

// 命名主题（可注册多套，多品牌 / 多租户）
ice.setTheme('dark');
ice.registerTheme('app:my-brand', mergeThemes(DEFAULT_THEME, { semantic: { primary: '#0d6efd' } }));
ice.setTheme('my-brand');
```

**注册的写法约束**（与 `registerPreset` / `registerType` 对齐，2026-09-14 收紧）：

- 内置主题名（`default` / `dark`，见导出的 `BUILTIN_THEME_NAMES`）**不允许覆盖** ——
  快照存的是"相对命名主题的差异"，基线被悄悄换掉会让已存快照还原出另一个样子；
- 同一个名字**重复注册会抛错**，要覆盖请显式 `registerTheme(name, theme, { overwrite: true })`
  （以前这里是裸赋值：一个应用能把内置 `dark` 静默换掉，整个页面跟着变）；
- 应用主题**建议带命名空间**（`app:brand-a`），避免与引擎内置或同页其它产品撞名。

```ts
// 部分主题：深合并（只写要改的那几处）
ice.setTheme({
  primary: '#0d6efd',                       // 平铺 semantic（历史写法，继续支持）
  base: { radius: { md: 6 } },              // base token 也能改（旧实现会忽略并污染 semantic.base）
  motion: { duration: { fast: 50 } },       // 深层局部改：不会把 motion.easing 抹掉
});
```

```ts
// 只改交互外壳
ice.setChrome({ handle: { fill: '#0d6efd', stroke: '#0d6efd' }, slot: { hoverFill: '#ffd43b' } });
```

合并语义的两个硬约束（都有回归测试）：

1. **深合并**：`{ motion: { duration: { fast: 50 } } }` 之后 `motion.easing` 必须还在 ——
   浅合并会把它变成 `undefined`，动画路径读 `motion.easing[名]` 会直接抛 TypeError。
2. **不改原主题**：合并返回新对象，`DEFAULT_THEME` / 已注册主题不会被就地污染。

### 主题变更通知（被动跟随的唯一时机）

`setTheme` / `setChrome` 应用完成之后会广播一次变更；订阅用 `ice.onThemeChange(fn)`，
返回的函数就是退订：

```ts
const off = ice.onThemeChange(({ theme, previous, kind }) => {
  if (kind !== 'theme') return;              // 'chrome' 表示只有交互外壳那组 token 变了
  repaintMyChrome(theme.semantic.primary);   // 此刻 ice.getTheme() 已经是新主题
});
off();
```

约定（都有回归测试）：

- 通知发生在**主题已应用、作用域缓存已失效**之后，回调里读 `ice.getTheme()` 拿到的是新值；
- **每个订阅者互相隔离**：某个回调抛错会被忽略并 `console.warn` 一次（不刷屏、不影响主题应用、不影响其它订阅者）；
- `setChrome` 也发通知（外壳是主题的一部分），只是 `kind` 为 `'chrome'` —— 订阅者里再调 `setChrome`
  重算外壳时按 `kind` 过滤即可，不会来回打架；
- 底层就是 `ice.evtBus` 上的 `ICE_EVENT_NAME_CONSTS.THEME_CHANGE`（该常量已从包入口导出），
  `onThemeChange` 是更省事的封装；`evtBus` 会在首次订阅时按需创建，因此 `init()` 之前订阅也不会丢。

**为什么要有它**：应用层"被动跟随"引擎主题的场景（图表 `theme:'auto'` 跟随明暗、设计器外壳从主题派生、
自维护一套画布配色）以前只能等下一次重建 —— 引擎换了主题、上层纹丝不动，根因就是这里没有信号。
各产品**不需要**再发明同步时机。

## 3. 主题引用：样式在 **paint 时** 解析

样式里的色值可以直接引用 token，而不是写死字面量：

```ts
new ICERect({ style: { fillStyle: token('primary'), strokeStyle: '$border' } });
new ICERect({ style: { fillGradient: { type: 'linear', from: [0, 0], to: [0, 100],
  stops: [[0, token('primary')], [1, '$background']] } } });
```

- `token(path)` 是推荐写法（返回 `{ $token: 'primary' }`，可序列化）；
  字符串简写 `'$primary'` / `'$palette.2'` / `'$chrome.slot.fill'` / `'$base.radius.md'` 等价。
- **解析发生在绘制那一刻**，所以 `setTheme()` 之后只需标脏，不必遍历重建 ——
  自定义组件也能跟着主题热切换（以前只有用了 preset 的组件能跟）。
- token 名写错（解析成 `undefined`）时**跳过这次赋值**，保留 ctx 原值：
  把 `fillStyle` 赋成 `undefined` 会让整块画布消失，比"颜色没变"严重得多。
- SVG 导出走同一套解析（`SvgExporter` 会把引用解析成真颜色），并有测试守着。

## 4. 交互状态样式

```ts
new ICERect({
  style: { fillStyle: token('background'), strokeStyle: token('border') },
  states: {
    hover: { fillStyle: token('primary'), lineWidth: 2 },
    active: { fillStyle: token('primary') },
    selected: { strokeStyle: token('primary'), lineWidth: 2 },
    disabled: { globalAlpha: 0.4 },
  },
});

component.setInteractionState('selected', true);   // 应用层按自己的语义驱动
```

- 叠加顺序：`基础样式 → focus → hover → active → selected → disabled`（越靠后越优先），
  最后仍是 `state.style` 的运行时写值之上的**状态**生效。状态样式刻意排在 `state.style` 之后：
  `state.style` 在构造时是 `props.style` 的副本，排前面的话状态补丁会被它原样盖掉。
- 状态样式里同样可以用主题引用。
- **自动驱动是可选的**：`ice.enableInteractionStates()` 之后，引擎在指针移动时维护 `hover`、
  按下/抬起维护 `active`。默认关闭 —— 引擎的 mousemove 本来不做命中检测（高频 + 脏矩形渲染），
  打开它等于给每个移动事件加一次场景命中测试，由应用按场景决定值不值。

## 5. 主题作用域（子树级）

```ts
const darkPanel = new ICEGroup({ theme: { background: '#111827', text: '#e5e7eb' } });
// 这棵子树里的 token 引用按补丁解析，其余部分不受影响（分屏大屏 / 暗底卡片）
```

越是靠近组件的补丁优先级越高；作用域合并结果按「主题版本 + 参与作用域的组件身份」缓存，
没有作用域时是零分配快路径。

## 6. 主题进快照

```ts
const json = ice.serializer.toJSONString();
// { version, createTime, lastModifyTime, theme: { name: 'dark' } | { name, patch: {...} }, childNodes: [...] }
```

- 存的是 **`{ name, patch }`**：`name` 是基线命名主题（默认 `default`），
  `patch` 是**相对它的真实差异**（`deepDiff`），形状与主题同构（`{ base?, semantic? }`）。
- 差异是**在快照那一刻算出来的**，所以「当初怎么设置的」（整份主题对象 / 部分补丁 / `setChrome`）
  **不影响存下来的内容**：只存改过的那几处，永远是最小集。
  （旧实现存的是"调用方传进来的原始对象"，塞一整份主题进去就会把内置 token 全写进文档。）
- 与命名主题完全一致时只写 `{ name }`；**没动过主题就不写 `theme` 字段**（旧快照格式不受影响）。
- 还原时**先切命名主题、再叠补丁、最后建组件**：preset 与默认样式都是在构造时展开的。

## 7. 校验：别让写错的主题静默生效

```ts
const diagnostics = ice.validateTheme();
// [{ severity: 'error', code: 'low-contrast', message: 'semantic.hint 与背景的对比度只有 2.54:1 …' }]
```

覆盖：颜色类型不对 / palette 为空 / motion 缺 duration 或 easing（错误）、
`text` / `muted` / `hint` 与背景的 **WCAG 对比度**（< 3 报错、< 4.5 警告）。

顶层的 semantic 键分两类处理（2026-09-14 修正，此前一律报 warning 且文案写错）：

- **疑似打错内置名** → `warning` / `unknown-semantic-token`，并把候选名字指出来
  （`primry` → "是不是想写 `primary`？"）。判定保守：归一化后同名，或**首字母相同且编辑距离 ≤ 2**
  —— 所以自定义的 `kind`（之于 `hint`）不会被误报；
- **应用自带词汇** → `info` / `custom-semantic-token`。引擎不认识它，但**样式里的
  `$app.highlight` 引用是能被解析的**（`tokenValue` 按路径取，不限于内置名单），
  所以这是受支持的用法，不该报成问题。

> 消费诊断时按 severity 过滤：把 `error` / `warning` 当成"要修的问题"，`info` 只作说明。
> `ice.validateTheme()` 返回的就是这份数组。

> 这条检查第一次跑就抓到了引擎自己的默认主题：`hint`（gray-400）在纯白上只有 2.54:1。
> 现在默认主题走 Bootstrap 5 值，灰阶阶梯刻意比 Bootstrap 默认更深一档：
> `text` = `#212529`（15.4:1）、`muted` = `#495057`（8.2:1）、`hint` = `#6C757D`（4.7:1），三档全过 AA。

## 8. 组件预设注册

```ts
ice.registerPreset('app:my-card', (theme) => ({
  radius: theme.base.radius.lg,
  style: { fillStyle: theme.semantic.background, strokeStyle: theme.semantic.border, shadow: 'md' },
}));
new ICERect({ preset: 'app:my-card' });
```

- **`STYLE_PRESETS` 是只读视图**：读没问题（`STYLE_PRESETS.card(theme)`），
  写会抛错并把调用方指向 `registerPreset` / `unregisterPreset`。
  以前它是普通对象，`STYLE_PRESETS.card = fn` 能在实例上生成同名属性盖掉原型里的内置预设 ——
  「内置不可覆盖」的纪律一行赋值就能绕过（实测确认），所以这条口子堵死了。
- 内置预设（`card` / `panel` / `button` / `button-danger` / `gradient` / `title` / `subtitle` / `body` / `label`）
  **不允许覆盖**：同名不同义会让同一份 option 在不同工程里画出不同的图；
- 重复注册同名应用层预设会**明确抛错**（与 `registerType` 同一套纪律），
  要覆盖必须显式 `{ overwrite: true }`；`unregisterPreset` 只能注销应用层预设；
- 应用层预设建议带 `app:` 命名空间，便于区分来源。

## 8.5 外观入口的边界（新增字段前必读）

「外观只有一个容器」这条要落到可执行的规则上：

- **`style` = 外观**：ctx 属性 + 引擎的样式糖（`shadow` / `fillGradient` / `strokeGradient`）+
  子元素外观（`style.label`）。它在**绘制那一刻**解析，因此可以引用主题 token、可以被 `props.states` 覆盖。
  新增外观字段一律进 `style`（子元素用 `style.<元素名>` 这一层嵌套，别新开一个 `xxxStyle` 容器）。
- **顶层 props = 动画可写通道 + 几何 / 缓存签名参数**（`lineDash` / `lineDashOffset` /
  `lineBorder*` / `opacity` / `left` / `width` …）。它们**不是"漏进 props 的外观"**，理由有两条：
  ① 引擎的动画按顶层 key 写值（`state[key]`），`lineDashOffset` 这类"蚂蚁线相位"就是被动画驱动的；
  ② `ObjectCache` 的内容签名与脏矩形外扩量直接读这些 key —— 挪进 `style` 会让**动画与缓存刷新同时失效**。
  要挪，得先让动画支持嵌套路径并同步改缓存签名，那是独立一轮的事。
- 例外与收口：这些 props 里凡是**颜色**（如 `lineBorderColor`）都必须支持主题引用，
  并在读值处过 `resolveThemeValue(..., themeOf())` —— 颜色归主题，几何量归 props。
- 曾经的违规项 `labelStyle`（连线标签的第二个样式容器）已归并：规范位置是 `style.label`，
  老的顶层 `labelStyle` 在构造时**单向并入**（弃用别名，一处归一化），不再有第二个入口。

## 8.6 上层应用怎么接：桥的约定（新应用接入前必读）

引擎只提供**机制**，主题的**词汇表归应用层** —— 与 i18n 的边界是同一条原则
（引擎不做 i18n，应用层把最终字符串传进来）。所以应用层「自带一套 token」不是缺陷，
而是这套边界的**预期形态**：浏览器的 CSS 变量由各个站点自己定义，也是同一个道理。

接入时要守的几条：

1. **应用的 token 是权威，桥是单向的**：`应用 token → 引擎主题补丁`（`setTheme` / `setChrome`）。
   引擎**永不反向读**应用的词汇表 —— 一旦反向依赖，谁都不能单独换语言/换品牌。
2. **桥只映射「引擎自己画的那部分」**：`semantic` 的基础语义色（引擎默认样式用）+
   `chrome`（选中框 / 手柄 / 插槽 / 引导线 / 连线标签 / 选区 / 阴影色）。**不要**试图把应用词汇
   1:1 复制进引擎：两边需求本就不重叠，复制只会让引擎变成各家的垃圾桶。
3. **每个应用一条桥，放在应用仓、带单测**。现有三条：
   `ice-web-components/core/ICEThemeBridge.ts`（UI token → 引擎，7 条单测）、
   `ice-chart/theme/chartEngineBridge.ts`（图表主题 → 引擎，5 条单测）、
   `ice-entity-designer/theme/designerTheme.ts`（外壳配色**从引擎主题派生**：
   `designerChromeFromTheme()`；想要固定旧观感的宿主显式 `setChrome(DESIGNER_CHROME_ANTD)`）。
   桥要"被动跟随"引擎主题时，用上面的 `ice.onThemeChange(fn)`，别再各自发明同步时机。
4. **不要在应用里再实现一套主题解析**（优先级链 / 作用域 / 状态样式 / 序列化）——
   那些是引擎的职责，应用只负责"我的 token 叫什么、默认值是多少"。
5. **DSL 里能不能用 token 引用，取决于"谁在画"**：引擎绘制的图元（设计器的节点 / 连线样式、
   标签）走 `style`，`"$primary"` 这类引用能在绘制那一刻解析；**应用自绘的颜色**
   （图表系列是图表自己 `ctx.strokeStyle = color`）解析不了，只能用字面量 ——
   那类应用换主题的正确入口是它自己的主题字段（如 `option.theme`），再由它的桥转给引擎。
6. **设计语言（品牌基线）是产品决策，别靠合并词汇解决**。选型前家族里三套设计语言并存
   （引擎默认偏 Tailwind 色、chart 与 web-components 用 Bootstrap、设计器 DOM 是 antd）；
   要不要选一个基线是产品问题，合并 token 词汇既解决不了它，还会把各自的可替换性搭进去。
   **2026-09-14 已决策：方案① Bootstrap 5 基线** —— 引擎默认语义色对齐 Bootstrap 5
   （`DEFAULT_THEME.semantic.primary = #0D6EFD`），数据系列配色抽成唯一来源 `FAMILY_PALETTE`
   由引擎与 chart 共用，设计器画布外壳改为从引擎主题派生。**这只是"改值"**：三套词汇/三条桥
   的结构照旧（本节 1–5 点不变），各产品自有的身份主题（XP / arcade / 高对比）也照旧保留。
   决策记录见 [09 · 路线图](09-roadmap.md) 的「家族品牌基线」。

## 9. 默认样式与容器

- 叶子组件没写 `style` 时，默认样式**来自主题**（`fillStyle = semantic.primary`、
  `strokeStyle = semantic.border`），并随 `setTheme` 刷新。历史默认是写死的 `red/blue`（调试遗产）。
- **容器（`ICEGroup` 及其子类）默认透明**：容器是布局与分组用的，历史上因为
  `ICEGroup extends ICERect` + 写死默认样式，任何没给样式的容器都会画一个不透明红块
  （叠层示例里"混出的紫色"就是这么来的）。要背景 / 边框就显式给 `style` 或用 `preset`。

## 10. 性能约束（改这块之前必读）

`applyStyleToCtx()` 是每帧每组件都跑的热路径，因此：

- 样式里没有主题引用、也没有激活的状态时走**快路径**：与加主题机制之前逐字同构
  （不建闭包、不做额外分支），微基准 0.98× 基线；
- 是否含引用由 `styleNeedsTheme()` 在**构造 / 写 style 时**扫一次并缓存
  （`__styleHasTokens`），不在每帧扫；
- 主题是**惰性取用**的：只有真的碰到引用才去取实例主题；无作用域时 `themeOf()` 是零分配快路径。

> 微基准门禁：`npm run bench:micro -- --check`（含 `applyStyleToCtx`）。

## 11. 已知取舍

- **阴影的几何（blur / offset）归引擎**，主题只能改颜色：脏矩形外扩量是按那几个数字算的
  （`renderer/dirty-rect-util`），主题改几何会让局部重绘切边。要新的阴影形态就加一个新的
  命名预设（引擎侧），别让主题改数值。
- **`style.label` 是子元素外观的范式**：连线标签过去有自己的 `labelStyle` 容器，于是"标签色能不能用主题"
  有过两种答案；现在归一到一个容器、一条解析路径（老名字在构造时并入）。
- **状态样式压过运行时 `state.style`**：状态是"当前交互反馈"，按定义应该可见；
  需要更强的优先级时，在状态回调里自己写样式或清掉状态。
- 主题作用域的补丁是**浅语义**的：它不参与「组件类型的默认值」这一层（那层由 preset 负责）。
