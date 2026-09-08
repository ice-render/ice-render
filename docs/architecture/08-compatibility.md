# 08 · 多运行时兼容

> 引擎的总体目标：**一款高性能 canvas 绘图引擎，同时兼容 Web 浏览器与各类小程序**。因此所有代码都不得依赖浏览器专有 API。

## 约束：运行时依赖极简

- 运行时依赖**仅 `lodash` + `gl-matrix`**，无其它依赖。
- 这保证了引擎可以在任何能跑 JS、能提供 Canvas Context 的环境中使用，而不被 npm 生态的浏览器假设拖累。

## 跨平台根对象 `cross-platform/root.js`

所有对全局对象与 rAF 的访问，都收敛到一个适配层：

```javascript
let root = window || global || {};          // 浏览器=window，Node=global
root.requestFrame =
  root.requestAnimationFrame ||
  root.webkitRequestAnimationFrame ||
  root.mozRequestAnimationFrame ||
  root.oRequestAnimationFrame ||
  root.msRequestAnimationFrame;
```

- 引擎内部统一用 `root` 访问全局、用 `root.requestFrame` 请求动画帧，**不直接写 `window`**。
- 小程序环境只要提供一个带 `requestAnimationFrame` 的全局对象，就能驱动 `FrameManager`。

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
| `Path2D` | 图元大量使用（`new Path2D()` 构造路径） | 小程序 Canvas 不一定有 `Path2D`，需 polyfill 或改用路径命令 |
| `requestAnimationFrame` | 经 `root.requestFrame` 抽象 | 小程序用其自身的渲染帧回调桥接 |
| `document`/`window` | 仅在"字符串 id 初始化"路径用到 | 直接传 `ctx` 即可绕开 DOM |
| `devicePixelRatio` | 拖拽逻辑中有注释掉的引用 | 若需高清屏适配，应移到初始化参数 |

> 说明：当前引擎已做到"逻辑层无 DOM 依赖、rAF 经适配层"，但 `Path2D` 的使用是接入小程序时的最大待办——这是兼容性路线上的已知工作项，尚未做跨端实测。
