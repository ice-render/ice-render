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
>   **协议现状（v2）**：状态与结构**都走增量**（`state` / `add` / `remove`），全量 `scene` 只作兜底与自愈。
>   v1 的"结构变更走全量重同步"已作废：实测加一个节点从 **485 924 B** 降到 **1 037 B**（≈470×），
>   并省掉 worker 侧一次整树重建 + 冷启动全量重绘（那一帧 130~161ms）。
> - **阶段二第二块** = 让真实应用能接上：**输入永远在主线程**（DOM 事件、命中检测、拖拽都不跨线程），
>   主线程改走"几何通道"（跑渲染管线但不产出像素）以维持命中检测依赖的世界盒；
>   工具层按**选择**镜像 —— worker 用**自己的**控制面板画手柄。参考宿主 `MirrorHost`，
>   回归 `e2e/visual/worker-mirror.spec.ts` 的交互用例（点选 / 拖拽 / 空点隐藏手柄，逐像素 0 差异）。
> - **仍未做**：输入转发（DOM 事件留主线程这条不变，这里指"把原生事件也透给 worker"）、
>   把补间搬进 worker（实测收益很小：1000 个动画组件每帧只 0.19ms / 68KB）、
>   结构增量里的"换父级"（`adoptChild` 目前按"删 + 加"两条 op 走，语义正确、只多一条消息）。
>   引擎的**默认**渲染仍是主线程；worker 渲染要宿主显式接线。
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
| 文本字形语言（`lang`/`dir`） | 主画布元素属性 | ✅ **已解决（协议下发）**：宿主把主画布的 `lang`/`dir` 随 `text` 消息推给 worker，`MirrorTarget.applyText()` 落到 worker 的 `ctx` 与 `root.textLanguage` —— 后者让**组件缓存 / 静态层的每一张离屏画布**也继承同一口径（少了它，缓存里的汉字字形会与主画布分叉） |
| 字体 | `ICE.loadFont()`（`FontFace` + `document.fonts`） | ✅ **已下发**：宿主在主线程把字体字节取好（`MirrorHost` 的 `fonts` 选项），`fonts` 消息推给 worker，worker 用自己的 `FontFace` + `self.fonts` 注册；运行时不支持时如实报 `fontErrors`、不抛 |
| 图片 | `ImageCache` 的 `Image` + `onload` | ✅ **已下发**：worker 里没有 `Image` 构造器（带图片的树以前会整棵退回主线程 —— 实测加一个 `ICEImage` 就 `hostActive: false`）。现在主线程渲染发现用图 → 宿主 `fetch` + `createImageBitmap` 解码 → `images` 消息（位图走 transfer 零拷贝）→ worker 直接用；同一 URL 只解码一次，未到达时返回"未加载"**不抛**。⚠️ **边界：缩放绘制**时 Chromium 对 `Image` 与 `ImageBitmap` 的重采样不同（实测原图 185×182：1:1 绘制**逐点一致**、缩到 72×72 差 770 像素/最大 93、缩一半差 411 像素/最大 10）——要严格逐像素一致就**按原图尺寸绘制** |

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
5. **镜像只寻址"文档里的组件"**（`isMirroredComponent`，与 Serializer / Deserializer 同源判定）。
   复合组件的派生子件（按 state 重建的底 / 标题 / 角标）不进文档，主线程对它们的写入在 worker 侧
   没有对应 id：发过去只会换来 `missing` → 全量重同步（实测每改一次节点就重发 473KB）。
   这类写入**不镜像、只计数**（`MirrorBridge.skippedDerived`）；镜像里那份派生件靠**重放容器的
   `applyPatch`** 重建（见下一条）。同理，落在派生子树里的**结构变更**（容器重建自己）也不镜像 ——
   而真实子节点（`getSerializableChildren()` 声明的那些）增删走**结构增量 op**（见下一条）。
6. **补丁按应用层入口重放**：worker 收到 `ops` 后走 `component.applyPatch()`（引擎基类默认 =
   `setState`，应用层可以覆盖它做派生：重建内部部件、重算连线、把老属性规范化到新位置），
   而不是裸 `setState`。这样"派生逻辑跟着代码走，不跟着数据走"——两边跑同一份代码，
   不需要把派生结果跨线程搬运。
