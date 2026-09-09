# 10 · Worker / OffscreenCanvas 渲染（设计文档，Web-only）

> 状态：**设计 + 最小可行性原型**。本轮不把引擎正式移植到 worker；本文给出边界、依赖清单、
> 架构分层与验证结论，供后续立项。引擎核心渲染逻辑仍以主线程为目标，不破坏小程序多运行时约束。

## 1. 目标与边界

- **目标**：把「CanvasRenderer + 图元 doRender + 真实光栅化」搬到 Web Worker（`OffscreenCanvas`），
  释放主线程帧预算，让交互（命中检测、DOM 事件、面板）与渲染并行。
- **边界（明确不做）**：不做小程序 worker 移植（见 §6）；不在 worker 内做文本 IME/字体/图片解码；
  不迁移完整组件树双端同步（v0 原型直接 worker 内建静态场景）。

## 2. 现引擎中依赖 DOM/主线程的 API 清单（worker 化需要桥接或禁用）

| 依赖点 | 位置 | worker 化方案 |
|---|---|---|
| `root.requestFrame` | `FrameManager` | worker 无 rAF → 主线程 rAF 转发节拍 / `setInterval` 驱动 |
| 文本量测 DOM `<div>` | `ICEText.measureText` | 主线程预量宽高后下发；worker 内 `OffscreenCanvasRenderingContext2D.measureText`（需字形就绪） |
| 图片 `new Image()` | `ImageCache` | 主线程 decode → `createImageBitmap` → 传输位图 |
| 字体 `FontFace / wx.loadFont` | `root.loadFont` | 主线程加载完成后下发（worker 内字体不可信） |
| 内联编辑 HTML `<input>`（IME） | `ICEText` | 编辑态仍在主线程完成 |
| 命中/坐标换算用 `getBoundingClientRect` | `DOMEventDispatcher` | 命中在主线程算（保持命中检测铁律） |
| `global`/`window` 探测 | `cross-platform/root.ts` | worker 启动时显式注入 `globalThis.global = self`（UMD 兼容） |

## 3. 架构分层

```
主线程 RendererHost                          Worker WorkerRenderer
  ├─ DOM 事件 → 命中检测（主线程，铁律不变）
  ├─ 组件状态树 / 序列化（主线程持有）
  ├─ 图片/字体/文本量测（DOM 侧）
  ├─ setState / 结构变更 → 标记 dirty
  └─ 每帧 postMessage: { type:'frame', dirtyIds?, snapshotVersion }  →  收到命令后 refreshQueue + doRender*
       → transferToImageBitmap / (备选) transferControlToOffscreen
  主线程 ImageBitmapRenderingContext 展示
```

## 4. 双 buffer 方案对比

| 方案 | 说明 | 结论 |
|---|---|---|
| `transferControlToOffscreen` | 主线程把 canvas 控制权交给 worker；主线程失去 2D ctx | 影响主线程命中/测量；首版不采用 |
| **`transferToImageBitmap` + `ImageBitmapRenderingContext`（推荐初版）** | worker 每帧 OffscreenCanvas → 位图 → 主线程 `transferFromImageBitmap` 展示 | 主线程保 ctx；位图传输开销小；实现简单 |

消息协议（draft）：
```
主线程 → worker: { type:'scene', json } | { type:'delta', ids:[...], snapshotVersion }
                | { type:'frame', t:DOMHighResTimeStamp }
worker  → 主线程: { type:'bitmap', bitmap, stats:{renderMs} } | { type:'stats', ... }
```

## 5. 一致性要点

- 命中检测与状态同步留在主线程 → 不破坏现有「命中检测铁律」与事件语义。
- 动画时钟单一化：worker 收到主线程 `frame` 命令的时间戳做补间，避免双时钟漂移。
- 渲染路径直接复用 M1 的 `doRenderFull/doRenderDirtyRect` 分派（渲染器已可插拔），
  将来把 `dirtyIds/快照` 经消息通道传给 worker，worker 内同样受益于脏矩形局部重绘。

## 6. 小程序不适用原因与开关策略

- 小程序 Canvas 2D 不在 Worker 运行；`wx.createOffscreenCanvas` 能力与线程模型与 Web 不同，
  worker 化收益不成立且破坏跨端一致。→ **web-only**：`root.workerSupported` 探测 +
  `ICE.init(..., { renderInWorker?: boolean })`（默认关）。探测项：`OffscreenCanvas`、
  `Worker`、`ImageBitmapRenderingContext`。

## 7. 最小可行性原型（本轮交付）

- `examples/performance/worker-main.html` + `worker-min.js`：
  - worker 内 `importScripts` UMD dist（先注入 `globalThis.window/global`），在 `OffscreenCanvas`
    2D ctx 上驱动同一套 ICE 确定性场景，测量 worker 内 static/anim 单帧 p50（含真实光栅化），
    末帧 `transferToImageBitmap` 上传主线程 `ImageBitmapRenderingContext` 展示。
  - 结果写入 `window.__workerBenchResult`，可被 Playwright 采集。
- **兼容性处理（宿主页面层）**：
  - 能力探测：`Worker` / `OffscreenCanvas` / `canvas.getContext('bitmaprenderer')` 三者缺一即走主线程回退。
  - worker 构造或运行期 `onerror` 也会回退主线程渲染（同一确定性场景，同一套测量函数）。
  - 提供 `?backend=main` 强制走主线程路径，便于回归测试回退逻辑。
  - 结果带 `backend: 'worker' | 'main-thread'` 与 `supported` 字段，如实上报实际后端。
- **注意**：`renderInWorker` 作为引擎级开关仍是**未来设计**（见 §1/§6），本轮未进引擎核心；
  以上兼容处理发生在宿主页/集成层，引擎本身仍以主线程为目标、跨端安全。

## 8. 验收指标与不做清单（M2 范围）

- 指标：worker 内单帧渲染 p50（static/anim 对照主线程同场景数值）、帧位图传输可用、`__workerBenchResult` 可达。
- 不做：树/事件双端同步、文本/图片/字体/控制面板在 worker 内、小程序正式移植。
