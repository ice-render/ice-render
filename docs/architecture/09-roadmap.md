# 09 · 路线图：引擎原语 vs 应用层

> 本文定义 ice-render 的演进方向，并划清「引擎该做什么」与「应用层该做什么」的边界。
>
> **状态复核：2026-09-11**。本节表格是**当前状态**，不是最初拟定的待办清单 ——
> 历史版本曾把已完成项一直留着「未做」的表述，容易让人重复投入，已按实测重写。

## 边界（重要）

```
ice-render（引擎）= 提供「原语」，不做编辑器 UX
  ├── 渲染图元、矩阵变换、坐标系
  ├── 文本（含内联编辑）
  ├── 动画
  ├── 多运行时（WEB + 小程序）
  ├── 命中检测（精确的点-形状判定）
  ├── 序列化、连线、事件系统
  └── ...

ice-entity-designer（应用）= 用原语「拼装」编辑器 UX
  ├── undo/redo、多选/框选、编组、复制粘贴
  ├── 视口交互绑定、对齐分布面板、图层面板、导出
  └── ...
```

**undo/redo、多选/框选 UX、编组、复制粘贴** 等是**应用层**能力，由 ice-entity-designer 用引擎的
`addChild/removeChild/setState/序列化` 等原语组合实现，**不归引擎**。引擎侧只需保证原语够用：
多选原语 `ice.setSelection(components)`、锚点缩放 `ice.zoomAt()`、对齐吸附 `ice.alignmentGuide`
都已提供；具体交互形态（marquee 框选、多指手势）由应用层接。

## 引擎原语现状

### 已落地

| 领域 | 落地内容 |
|---|---|
| 输入层 | `pointer*` / `touch*` / `wheel` 三通道，按运行时能力自动选择（无 `PointerEvent` 时回退 `mouse* + touch*`）；拖拽不再依赖 `evt.movementX` |
| 视口 | `setViewport()`、锚点缩放 `zoomAt(screenX, screenY, factor)`；**视图缩放**与**图元缩放**严格分离（见 [11](11-viewport-zoom.md)） |
| HiDPI | `ICE.init(el, { dpr })`，backing store = 内容盒尺寸 × dpr；坐标换算与命中同步改走内容盒语义 |
| 对齐吸附 | 边缘 / 中心 / 等间距 + 提示线，默认禁用、按需 `alignmentGuide.enable()`，未启用零开销（见 [12](12-alignment-guide.md)） |
| 命中检测精度 | 全局→本地变换后调 `containsLocalPoint()`：圆/椭圆走椭圆方程、点集类（星形/正N边形/玫瑰）走射线法、折线走点-线段距离（`ICEEllipse` / `ICEDotPath` / `ICEPolyLine`） |
| 命中检测性能 | 视口裁剪 + 包围盒 O(1) 预筛（实测 N=6000、屏外 50%：**1.89x**） |
| 渲染 | 脏矩形局部重绘门控由「整场景」细化为「相交级」；本地盒收敛到唯一来源 `__localBox()`（`getMinBoundingBox()` 与上屏快照盒必然一致） |
| 渲染（派生参数） | `dirty` / `paramsDirty` 两级脏标记：祖先变换变化只重绘、不连带重量测后代（实测移动整组：`calcComponentParams` 10→0、`calcDots` 6→0） |
| 文本 | 内联编辑（光标 / 退格 / 删除 / 方向键 / Home / End / Enter）；**中文 IME**（叠加透明 HTML input + `compositionend`，无 `document` 的运行时降级为 canvas keydown）；自动换行 / `maxLines` 省略号 / grapheme 分段（默认关闭）；量测改为 **canvas 优先 + DOM 降级**，`innerHTML` 注入已消除 |
| 字体 | `root.loadFont` 平台适配（浏览器 `FontFace` / 小程序 `wx.loadFont`） |
| 动画 | 点路径键（`'transform.rotate'`）、`delay`、取整可配（默认不取整）、**关键帧时间轴**、**弹簧类缓动**（`spring` / `springSoft` / `springSnappy`，自带过冲）、**数组字段逐元素补间**；结束判定按时间（弹簧能过冲的前提） |
| 布局 | `addChild` / `removeChild` 立即重排、批量操作只排一次；排布前有 measure 阶段；新容器型子组件继承父层布局 |
| 连接线 | 正交路由 `routeType: 'orthogonal'`、连线标签 `label + labelStyle`、5 个共享插槽吸附；`findComponent` 递归查找（因此**连线可连嵌套子组件**） |
| 序列化 | `ICE.getTypeId(ctor)` 类型反查（与类的 JS 名解耦，压缩改名不破坏已存数据）；`version` 字段 + `SERIALIZATION_MIGRATIONS` 迁移表；未注册类型跳过并记入 `deserializer.unknownTypes` |
| 插件 | `ICE.use(plugin)` / `unuse(name)` 三层注册点（组件类型 / 每帧渲染 / 交互工具）+ `setup` / `teardown` 生命周期 |
| 无障碍 | `getAccessibilityTree()` 可访问节点快照 + `setFocusedComponent()` 键盘焦点回传。**引擎不自建 DOM 镜像层**（见 [14](14-accessibility.md)） |
| 多运行时 | `root.createPath2D()`（原生 `Path2D` / `PolyfillPath2D` 降级）、离屏 canvas、图片、像素比全部有平台适配；`requestFrame` 无 rAF 时定时器兜底（Node / headless / 小程序低版本也能启动） |
| 工程化 | 68 个测试文件 / 531 个用例 + 覆盖率棘轮门槛、Playwright 可视化与像素一致性回归、`publint` + `attw` 发布包门禁、lockfile 入库 + CI 用 `npm ci`、CHANGELOG |

