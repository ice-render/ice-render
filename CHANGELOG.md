# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 拟定下一个版本号为 **1.1.0**（新增能力向后兼容，但含几处「修正类」行为变化，见下方「需要注意」）。

### 新增

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

### 修复

- **安全**：`ICEText` 的 DOM 降级量测由 `innerHTML` 拼接 `<br>` 改为 `textContent` + `white-space: pre`，
  用户文本中的 HTML 不再被当作标签执行。
- **画布带 `border` / `padding` 时命中检测整体偏移**：坐标换算与 dpr backing store 尺寸改用
  **内容盒**（`getBoundingClientRect()` 返回的是 border-box）。
- **页面滚动 / 布局变化后命中检测偏移**：canvas 矩形改为在非移动类输入事件上刷新
  （旧实现只在 `init` 时取一次）。
- **一个未知组件导致整份数据打不开**：反序列化遇到未注册类型时跳过该节点并记录，不再抛 `TypeError`。
- **`.husky/pre-commit` 缺少可执行位**：git 会直接跳过该钩子，导致 `lint-staged` / commitlint 从未真正运行。

### 性能

- **视口裁剪**：全量帧跳过「未变脏 + 有上屏快照 + 与可见区不相交」的组件。
  实测 N=6000、屏外 50%：4.44 ms/帧 → 关闭裁剪 8.38 ms/帧（**1.89x**）。
- **命中检测包围盒预筛**：复用渲染快照做 O(1) 拒绝，避免对屏外组件做矩阵反变换 + 形状判定。
- **脏矩形门控由「整场景」放宽到「相交级」**：编辑器场景（含文本 / 星形 / 半透明控制面板）此前
  几乎永久回退全量，实测富场景局部重绘执行次数 **0 → 2**，且 10 步逐像素比对仍 100% 一致。

### 需要注意（升级前请确认）

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

### 工程

- `.eslintrc` 为 `tests/**`、`e2e/**` 关闭 `@typescript-eslint/no-var-requires`
  （测试中刻意使用 `require` 处理 `jest.mock` 的提升顺序）。
- 全仓 prettier 格式化，`npm run lint` 由「194 error」变为 **0 error**（CI 的 lint 步骤由红转绿）。
