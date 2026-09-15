# 布局机制对齐 Swing（去掉「布局继承」，补齐 validate / 尺寸协商）

- 日期：2026-09-15
- 状态：已批准（用户要求「对 ice-render 和 ice-web-components 进行优化」）
- 分支：`feat/layout-swing-alignment`（引擎自 `dev`，组件库自 `main`）

## 1. 背景

`ice-web-components` 里 80+ 组件只有 `ICETabs` 一处用了引擎的布局机制，其余全部手写坐标。
排查后确认不是「没写」，而是**用不了**：

1. `ICEGroup.setLayout()` 末尾 `__propagateLayout(manager)` + `addChild()` 的继承分支会把父容器的
   布局策略**递归灌进所有后代容器**。而 web-components 的每个组件都是 `ICEGroup` 子类、内部零件
   （按钮文字、输入框前后缀/清除按钮…）都在同一个 `childNodes` 里 —— 于是「给面板设布局」= 把整个
   界面的内部零件按同一个策略重摆一遍。实测：`ICETextField(prefix, allowClear)` 被放进
   `setLayout(ICEBoxLayout)` 的面板后，内部文本 `12 → 0`、清除按钮 `(170,6) → (316,0)`。
2. 引擎只有「向上 requestLayout」，没有 Swing 的自顶向下 `validateTree`：内层容器（即使自己持有布局）
   被父布局改尺寸后不会重排自己的子树，只能靠 `fitContent` 或传播 hack 兜。
3. 布局读 `child.state.width/height` 而不是问 `child.getPreferredSize()`，于是文本量测/嵌套容器的
   自然尺寸要靠 `fitContent` + 两趟 + 「首帧后再量一遍」的补丁。

## 2. 对照 Java Swing（本轮用 OpenJDK 21 源码 + 运行时实测确认）

| 事实 | 证据 |
|---|---|
| 每个组件都是容器，`JButton instanceof Container == true`；`JButton` 默认布局为 `null`，`JPanel` 默认为 `FlowLayout` | `javap` 继承链 + 运行时 `Probe` |
| `setLayout()` 只写自己的字段并 `invalidateIfValid()`；`layout()` 只调 `layoutMgr.layoutContainer(this)`，**从不把策略传给子容器** | `java.awt.Container` 源码 |
| `validateTree()`：先 `doLayout()` 自己，再对每个失效子容器递归 `validateTree()`；失效沿父链向上 | `java.awt.Container` 源码 |
| `Container.getPreferredSize()` → `layoutMgr.preferredLayoutSize(this)`；`BorderLayout.preferredLayoutSize` 对每个子项调 `getPreferredSize()`；叶子由 UI delegate 报尺寸（`JComponent.getPreferredSize()` → `ui.getPreferredSize(this)`） | 源码 + 字节码 + 运行时（`setPreferredSize` 影响 `preferredLayoutSize`） |
| Flow / Border / Box 跳过不可见子项；**GridLayout 不跳过**（保留格子） | 运行时实测三组 bounds |
| 控件内部装饰不是子组件（`JLabel.getComponentCount() == 0`，文字/图标由 UI delegate 画与量） | 运行时实测 |

## 3. 本轮范围

**做**

- 删除布局继承（`__propagateLayout` + `addChild` 继承分支）。
- 补自顶向下的失效/校验：`__layoutInvalid` + `doLayout()` 末尾递归校验子容器（对齐 `validateTree`）。
- 尺寸协商：`ICELayoutManager.preferredSizeOf()` 改为问 `child.getPreferredSize()`；
  `ICEGroup.getPreferredSize()` 在「调用方显式给了尺寸」时仍报自己的盒子（引擎里 `props.width/height`
  等价于 Swing 的 `setPreferredSize`），否则报布局算出的内容尺寸；新增 `setPreferredSize()` /
  `isPreferredSizeSet()` 对齐 Swing API。
- 布局跳过不可见子项（Flow / Box / Border / Overlay / Card），`ICEGridLayout` 保持「保留格子」。
- `ice-web-components`：去掉 `ICETabs` 的 `setLayout(null)` 规避；更新 `docs/guides/layout.md` 与
  `docs/architecture.md` 的布局章节。

**不做（留待后续）**

- 把 web-components 的内部装饰从 `childNodes` 迁到 `painter`（Swing 的 ComponentUI 位）。
  本轮先靠「不继承」消除穿透；迁移是组件库侧的重构，单独一批做。
- 容器级布局迁移（`ICEForm` / `ICESpace` 改走引擎布局器）需要交叉轴 stretch/align，同样单独一批。

## 4. 验收

- 新增 `tests/layout/layout-swing-semantics.test.ts` 覆盖：不继承、validateTree 重排、尺寸协商、
  显式尺寸优先、不可见子项跳过（Grid 例外）。
- 既有 `tests/layout/flow-layout.test.ts` / `layout-reflow.test.ts` 里「继承」两节改写为不继承语义。
- `npm test` + `npm run types:check` + `npm run build` 全绿；`ice-web-components` 的
  `npm run verify` 全绿。
