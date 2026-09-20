# 10 · Worker / OffscreenCanvas 渲染（设计文档，Web-only）

> 状态：**设计 + 最小可行性原型 + 阶段一（worker 一等宿主）+ 阶段二第一块（状态/命令协议）
> + 第二块（输入留在主线程 + 工具层镜像）已落地**（均 2026-09-20）。
>
> - **阶段一** = 引擎作为库能在 worker 里**零注入**跑起来（取根 `globalThis` + `createOffscreenCanvas`
>   的 `OffscreenCanvas` 分支）。回归 `e2e/visual/worker-perf.spec.ts`。
> - **阶段二第一块** = 跨线程**状态/命令协议**：主线程持有组件树与状态（唯一真相），worker 持有一棵
>   **镜像树**并渲染，画面用 `transferToImageBitmap` 回传。协议与实现见
>   `src/worker/mirror-protocol.ts` / `MirrorBridge` / `MirrorTarget`，参考宿主见
>   `examples/worker/mirror-render.html` + `mirror-worker.js`，回归 `e2e/visual/worker-mirror.spec.ts`
>   （状态增量 / 结构重同步之后，worker 画面与主线程参考**逐像素 0 差异**）。
>   **v1 边界**：状态走增量补丁，**结构变更走全量重同步**。
> - **阶段二第二块** = 让真实应用能接上：**输入永远在主线程**（DOM 事件、命中检测、拖拽都不跨线程），
>   主线程改走"几何通道"（跑渲染管线但不产出像素）以维持命中检测依赖的世界盒；
>   工具层按**选择**镜像 —— worker 用**自己的**控制面板画手柄。参考宿主 `MirrorHost`，
>   回归 `e2e/visual/worker-mirror.spec.ts` 的交互用例（点选 / 拖拽 / 空点隐藏手柄，逐像素 0 差异）。
> - **仍未做**：结构增量协议（增删子树的 op）、输入转发、字体/图片下发（worker 内文本的 `lang`/字形
>   口径与主线程可能分叉）。引擎的**默认**渲染仍是主线程；worker 渲染要宿主显式接线。
> 小程序支持已移除（2026-09-20），worker 化不再需要为它留后门。

## 1. 目标与边界

- **目标**：把「CanvasRenderer + 图元 doRender + 真实光栅化」搬到 Web Worker（`OffscreenCanvas`），
  释放主线程帧预算，让交互（命中检测、DOM 事件、面板）与渲染并行。
- **边界（明确不做）**：不在 worker 内做文本 IME/字体/图片解码；
  不迁移完整组件树双端同步（v0 原型直接 worker 内建静态场景）。

## 2. 现引擎中依赖 DOM/主线程的 API 清单（worker 化需要桥接或禁用）

| 依赖点 | 位置 | worker 化方案 |
|---|---|---|
| `root.requestFrame` | `FrameManager` | worker 无 rAF → 主线程 rAF 转发节拍 / `setInterval` 驱动 |
| 文本量测 DOM `<div>` | `ICEText.measureText` | 主线程预量宽高后下发；worker 内 `OffscreenCanvasRenderingContext2D.measureText`（需字形就绪） |
| 图片 `new Image()` | `ImageCache` | 主线程 decode → `createImageBitmap` → 传输位图 |
| 字体 `FontFace` | `root.loadFont` | 主线程加载完成后下发（worker 内字体不可信） |
| 内联编辑 HTML `<input>`（IME） | `ICEText` | 编辑态仍在主线程完成 |
| 命中/坐标换算用 `getBoundingClientRect` | `DOMEventDispatcher` | 命中在主线程算（保持命中检测铁律） |
| `global`/`window` 探测 | `cross-platform/root.ts` | ✅ **已解决（阶段一）**：取根改为 `globalThis` —— 浏览器 window / worker self / Node global 同一个入口，宿主不再需要伪造全局 |
| 离屏 canvas | `root.createOffscreenCanvas` | ✅ **已解决（阶段一）**：有 document 时用 `<canvas>`（保住 `lang`/`dir` 的字形口径），没有则用 `new OffscreenCanvas(w,h)`（worker 分支） |
| 文本字形语言（`lang`/`dir`） | 主画布元素属性 | ⚠️ worker 里拿不到主画布的 `lang` → CJK 字形可能与主线程分叉；v0 结论是文本口径留在主线程（见 §1 边界） |

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

### 3.1 输入留在主线程（阶段二第二块）

**没有任何"输入消息"** —— 这是设计而不是省事：DOM 事件、命中检测、拖拽、控制面板的交互本来就
只在主线程发生，跨线程转发一份坐标只会引入两套换算。真正的坑在别处：

1. **命中检测读的是渲染期的世界盒快照**（`CanvasRenderer.getWorldBox()` → `__snap`，渲染时写入）。
   所以主线程**必须继续跑渲染管线**，否则"从未渲染过的组件命中不到"。