### 仍未做（引擎侧）

| 优先级 | 事项 | 说明 |
|---|---|---|
| P1 | **错切（skew）手柄** | 引擎的 skew 变换本身可用（`gl-matrix-skew.ts`），缺的是控制面板上的手柄 UI；代码里已有 `TODO:添加斜切手柄？` |
| P2 | **自定义命中判定注册点** | 插件目前只能通过覆盖组件的 `containsPoint` / `containsLocalPoint` 定制命中，没有独立的注册协议；自定义布局 / 主题的正式注册协议同样未定 |
| P2 | **空间索引（四叉树 / R-tree）** | 已做视口裁剪 + O(1) 包围盒预筛；「上万节点且大部分在屏内」时全量命中仍是 O(n)，索引收益要到那个规模才显著 |
| P2 | **SVG / PDF 导出、SVG 导入** | 需独立 exporter。**诚实边界**：阴影、虚线流动、`measureText` 字形、`Path2D` 命令是 canvas 特有，导出只能近似，做不到像素级一致。是否做取决于产品定位 |
| P2 | **小程序真机验证** | `PolyfillPath2D`、离屏 canvas、字体加载在低版本基础库上的逐像素一致性与可用性，需微信开发者工具 / 真机确认（自动化测试覆盖不到） |
| P3 | **控制面板抽象** | 「按组件类型展现不同操作工具」需进一步抽象（`src/control-panel/ICEControlPanelManager.ts` 内有 FIXME）。插件机制的 `tools` 注册点可视为该抽象的第一层 |

## 验收原则

- 每项落地都带回归测试：纯逻辑用 jest（`tests/`，镜像 `src/` 结构），交互行为用 Playwright 真实鼠标测试（`e2e/`），像素一致性用 golden image（`e2e/visual/`）。
- **引擎目标是「高性能 canvas + WEB/小程序兼容」，任何改动不得破坏这两个约束。**
- 以下必须同时零错误：`npm run lint`、`npm run types:check`、`npm test`、`npm run build`、`npm run pkg:check`。
- 涉及「类的身份」的判断**不得依赖 `constructor.name`**（下游打包会 mangle 类名，判断会静默失效）——见 `AGENTS.md` 的「判类型不得依赖类名铁律」。
