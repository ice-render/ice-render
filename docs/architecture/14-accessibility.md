# 14 · 无障碍（a11y）原语

> 状态：**引擎只提供原语，DOM 镜像层由应用层实现**。本文说明为什么这样切、原语契约是什么、
> 以及如果将来要在引擎内建镜像层应该长什么样。

## 1. 问题：canvas 内容对辅助技术不可见

`<canvas>` 只是一张位图，不向辅助技术暴露任何绘制对象（MDN 在 `<canvas>` 词条中明确说明，
并建议在无障碍站点避免使用 canvas，或至少提供 fallback 文本）。W3C 更把 canvas 的
命中测试、放大、动态焦点列为**未解决用例**。

因此任何 canvas 图形引擎要让键盘用户与屏幕阅读器可用，都必须额外提供一层
**隐藏 DOM 镜像**：与画布内容一一对应的真实 DOM 元素（`<button>` / `role="img"` 等），
由 DOM 承担语义、焦点与播报，由 canvas 承担绘制。

## 2. 边界：为什么引擎不自建镜像层

镜像层的三个关键决策高度依赖具体产品语义，写在引擎里既做不对也难维护：

| 决策 | 为什么必须由应用层定 |
|---|---|
| DOM 结构（平铺 / 嵌套 / 是否带分组标题） | 取决于产品的信息架构与屏幕阅读器播报路径 |
| `role` 粒度（一个图元一个元素？还是一个容器一个元素？） | 取决于图元语义：表格卡片该播报为 `button` 还是 `group` |
| 文案（`aria-label` / `aria-description` / 状态播报） | 取决于业务语言与 i18n |

同时，引擎还受「多运行时」约束：小程序没有 DOM，内建镜像层在那里毫无意义。

所以引擎负责**可访问信息的提取**与**焦点回传**，应用负责**渲染镜像**。

## 3. 原语契约

### 3.1 可访问节点快照

```js
const nodes = ice.getAccessibilityTree(options);
// [{
//   id,                      // 组件 id（props.id）
//   role,                    // 角色建议：graphic | container | link | text | image | tool
//   label,                   // 可读名称：state.ariaLabel > state.text > state.title > id
//   box: { x, y, width, height },  // 屏幕坐标盒（CSS 像素，已含视口换算）
//   visible, interactive, focusable,
//   tabIndex,                // 建议 tab 顺序（同级按 zIndex 升序，与视觉堆叠一致）
//   selected,                // 是否当前被选中
//   level, parentId          // 树层级与父 id（便于生成嵌套 DOM）
// }]
```

`options`：

| 字段 | 默认 | 说明 |
|---|---|---|
| `includeHidden` | `false` | 是否包含 `display:false` 的组件 |
| `includeTools` | `false` | 是否包含工具层（控制面板等）。默认排除——工具层通常不该进无障碍树 |
| `filter` | — | 自定义谓词，在其它过滤之后应用 |

约定与保证：

- **只含已上屏的组件**：没有有效变换矩阵（从未渲染）的组件不会出现在快照里——它们本来也没显示。
- **不发散、不修改任何组件 state**：内部读缓存的 `composedMatrix`（`__paintWorldBox`），
  **不会**调用 `composeMatrix()`。这一点是刻意的：`composeMatrix()` 对点集路径会就地平移
  `state.dots`，反复调用会累积漂移（见 [13 · 能力缺口分析](13-gap-analysis.md) §4.6）。
- 应用层拿到的是**快照**，不是活动视图：需要刷新时重新调用即可（示例中挂在 `ROUND_FINISH` 后同步）。

### 3.2 键盘焦点

```js
ice.setFocusedComponent(componentOrId); // 传 id 字符串或组件实例；传 null 清除
ice.getFocusedComponent();
```

- **未设置焦点时行为完全不变**：键盘事件仍派发给「上次点击命中的组件」（历史行为）。
- 设置之后，键盘事件（keydown / keyup）改为派发给焦点组件 —— 应用层把 DOM 镜像元素的
  `focus` 事件映射到 `setFocusedComponent()`，画布内的组件就能收到键盘操作。
- id 不存在时清空焦点，不抛错。

## 4. 应用层要做什么（参考实现）

完整可运行示例见 [`examples/a11y/a11y-mirror.html`](https://github.com/ice-render/ice-render/blob/master/examples/a11y/a11y-mirror.html)：

1. 在 canvas 上方覆盖一个 `position:relative` 的容器，镜像元素绝对定位（`pointer-events` 按需设置）。
2. 调 `getAccessibilityTree()`，按 `box` 生成/更新镜像元素：
   `<button role="img" aria-label="…" tabindex="0" style="left:…px;top:…px;width:…px;height:…px">`。
3. 镜像元素的 `focus` / `click` → `ice.setFocusedComponent(id)`（并把 `selected` 同步成视觉高亮）。
4. 组件被拖动/缩放/视口变化后重新取快照（或直接挂在 `ROUND_FINISH` 上做增量同步）。
5. 焦点环、快捷键、`aria-live` 状态播报由应用层按产品规范实现（引擎不参与）。

## 5. 如果将来要在引擎内建镜像层（方案 A）

需要一并解决这些问题，否则不该进引擎：

- **生命周期**：镜像元素与组件的增删改同步（结构变更、`display` 切换、文本编辑态）；
- **多运行时**：无 DOM 运行时（小程序）必须整体禁用，且不能让这条路径影响主渲染链路；
- **包体**：a11y 代码应按需加载（`import 'ice-render/a11y'` 式的独立入口），
  避免不用无障碍的项目承担体积；
- **命中与焦点一致性**：镜像元素与画布命中必须使用同一套坐标换算（含视口与 dpr），
  否则会出现「看得见点不中」；
- **焦点环绘制**：要么用 CSS 描边（简单，但与画布缩放/旋转不一致），
  要么在画布里画（一致，但要进渲染循环并处理局部重绘）。

在需求明确之前，这些都属于「应用层实现更合适」的范畴。

## 6. 相关资源

- MDN `<canvas>`：[https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas)
- W3C Canvas 无障碍用例：[https://www.w3.org/WAI/PF/HTML/wiki/Canvas_Accessibility_Use_Cases](https://www.w3.org/WAI/PF/HTML/wiki/Canvas_Accessibility_Use_Cases)
- [13 · 能力缺口分析](13-gap-analysis.md) §3 P1-4 a11y
