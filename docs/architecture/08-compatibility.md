# 08 · 多运行时兼容（浏览器 + Node/headless）

> 引擎的总体目标：**一款高性能 canvas 绘图引擎，跑在现代浏览器与 Node/headless 上**。
> 目标运行时只有这两个 —— **小程序支持已于 2026-09-20 移除**（见文末「已移除的能力」）。

## 约束：运行时依赖极简

- **零运行时依赖**：`gl-matrix` 在构建时被**内联**进产物（它只列在 `devDependencies`，产物里没有任何 `import`/`require`），
  `lodash` 已用 `src/util/lang.ts` 自研工具替代。安装后开箱即用，不会因为缺少运行时依赖而报错。
- 内联的第三方代码**保留其版权与许可声明**：随包产出 `dist/THIRD-PARTY-NOTICES.txt`（由 `rollup-plugin-license` 生成）。
  MIT 要求随分发保留声明，只留引擎自己的 banner 是不够的。

## 跨平台根对象 `cross-platform/root.ts`

所有对全局对象、rAF 与平台能力的访问都收敛到这一个适配层：

| 能力 | 浏览器 | Node / headless |
|---|---|---|
| `requestFrame` | `requestAnimationFrame` 一族 | **没有 rAF 时退化为定时器**（约 16ms） |
| `createPath2D()` | `Path2DRecorder` 包装原生 `new Path2D()` | 没有原生 Path2D → 只记命令（见下） |
| `loadFont()` | `FontFace` + `document.fonts` | 兜底 `Promise.resolve()` |
| `createImage()` | `new Image()` | 由宿主提供 `Image`，否则抛明确错误 |
| `createOffscreenCanvas()` | `document.createElement('canvas')` | 没有离屏 canvas → 抛明确错误（缓存自动降级为直接落墨） |
| `devicePixelRatio` | `window.devicePixelRatio` | 兜底 `1` |

- 引擎内部统一用 `root` 访问全局与上述能力，**不直接写 `window`**。
- **`requestFrame` 的定时器兜底很关键**：Node / headless（无 rAF）此前会在 `FrameManager.start()`
  处直接抛错、连启动都做不到；现在这类环境也能跑。

## 路径：`Path2DRecorder`（命令流 + 原生转发）

原生 `Path2D` 不透明 —— 画得出来但拿不到几何描述，而 SVG / 服务端出图与形状断言都需要它。
所以路径对象一律走记录器：

- **有原生 `Path2D`**：命令既进命令流、也转发给原生对象（渲染路径与"直接用原生"一致）；
- **没有原生 `Path2D`**（headless / 测试桩）：只记命令。**引擎不再自己把命令重放上屏** ——
  那条支路原本是给"没有 Path2D 的小程序低版本"用的，2026-09-20 随小程序支持一起删掉了。
  命令流本身照旧可用（导出、断言）。

## rAF 的封装：FrameManager

`FrameManager` 是唯一的 rAF 入口，把 `root.requestFrame` 的回调统一转成 `ICE_FRAME_EVENT` 广播。因此：

- **引擎不直接依赖 rAF**，只依赖"每帧能收到 `ICE_FRAME_EVENT`"这一抽象。
- 需要自定义帧率时，替换/扩展 `root.requestFrame` 即可，不影响其它模块。

## 与 Canvas Context 的耦合

- `ICE.init(el)` 接受 DOM id 字符串或元素；`ICE.init(ctx)` 也接受**直接传入一个 CanvasContext**
  （测试 / headless / 自绘宿主用得上 —— 引擎只需要"能拿到 2d 上下文"）。
- 渲染用到的 canvas API 集中在下层（`setTransform`、`clearRect`、路径/样式方法、`drawImage`…），
  由 `CanvasRenderer` 与各图元调用。

## 已移除的能力（2026-09-20）

小程序支持整体移除，删掉的都是为"小程序形状的运行时"而存在的东西：

- `cross-platform/root.ts` 里的 `wx.*` 分支：`loadFont` / `createImage` / `devicePixelRatio` / `createOffscreenCanvas`；
- 无原生 `Path2D` 时的**命令重放**与 `PolyfillPath2D`（连同 `ICEPath.replayPath()`）；
- 「小程序形状」回归夹具 `tests/mini-program/`（摘掉 `document` / `window` / `Path2D` / `rAF` / `FontFace` /
  `OffscreenCanvas`、只留 `wx.*`，并对 Canvas 2D 成员做白名单越界检查）与宿主适配示例 `examples/mini-program/`；
- README / 文档站里"小程序是一等公民"的承诺与接入指引。

**保留**（这些不是小程序专属，删了会伤浏览器或服务端出图）：`root` 适配层本身、无 rAF 的定时器兜底、
`Path2DRecorder` 的命令流、离屏 canvas 缺失时的缓存降级、`ICE.init(ctx)` 入口。
保留的能力仍有回归：`tests/cross-platform/`、`tests/renderer/offscreen-*`、
`tests/export/svg-export.test.ts`（命令流驱动导出）。
