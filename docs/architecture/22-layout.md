# 22 · 布局（LayoutManager）

> 设计思想来自 Java Swing 的 `LayoutManager`：**容器持有策略，策略只算位置**。
> 本文与 `AGENTS.md` 的「布局铁律」是同一套口径，**以代码为唯一真相**
> —— `src/layout/`（策略）、`src/graphic/container/ICEGroup.ts`（择时与尺寸协商）。

## 1. 两个角色

| 角色 | 是谁 | 职责 |
|---|---|---|
| **容器** | `ICEGroup`（及其子类） | 持有策略、决定**什么时候**排（`setLayout` / 增删子项 / 子项改尺寸 / 校验趟） |
| **策略** | `ICELayoutManager` 的派生类 | **只算位置**：`layoutContainer(container)` 里写子项的 `left/top`（必要时连 `width/height` 一起写） |

两条边界：

- **策略里不写"什么时候排"** —— 那是容器的事，写在策略里迟早会自激或漏排；
- **策略里不自己算内外距** —— 一律走 §4 那套公共方法。

## 2. 内置策略（7 个）

类型 id 全部注册进类型注册表（`src/consts/LAYOUT_TYPE_MAPPING.ts`，`ice-render:` 前缀），
构造参数就是 `toJSON()` 报出来的那份（§9）：

| 类型 id | 类 | 构造参数（默认值） | 说明 |
|---|---|---|---|
| `ice-render:ICEFlowLayout` | `ICEFlowLayout` | `gap`(10) / `gapY`(=gap) / `align`('left') / `crossAlign`('start') / `pack`('in-order') | 流式换行；`pack: 'first-fit'` 会把小件回填到任何放得下的行（Swing `FlowLayout` 是 `in-order`） |
| `ice-render:ICEBoxLayout` | `ICEBoxLayout` | `axis`('x') / `gap`(5) / `align`('start') | 单轴堆叠；`align` 支持 `start`/`center`/`end`/`stretch` |
| `ice-render:ICEGridLayout` | `ICEGridLayout` | `cols` / `rows` / `gapX`(10) / `gapY`(10) / `cellSizing`('content') | 网格；`cols` 与 `rows` 给一个即可（另一个反推），`gridSpan` 可跨格 |
| `ice-render:ICEBorderLayout` | `ICEBorderLayout` | `gap`(5) | 五区（`north`/`south`/`east`/`west`/`center`），区域写在子项的 `layoutConstraint` |
| `ice-render:ICECardLayout` | `ICECardLayout` | `currentIndex`(0) | 只显示当前一张（其余置 `display:false`），当前卡摆到内容盒左上角；`currentIndex` 进快照（切到第几张是文档状态） |
| `ice-render:ICEOverlayLayout` | `ICEOverlayLayout` | — | 所有子项叠在内容盒左上角；首选尺寸取**最大**而非求和（叠加语义） |
| `ice-render:ICELayeredLayout` | `ICELayeredLayout` | `gapX`(80) / `gapY`(40) / `direction`('horizontal') / `crossAlign`('start') | 分层级布局（泳道 / 层列） |

> 默认值取的是 `??` 而不是 `||`：`gap: 0`、`currentIndex: 0` 这类"零"必须能表达
> （用 `||` 会被当成"没传"，静默落回默认值）。

## 3. 尺寸协商：只有一条路

**布局问子项的 `getPreferredSize()`**（策略侧入口 `preferredSizeOf(child)`），
不许直接读 `state.width/height` 当"它想要多大"。子项怎么答：

| 子项 | 它报什么 |
|---|---|
| 叶子图元 | 当前盒子（文本在量测之后就是字形实际尺寸） |
| 容器（有自己的布局） | **没有显式声明尺寸**时，报它自己策略算出的**内容尺寸**（对齐 Swing `Container.getPreferredSize() → preferredLayoutSize`）；显式给了尺寸的容器仍报自己的盒子（等价于 Swing 的 `setPreferredSize`） |
| 任何声明过 `setPreferredSize()` 的组件 | 声明值优先 |

兜底：子项没实现 `getPreferredSize()`、或它报 `[0,0]`（"我对尺寸没有意见"）时，
落回它的盒子尺寸（`preferredSizeOf`）。

⚠️ **构造期给的 `width/height` 是"边界"（`setBounds` 语义），不是首选尺寸**。
"父布局不许顶掉调用方给的尺寸"这类诉求，用 `setPreferredSize()` 表达，别指望布局去猜。

- `fitContent: true` 的容器：摆完之后把自身尺寸设成 `layoutManager.getPreferredSize()`
  （尺寸**真的变了**才写，避免每帧抖动）。它只是"可选行为"——**没有它也能嵌套**：
  子容器照样会把内容尺寸报给父布局。
- `ICEGridLayout` 的 `cellSizing: 'equal'` 例外：`getPreferredSize()` **返回 `[0,0]` 不表态** ——
  子项被拉成格子大小之后再量它们，等于量容器自己（自指反馈，只会越量越大）；
  容器多大由调用方给的尺寸决定。

## 4. 内外距只有一套实现

容器的 `padding`、子项的 `margin` 一律走这几个公共方法，**新布局不许自己再算一遍**
（否则必然出现"屏幕上是 8px、盒子按 0 算"的漂移）：

| 方法 | 作用 |
|---|---|
| `contentBox(container)` | 容器内容盒（扣掉 `padding`） |
| `paddingOf(container)` / `marginOf(child)` | 读内外距（归一化后的四值） |
| `outerSizeOf(child)` | 子项外尺寸（含 `margin`） |
| `placeChild(child, x, y)` | 按内容盒坐标摆放（内部会加 `margin`） |
| `placeChildSized(child, x, y, w?, h?)` | 摆放并给定尺寸 |