7. **结构变更也走增量**（协议 v2）：`add` / `remove` 各一条 op —— `add` 带一棵**子树文档**
   （`Serializer.encodeSubtree()` 的产物，与整份文档同一条编码路径），`remove` 只带 id；
   worker 侧用 `Deserializer.decodeInto()` 挂上去、并维护 id 索引（`appliedAdds/appliedRemoves`）。
   实测（IED 200 节点 / 800+ 组件）"新建一个节点"：**1037 B、0 次全量重同步、worker 那一帧 6.3ms**，
   对比老口径的 **485 924 B（474KB）、1 次全量重同步、worker 那一帧 125ms**；端到端 166ms → 10ms。
   全量 `scene` 退化为**兜底与自愈**：拿不到可寻址的 id / 父容器不可寻址 / 子树编码失败 /
   worker 报 `missing` / 宿主显式要求（`resyncOnStructureChange: true`）。
   ⚠️ 结构 op 与状态补丁是**同一条有序队列**，因此 `addChild` 的镜像钩子必须排在
   `__reapplyPreset()`（会顺手写 `style`）与 `doLayout()`（会写 `left/top`）**之前** ——
   顺序反了就是"worker 收到未知 id 的补丁" → `missing` → 全量重同步，结构增量白做
   （2026-09-20 由 IED 的真实操作抓到，单测已钉住）。
8. **文本与图片的口径都必须跟着走**：`lang`/`dir`（汉字简/繁/日字形）、**字体字节**、**图片位图**
都随协议下发 —— 宿主从主画布读语言、把字体取成字节、把图片解码成 `ImageBitmap`，
worker 用自己的 `ctx` / `FontFace` / 图片注册表落地。少了任何一样，"缓存 / 静态层与主画布
逐像素一致"这条承诺都会破（图片那条以前更严重：worker 里没有 `Image` 构造器，整棵镜像会退回主线程）。

**直绘模式（可选）**：`transferCanvas: true` 时宿主把显示画布 `transferControlToOffscreen()` 交给
worker（worker 直接往它上面画、不再回传位图），代价是主线程读不到那块画布；前置是"显示画布必须
还没有 2d 上下文"，因此引擎要 init 在叠放着的输入/量测层上（参考宿主 `?direct=1`）。

**帧节拍必须有背压**：worker 一帧要几毫秒，主线程按 rAF / 交互节奏每毫秒都能发一帧 ——
   不设上限的话 `frame` 消息会越排越多（实测 30 帧基准积压 200+ 条），镜像滞后无上界、
   期间画的还是过时状态。做法是**至多一帧在途**："还想画"只记一个标记，等位图回来立刻补一帧
   （补的是最新状态）。宿主判断"静止态"用 `MirrorHost.renderedSeq` 与
   `MirrorBridge.lastFrameSeq` 这组水印，而不是"又收到一张位图"（位图是背压的，会落后）。

## 4. 双 buffer 方案对比

| 方案 | 说明 | 结论 |
|---|---|---|
| `transferControlToOffscreen`（**已落地，opt-in**） | 主线程把 canvas 控制权交给 worker；主线程失去这块画布的 2D ctx | 用 `MirrorHost({ transferCanvas: true })` 开启：省掉每帧"位图回传 + 主线程合成"。两条前置：① 那块**显示画布必须还没有 2d 上下文**（`getContext` 调过一次就转移不出去）——所以引擎要 init 在**另一块**"输入/量测层"上（参考宿主 `?direct=1` 的双画布布局）；② 开启后主线程读不到像素（截图要用页面级）。与位图模式**逐字节同画面**（e2e 用 PNG 比对） |
| **`transferToImageBitmap` + `ImageBitmapRenderingContext`（推荐初版）** | worker 每帧 OffscreenCanvas → 位图 → 主线程 `transferFromImageBitmap` 展示 | 主线程保 ctx；位图传输开销小；实现简单 |

