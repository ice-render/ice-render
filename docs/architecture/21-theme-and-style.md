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
ice.registerTheme('my-brand', mergeThemes(DEFAULT_THEME, { semantic: { primary: '#0d6efd' } }));
ice.setTheme('my-brand');
```

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

覆盖：未知语义 token（警告）、颜色类型不对 / palette 为空 / motion 缺 duration 或 easing（错误）、
`text` / `muted` / `hint` 与背景的 **WCAG 对比度**（< 3 报错、< 4.5 警告）。

> 这条检查第一次跑就抓到了引擎自己的默认主题：`hint`（gray-400）在纯白上只有 2.54:1 ——
> 现在默认主题的 `muted` / `hint` 已调深一档（gray-600 / gray-500），两级都过 AA。

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