## 5. 子项上的布局声明（放 `state`，随快照走）

| 键 | 谁读 | 说明 |
|---|---|---|
| `margin` | 所有布局 | 子项外边距 |
| `grow` | `ICEBoxLayout`（主轴） | 主轴拉伸权重；与交叉轴 `stretch` 可以同时用 |
| `gridSpan: { colSpan, rowSpan }` | `ICEGridLayout` | 跨格（默认 1×1） |
| `layoutConstraint` | `ICEBorderLayout` | 区域名：`north`/`south`/`east`/`west`/`center` |

非法值**提示一次**而不是静默落默认值（例：`layoutConstraint` 写了个不认识的区域名，
会按 `center` 处理并 `console.warn` 一次）—— 静默纠正会让"为什么排成这样"查不出来。

## 6. 什么时候排（择时全在容器侧）

- `setLayout(manager)` → **立即** `doLayout()`；
- 增删子项（`addChild` / `removeChild` …）→ **立即**；
- 子项改 `width/height` → **合并到下一帧**（`__layoutRequested`，渲染前消费一次）；
- 子项 `display` 变化 → 请求父容器重排（§7）。

`doLayout()` 内部是四步（`ICEGroup.doLayout`）：

1. **测量趟**（自底向上）：每个子项 `measure()`；`fitContent` 的子容器先把自己量成内容尺寸，
   这样父布局读到的是它的**自然尺寸**，而不是还没算出来的空盒子；
2. **排布趟**：本容器的策略落位（只摆位置）；
3. **`fitContent`**（可选）：把自身尺寸设成内容尺寸；
4. **校验趟（自顶向下）**：对齐 Swing `Container.validateTree()` —— 谁失效（被改过尺寸 / 请求过重排）
   就把谁重排一遍并递归它的子树，**没失效的子树整棵跳过**；中间层容器即使没有自己的布局也要穿过去
   （它的后代可能失效）。

两条硬规则：

- **布局不继承**：父容器 `setLayout()` **不**下灌给子容器（对齐 Swing `Container.setLayout`：
  父布局只负责给子容器摆位置）。子容器要自动排布，就自己 `setLayout()`。
- **布局期间不自激**：`__layingOut` 期间子项的位置/尺寸变化不再反向请求重排，统一交给当前这一趟。

## 7. 交互锁（独立的一维策略）

布局接管后，后代默认禁止手动变换/拖动（`transformable=false`）—— 因为位置由代码接管了。
但这条**可以单独关**，它不依附于布局：

```js
group.setLayout(new ICEBoxLayout({ axis: 'y' }), { lockInteraction: false }); // 只排位置、不锁交互
group.setInteractionLock(true); // 没有布局也能单独切
```

⚠️ 锁是**有副作用**的（直接写子项的 `transformable` / `draggable`），所以解锁时按备份**还原原值**：
只锁不还原，会留下"布局撤销之后子项再也拖不动"的不可逆坑。编辑器类场景（位置是数据）应当关掉它。

## 8. 显隐是布局输入

`setState({ display })` 会请求父容器重排（对齐 Swing `Component.setVisible()` → `invalidateParent()`）。
布局器统一用 `layoutChildren()` 取"参与布局的子项"：

| 布局 | 不可见子项 |
|---|---|
| `FlowLayout` / `BoxLayout` / `BorderLayout` / `OverlayLayout` | **跳过**（不占位） |
| `GridLayout` | **不跳过**（照样占格子）—— 对齐 Swing `GridLayout` |
| `CardLayout` | 不看子项自己的 `display`：它**按 `currentIndex` 改**子项的 `display`（第 i 张可见、其余隐藏） |

## 9. 序列化：布局是"怎么排"，属于文档内容

容器在快照里存 `layout: { type, props }`（`Serializer.__serializeLayout`）：

- 布局必须实现 `toJSON()`，报**构造参数**（运行时缓存不要报，否则往返会出现"存下来一堆派生值"）；
- 类型登记在 `src/consts/LAYOUT_TYPE_MAPPING.ts`，第三方布局用
  `ice.registerType('your-namespace:MyLayout', MyLayout)` 注册；
- 读回时类型未注册 → **跳过策略但保留坐标**，并记入 `deserializer.unknownTypes`
  （与未注册组件同口径：不炸整份数据）。

不登记的症状是"存盘再打开、版式散了"——坐标还在，但排布策略没了。

## 10. 回归

| 文件 | 守什么 |
|---|---|
| `tests/layout/layout-swing-semantics.test.ts` | 与 Swing 对齐的那几条口径（首选尺寸、校验趟、`update` 语义） |
| `tests/layout/layout-composition.test.ts` | 嵌套组合：内容自适应 / 内外距 / `grow`+`stretch` / 布局与交互共存 |
| `tests/layout/grid-border-layout.test.ts` | 网格（含 `cellSizing` 两口径、跨格）与五区布局 |
| `tests/layout/box-card-overlay-layout.test.ts` | 单轴 / 卡片 / 叠加 |
| `tests/layout/layered-layout.test.ts`、`layered-core.test.ts` | 分层级布局与其核心算法 |
| `tests/layout/layout-reflow.test.ts`、`layout-responsive.test.ts` | 重排时机（一帧内合并）与容器尺寸变化后的重排 |
| `tests/layout/layout-ignore.test.ts` | `display:false` 的显隐口径 |
| `tests/layout/layout-interaction-lock.test.ts` | 交互锁的副作用与还原 |
| `tests/layout/layout-min-size.test.ts` | 最小尺寸约束 |
| `tests/persistence/layout-serialization.test.ts` | 快照往返（含未注册类型跳过策略保留坐标） |
