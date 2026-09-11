# 08 · 多运行时兼容

> 引擎的总体目标：**一款高性能 canvas 绘图引擎，同时兼容 Web 浏览器与各类小程序**。因此所有代码都不得依赖浏览器专有 API。

## 约束：运行时依赖极简

- **零运行时依赖**：`gl-matrix` 在构建时被**内联**进产物（它只列在 `devDependencies`，产物里没有任何 `import`/`require`），
  `lodash` 已用 `src/util/lang.ts` 自研工具替代。安装后开箱即用，不会因为缺少运行时依赖而报错。
- 内联的第三方代码**保留其版权与许可声明**：随包产出 `dist/THIRD-PARTY-NOTICES.txt`（由 `rollup-plugin-license` 生成）。
  MIT 要求随分发保留声明，只留引擎自己的 banner 是不够的。
- 这保证了引擎可以在任何能跑 JS、能提供 Canvas Context 的环境中使用，而不被 npm 生态的浏览器假设拖累。

## 跨平台根对象 `cross-platform/root.ts`

所有对全局对象、rAF 与平台专有能力的访问，都收敛到这一个适配层：

| 能力 | 浏览器 | 小程序 / 其它 |
|---|---|---|
| `requestFrame` | `requestAnimationFrame` 一族 | 平台自身的帧回调；**全都没有时退化为定时器**（约 16ms） |
| `createPath2D()` | 原生 `new Path2D()` | `PolyfillPath2D`（记录路径命令、渲染时重放，逐像素一致） |
| `loadFont()` | `FontFace` + `document.fonts` | `wx.loadFont` |
| `createImage()` | `new Image()` | `wx.createImage` |
| `createOffscreenCanvas()` | `document.createElement('canvas')` | `wx.createOffscreenCanvas({ type: '2d' })` |
| `devicePixelRatio` | `window.devicePixelRatio` | 小程序系统信息 |

- 引擎内部统一用 `root` 访问全局与上述能力，**不直接写 `window`**。
- **`requestFrame` 的定时器兜底很关键**：Node / headless（无 rAF）与部分小程序低版本基础库此前会在
  `FrameManager.start()` 处直接抛错，连启动都做不到；现在这类环境也能跑（headless 出图的两个阻塞点之一）。

## rAF 的封装：FrameManager

`FrameManager` 是唯一的 rAF 入口，把 `root.requestFrame` 的回调统一转成 `ICE_FRAME_EVENT` 广播。因此：

- **引擎不直接依赖 rAF**，只依赖"每帧能收到 `ICE_FRAME_EVENT`"这一抽象。
- 若目标平台没有 rAF（或需要自定义帧率），只需替换/扩展 `root.requestFrame`，不影响其它模块。

## 与 Canvas Context 的耦合

- `ICE.init(ctx)` 接受两种入参：DOM id 字符串（浏览器，内部 `document.getElementById` + `getContext('2d')`）或**直接传入一个 CanvasContext**（小程序可传入自己的 `ctx`）。
- 渲染用到的 canvas API 集中在下层（`setTransform`、`clearRect`、`Path2D`、各种路径/样式方法），由 `CanvasRenderer` 与各图元调用。

## 需要关注的适配点

| 点 | 现状 | 小程序适配提示 |
|---|---|---|
| `Path2D` | ✅ 已抽象为 `root.createPath2D()`（原生 `Path2D` / `PolyfillPath2D` 降级，逐像素一致） | 无需改动；真机一致性仍需微信开发者工具/真机确认 |
| `requestAnimationFrame` | ✅ 经 `root.requestFrame` 抽象，且**无 rAF 时有定时器兜底** | 小程序用其自身的渲染帧回调桥接 |
| `document` / `window` | 仅在"字符串 id 初始化"路径与文本内联编辑的 IME 输入框用到 | 直接传 `ctx` 即可绕开 DOM；无 `document` 时 IME 输入降级为 canvas keydown |
| `devicePixelRatio` | ✅ 已实现：`ICE.init(el, { dpr })`，backing store = 内容盒 × dpr | 小程序按系统信息提供 dpr |
| 字体 / 图片 / 离屏画布 | ✅ 均经 `root` 抽象（见上表） | 需平台提供对应能力；缺失时报错信息应指向该适配点 |

> **说明（2026-09-11 更新）**：`Path2D` 已不再是待办（已抽象为 `root.createPath2D()` + `PolyfillPath2D`），
> 无 rAF 的运行时的启动阻塞也已解除。当前**唯一未闭环的是真机验证**：`PolyfillPath2D`、离屏 canvas、
> 字体加载在低版本基础库上的逐像素一致性与可用性，需要微信开发者工具或真机确认 —— 自动化测试（Playwright/Chromium）
> 覆盖不到这一层，因此这是兼容性路线上仅剩的已知工作项。