消息协议（v2；`frame` 带 `seq`，见 §5 与 `MirrorHost.renderedSeq`）：
```
主线程 → worker: { t:'scene', v, seq, doc, dropped? }      // 全量（首次 / 兜底 / 自愈）
                | { t:'ops',   v, seq, ops:[...] }           // 增量：['state',id,patch] | ['add',parentId,子树文档] | ['remove',id]
                | { t:'frame', v, seq, time }                // 节拍（用主线程的时间戳）
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

worker 化天然是 **web-only**，所以"起不来怎么办"必须是机制的一部分、而不是交给应用去猜。
引擎**不做全局开关**（`ICE.init(..., { renderInWorker })` 那种"引擎自己切渲染后端"仍是未来设计）：
镜像由宿主显式接线（`MirrorHost`），因此保护也做在宿主这一层，分三道闸：

**① 启动前探测**（`detectMirrorSupport()` / `MirrorHost.detect({ canvas })`，能力来自 `root`）：

| 必要条件 | 缺失时的后果 | 判定 |
|---|---|---|
| `Worker` | 根本没有线程可开 | `root.workerSupported` |
| `OffscreenCanvas` + `transferToImageBitmap` | worker 里没有落墨目标（Safari 16.4 之前只有部分实现） | `root.offscreenCanvasSupported` |
| `ImageBitmap` | 位图跨不回来 | `root.imageBitmapSupported` |
| `bitmaprenderer`（**非致命**） | 退化成 2d `drawImage` 合成，多一次拷贝 | 探测可见画布 |

探测不过就**根本不接管落墨通道** —— 画面与"从没接过 worker"逐像素一致，功能一项不少。

**② 启动期兜底**（都在 `MirrorHost.start()` 里，失败即回退）：

- `new Worker()` 包 try/catch：CSP 的 `worker-src`、`file://`、企业策略/隐私模式会**同步抛**，
  以前那会从 `start()` 冒出去、整页崩；
- **`ready` 握手 + 超时**（默认 4000ms）：worker 脚本 404 / 语法错 / 在 `importScripts` 或模块顶层就抛
  （真实例子：顶层 `new OffscreenCanvas()`）都不一定触发 `onerror`，但"等不到 ready"是确定可观测的；
- **`ready.caps` 校验**：worker 自报 `offscreen: false` 或协议版本不一致 → 回退并说明原因。

**③ 运行期看门狗**：背压保证"最多一帧在途"，所以"**有帧在途却超过 `staleTimeout`（默认 4000ms）
没有位图回来**"是干净的死亡判据（worker 卡长任务 / 画布分配失败 / 被宿主策略掐掉都覆盖）。
`onerror` 同样走回退。

**回退动作是固定的三步**（`MirrorHost.__fallback`）：`stop()` 原样还原落墨通道与缓存开关 →
**立刻用主线程重绘一帧** → 上报 `onFallback({ reason, message, support })` + 一条 `MIRROR_FALLBACK`
错误事件。也就是说：**任何一步失败，宿主拿到的都是一块正常、可交互、能继续画的画布**，
而不是"冻在某一帧上、还不报错"。

回归：`tests/worker/mirror-host.test.ts`（探测/构造/握手/caps/版本/运行期/看门狗/`fallback: 'off'`）
+ `e2e/visual/worker-fallback.spec.ts`（真实浏览器里把 worker 指到一个不存在的脚本、以及
`?backend=main`，断言"回退了 + 画面还在 + 改状态画面跟着变"）。应用侧的接法见
`ice-entity-designer` 的 `e2e/worker-mirror.spec.ts`。

- **2026-09-20 更新**：小程序已不再支持，本节原先那条"小程序线程模型不同 → 收益不成立"的
  排除理由随之消失（见 `08-compatibility.md` 的「已移除的能力」）。

## 7. 最小可行性原型（本轮交付）

### 7.0 真实应用验证：ice-entity-designer 的流程图（2026-09-20）

把镜像接上 IED 的流程图（**200 节点 / 799 组件 / 画布 900×620**，含节点标题与连线标签）实测：

