# 在微信小程序里跑 ice-render

这个小例子演示最小可用接入：一个 `<canvas type="2d">` + 一次 `ICE.init(ctx)` + 一层触摸适配。
引擎**不依赖 DOM**，小程序侧不需要任何假 DOM。

## 目录

```
examples/mini-program/
├── app.json / project.config.json / package.json   # 开发者工具可直接打开本目录（游客模式，无需 AppID）
├── host-adapter.js              # 宿主适配：取画布位置 + 把 bindtouch* 换算成引擎输入
└── pages/ice-canvas/            # 可直接拷进小程序项目的页面
    ├── index.js
    ├── index.wxml
    ├── index.wxss
    └── index.json
```

## 在微信开发者工具里跑起来

1. 开发者工具 → 导入项目 → 选择本目录（`examples/mini-program/`），AppID 选「游客模式」即可；
2. 在本目录执行 `npm install`，然后工具菜单 **工具 → 构建 npm**（产物落在 `miniprogram_npm/ice-render`）；
3. 编译预览：应该看到一个可拖动的方块、一段文字和一条连线；用鼠标/触摸拖一下，方块跟随移动。

> 想接到自己的项目里：把 `pages/ice-canvas/` 与 `host-adapter.js` 拷过去，`package.json` 里加
> `ice-render` 依赖，同样「构建 npm」后再打开即可。

## 三步接入

**1）拿 canvas 节点（不是旧接口的 canvasId）**

```js
wx.createSelectorQuery()
  .in(this)
  .select('#ice-canvas')
  .fields({ node: true, size: true })
  .exec((res) => {
    const canvas = res[0].node;
    const ctx = canvas.getContext('2d');
    const dpr = wx.getSystemInfoSync().pixelRatio || 1;
    canvas.width = res[0].width * dpr;   // 小程序里画布不会自动跟随 CSS 尺寸
    canvas.height = res[0].height * dpr;
  });
```

**2）直接 init，绕开 DOM**

```js
const ice = new ICE();
ice.init(ctx, { dpr });
```

引擎在没有 `getBoundingClientRect` 的运行时按「原点 (0,0) + 画布自身尺寸」构造矩形
（`ICE.readCanvasRect()`），正好对上小程序的坐标语义，不需要给画布对象打补丁。

**3）把触摸交给 `host-adapter.js`**

```js
const { createHostAdapter } = require('../../host-adapter');
this.host = createHostAdapter({ ice, component: this, canvasId: 'ice-canvas' });
// wxml: bindtouchstart="onTouchStart" 等 → this.host.onTouchStart(evt)
```

适配层做两件事：`wx.createSelectorQuery().boundingClientRect()` 取画布在页面里的位置；
把触摸的 `clientX/clientY`（视口坐标）换算成**画布内坐标**后，以引擎总线的
`ICE_TOUCHSTART/MOVE/END/CANCEL` 投递。引擎会把它归一化成 `mousedown/mousemove/mouseup`
派发给组件 —— 业务代码与浏览器里完全一致。

> 页面 `onUnload` 里记得 `ice.destroy()`：它会停掉帧循环。

## 引擎在小程序环境下的行为（已自动化验证）

`tests/mini-program/smoke.test.ts` 在一个「小程序形状」的运行时里跑这些断言 ——
没有 `document` / `window` / `Path2D` / `requestAnimationFrame` / `FontFace` / `OffscreenCanvas`，
只有 `wx.*`，画布对象只有 `width` / `height` / `getContext`：

| 能力 | 行为 |
|---|---|
| `ICE.init(ctx)` | 不依赖 DOM；缺少 `getBoundingClientRect` 时用画布自身尺寸兜底 |
| 渲染帧循环 | 没有 `requestAnimationFrame` 时用定时器兜底 |
| 路径绘制 | 没有原生 `Path2D` 时自动降级为命令记录 + 重放 |
| 文本量测 | 优先用 canvas 字形墨迹；老基础库没有墨迹界标时按 state 尺寸兜底，**不抛错、不刷日志** |
| 离屏缓存 | 走 `wx.createOffscreenCanvas`；老基础库没有这个 API 时**自动关闭缓存、退化为直接落墨**，不会在帧回调里抛错 |
| 触摸输入 | `bindtouch*` → 归一化成鼠标语义事件与画布内坐标 |
| 序列化 / SVG 导出 | 都可用（不依赖 canvas 与 DOM） |

跑一遍：

```bash
npx jest tests/mini-program
```

## 真机才能覆盖的（别把上面的测试当成真机结论）

- **字体**：`wx.loadFont` 是否生效、iOS/Android 字体度量差异；
- **离屏 canvas**：真机上的可用性与性能（我们用组件级离屏缓存）；
- **低端机光栅化性能**、**低版本基础库的边界行为**；
- 开发者工具模拟器的 canvas 由 Chromium/Skia 实现，与真机实现不同 ——
  **模拟器通过 ≠ 真机逐像素一致**。

需要更高置信度时，用官方 `miniprogram-automator` 在模拟器里跑（需要微信开发者工具，
官方仅支持 Windows / macOS），或直接上真机。
