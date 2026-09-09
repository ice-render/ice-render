# 09 · 路线图：引擎原语 vs 应用层

> 本文定义 ice-render 的演进方向，并划清「引擎该做什么」与「应用层该做什么」的边界。

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
  ├── 视口缩放平移、对齐分布、图层面板、导出
  └── ...
```

**undo/redo、多选、编组、复制粘贴、视口** 等是**应用层**能力，由 ice-entity-designer 用引擎的 `addChild/removeChild/setState/序列化` 等原语组合实现，**不归引擎**。

## 引擎原语待办

| 优先级 | 事项 | 说明 |
|---|---|---|
| P0 | **命中检测精度** ✅ | `containsPoint` 用包围盒，圆/旋转形状点边角会误命中，已改为精确点-形状判定（圆/椭圆方程、点-多边形射线法、折线点-线段距离） |
| P0 | **文本内联编辑** ✅ | `ICEText` 支持编辑态 + 光标渲染 + 键盘输入（字符/退格/删除/方向键/Home/End/Enter），双击进入编辑；**IME（中文输入）未支持**，需平台适配层（如 HTML 输入框叠加）补齐 |
| P0 | **多运行时（Path2D）** ✅ | `new Path2D()` 已抽象为 `root.createPath2D()`（原生 Path2D / `PolyfillPath2D` 降级），无 Path2D 环境（小程序低版本基础库/Node）逐像素一致渲染；**真机验证**仍需微信开发者工具或小程序真机 |
| P1 | 动画完善 ✅ | 无限循环(`loop`)、播放次数(`iterationCount`)、递减动画(from>to)、多属性独立计时同步、`pause()`/`resume()` 冻结进度 |
| P1 | 变换原语补全 ⚠️ | 旋转原点自定义 ✅（origin: localCenter/top-left/custom）；**错切（skew）手柄未做**（代码 TODO，UI 手柄较复杂） |
| P1 | 文本能力 ⚠️ | 多行 ✅（\n 拆分 + DIV 实测行高）；**字体加载**（wx.loadFont / CSS @font-face）未做 |
| P2 | 连线增强 ✅ | 正交路由 ✅（`routeType: 'orthogonal'`，按插槽方向生成直角折线）；连线标签 ✅（`label` + `labelStyle`，绘制在折线中点带背景） |
| P2 | 序列化版本迁移 ✅ | 序列化加 `version` 字段 + 排除运行时缓存值（linearMatrix/composedMatrix/localOrigin/absoluteOrigin/dots/textHeight）；Deserializer 提供 `migrate` 迁移钩子、不支持的版本抛错 |
| P2 | 工程债 ⚠️ | 拼写/FIXME 清理 ✅；**发布流水线 ✅**（rollup 输出 esm/cjs/umd + types 齐全，gl-matrix 移到 devDependencies 消除下游重复安装，dist 独立可运行）；应用消费链工具链统一未做 |

## 验收原则

- 每项落地都带回归测试：纯逻辑用 jest，交互行为用 Playwright 真实鼠标测试（`e2e/visual/interaction.spec.ts`）。
- 引擎目标是「高性能 canvas + WEB/小程序兼容」，任何改动不得破坏这两个约束。