2. 但主线程**不该再产出像素**（那正是要交给 worker 的部分）。做法是把落墨换成一个"几何通道"
   上下文：吞掉一切绘制调用，只把 `measureText` 与 `create*Gradient` 委派给真实上下文
   （文本盒高与渐变对象都是引擎要读回来的东西）。引擎侧入口是 `ICE.setPaintTarget(ctx)`，
   参考实现是 `MirrorHost` 里的 `createGeometryOnlyContext()`。
3. 主线程同时**关掉离屏位图缓存**（`cache.isCachable = () => false`）：不产出像素时，位图缓存
   只是白烧 CPU。
4. **工具层不进序列化，也不作为 ops 镜像**。控制面板 / 手柄由 `ICEControlPanelManager` 按目标
   自己造（`toolNodes` 明确不序列化），两边实例与 id 都不同 —— 把主线程手柄的
   `setState({display:false})` 当 ops 发过去，worker 里没有这些 id，只会换来一串 `missing`
   与重同步风暴。所以镜像的是**「面板显示给谁」**：`ICEControlPanelManager.applySelection()`
   把目标推给 worker，worker 用它**自己的**面板画出同一套手柄（含 `transformable` / `linkEditable`
   的门控，判定复用同一条路径，不另写一套）。
   注意"点空白处"的语义：引擎只**隐藏面板**、不清空 `selectionList`，所以镜像的必须是面板状态，
   而不是选中列表 —— 否则会出现"主线程手柄没了、worker 画面里还挂着"。

## 4. 双 buffer 方案对比

| 方案 | 说明 | 结论 |
|---|---|---|
| `transferControlToOffscreen` | 主线程把 canvas 控制权交给 worker；主线程失去 2D ctx | 影响主线程命中/测量；首版不采用 |
| **`transferToImageBitmap` + `ImageBitmapRenderingContext`（推荐初版）** | worker 每帧 OffscreenCanvas → 位图 → 主线程 `transferFromImageBitmap` 展示 | 主线程保 ctx；位图传输开销小；实现简单 |

消息协议（draft）：
```
主线程 → worker: { t:'scene', v, seq, doc, dropped? }      // 全量（首次 / 结构变更后）
                | { t:'ops',   v, seq, ops:[['state', id, patch]] }   // 状态增量
                | { t:'frame', v, time }                    // 节拍（用主线程的时间戳）
                | { t:'resize', v, width, height }
worker  → 主线程: { t:'ready',   v, caps }
                | { t:'rendered', v, seq, stats }           // 位图走 transfer（宿主自己收）
                | { t:'missing', v, seq, ids }              // 镜像缺组件 → 主线程重发全量
                | { t:'error',   v, message, code? }
```

（上面是 v1 的**最终形态**，已实现；`v` 是协议版本，不匹配时接收方明确拒绝，不猜老格式。）

**三条实现纪律**（改这块之前先读，`mirror-protocol.ts` 头注释里有完整理由）：
1. 状态是**推**过去的，worker 从不回传组件状态 —— 没有双向冲突要解决；
2. 消息发出前一律过 `sanitizeTransferable()`：结构化克隆带不走的值（函数 / DOM 节点 /
   `CanvasGradient`）**就地丢弃并把路径记进 `dropped`**，否则 `postMessage` 抛 `DataCloneError`
   会让整帧消息发不出去（症状是"画面卡住不动"）；
3. 采集中在引擎内部四处（`setState` / `addChild` / `removeChild`，`ICE` 与 `ICEGroup` 各一份），
   没装桥时只有一次属性读 —— 见 `src/worker/mirror-hooks.ts`。

## 5. 一致性要点

- 命中检测与状态同步留在主线程 → 不破坏现有「命中检测铁律」与事件语义。
- 动画时钟单一化：worker 收到主线程 `frame` 命令的时间戳做补间，避免双时钟漂移。
- 渲染路径直接复用 M1 的 `doRenderFull/doRenderDirtyRect` 分派（渲染器已可插拔），
  将来把 `dirtyIds/快照` 经消息通道传给 worker，worker 内同样受益于脏矩形局部重绘。

**实测结论（2026-09-20，`e2e/visual/worker-mirror.spec.ts`）**：v1 把动画的**计算结果**（绝对状态值）
推给 worker，worker 不做补间 —— 因此"双时钟漂移"这一条在 v1 上**根本不成立**（没有插值就没有时钟）。
六步（位移/换色、半径、点集、加子节点、删子节点）逐步比对，worker 画面与主线程参考
**逐像素 0 差异**（alpha 与 RGB 都严格相等）。真正需要单一时钟的是**将来**把补间也搬进 worker 的那版。

