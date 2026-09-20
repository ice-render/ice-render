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
| `createOffscreenCanvas()` | `document.createElement('canvas')`（保住 `lang`/`dir` 的字形口径） | 有 `OffscreenCanvas` 就用它（Web Worker 走这条）；都没有 → 抛明确错误（缓存自动降级为直接落墨） |
| `devicePixelRatio` | `window.devicePixelRatio` | 兜底 `1` |

- 引擎内部统一用 `root` 访问全局与上述能力，**不直接写 `window`**。
- **取根用 `globalThis`**（2026-09-20）：浏览器 / Web Worker / Node 三种宿主的 `globalThis` 分别是
  `window` / `self` / `global`，一个入口全覆盖。改造前是 `window → global` 双探测，**worker 里两者都不存在**
  → 取到兜底空对象 `{}`，引擎在 worker 内连 `Path2D` / `OffscreenCanvas` 都看不见（当年的原型只能
  先 `self.window = self` 伪造全局）。现在 worker 是**一等宿主**，宿主不再给引擎打补丁。
- **`requestFrame` 的定时器兜底很关键**：Node / headless（无 rAF）此前会在 `FrameManager.start()`
  处直接抛错、连启动都做不到；现在这类环境也能跑。

## 路径：`Path2DRecorder`（命令流 + 原生转发）

原生 `Path2D` 不透明 —— 画得出来但拿不到几何描述，而 SVG / 服务端出图与形状断言都需要它。
所以路径对象一律走记录器：

- **有原生 `Path2D`**：命令既进命令流、也转发给原生对象（渲染路径与"直接用原生"一致）；
- **没有原生 `Path2D`**（headless / 测试桩）：只记命令。**引擎不再自己把命令重放上屏** ——
  那条支路原本是给"没有 Path2D 的小程序低版本"用的，2026-09-20 随小程序支持一起删掉了。
  命令流本身照旧可用（导出、断言）。

## 现代 Canvas 能力：用哪些、兜底是什么（2026-09-20 复核）

目标运行时收敛到「现代浏览器 + Node/headless」之后，规范里那些"前几年才有"的成员可以从
「不敢用」变成「优先用」—— 但**每一条都要带兜底**：Node/headless 侧的 canvas 实现
（node-canvas 之类）与各浏览器跟进节奏并不一致，而 headless 出图（SVG / 服务端）是引擎的
一等公民。当前账目：

| 能力 | 状态 | 说明 / 兜底 |
|---|---|---|
| `Path2D.roundRect`（2021 进规范） | **已采用** | 圆角矩形从「4 次 `arcTo` 手撸」改为一次 `roundRect`：每个圆角矩形的命令流 **14 条 → 1 条**（1000 个图形 14000 → 1000 条），路径重建 **127.9µs → 88.0µs**（500 个形状，实测见下）。没有原生 `roundRect` 的运行时由 `Path2DRecorder` 展开成**等价**的 `moveTo / lineTo / arcTo` 序列。归一化规则（1~4 个半径的补齐、负宽高镜像、超限半径等比缩放）只写一份，放在 `src/util/round-rect.ts`，记录器与 SVG 导出器共用。真机逐像素对照：`e2e/visual/round-rect-parity.spec.ts`（12 组边角场景 **0 差异**）。 |
| `ctx.filter`（写在 `style.filter`） | **画布可用；SVG 未支持** | `style` 一律透传给 ctx，所以 `style.filter = 'blur(8px)'` 本来就生效；配套的三条机制缺一不可：`LEAKY_CTX_PROPS` 的 `['filter','none']`（画完复位，不漏给同帧后面的组件）、`ObjectCache.__styleKey()` 带上 `st.filter`（改了滤镜必须重建位图）、`stylePaintPad()` 的 `filterDevicePad()`（模糊/投影的墨迹会溢出几何盒，位图与脏矩形都要扩边）。导出侧的留白见下。 |
| `createConicGradient` | **已采用** | `ice.createConicGradient()`；运行时没有它则退回中间色纯色（`ICEComponent` 的渐变分支）。 |
| `ctx.letterSpacing` / `wordSpacing` 等文本状态 | **已采用** | 进 `LEAKY_CTX_PROPS`；量测**之前**写进 ctx（`measureText` 会把字间距算进宽度）。 |
| `OffscreenCanvas` + Worker | **部分采用（阶段一）** | 引擎现在**能作为库直接跑在 worker 里**（取根 `globalThis` + `createOffscreenCanvas` 的 `OffscreenCanvas` 分支），原型不再需要宿主伪造全局，回归 `e2e/visual/worker-perf.spec.ts`。**仍未做**：场景/状态跨线程同步、输入转发、字体图片下发（即"把引擎正式移植进 worker"本身），见 `10-worker-offscreen.md`。 |
| `ImageBitmap` / `createImageBitmap` | **未采用** | 引擎的图片链路是 `ImageCache`（`Image` + `onload`）。换成 ImageBitmap 的收益是「预解码 + 可 transfer 进 worker」；在单线程渲染路径上它只是同一份位图换个壳，等 worker 路线落地时再一起评估。 |
| `ctx.reset()`（2023） | **未采用** | 它会连带重置变换与裁剪，而引擎逐组件 `save/restore` 状态、每帧自持变换；现有 `__resetLeakyCtxState()` 按**位掩码只复位写过的那几项**，比整体 reset 更省。换过去等于重做状态模型，收益不明。 |

两条**踩过的坑**（都写在代码注释里，改这块之前先看）：

- **滤镜的长度参数是设备像素，不随视图缩放。** 真机实测：同一个 `blur(8px)` 在
  `setTransform(1 / 0.62 / 0.5)` 下溢出恒为 18~19 **设备**像素 —— 与 `stroke` / `shadowBlur`
  （随变换缩放）**方向相反**。所以 `stylePaintPad(state, scale)` 必须把滤镜那部分**除以渲染视口缩放**，
  否则缩略视图下位图会切掉滤镜的尾巴（实测 scale=0.62 时 `drop-shadow` 差 118 像素、`blur(8px)` 差 76 像素）。
  回归：`e2e/visual/filter-cache-fidelity.spec.ts`（`?scale=0.62` 那一档卡严格 0 差异）。
- **命令流加了新命令，导出器就必须认识它。** `roundRect` 若在 `SvgExporter.commandsToPathData()` 里
  没有分支，会静默走兜底逻辑画成直角 —— 表现为「画布上是圆角、导出成直角」。
  消费者（读 `_commands` 自行重放的第三方）同理：命令词汇表是**约定**，新增命令属破坏性变更。

### SVG 导出的留白：`ctx.filter`

CSS 滤镜函数在 SVG 里没有一对一命令：`blur()` 要拼 `feGaussianBlur`、`grayscale()` 要拼
`feColorMatrix`、`drop-shadow()` 对应 `feDropShadow`，且模糊半径的定义（标准差 vs 模糊量）两边
并不统一。因此**导出器目前忽略 `style.filter`** —— 与虚线流动、雪碧图切图同属「有意留白」。
需要矢量产物里也带效果时，请改用引擎显式支持的阴影 / 渐变（它们有对应映射），或走位图通道
（`compose-layers` 的截图模式）。

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