| 指标 | 主线程渲染 | worker 镜像 | 结论 |
|---|---|---|---|
| 缩放平移每帧主线程 p50 | 1.90 ms | **1.20 ms** | **省 37%**（缓存整批失效、全部图元重画的最重负载） |
| 拖动单节点每帧 p50 | 3.20 ms | 2.80 ms | 省 12%（引擎的静态层 / 组件位图缓存已经把这类负载吸收了） |
| worker 内渲染 p50 | —— | 3.8 ms | 在主线程之外，不占帧预算 |
| 端到端延迟（改状态 → 位图回来） | —— | **7.0 ms** | 约一帧量级，这是镜像方案的真实代价 |
| 静止态几何对账 | —— | **399/399 逐项相等** | 每个节点的世界盒 + 连线两端点 |
| 静止态像素（worker vs 文档重建 / vs 主线程源树） | —— | **0 差异 / 558000 像素 0 差异** | 含节点标题与连线标签（文字栅格化） |
| 全量场景体积 | —— | 473 KB | 只在首次 / 兜底 / 自愈时发 |
| **落墨占比**（三档护栏：主线程 / 几何通道 / 镜像） | 1.90 ms | 1.20 / **1.20 ms** | 落墨占主线程那一帧 **37%** —— 这就是镜像能省的**上界**（`e2e/worker-mirror.spec.ts` 的"落墨占比三档"用例钉住区间） |
| 加一个节点的代价（v2 结构增量） | 485 924 B · 1 次全量重同步 · worker 那一帧 125ms | **1 037 B · 0 次重同步 · 6.3ms** | 端到端 166ms → 10ms |

规模趋势（`?nodes=40/120/250/400`）：主线程每帧 0.50/1.20/2.30/4.50 ms → 0.30/0.80/1.50/3.00 ms，
**省 31%~46%**。

**结论**：镜像能让"大范围重绘"类负载轻 30%~40%，代价约一帧延迟；
**是否需要它取决于场景里有没有大范围重绘**（缩放/平移、换主题、批量改样式），而不是"图元多不多"。

**保真边界 = 序列化格式的保真边界 + 「派生逻辑跟着代码走」**。复合组件的派生子件（IED 的节点
形状 / 标题 / BPMN 角标 / 连线标签）按设计**不写进文档**，worker 侧由构造函数重建，id 与主线程
不同 —— 所以对它们的**状态写入不镜像**（发过去只会换来 `missing` → 全量重同步，实测每改一次
节点就重发 473KB）。它们靠另一条路保持一致：**镜像侧按应用层入口重放补丁**
（`MirrorTarget.applyOps` → `component.applyPatch()`），派生逻辑两边跑的是同一份代码。
于是静止态**几何逐项相等、像素逐像素为 0**（上表）。

这条边界剩下的含义（不是缺陷，是设计）：**只改派生部件、容器状态没动**的写法不在文档模型内 ——
这种写入不会进镜像（`MirrorBridge.skippedDerived` 计数上报），连 `serialize → load` 往返也留不住它。

**这次验证顺手修掉的缺陷**（每个都配了守卫/回归，细节见 CHANGELOG）：
① 几何通道漏登记 `fillText`/`strokeText` → 真实文字一画就抛；
② `ICEGroup.setState` 是完全覆盖、不经过镜像钩子 → **容器型组件（FlowNode）的状态全进不了镜像**；
③ 协议没有视口消息、且新起的镜像不对齐"当前视口/选择"；
④ `MirrorHost` 的 2d 合成没复位主画布上下文（残留 CTM 让位图整体错位）。
⑤ 应用层位置/尺寸补丁直接写 `setState`，不走引擎的 `setPosition()` → **程序化移动节点时连线不跟随**
   （镜像侧反而因为重建而"对"，两边几何分叉）；
⑥ 镜像侧只落 `setState`，不重放应用层的 `applyPatch` → 派生部件（标题 / 形状 / 连线走线）停在旧值；
⑦ **帧节拍没有背压**：主线程每步都发 `frame`，worker 一帧要几毫秒 → 实测 30 帧的基准能积压两百多条
   `frame` 消息（`renderedSeq=45` vs `lastFrameSeq=240`），镜像要好几秒才追上，期间画的每帧都是过时状态。
   修法：**至多一帧在途**（`MirrorHost`），并把 `frame` 的 `seq` 作为"这张位图是哪一帧"的水印
   （`MirrorHost.renderedSeq` / `MirrorBridge.lastFrameSeq`）—— 静止态验收、截图、像素比对都要等它追平。

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