交互同样实测过（同文件第二个用例，参考宿主 `examples/worker/mirror-render.html`）：
可见画布**刻意偏离页面左上角**（100px/40px）——点选、拖拽、空点隐藏手柄全部按可见画布的矩形换算，
主线程选中与拖拽位移精确（+60/+40），worker 画面里的手柄随之出现/移动/消失，
每一步与参考渲染**逐像素 0 差异**。

## 6. 开关策略（web-only）

- 目标运行时是"现代浏览器 + Node/headless"，worker 化天然是 **web-only**：探测 `OffscreenCanvas`、
  `Worker`、`ImageBitmapRenderingContext` 三者齐备才启用；`root.workerSupported` +
  `ICE.init(..., { renderInWorker?: boolean })`（默认关）。
- **2026-09-20 更新**：小程序已不再支持，本节原先那条"小程序线程模型不同 → 收益不成立"的
  排除理由随之消失（见 `08-compatibility.md` 的「已移除的能力」）。

## 7. 最小可行性原型（本轮交付）

### 7.0 真实应用验证：ice-entity-designer 的流程图（2026-09-20）

把镜像接上 IED 的流程图（**200 节点 / 799 组件 / 画布 900×620**，含节点标题与连线标签）实测：

| 指标 | 主线程渲染 | worker 镜像 | 结论 |
|---|---|---|---|
| 缩放平移每帧主线程 p50 | 1.90 ms | **1.20 ms** | **省 37%**（缓存整批失效、全部图元重画的最重负载） |
| 拖动单节点每帧 p50 | 2.60 ms | 2.50 ms | 省 4%（引擎的静态层 / 组件位图缓存已经把这类负载吸收了） |
| worker 内渲染 p50 | —— | 2.8 ms | 在主线程之外，不占帧预算 |
| 端到端延迟（改状态 → 位图回来） | —— | **4.7 ms** | 约一帧量级，这是镜像方案的真实代价 |
| 初始态像素（worker vs 文档重建） | —— | **0 差异** | 含文字与连线标签 |
| 全量场景体积 | —— | 473 KB | 只在结构变更时发；状态走增量补丁 |

规模趋势（`?nodes=40/120/250/400`）：主线程每帧 0.50/1.20/2.30/4.50 ms → 0.30/0.80/1.50/3.00 ms，
**省 31%~46%**。

**结论**：镜像能让"大范围重绘"类负载轻 30%~40%，代价约一帧延迟；
**是否需要它取决于场景里有没有大范围重绘**（缩放/平移、换主题、批量改样式），而不是"图元多不多"。

**保真边界 = 序列化格式的保真边界**。复合组件的派生子件（IED 的节点图标 / 连线标签）按设计
**不写进文档**，worker 侧重建后 id 与主线程不同 → 应用层对它们的位置更新镜像不过去：
几何逐项一致（实测 396/399），只有这些子件的视觉细节有差异（像素差约 9%，只落在标签周围）。
要彻底消掉，需要（二选一）：让派生子件进文档（实现 `getSerializableChildren()`），
或者让镜像按**结构路径**（"容器 X 的第 N 个派生子件"）而不是 id 寻址。

**这次验证顺手修掉的四个缺陷**（每个都配了守卫/回归，细节见 CHANGELOG）：
① 几何通道漏登记 `fillText`/`strokeText` → 真实文字一画就抛；
② `ICEGroup.setState` 是完全覆盖、不经过镜像钩子 → **容器型组件（FlowNode）的状态全进不了镜像**；
③ 协议没有视口消息、且新起的镜像不对齐"当前视口/选择"；
④ `MirrorHost` 的 2d 合成没复位主画布上下文（残留 CTM 让位图整体错位）。

复现：`ice-entity-designer` 的 `npm run build && npx playwright test e2e/worker-mirror.spec.ts`，
页面 `examples/worker-mirror.html?nodes=200`；完整报告见该仓 `docs/worker-mirror-rendering.md`。

**阶段二第一块之后，参考宿主升级为"真协议"版**（`examples/worker/mirror-render.html` +
`mirror-worker.js`）：主线程建树 → `MirrorBridge` 发 `scene`/`ops`/`frame` → worker 内
`MirrorTarget` 落成镜像树 → `OffscreenCanvas` 渲染 → `transferToImageBitmap` 回传 →
主线程用 `ImageBitmapRenderingContext` 展示（`#view`），同时把同一张位图画进 2d 画布（`#probe`）
供逐像素验收；`#ref` 是主线程用同一棵树直绘的参考。下面这段是**更早的**单场景性能原型，保留备查。

- `examples/performance/worker-main.html` + `worker-min.js`：
  - worker 内 `importScripts` UMD dist（**零注入**，阶段一之后不再需要伪造全局），在 `OffscreenCanvas`
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
- 不做：树/事件双端同步、文本/图片/字体/控制面板在 worker 内。
