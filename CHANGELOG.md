# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 下一个版本发布前，改动在这里累积。

### 修复 / 新功能（Worker 镜像 · 换父级单条 op + 图片口径对齐）

- **换父级（`adoptChild`）走单条 `move` op**。它此前只触发"新增"钩子：镜像里旧父那份不会被摘掉，
  同一棵树因此出现**两个同 id 实例**（双重绘制，后续状态补丁只更新其中一个）。现在协议多一种
  `['move', id, 新父 id]`：主线程在 `ICEGroup.adoptChild` 里单独通知（并抑制 `addChild` 的 add 通知），
  worker 侧用引擎自己的 `adoptChild` 落地（不销毁、坐标不换算，与主线程同语义）。
- **图片：主线程与 worker 画同一份解码结果**。此前 worker 画 `ImageBitmap`、主线程画 `Image`，
  **缩放绘制**时两者重采样不同（实测原图 185×182 缩到 72×72：770 像素、最大 93/255）。
  现在宿主解码**两份**（实测两次 `createImageBitmap` 逐点一致）：一份注册进"解码结果表"给本页所有
  ICE 实例用，一份随 transfer 给 worker；并且**位图在路上时主线程不先退回 `Image`**
  （否则位图到达那一帧会像素跳变）；解码失败会摘掉"在途"标记、退回常规路径。
  引擎 e2e 的图标因此改回**缩放绘制**仍断言逐像素 0 差异。

### 新功能（Worker 镜像 · 图片下发 + "落墨占比"基准护栏）

- **图片下发**（`images` 消息）：worker 里没有 `Image` 构造器 —— 在此之前**带图片的树会让整个镜像退回
  主线程**（实测：往镜像树里加一个 `ICEImage`，`hostActive` 立刻变 false，错误是
  "当前运行时没有可用的 Image 构造器"）。现在：主线程渲染发现用图 → 宿主在主线程
  `fetch` + `createImageBitmap` 解码 → `images` 消息下发（位图走 **transfer** 零拷贝）→ worker 的
  `ImageCache` 命中就直接画；同一条 URL 只解码一次；**图还没到时返回"未加载"、不抛**（下发到达时
  `MirrorTarget.applyImages()` 会把用到它的组件标脏，下一帧补上）。运行时不支持
  `createImageBitmap` / 解码失败时如实上报 `MIRROR_IMAGE_FAILED`。
- **两条实测踩到的坑**（都由测试/探针逮住）：
  ① `ImageCache.loaded()` 用 `Image` 的 `complete` / `naturalWidth` 判定 —— `ImageBitmap` 没有这两个
     属性，于是"第一次取用能画、**缓存命中之后永远画不出来**"（`loaded` 变成 `undefined`）。
     现在没 `complete` 的一律视为已解码。
  ② 图片是**异步**到达的：初版 e2e 里"参考侧有图、镜像还没有"差出一整块图标（5061 像素），
     现在夹具与用例都等两侧解码完成再比。
- **"落墨占比"基准护栏**（`ice-entity-designer` 的 `headroom()` + 对应 e2e）：把
  **主线程直绘 / 几何通道（删掉落墨、不启 worker）/ worker 镜像**三档放在同一条曲线上量，
  并钉住区间 —— 镜像是把"落墨"那一档搬走了，所以它的收益**上界**就是落墨占比。
  实测（IED 200 节点 / 缩放的视口负载）：主线程 1.90ms → 几何通道 1.20ms → 镜像 1.20ms，
  **落墨占比 37%**、镜像省 37%（区间断言：占比 ∈ (0.1, 0.75) 且镜像 ≤ 几何通道 × 1.25）。
- **图片路径的保真边界**（写进架构文档）：**缩放绘制**时 Chromium 对 `Image` 与 `ImageBitmap`
  的重采样不同 —— 实测原图 185×182：**1:1 逐点一致**、缩到 72×72 差 770 像素/最大 93、
  缩一半差 411 像素/最大 10。要严格逐像素一致就按原图尺寸绘制（e2e 的夹具就是 1:1 的）。

回归：`tests/worker/mirror-images.test.ts`（新增 7 条：worker 直接可用 / 缓存命中仍算已加载 /
真的画出来 / 未下发不抛 / 主线程请求转宿主 / 桥的 transfer 列表 / 宿主解码去重）；
引擎 e2e 的场景里加了一张 `ICEImage` 并断言**逐像素 0 差异**；IED 新增"落墨占比三档"用例。

### 新功能（Worker 镜像 · 文本口径下发 + 直绘模式）

worker 与主线程在"文本"和"传输"这两处一直有条边界，这一版都收掉：

- **文本绘制语言（`lang` / `dir`）下发**（`text` 消息）：worker 里没有主画布元素可继承语言，
  不推过去的话同一个汉字会按运行时默认语言选字形（简/繁/日/韩），与主线程分叉。宿主从可见画布读
  语言（或 `textLanguage` 选项显式给），`MirrorTarget.applyText()` 落到 worker 的 `ctx` 与
  `root.textLanguage` —— 后者让**组件缓存 / 静态层的每一张离屏画布**也继承同一口径
  （`root.createOffscreenCanvas` 统一应用，少了它缓存里的字形会与主画布分叉）。
- **字体下发**（`fonts` 消息）：宿主在主线程把字体字节取好（`MirrorHost` 的 `fonts` 选项，
  `await (await fetch(url)).arrayBuffer()`），worker 用自己的 `FontFace` + `self.fonts` 注册；
  运行时不支持时如实报 `fontErrors`、**不抛**（字形分叉可解释，页面不能崩）。
  **图片仍未下发**：图片链路是 `ImageCache` 的 `Image` + `onload`，worker 里要用 `createImageBitmap`
  另开一条解码路径，属于独立一块（已记进架构文档的边界表）。
- **直绘模式**（`MirrorHost({ transferCanvas: true })`，opt-in）：把显示画布
  `transferControlToOffscreen()` 交给 worker 直接画，省掉每帧"位图回传 + 主线程合成"。
  两条前置写进了文档：显示画布**必须还没有 2d 上下文**（`getContext` 调过一次就转移不出去 →
  引擎 init 在叠放的"输入/量测层"上，参考宿主 `?direct=1` 的双画布布局）；开启后主线程读不到像素。
  运行时不支持 / 转移失败时退回位图模式并如实上报（`MIRROR_CANVAS_TRANSFER_UNSUPPORTED` /
  `..._FAILED`）。直绘模式下 worker 不回传位图，但 `rendered` 水印与统计照旧推进（背压与
  静止态对账都靠它）。

**顺手修掉的两个"探测/初始化把功能废掉"的坑**（都是实测踩到才发现的）：
① `MirrorHost` 在转移画布**之前**调了 `canvas.getContext('bitmaprenderer')` 探测合成路径 →
   画布被标记成"已有上下文"，转移必然失败；现在直绘路径完全不碰那块画布。
② `detectMirrorSupport()` 用**调用方那块画布**探测 `bitmaprenderer` → 同样把画布污染掉；
   现在改在**临时画布**上问运行时能力（拿不到就保守为 false —— 它只影响合成路径，非致命）。

实测（引擎参考宿主）：直绘模式与位图模式**画面逐字节一致**（页面级 PNG 比对，4498B 相同），
帧节拍 / 水印照旧推进；当前运行时的文本语言由 worker 侧 `ctx.lang` 回报（`textLang`），e2e 断言它
等于主画布语言。

回归：`tests/worker` 新增 `mirror-text`（语言落 ctx + 离屏画布继承、字体注册 / 不支持时的报错）、
`mirror-canvas`（直绘接管、宿主先切量测层再转移、无位图帧的水印推进、不支持时退回）
与探测守卫（不得在被测画布上建上下文）；引擎 e2e 新增直绘模式用例；IED 的镜像 e2e 增断言
"worker 侧文本语言 == 主画布 lang"。

### 新功能（Worker 镜像 · 协议 v2：结构变更也走增量）

拓扑编辑里最高频的两件事是"加图元"和"删图元"，而它们在 v1 里是**最贵**的：结构一变就重发整份文档
（IED 200 节点场景 **474KB**）+ worker 侧 `clearAll()` + 整树反序列化 + 冷启动全量重绘。
v2 把结构也变成增量：

- **协议**：`MirrorOp` 从 `['state', id, patch]` 扩成三种 —— `['state', id, patch]`、
  `['add', parentId | '#root', 子树文档]`、`['remove', id]`；`MIRROR_PROTOCOL_VERSION` 升到 **2**
  （第三方自写的 v1 worker 会被版本校验拒绝，宿主自动回退主线程渲染，不会静默画错）。
- **编码 / 还原走既有入口**：新增 `Serializer.encodeSubtree(component)` 与
  `Deserializer.decodeInto(parent, nodeData)` —— 与整份文档**同一条路径**（typeId 注册表、
  派生件跳过、zIndex 口径、布局还原），只是不带文档外壳。
- **worker 侧**：`MirrorTarget` 按 op 类型分派，`add` 用 `decodeInto()` 挂上并**重索引子树**、
  `remove` 先收集子树 id 再摘除；新增计数 `appliedAdds` / `appliedRemoves`（宿主对账用）。
  父容器找不到照旧进 `missing` → 触发既有的"限流重发全量"自愈。
- **全量 `scene` 退化为兜底**：拿不到可寻址的 id、父容器不可寻址、子树编码失败、worker 报 `missing`、
  或宿主显式要求（`resyncOnStructureChange: true`，默认已翻成 `false`）时才发。
- **队列顺序是正确性的一部分**（实测抓到的真 bug）：`addChild` 的镜像钩子原先排在
  `__reapplyPreset()`（会顺手写 `style`）之后，于是同一批里"未知 id 的状态补丁"排在了 `add` 前面
  → worker 报 `missing` → 每次新建节点都触发一次全量重同步，结构增量白做。
  现在 `ICE.addChild` / `ICEGroup.addChild` 都在**写状态的调用之前**通知钩子（`doLayout()` 同理）。

**实测**（IED 200 节点 / 800+ 组件，"新建一个节点"）：

- 发出去的字节：**485 924 B（474KB）→ 1 037 B**（≈470 倍）；
- 全量重同步：**1 次 → 0 次**；
- worker 那一帧 `renderMs`：**125.3 ms → 3.9 ms**；
- 端到端（改完 → 位图回来）：**165.5 ms → 9.7 ms**（中位数；首次含冷启动 59ms）。

回归：`tests/worker/`（新增 add/remove 增量、复合容器真子节点、队列顺序、回退守门等 6 条）、
`e2e/visual/worker-mirror.spec.ts`（断言 5 步里 `appliedScenes` 恒为 1、`appliedAdds/Removes > 0`，
像素仍 0 差异）、IED 的 `e2e/worker-mirror.spec.ts`（新增结构通路场景：加 2 删 2 条 op、0 次重同步、
几何 0 不一致）。

## [4.0.0] - 2026-09-20

> ⚠️ **破坏性：路径命令流新增 `roundRect`**（读 `component.path2D._commands` 自行重放/翻译的第三方代码
> 要认识这个新命令；引擎自带的 SVG 导出器已支持）。其余都是新增能力与修复，数据格式与渲染结果的
> 其它部分不变。
>
> 本版主线是 **worker 镜像渲染**（阶段一"worker 一等宿主" → 阶段二"跨线程协议 / 输入留主线程 /
> 工具层镜像" → 真实应用验证 → 派生更新可镜像 + 帧节拍背压 → 兼容保护），配一条
> **下游回归分层**工具（`npm run regression:affected`）。

### 开发工具（下游回归分层：`npm run regression:affected`）

家族现在有 11 个应用成员，一轮"全家族单测 + e2e"约 8 分钟 —— 改一行文档也全量跑是纯浪费。
新增 `scripts/family-regression.cjs`（`npm run regression:unit` / `:affected` / `:family`），
把下游回归分成三层，但**绝不静默少测**：判定规则写死在脚本里，且每次都打印"为什么这么跑"。

- **`unit`**：全家族单测（每成员 `npm test`；没有测试用例的成员退到 `npm run types:check` → `build`，
  这正是 `ice-entity-designer-react-demo` 这类"跟版"成员的验证方式）。
- **`affected`（默认）**：引擎 `verify:full` + 全家族单测 + **受影响成员**的 e2e。
- **`full`**：引擎 `verify:full` + 全家族单测 + **全部**成员 e2e（发版前）。

"受影响"由**改动路径 + 应用引用面**判定：只改 `src/worker/**` → 谁真的接线了镜像
（代码里出现 `MirrorHost` / `MirrorBridge` / `MirrorTarget` / `detectMirrorSupport` …）谁跑 e2e；
改了 `src/` 下**其它**任何东西（图形 / 渲染器 / 事件 / 序列化 / ICE / `cross-platform/root`…）→
**全家族**跑 e2e（共用行为，"引用面"判断会漏，宁可多跑）；只改文档/测试/基准 → 不跑应用 e2e。
另外，**不依赖引擎的成员**（如 `ice-agent-console`）在 `affected` 层只跑单测 —— 它的 e2e 观察不到
引擎改动。成员是自动发现的（兄弟目录、目录名 `ice-*`、有 `package.json`；文档站 `ice-render-doc` 排除），
新加应用不用改脚本；依赖链接照旧"临时指向工作区引擎、跑完还原"。

实测：`--tier=unit` 三个成员 10.1s；`--tier=affected --only=ice-entity-designer,ice-agent-console`
32.6s（IED 跑 e2e，agent-console 只跑单测）；同规模的全量 `--tier=full` 约 8 分钟。
支持 `--dry-run`（先看计划）、`--since=<ref>`（默认 `origin/dev`）、`--only=`、`--skip-engine`。

### 新功能（Worker 镜像 · 2026-09-20 兼容保护：起不来就回退，回退后照常可用）

镜像一直是"宿主显式接线"，于是"某些浏览器/宿主不支持"以前只能靠应用自己判断：不支持时
**不会崩，但会静默冻屏**（几何通道挂着、worker 没有位图回来，画面停在最后一帧）。
这一版把这件事收进机制里，分三道闸 + 一个固定回退动作：

- **启动前探测**：`detectMirrorSupport()`（引擎导出）与 `MirrorHost.detect({ canvas })`。
  判定三条必要条件 —— `Worker`、`OffscreenCanvas` + `transferToImageBitmap`、`ImageBitmap`
  （能力统一问 `root`：新增 `root.workerSupported` / `root.offscreenCanvasSupported` /
  `root.imageBitmapSupported`，宿主不再自己去 `typeof window.Worker`）。`bitmaprenderer` 只影响
  合成路径（退回 2d `drawImage`），**不算必要条件**。探测不过时 `start()` **根本不接管落墨通道**。
- **启动期兜底**：`new Worker()` 包 try/catch（CSP 的 `worker-src`、`file://`、企业策略/隐私模式
  会**同步抛**，以前那会从 `start()` 冒出去）；新增 `ready` 握手 + 超时（默认 4000ms）——
  worker 脚本 404 / 语法错 / 模块顶层就抛（真实例子：顶层 `new OffscreenCanvas()`）**不一定**触发
  `onerror`，但"等不到 ready"确定可观测；并校验 `ready.caps`（worker 自报没有 OffscreenCanvas）
  与协议版本。
- **运行期看门狗**：背压保证"最多一帧在途"，所以"**有帧在途却超过 `staleTimeout`（默认 4000ms）
  没有位图回来**"= worker 已死（卡长任务 / 画布分配失败 / 被宿主策略掐掉），自动回退。
- **固定回退动作**（`MirrorHost.__fallback`）：`stop()` 原样还原落墨通道与位图缓存开关 →
  **立刻用主线程重绘一帧** → 上报 `onFallback({ reason, message, support })` + 一条 `MIRROR_FALLBACK`
  错误事件（只接 `onEvent` 的宿主也不会漏）。`fallback: 'off'` 可关掉自动回退（只上报）。
- 参考宿主升级：`examples/worker/mirror-render.html` 增加 `?backend=main`（强制主线程）与
  `?worker=<url>`（换成坏脚本）两个开关，并新增 `e2e/visual/worker-fallback.spec.ts`：
  真实浏览器里把 worker 指到不存在的脚本 → 断言"回退了 + 画面仍有墨迹 + 改状态画面跟着变"。

回归：`tests/worker/mirror-host.test.ts` 新增 8 条（探测 / 不接管 / 构造抛错 / 握手超时 / caps 与
版本不一致 / 运行期报错 / 看门狗 / `fallback: 'off'`）；引擎 `verify:full`；
`ice-entity-designer` 侧加了集成级回退用例（页面必须把模式切回主线程）。

### 新功能（Worker 镜像 · 2026-09-20 收口：派生更新可镜像 + 帧节拍背压）

接着上面的真实应用验证，把"镜像里最后那点分叉"和"交互下的滞后"一起收掉。三处改动分别对应一个
真实缺陷，判据都是**真实应用上的实测数字**（IED 流程图，200 节点 / 799 组件）：

- **派生更新可镜像（应用层补丁入口）**。新增公开入口 `ICEComponent.applyPatch(patch)`（默认就是
  `setState`，应用层可覆盖它做派生：重建内部部件 / 重算连线 / 规范化老属性），`MirrorTarget`
  应用 `ops` 时**走这个入口**而不是裸 `setState`。理由：复合组件的派生子件（IED 的节点形状 /
  标题 / 连线标签）不进文档，worker 侧那一份由构造函数重建 —— 只有重放应用层补丁，派生逻辑才会
  在两边都跑一遍（同一份代码）。实测：改名 / 改类型 / 改位置的几何与像素都逐项一致。
- **派生部件不寻址、也不触发重同步**。新增 `isMirroredComponent()`（与 `Serializer` /
  `Deserializer` 同源判定），桥不再把"镜像里根本没有的组件"的补丁发出去 —— 发过去只会换来
  `missing` → 全量重同步（实测每改一次节点重发 **473KB**，而且顺手清掉同批已排队的补丁）。
  这类写入按 `MirrorBridge.skippedDerived` 计数上报（**不是**静默丢弃）。同理，落在派生子树里的
  **结构变更**（容器重建自己）不再触发全量；真实子节点（`getSerializableChildren()` 声明的）
  增删照旧走全量 —— 为此 `ICEGroup.removeChild` 的镜像钩子**必须发生在摘除之前**（摘除后再问
  "它是不是真实子节点"就分辨不出来了，真子节点的删除会被误判成内部重建）。
- **帧节拍背压 + 帧号水印**。worker 一帧要几毫秒，主线程按 rAF / 交互节奏每毫秒都能发一帧：
  没有背压时 `frame` 消息越排越多，实测一个 30 帧的基准跑完，worker 侧积压 200+ 条
  （`renderedSeq=45` vs `lastFrameSeq=240`）—— 镜像要好几秒才追上，期间画出来的每一帧都是**过时**状态，
  静止态对账还会把它误读成"状态分叉"。现在 `MirrorHost` **至多一帧在途**（"还想画"只记一个标记，
  帧回来立刻补一帧、补的是最新状态）；`frame` 消息带上 `seq`（worker 原样回传），宿主用
  `MirrorHost.renderedSeq` / `MirrorBridge.lastFrameSeq` 这组水印判断"这张位图是哪一帧"。
  `frame` 少了 `seq` 会被 `isMirrorCommand` 明确拒绝（协议尚未发布，故仍是 v1）。

**实测（收紧后的 e2e 断言）**：静止态几何对账 **399/399 逐项相等**（原先 396/399），
worker 位图 vs 主线程源树直绘 **558000 像素 0 差异**（原先约 9%）；改名 / 改类型 / 改位置三步走完
**没有发生任何全量重同步**（场景数 1 → 1）；缩放平移每帧主线程 1.90ms → 1.20ms（省 37%），
拖动单节点 3.20ms → 2.80ms（省 12%），端到端 7.0ms。

### 修复（位置 / 尺寸补丁要让"跟随者"跟上）

- **程序化移动节点时连线不跟随**。引擎只在 `setPosition()` 里派发 `BEFORE_MOVE` /
  `AFTER_MOVE`，而应用层（IED 的属性面板 / 脚本路径）直接写 `setState({left,top})` ——
  鼠标拖拽走的是 `moveGlobalPosition()` → `setPosition()`，所以这个分叉只在程序化改位置时
  表现出来（真实症状：面板改坐标，节点走了、连线留在原地）。引擎侧的契约在
  `ICEComponent.applyPatch` 的注释里写明：**位置 / 尺寸这类"有跟随者"的改动走公开入口**。
  引擎本身无行为变更（没有改 `setState` 的语义），应用侧的修法见 IED 的 CHANGELOG。

### 真实应用验证（ice-entity-designer 流程图 · 2026-09-20）

把 worker 镜像接上 IED 的流程图（200 节点 / 799 组件）实测，顺手挖出并修掉四个"只有真跑起来
才会暴露"的缺陷 —— 每一个都有守卫或回归：

- **几何通道漏了文本绘制成员**：`createGeometryOnlyContext()` 没登记 `fillText` / `strokeText`，
  真实图元一画到文字就抛 `this.ctx.fillText is not a function`（基准场景没有文字，所以一直没暴露）。
  修法：补齐成员，并加一条**源码扫描守卫**（引擎新用一个 `ctx.xxx()` 而桩里没登记就变红）。
- **容器型组件的状态完全进不了镜像**：`ICEGroup.setState` 是**完全覆盖**（语义不同：要把整棵子树标脏），
  不经过 `ICEComponent.setState` 里的镜像钩子 —— IED 的 `FlowNode extends ICEGroup`，于是拖节点、
  改标题在镜像里全都不动（不报错、只是画面不动）。修法：`ICEGroup.setState` 自己补一次钩子，
  并加守卫测试（每个 `setState` 覆盖要么调 `super.setState`，要么自己 `notifyStateChange`）。
- **协议缺视口消息**：编辑器里缩放/平移是最常见的重型操作，不镜像视口两边看的就不是同一片区域。
  新增 `{ t:'viewport', scale, tx, ty }`；同时给 `MirrorBridge.prime()`——**宿主后接上来时**要把
  "当前视口/当前选择"一起发过去，否则新起的镜像从默认视口出发（接上 worker 的瞬间画面会跳一下）。
- **2d 合成没复位画布状态**：`MirrorHost` 用 `drawImage` 贴位图时，主画布的 2d 上下文里可能还留着
  上一个组件的 CTM —— 整张位图被带着变换贴上去，症状是"切回主线程渲染后画面整体缩放了 1.6 倍"
  （用隐藏画布取像素的比对看不出来，那张画布的上下文是干净的）。修法：合成前
  `save + setTransform(单位) + 复位 alpha/composite + clearRect + drawImage + restore`。

**实测数字**（`ice-entity-designer/e2e/worker-mirror.spec.ts`，200 节点 / 799 组件 / 900×620）：
缩放平移每帧主线程 **1.90ms → 1.20ms（省 37%）**；拖动单节点 2.60ms → 2.50ms（省 4%，
引擎自己的静态层/组件位图缓存已经把这类负载吸收了）；worker 内渲染 2.8ms（不占帧预算）；
端到端延迟 **4.7ms**（约一帧）；初始态 worker 渲染与主线程直绘**逐像素 0 差异**（含文字/连线标签）。

**保真边界（重要）**：**镜像的保真边界 = 序列化格式的保真边界**。复合组件的派生子件
（IED 的节点图标 / 连线标签）不进文档，worker 侧重建后 id 与主线程不同，应用层对它们的位置更新
镜像不过去 —— 几何逐项一致（396/399），只有这些子件的视觉细节有差异（像素差约 9%）。
彻底消掉它需要"让派生子件进文档"或"镜像按结构路径寻址"——**上一条已经用第三条路收掉了**
（重放应用层补丁 + 派生件不寻址），这里的数字因此只作"当时的历史记录"。

### 新功能（Worker 镜像 · 阶段二第二块：输入留在主线程 + 工具层镜像）

让真实应用能接上：主线程持有状态、处理输入；worker 渲染。**没有任何"输入消息"** ——
DOM 事件、命中检测、拖拽、控制面板交互本来就只在主线程发生，跨线程转发只会引入两套坐标换算。

- **`MirrorHost`（主线程宿主）**：把「可见画布（显示 + 输入矩形）/ 主线程几何通道 / worker 渲染」
  接起来，含 rAF 节拍、`resize` 同步、`stop()` 还原、`onBitmap` / `onStats` 钩子。
- **几何通道**：`ICE.setPaintTarget(ctx)` + `MirrorHost` 里的 `createGeometryOnlyContext()`。
  命中检测读的是**渲染期的世界盒快照**（`CanvasRenderer.getWorldBox()`），所以主线程必须继续跑渲染
  管线；但不必产出像素 —— 落墨换成一个吞掉绘制调用、只把 `measureText` / `create*Gradient`
  委派给真实上下文的桩，主线程因此只剩几何与簿记（宿主同时关掉主线程的离屏位图缓存）。
- **工具层按"选择"镜像**：控制面板/手柄由 `ICEControlPanelManager` 按目标自己造（`toolNodes` 不序列化），
  两边实例与 id 都不同。所以镜像的是**「面板显示给谁」**：新增公开入口
  `ICEControlPanelManager.applySelection(component | null)`（`mouseDownHandler` 与镜像同步共用），
  经 `selection` 消息推给 worker，由 worker **自己的**面板画出手柄。
  **工具层的状态与结构一律不镜像**（否则主线程手柄的 `setState` 会在 worker 里全是未知 id，
  换来一串 `missing` 与重同步风暴）。
- **节拍**：`frame` 消息仍然由主线程 rAF 驱动；worker 侧 `FrameManager.wake()` 只在有活时跑。
- 参考宿主 `examples/worker/mirror-render.html`（可见画布刻意偏离页面左上角，专门压坐标换算）
  + 回归 `e2e/visual/worker-mirror.spec.ts` 第二个用例：点选 / 拖拽（+60/+40）/ 空点隐藏手柄，
  每一步与主线程参考渲染**逐像素 0 差异**，手柄确实出现在 worker 画面里。

### 新功能（Worker 镜像渲染 · 阶段二第一块：跨线程状态/命令协议）

- **`MirrorBridge`（主线程）+ `MirrorTarget`（worker）+ 协议 v1**，公开导出。
  主线程持有组件树与状态（唯一真相，命中检测也在主线程），worker 持有一棵**镜像树**只负责渲染，
  画面经 `transferToImageBitmap` 回传。
  - 消息：`scene`（全量文档）/ `ops`（`['state', id, patch]` 增量）/ `frame`（节拍）/ `resize`；
    回传 `ready` / `rendered`（含 `renderMs`、组件数、已应用 op 数）/ `missing` / `error`。
  - **v1 边界**：状态走增量补丁，**结构变更走全量重同步**（增删子节点低频，不值得先上子树增量协议）。
  - **不可克隆值的处理**：消息发出前过 `sanitizeTransferable()`，函数 / DOM 节点 / `CanvasGradient`
    这类结构化克隆带不走的值**就地丢弃并记录路径**（`bridge.dropped`），否则 `postMessage` 抛
    `DataCloneError` 会让整帧消息发不出去（症状是"画面卡住不动"）。
  - 采集中在引擎内部四处（`setState` / `addChild` / `removeChild`，`ICE` 与 `ICEGroup` 各一份），
    没装桥时只有一次属性读（`src/worker/mirror-hooks.ts`）。
  - 参考宿主：`examples/worker/mirror-render.html` + `mirror-worker.js`；回归
    `e2e/visual/worker-mirror.spec.ts` —— 六步（位移/换色 / 半径 / 点集 / 加子 / 删子）逐步比对，
    worker 画面与主线程参考**逐像素 0 差异**。
- 顺带导出 `FrameManager`（帧控制器单例）：worker 里没有 rAF，宿主想按主线程节拍驱动时用
  `FrameManager.wake()` 叫醒一次即可（引擎默认「没有脏组件/活动动画就停帧」）。

### 修复（本轮连带抓出的两个"属性改了画面不动"）

- **`ICECircle.setState({ radius })` 只改 state、不改绘制**：`radius` 只在构造函数里被翻译成
  `radiusX/radiusY`，而绘制读的是后者 —— 于是 `state.radius = 40` 而画出来还是 28。
  这个缺陷是 worker 镜像回归抓出来的（镜像按文档重建会走构造函数 → 按 40 画，两边对不上，
  像素差 2655 个）。现在 `setState` 与构造函数同口径映射（`radius` ↔ `radiusX/radiusY/width/height`）。
  回归：`tests/graphic/circle-radius-setstate.test.ts`。
- **（同上一条的排查过程）** 顺带确认：`examples/worker/mirror-render.html` 已纳入示例导航页
  （95 个示例）。

### 性能 / 兼容（Web Worker 成为一等宿主 · worker 路线阶段一）

- **取根改为 `globalThis`**：浏览器 window / **Web Worker self** / Node global 同一个入口。
  改造前是 `window → global` 双探测 —— worker 里两者都不存在，取到兜底空对象 `{}`，
  引擎在 worker 内看不见 `Path2D` / `OffscreenCanvas` / `devicePixelRatio`，形状连一笔都画不出来
  （当年的最小原型只能先 `self.window = self` 伪造全局再 `importScripts`）。
- **`createOffscreenCanvas` 增加 `OffscreenCanvas` 分支**：有 DOM 时仍用
  `document.createElement('canvas')`（要保住 `lang`/`dir` 的字形口径），没有 DOM 时用
  `new OffscreenCanvas(w, h)` —— worker 里因此**离屏层不再静默降级**。
- **回归**：`e2e/visual/worker-perf.spec.ts` 在真机 worker 里断言「宿主没注入 / `root` 就是 `self` /
  形状拿得到原生 `Path2D` / 能建离屏 canvas / 画布真的落了墨」；`tests/cross-platform/root.offscreen.test.ts`
  覆盖三条分支（document 优先 / OffscreenCanvas / 都没有则抛明确错误）。
- **边界（仍未做）**：场景与状态跨线程同步、输入转发、字体与图片下发（worker 内文本字形语言
  与主线程可能分叉）—— 见 `docs/architecture/10-worker-offscreen.md`。

### 变更（破坏性：命令流新增 `roundRect`）

圆角矩形不再由引擎手撸，而是走平台的 `Path2D.roundRect`。**路径命令流里因此多了一个命令名**
（`['roundRect', x, y, w, h, radii]`），凡是从 `component.path2D._commands` 读命令流自行
重放 / 翻译的第三方代码，都要认识这个新命令（引擎自带的 SVG 导出器已支持）。
引擎内部形状、渲染结果与数据格式的其余部分不变。

### 性能

- **圆角矩形改用平台 `roundRect`**（2021 年进入 Canvas 2D 规范）。改造前 `ICERect` 用 4 次 `arcTo`
  手撸（每个角一次 `sqrt/acos/tan/atan2`），现在是一次 `roundRect`：每个圆角矩形的命令流
  **14 条 → 1 条**（1000 个图形 14000 → 1000 条），路径重建 **127.9µs → 88.0µs**（500 个形状，
  1/3 是圆角矩形）。没有原生 `roundRect` 的运行时（老 Safari / 某些 headless 的 Path2D 实现）
  由 `Path2DRecorder` 展开成等价的 `moveTo / lineTo / arcTo`，真机 12 组边角场景实测**逐像素 0 差异**。
  归一化规则（1~4 个半径的补齐、负宽高按视觉角镜像、超限半径等比缩放而非各自截断）只写一份，
  放在 `src/util/round-rect.ts`，记录器与 SVG 导出器共用 —— 两边各写一份必然漂移成
  「画布上是圆角、导出成直角」。回归：`tests/util/round-rect.test.ts`、
  `tests/cross-platform/path2d-recorder.test.ts`、`e2e/visual/round-rect-parity.spec.ts`。

### 修复

- **文本度量被渲染状态污染 → 世界几何随「开/关缓存」变化**（2026-09-20 定位，本轮）。

  症状：缩放视图下「视口变化之后再改内容」时，开离屏缓存的渲染与直接落墨能差到
  **最大预乘差 132/255**（3.0.0 的源码上更差：3781 个差异像素）。查证过程与结论：

  - 先用「只把整棵树标脏、一个字节内容都不改」做触发器，把问题从「缓存重建」二分到「缓存复用」；
  - 缓存位图账本显示所有位图都已是新视口烤的（排除了「陈旧位图」这一假设）；
  - 抄进**最小复现**：单个 `transform: { rotate: 55 }` 的 `ICEText`，先在 scale=1 烤位图、
    再把视口切到 0.62 → 355 像素不一致（最大 221/255）；逐步打印发现同一组件的
    **世界包围盒在重建时变了**（高度 16.916 → 13.096）。
  - 真因：canvas 的 `actualBoundingBoxAscent/Descent` 是**相对当前 `textBaseline`** 报告的 ——
    `alphabetic` 下 `rotated`（18px Arial）是 12.885 / 0.211，`bottom`（引擎默认）下是
    16.916 / **-3.820**。引擎按「上=ascent、下=descent」拼盒高，负的 descent 被 `Math.max(0, …)`
    丢掉，于是盒高多出 3.82px；而**量到哪条基线取决于量测发生在哪一帧、在哪个通道**（主画布 /
    缓存位图 ctx），所以同一个组件的世界高度会随缓存开关变化。旋转文本只是最容易撞上的形状。

  修复：`ICEText.__measureByCanvas()` 量测期间把 ctx 归到基准态（单位变换 + `alphabetic` 基线），
  量完原样还原。修后最小复现 **0 差异**，夹具里的病态差异从 132/255 降到 3（即文档里那条
  8-bit 预乘取整噪声），文本盒高与本机 canvas 的真实墨迹高一致。回归：
  `tests/graphic/text-measure.test.ts`、`e2e/visual/offscreen-cache-fidelity.spec.ts`。

- **`style.filter` 漏出内容指纹**（`ObjectCache.__styleKey`）。`filter` 走的是「style 透传给 ctx」
  这条既有通道，会被烤进离屏位图；指纹里没有它，改滤镜时会继续贴旧位图（属性改了画面不动）。
- **`ctx.filter` 的落墨外扩量算错单位**。模糊/投影的墨迹会溢出几何盒，位图与脏矩形都要扩边，
  但**滤镜的长度参数是设备像素、不随视图缩放**（实测 `blur(8px)` 在 `setTransform(1 / 0.62 / 0.5)`
  下溢出恒为 18~19 设备像素，与随变换缩放的 `stroke` / `shadowBlur` 相反）。改为
  `stylePaintPad(state, scale)` 把滤镜那部分按渲染视口缩放换算回世界坐标后，缩略视图下不再切掉尾巴
  （改造前 scale=0.62 时 `drop-shadow` 差 118 像素、`blur(8px)` 差 76 像素，现在严格 0）。
  同时把带滤镜的组件按「非不透明落墨」处理（边界像素半透明、墨迹溢出几何盒 → 不参与局部重绘，
  与阴影同一档）。回归：`tests/graphic/style-filter.test.ts`、`tests/renderer/dirty-rect-util.test.ts`、
  `e2e/visual/filter-cache-fidelity.spec.ts`。
- **微基准 `路径重建 · 只转发不记录（对照）` 的对照组失效**：`createPathObject()` 第一句就是
  `this.path2D = root.createPath2D()`，原先塞进去的 `ForwardOnlyPath2D` 下一行就被覆盖，
  两个基准测的其实是同一件事（差值只是噪声）。改为换掉工厂（`global.createPath2D`）后才量得准：
  记录的边际成本 ≈ 156ns/形状（≈11ns/命令）。

### 文档

- `docs/architecture/08-compatibility.md` 增补「现代 Canvas 能力：用哪些、兜底是什么」——
  `roundRect` / `ctx.filter` / `createConicGradient` / 文本状态已采用，`OffscreenCanvas + Worker` /
  `ImageBitmap` / `ctx.reset()` 未采用（各写了理由与后续条件），并记下两个坑：
  滤镜长度是设备像素、新命令必须有导出映射。

## [3.0.0] - 2026-09-20

> ⚠️ **破坏性：不再支持小程序**（2026-09-20，分支 `remove/mini-program-support`）。
> 目标运行时收敛为**现代浏览器 + Node/headless**。小程序接入方留在 2.x（或自行维护适配层）。

### 变更（破坏性：移除小程序支持）

删掉的都是为"小程序形状的运行时"而存在的东西：

- `cross-platform/root.ts` 的 `wx.*` 分支：`loadFont` / `createImage` / `devicePixelRatio` /
  `createOffscreenCanvas`（浏览器与 headless 的路径不变）；
- **无原生 `Path2D` 时的命令重放**与 `PolyfillPath2D`（连同 `ICEPath.replayPath()`）。
  没有原生 `Path2D` 的运行时不再支持上屏；命令流本身照旧（SVG / 服务端出图、形状断言）；
- 「小程序形状」回归夹具 `tests/mini-program/`（摘掉 `document`/`window`/`Path2D`/`rAF`/`FontFace`/
  `OffscreenCanvas`、只留 `wx.*`，并对 Canvas 2D 成员做白名单越界检查）与宿主适配示例
  `examples/mini-program/`；
- README / 文档站里"小程序是一等公民"的承诺、接入指引与跨平台章节（`08-compatibility` 重写为
  「浏览器 + Node/headless」）。

**保留**（不是小程序专属，删了会伤浏览器或服务端出图）：`root` 适配层本身、
无 rAF 的定时器兜底（Node / headless）、`Path2DRecorder` 的命令流、离屏 canvas 缺失时的缓存降级、
`ICE.init(ctx)` 入口、指针/触摸输入归一化（老浏览器仍在用）。

**顺带解绑**：`worker + OffscreenCanvas` 路线原先专门写了"小程序线程模型不同 → 不做"的排除理由，
现在随之消失（见 `docs/architecture/10-worker-offscreen.md` §6）。

回归：引擎 `verify:full` + 家族全量（chart / web-components / entity-designer / game /
smart-water / agent-console 等）单测与 e2e。

### 性能

- **按需派发：没人听的事件名整段早退**（2026-09-20，分支 `perf/dispatch-and-bench`）。

  一次原生指针输入会被派发两个名字（原生名 `pointermove` + 兼容名 `mousemove`），而通常只有一个
  有人听 —— 引擎自己的默认处理器挂在鼠标名上，应用要么用鼠标名（老代码）要么用指针名（新代码）。
  没人听的那一次以前要白跑「祖先链数组 + 每层 `trigger` + 总线触发」。

  实测（`bench/micro/event-dispatch.bench.mjs`，Apple M 系 / node 25）：
  一次完整派发 **9.75 µs**（约 5.9 KB 分配），早退 **3.3 ns**；
  典型 `ICE_POINTERMOVE` 全链路 **12.0 µs**（改造前还要多一次 9.75 µs 的完整派发）。
  指针移动是每帧级高频，拖动/悬停因此省掉一半派发与相应 GC 压力。

  实现：`src/event/listened-event-names.ts` 的单向登记表（`ICEEventTarget.__register` 写入）+
  `DOMEventDispatcher.__dispatch` 入口判定。**只增不减是刻意的**：摘除路径有 `off` /
  `purgeEvents` / `once` 自摘 / `signal.abort` 四条，漏一条就会"有人听却不派发"；
  而多一次空派发只是幂等白跑。

  回归：`tests/event/dispatch-on-demand.test.ts`（5 条）+ 三条新基准（已入 baseline）。
  对使用者**不可观测**（没人听的名字本来就没有接收方），所以没有破坏性口径。

## [2.20.0] - 2026-09-19

> ⚠️ **行为变化（本仓约定：不用 `!` 标记，写在下面这一小节）**：`evt.target` 不再可能是 DOM 元素
> —— 事件来源显式化为 `evt.source`，原始 DOM 元素请到 `evt.originalEvent.target` 取。

### 变更（破坏性：事件身份字段契约）

- **`evt.source` 与 `evt.target` 契约**（2026-09-19，分支 `feat/event-source-and-target-contract`）：
  把"事件从哪来"显式化，消掉两个使用者一定会撞的坑。

  ⚠️ **行为变化**：`evt.target` 不再可能是 DOM 元素 ——
  以前 `new ICEEvent(原始 DOM 事件)` 会把 DOM 事件的 `target` / `currentTarget` / `srcElement` /
  `eventPhase` 一起平铺进来，于是"画布外点工具栏按钮"的事件上 `target` 是 `HTMLButtonElement`，
  应用只能靠 `instanceof ICEComponent` 去猜；而 `eventPhase` 出现同一字段两种含义
  （命中组件的路径在组件链末尾归零、总线看到 `0`；没有命中组件的事件沿用 DOM 的 `BUBBLING_PHASE(3)`）。
  现在：

  - **`evt.source`**：`'canvas'`（画布内的原始输入，可能有命中组件）/ `'window'`（画布外的原始输入，
    没有命中组件）/ `'engine'`（`trigger()` / `dispatchEvent()`）。应用只关心画布内交互时，
    一句 `if (evt.source !== 'canvas') return;` 就够了；
  - **`evt.target`**：要么是命中的组件、要么是 `null`；原始 DOM 元素在 `evt.originalEvent.target`；
  - **`evt.eventPhase`**：总线那一段恒为 `0`（总线是传播终点，不在任何传播段里）；
  - 顺带把 `ICEEvent` 上"声明了却没有默认值"的 W3C 字段补齐（`srcElement` / `isTrusted` /
    `composed` / `cancelBubble` / `returnValue`）—— 以前只有从 DOM 事件拷到值时才有值。

  ⚠️ **已知行为（本次不改）**：画布外的输入仍会做命中测试（坐标按画布矩形换算，可能恰好落在画布内
  并命中组件，表现为"点工具栏按钮顺带选中画布元素"）。归属已由 `source` 给出，应用过滤即可；
  "画布外输入要不要干脆不做命中"是语义级决策，留待单独评估。

  回归：`tests/event/event-source.test.ts`（8 条；改动前 7 条红，第 8 条"应用转发改写 `evt.target`"
  改动前后都绿——它是控制项）。

## [2.19.0] - 2026-09-19

> 这一版把「容器与它的内容」的绘制次序补完整：**容器的派生部件（自己的底 / 标题 / 角标）永远画在
> 自己的内容之下**（CSS 的背景语义），并且**四个 z 序 API 只作用于真实子节点**。
>
> ⚠️ **行为变化只影响声明了 `getSerializableChildren()` 的复合组件**（截至目前只有
> ice-entity-designer 的流程图 / BPMN 节点与池、状态机的复合状态）；**没有该钩子的组件行为逐字不变**。
> 应用侧从这一版起可以删掉"给容器的底写一个比内容更低的 `zIndex`"那种魔数 —— 引擎给保证了。

### 变更

- **容器的派生部件先于内容绘制**（2026-09-19，分支 `fix/reorder-scope-and-derived-paint-order`）。

  背景是两个真实事故（ice-entity-designer 的示例，2026-09）：**BPMN 池里的任务矩形全部消失**
  （只剩连线和文字）、**状态机的复合状态变成一个空框**。

  根因：复合组件（`hasDerivedChildren() === true`）把自己的底 / 标题 / 角标也挂在 `childNodes` 里
  （形状由子组件绘制是刻意的 —— 菱形 / 事件圆 / 圆角框都靠它），而渲染顺序铁律是
  「树序 + 兄弟按 `zIndex`」。于是**容器的底和容器里的内容是同层兄弟**：池的底是默认 `'auto'`（0）、
  泳道是 `-20000` → 泳道连同泳道里的全部节点先画完，池的底最后盖上来，整段内容被自己的底色吃掉。
  实测把引擎换回 2.12.3（渲染顺序改版之前）画面正常、2.13.0 起逐帧一致 —— 属既有 z 序口径与新
  渲染顺序错配，不是信号问题也不是示例写错。

  现在：`util/data-util.ts` 的 `paintOrderChildrenOf(container)` 把一层的子节点排成
  「**派生部件（按 z 升序）→ 真实子节点（按 z 升序）**」。应用侧不用再猜"多低才算够低"。
  ⚠️ 递归展平时**不能**把这个分组结果再按 zIndex 洗一遍（分组次序不是 zIndex 升序），
  因此 `flattenTree` 拆出了内部函数 `flattenOrdered`；`SvgExporter.collectOrdered` 同源改口径
  （渲染队列 / SVG 导出 / 命中检测三者必须同源）。

- **四个 z 序 API 的作用域收窄到"真实子节点"**（`bringToFront` / `sendToBack` / `moveUp` / `moveDown`）。

  派生部件不是文档内容：被重编号会把容器内容盖掉，而且组件重建即复位（改了也留不下来），
  纯噪声。现在作用域由 `siblingScopeOf(container)` 给出 = `getSerializableChildren()` 声明的那些；
  没有该钩子的容器行为不变。实测（状态机示例）：复合状态的框不再在子状态 `sendToBack()` 之后压住它。

- **对外导出 `paintOrderChildrenOf`**：与 `sortSiblingsByZIndex` / `zIndexOf` / `zIndexForPaintRank`
  并列的"排序口径"公开出口，让应用与测试能**在无头环境断言真实绘制次序**（不必起浏览器）。

### 回归

- 单元：`tests/renderer/derived-children-paint-order.test.ts`（9 条，修复前 8 条红）——
  底排在内容之后仍先画、纯容器行为不变、分组内各自按 z、池→泳道→节点三层嵌套、
  四个 API 不动派生部件的 `zIndex`、派生部件自己调用是空操作、SVG 导出与画布同源。
- 真机像素：`e2e/visual/render-order.spec.ts` 新增「三层嵌套下底 `zIndex` 更大也先画」，
  配套 `examples/render-order/tree-order.html` 的第三组；改动前的引擎上这条报
  `Expected "#198754" Received "#0d6efd"`（任务被池底盖住）。
- 家族全量：12 个包（chart / chart-dsl / web-components / web-components-dsl / entity-designer /
  entity-designer-dsl / render-dsl / smart-water / game / agent-console / doc / react-demo）
  指向本版引擎跑单测 + e2e，全绿。

## [2.18.0] - 2026-09-19

> ⚠️ **破坏性：事件传播语义改版**。事件开始沿组件树冒泡（命中组件 → 各级父容器 → 总线），
> 且 `ICEEvent` 的 W3C 方法从「调用即抛异常」变成**真生效**。上游要改的三件事：
> ① 容器的 click 处理若只想认「点在自己身上」，加 `evt.target === this` 守卫；
> ② 跨组件转发事件时把 `evt.target` 改成目标组件；
> ③ `preventDefault()` 现在会真的阻止原始 DOM 的默认行为（原来会抛异常）。

### 变更（破坏性：事件系统语义）

- **事件沿组件树冒泡 + `ICEEvent` 的 W3C 方法真实现**（2026-09-19，分支 `feat/event-system`）。

  改版前的事实（探针实测）：`ICEEvent.prototype.preventDefault / stopPropagation /
  stopImmediatePropagation / composedPath / initEvent` **全是 `throw new Error('Method not implemented.')`** ——
  应用里一调用，异常就从监听器里冒出去，**后面的监听器与总线都收不到事件**；
  而且组件之间**没有冒泡**（只有"命中组件 + 总线"两站），父容器拿不到子组件上的事件。
  下游为此各写各的绕过：`ice-chart` 专门写了"只对原始 DOM 事件调用 `preventDefault`"的注释与封装，
  `ice-web-components` 里则留下若干"在面板自己身上再 `stopPropagation` 一次"的写法 ——
  既无效（没有冒泡可阻止），又危险（真调下去就炸，而 `typeof === 'function'` 的守卫**拦不住它**）。

  改版后：

  - **传播路径**：命中组件（`AT_TARGET=2`）→ 各级父容器（`BUBBLING_PHASE=3`）→ **总线最后收一次**；
    `evt.target` 恒为命中组件，`currentTarget` 随节点走，`composedPath()` 给出祖先链。
  - **`stopPropagation()` 只挡祖先**；`stopImmediatePropagation()` 连当前目标剩下的监听器也跳过；
    ⚠️ **总线仍然收到一次** —— 它是引擎内部通道（控制面板选中 / 连线插槽 / 悬停 / 键盘作用域），
    被组件里的一次 `stopPropagation()` 掐掉会变成"看着只挡冒泡、实际引擎失灵"。
  - **`preventDefault()`**：只有 `cancelable === true` 才生效，置 `defaultPrevented`，并顺手调用
    原始 DOM 事件的 `preventDefault()`；引擎自造事件上 `bubbles / cancelable / defaultPrevented /
    eventPhase` 不再是 `undefined`。
  - **同一个 `ICEEvent` 一路传到底**（不再层层包）：否则上一个监听器打的标记会落在副本上
    （冒泡/取消永不生效），`param` 也会被覆盖成 `{}`（"组件路径看不到 param"就是这个原因）。
  - **构造函数平铺字段时不覆盖本类方法**（`NON_COPYABLE_KEYS`）：普通对象做的事件桩上的
    `preventDefault` 是可枚举 own 属性，拷进来就会盖掉真实现（真实 DOM 事件的方法在原型上、不可枚举，
    所以旧实现没暴露这个坑）。
  - **API**：`on / once / off / suspend / resume / purgeEvents` 一律返回 `this`（可链式）；
    `off(name)`（不传回调）清空该事件的**全部**监听；`addEventListener(type, fn, { once })` /
    `removeEventListener` / `dispatchEvent(event)` 改成**签名正确的真方法**（旧实现是把
    `on/off/trigger` 挂过去，第三参被当成 `scope`、`dispatchEvent` 收事件对象却当成事件名）；
    `ICEEvent` 与 `ICE_EVENT_NAME_CONSTS` 之外，**`ICEEvent` 类本身也对外导出**了。
  - **两套 API 是同一个实现、两种参数形状**（这是本轮明确收口的目标）：
    `on(name, fn, scope?, options?)` 与 `addEventListener(type, fn, options?)` 共用同一份
    `__register` / `__remove`；`off` 按 `(fn, scope)` 精确匹配、`removeEventListener` **忽略 scope**
    （W3C 身份 = `(type, listener, capture)`）；`dispatchEvent` 按 W3C 返回 `!defaultPrevented`。
    `options` 支持 `{ once, passive, capture, signal }`：`passive` 监听器里 `preventDefault()` 不生效
    （按事件名提醒一次，别静默）、`capture` 只作注册身份（引擎无捕获阶段）、`signal` abort 自动摘除；
    `listener` 可以是函数或 `{ handleEvent }` 对象。`once` 改成**监听记录上的标记**
    （不再是"自摘包装函数 + `__onceOriginal`"那套双身份），`off/hasListener/removeEventListener`
    因此用**同一个身份**匹配。引擎自造事件的 `timeStamp` 改用**单调时钟**（`performance.now()` 时间原点，
    旧实现是 `Date.now()` 墙钟）。
    回归：`tests/event/api-consistency.test.ts`（9 条：交叉注册/移除、`once` 等价、`{handleEvent}`、
    `capture` 身份、`passive` 屏蔽 + 提醒、`signal` 摘除、`dispatchEvent` 返回值、单调时间戳）。
  - **连带修掉的两处"冒泡副作用"**（都是这次实测发现的）：
    ① `TransformControlPanel.keyboardEvtHandler` 把键盘事件**转发**给选中组件时没改 `evt.target` ——
    新引擎的默认键盘处理带 `evt.target === this` 守卫，转发过去会被当成"冒泡上来的祖先事件"丢掉，
    表现为"选中组件后用手柄按方向键没反应"。现在转发前改写 `target`（回归：`tests/control-panel/transform-control.test.ts`
    的"转发时改写 evt.target"，无修复时该用例直接红）。
    ② 容器的 click 处理若只想认"点在自己身上"，要用 `evt.target === this` 守卫（新引擎里子节点点击会冒泡上来）——
    这条约定写进了 [05 事件系统](docs/architecture/05-event-system.md) 与 `AGENTS.md`；
    下游 `ice-web-components` 的模态遮罩 / 悬浮按钮 / 下拉选择器 / 图片预览遮罩共 5 处按这条收口
    （守卫在 2.17.0 上也成立，跨版本安全）。
  - **事件名与事件对象有了类型**（应用层一致性收口）：`ICE_EVENT_NAME_CONSTS` 改 `as const`，
    新增 `event/event-types.ts`（`ICEEventName` = 内置事件 + DOM 语义事件、`ICEEventOf<K>`、
    `ICEEventParamMap` 事件名 → `evt.param` 形状、`ICEEventListenerOptions`），
    `on / once / trigger` 加重载：写引擎名/DOM 语义名时回调里的 `evt` 有类型
    （`evt.param.component`、`evt.offsetX` 都能过编译），写自定义事件名回退 `any`；
    `ICEEvent` 补齐归一化输入字段声明。
    ⚠️ 载荷仍分两处（`evt.param` 与「事件对象字段」，后者是变换类事件的历史写法），
    类型表**如实反映**、未强行统一 —— "全部走 param"是行为变更，等有需要再做。
  - **门禁补一条**：`tests/**` 原本不在 `tsconfig.json` 的 `include`（只有 `src`）里，
    新增的 `tests/types/event-names.ts` 类型断言本来是**死的**（实测：断言写错也不报错）。
    新增 `tsconfig.typecheck.json` 把 `tests/types` 纳入，`npm run types:check` 现在跑两份；
    配套的家族侧替换（引擎事件名改用常量）见各仓提交。

  ⚠️ **下游需要跟着改**（本版未一并改，列在这里以免漏）：`ice-web-components` 里
  `ICEModal` / `ICEDrawer` / `ICETour` / `ICETable` / `ICEKeyScope` 那几处对 **ICEEvent** 调
  `preventDefault` / `stopPropagation` 的地方，现在**从"会抛异常"变成"真的生效"** ——
  语义变强了，但意图要复核（尤其"阻止冒泡到遮罩"这类，冒泡实现之后才真正成立）；
  `ice-chart` 的 `InteractionController.preventDefault` 绕过可以删掉。

  回归：`tests/event/bubbling-and-w3c.test.ts`（14 条：W3C 方法 / 冒泡顺序 / `stop*` 语义 /
  总线不受影响 / composedPath / 别名与链式 / `off(name)` 全清）、`docs/architecture/05-event-system.md`。

## [2.17.0] - 2026-09-19

> ⚠️ **这一版有两处破坏性变更**：默认 `zIndex` 的语义改版（`'auto'` 哨兵 + 重排 API 收窄）
> 与**序列化格式升到 v2**。旧引擎读不了 v2 文档（会明确报「不支持的反序列化版本」，
> 而不是画错）；v1 文档在本版本载入时会**自动迁移**（绘制次序逐项不变）。

### 变更（破坏性：默认 `zIndex` 语义 + 序列化格式 v2）

- **`zIndex` 改成 CSS 口径：默认值是 `'auto'` 哨兵（`Z_INDEX_AUTO`），排序时当 `0` 用 ——
  就是 `z-index: auto` 那一档**（2026-09-19）。
  同层没显式写过 `zIndex` 的兄弟**彼此相等**，次序退化为**加入顺序** —— 后加入的默认画在最上面；
  **显式写的值是一视同仁的钉子**：`-n` 压到 auto 层之下（背景），`+n` 抬到 auto 层之上（浮层）。

  这一改**删掉了"构造顺序计数器"**（`ICEComponent.instanceCounter`）以及配套的计数器同步，
  连带消灭了它带来的两类问题：

  - **跨会话倒挂**：打开一份"元件比较多"的文档（zIndex 已到 198~200）后新建组件，新会话的计数器
    还在个位数，新建的拿到 4 → **画到已有内容下面**（症状是"新建的图元看不见"）；
  - **"写死一个 zIndex 表示在最上层"不可靠**：计数器是**进程级、跨 ICE 实例共享**的，默认值会
    一直涨 —— 同一个场景在两个实例里的默认值实测是 18~25 vs 109~116，写死的 `zIndex: 90`
    在一边压得住、在另一边压不住（这条把 `dirty-rect-pixel` 像素用例打红，才被挖出来）。

  ⚠️ **代价（有意为之，CSS 同义）**：显式钉了正数的兄弟会盖住**之后新加入**的 auto 组件。
  要"永远在最上面"就用工具层（`ice.addTool`，工具层整体在组件层之上）或 `bringToFront()`。
  ⚠️ **数组次序语义不变**：`childNodes` 仍是加入顺序，绘制次序看 `zIndex`。

  另：`zIndex >= 1e7`（`BIG_ZINDEX_NUMBER`）不再是"组件层别用的保留号段"，它只是**工具层自己**
  的编号；组件层写多大的数都压不住工具层（两层是两条独立队列，本来就不比较）。

- **四个 z 序 API 不再改写应用自己钉的正数**（`bringToFront` / `sendToBack` / `moveUp` / `moveDown`）：
  它们的作用域收窄到同层的**可排层**（排序键 ≤ 0：`'auto'` 默认值与负值），应用钉成正数的兄弟
  （浮层 / 水印 / 吸顶条）不参与、值也不会被改写。旧实现"整层重编号"会把钉子一起洗掉 ——
  表现为"置顶一次，浮层就掉到下面去了"。目标自己被钉住时按退化规则处理：
  `bringToFront` → `max+1`；`sendToBack` → `min-1`；`moveUp/moveDown` → 只在正数钉子之间交换数值。
  回归：`tests/graphic/z-index-order.test.ts`（钉子不被改写 / 目标即钉子 / 钉子间换位 / 不越档）。

- **序列化格式升到 v2，并附一条 v1 → v2 的 `zIndex` 迁移**（**旧文档必须走这条迁移**）：
  同一个数字在 v1 / v2 里含义不同 —— v1 的 `zIndex` 是"构造顺序计数器"留下的数字，v2 把它当
  **应用自己钉的正数**。不做迁移的后果是实测复现过的：打开旧文档（`198~200`）后新建组件，
  **新建的会沉到最下面**（v1 时代那个"新建的图元看不见"换个入口回来）。
  迁移对**每个兄弟组**按 v1 口径排出绘制次序、再按 v2 口径重编号成 `-(m-1) … 'auto'`：
  **次序逐项不变**，最上层落回 auto 层，于是"新建的仍在最上面"这条承诺继续成立；
  整组本来全是 0 / 没写时不动它。⚠️ 代价（有意为之）：v1 文档里"钉在 9999 的浮层"迁移后
  落回 auto 层、不再有钉子效力 —— v1 本来也没这个保证。
  ⚠️ 另外：格式升到 v2 之后，**2.16.0 读新文档会明确报「不支持的反序列化版本」**，而不是拿到
  `'auto'` 按数字比较（NaN）静默乱序 —— 宁可拒绝也不画错。
  回归：`tests/persistence/zindex-v2-migration.test.ts`（5 条：旧文档次序不变 + 新建仍在最上 /
  乱序也保持 / 全 auto 不动 / v2 文档不迁移 / 版本号抬到最新）。

### 新增

- **z 序操作 API**：`ICEComponent` 的 `bringToFront()` / `sendToBack()` / `moveUp()` / `moveDown()`
  （都返回 `this`，可链式）。作用域是**同一个父容器**（与"`zIndex` 只在兄弟之间比较"同源），
  实现是把同层重编号成 **`-(n-1) … 'auto'`（最上面那个落回 auto 层）** —— 所以**平手**（多个组件
  `zIndex` 相同、次序由加入顺序决定）时也挪得动（这是"自己加一减一"做不到的），
  而且**置顶之后新加入的组件仍然画在最上面**（auto 那一档按加入顺序，新加入的最后画）。
  口径唯一出处 `util/data-util.ts` 的 `zIndexForPaintRank`。回归：`tests/graphic/z-index-order.test.ts`。
- **控制面板手柄尺寸可配置**：
  `ICE.init(ctx, { controlPanel: { resizeControlSize, rotateControlSize, rotateControlOffsetY, lineControlSize } })`。

  这四个尺寸原本是写死在 `TransformControlPanel` / `LineControlPanel` 里的私有字段
  （代码里挂着 `//TODO:改成可配置参数`）：16 / 8 / 60 / 16。触摸端要大一点的控点、
  密集图纸要小一点，宿主此前只能改引擎源码。现在按构造参数传，默认值不变，
  **非法值（0 / 负数 / NaN / 非数字）一律退回默认** —— 配错的症状会是"手柄看不见也点不中"，
  那种失败比"配不上"难查得多。

  回归：`tests/control-panel/control-panel-options.test.ts`（默认值 / 构造可配 /
  `ICE.init` 透传 / 非法值退回，四条都验到"手柄真的按配置建出来"，不只是字段被赋值）。

### 文档

- `ICEVisioLink` 的构造参数**补全了文档**（`escapeDistance` / `linkShape` / `links` /
  `arrow` / `style.label.offset` 等，原本只有一句 `FIXME`）。
- `BIG_ZINDEX_NUMBER`（1e7）的注释改成它**真实**的语义：它**不是**"比所有组件都大"的全局
  最大值，而是**工具层内部**的排序号段 —— 工具层与组件层是两条独立队列，组件层写再大的
  `zIndex` 也压不住工具层。[02 组件模型](docs/architecture/02-component-model.md) 与
  [04 渲染](docs/architecture/04-rendering-performance.md) 同步：补保留号段约定、
  补"数值变了 ≠ 次序变了"这条队列缓存判据及其实测数字。
- 「默认 `zIndex` 语义改版」相关的文档一次改齐：[02 组件模型](docs/architecture/02-component-model.md)
  的「容器与 `zIndex`」一节（0 = auto 层 / 正负钉子 / 四个 API 的编号口径）、
  [04 渲染](docs/architecture/04-rendering-performance.md)（渲染顺序铁律的判据来源）、
  [06 序列化](docs/architecture/06-serialization.md)（默认不写、显式原样写），
  以及 `AGENTS.md` 的 zIndex 契约块（含"别再把计数器修回来"的原因）。
- [07 交互与动画](docs/architecture/07-interaction-animation.md) 补了「正交路由怎么算」一节：
  候选 → 三道过滤 → 避障 → 打分，连同那条案例数据（24 处穿线 → 0）和两个踩过的坑。
- [09 路线图](docs/architecture/09-roadmap.md) 的「连接线」一行补上 2.15.0 的标签偏移与
  2.16.0 的避障；README 的 `ICE.init` 选项处补上 `controlPanel`，连接线一节补上避障。
- `AGENTS.md` 的「已知技术债」复核：TODO/FIXME 由 23 处降到 **9 处**，
  「尺寸/样式可配置」那批已做完，实质缺口只剩两条（控制面板按类型选工具、斜切手柄）。

### 修复

- **`addChild(child, false)` 会把同帧的待重绘清掉**（`ICE.addChild` / `ICE.removeChild` /
  `ICEGroup.addChild` / `ICEGroup.removeChild` 四处）：这几处写的是 `this.dirty = markDirty`
  （`ICEGroup` 那两处是 `this.ice.dirty = markDirty`）——**赋值**，而参数语义是"**不要主动置脏**"。
  后果是批量装子件（`addChildren` 内部走 `addChild(x, false)`）时，把同帧里已经攒下的重绘一起丢掉，
  表现为"这一帧该重绘却没绘制"（实测：`ice.dirty = true` 之后 `group.addChild(c, false)`，
  `ice.dirty` 变成 false）。改成只置真、不置假；`ICEComponent.__applyDirty` 同步收紧为
  `this.dirty || markDirty || !__everRendered`（从未渲染过的组件必须保持脏）。
  回归：`tests/renderer/CanvasRenderer.queue.test.ts`（不清脏 + 队列仍含新子件）。

- **存盘时 `zIndex` 的写法收敛成一条规则**（**数据格式的写法变了**，读旧数据不受影响）：
  **默认值（0）不写、显式值原样写**（`Serializer.__encodeChildren`）。旧的"归一化成 `0..n-1`"
  随计数器一起废掉 —— 它会把应用刻意钉住的浮层值（如 `zIndex: 9000`）改写成小整数，
  把"钉住"这件事丢掉。现在文档里写的就是次序本身；读回时子节点按文件顺序构造（= 加入次序），
  **往返之后绘制次序逐项不变**。读旧数据不受影响（`zIndex` 本来就是可选字段）。
  回归：`tests/graphic/z-index-order.test.ts`。

- **连接点碰撞检测不再自己"全局按 zIndex 排序"**：`ICELinkSlotManager` 在 `flattenTree` 的结果上
  又排了一遍**全局** zIndex，等于把"树序 + 兄弟按 zIndex"退回旧的全局语义 —— 父容器会因为
  zIndex 更大被判成"比子组件更上层"（实测：`group(z=9)` + `child(z=5)` 时命中 group，
  与真实绘制/点击语义相反）。现在直接用展平结果（它已经是绘制次序），"后者覆盖前者"即
  "z 序最高者胜出"。回归：`tests/link/link-slot-collision.test.ts`。

- **离屏层跟随主画布的文本语言（`lang` / `dir`）**：同一个汉字有简/繁/日/韩多套字形，
  Canvas 按元素的**语言**选字形 —— 而引擎对静态层与组件缓存承诺"与主画布**逐像素一致**"。
  宿主在主画布上显式写了 `lang` 之后，那两个离屏层此前不跟随，字形会分叉：差异只有几个像素，
  肉眼几乎看不出，却会让像素回归在最不该红的时候红。

  改法：`root.createOffscreenCanvas(w, h, sourceEl)` 多一个可选参数，从主画布镜像 `lang` / `dir`；
  静态层与组件缓存两条路径都把主画布传下去。**兼容性**：`lang` 是 2025 年才进
  CanvasTextDrawingStyles 的属性（Chrome 136+，Safari / Firefox 至今没有），所以只做"把属性写上"，
  不支持的运行时自然忽略；小程序 canvas 是宿主对象、赋值可能抛错，捕获后跳过，绝不影响渲染。
  回归：`tests/renderer/offscreen-text-lang.test.ts`（镜像行为 + 两条渲染链路 + 宿主对象降级）。

- `ICEVisioLink.lineIntersectsLine()` 改用**参数方程**判线段相交（`p + t·r` 与 `q + u·s`），
  替掉原来的"竖×竖 / 竖×斜 / 斜×斜"三支轴向特判 —— 分支更少，且共线重叠对**任意方向**都成立
  （旧实现只覆盖轴向与同斜率两种）。

  ⚠️ **行为口径不变**：交点判定仍然走 `GeoLine.contains()`（带 3px 容差，"几乎贴到"也算相交）。
  这条容差是承重的 —— 正交路由靠它把"线贴着图元边框走"判成穿越，换成精确比较会让一批
  本该绕开的走线悄悄贴着边框过去。回归逐条钉住口径：真交叉 / 端点相接 / 共线重叠（横竖斜）/
  平行不相交 / 贴边容忍，见 `tests/link/visio-link-obstacle.test.ts`。

- 清掉三条**已经过期**的 FIXME 注释（行为与回归都在，只是注释没跟上）：
  `ICEComponent.destory()` / `ICEGroup.destory()` 的「立即停止组件上的所有动画」
  （实现里早已把组件从动画管理器摘除，回归在 `tests/animation/animation.extended.test.ts`）；
  `DOMEventDispatcher` 的「控制面板会遮挡组件」（2026-09-08 命中检测已跳过 `isControlPanel`，
  回归在 `tests/event/DOMEventDispatcher.test.ts`）。

### 性能

- **改 `zIndex` 不再无条件重建渲染队列**：以前只要 zIndex **数值**变了就整队重建
  （重新 `flattenTree` 整棵树 + 每个父容器各自排序）。但"数值变了、次序没变"是常见的一类
  （批量把一批子件重写成同一组值、动画缓动 zIndex 但没跨过邻居）—— 这时整队重建纯属白干。
  现在先花一次 O(n) 判断"队列在每个父容器内是否**已经**有序"（判据用展平时写下的 `_level`/`_pid`，
  只比相邻同组节点，无 Map、无分配），有序则只刷新快照；次序**真**变了才重建。
  实测 10000 组件：稳态帧 0.20ms、改 1 个 `left`（对照）0.93ms、改 1 个 `zIndex` 但次序不变
  1.26ms（**零次整队重建**）、改 `zIndex` 跨过邻居 1.37ms（整队重建 0.69ms）。
  判序那一步本身也从 0.41ms 降到 0.28ms（旧写法按 pid 建 Map，真帧里要遍历 1 万个分散在堆上的对象，
  是内存访问的代价）。
- 无障碍树（`buildAccessibilityTree`）的同级排序**改用引擎里那一份** `sortSiblingsByZIndex`，
  不再各写一套"按 zIndex 升序"的比对 —— 顺序规则只有一处出处。

## [2.16.0] - 2026-09-18

### 修复

- **正交路由避障：连线不再横穿图元**（`ICEVisioLink.interpolate()`）。

  改之前，`interpolate()` 的"不相交"过滤只认**两端自己**的包围盒（`startBounding` /
  `endBounding`）—— 走廊里挡着的第三个图元它一无所知，于是密集布局里必然出现
  "线从方块中间穿过去"。给排水工艺图（78 图元 / 37 条管线）实测 **24 处穿越**。

  现在的算法：① 收集走廊（两端点矩形外扩 28px）里的图元当障碍，只认**图元本体**
  （`hasDerivedChildren()` 声明的内部零件不算，否则位号/名称那几十个文字盒会把障碍清单占满）；
  ② 按障碍逐个补"绕到它外侧"的候选，绕不开时再按**挡路图元的并集**补一轮（一条线要横穿一整排时用）；
  ③ 打分改成"零穿越优先，退而求其次取穿越最少"，且这一步排在"取点数最少的那一档"**之前**
  —— 否则一条更短但穿方块的候选会先把零穿越的淘汰掉。

  ⚠️ 两个埋过的坑写在代码注释里：`getMinBoundingBox()` 未渲染时读的是空矩阵、算出来全是 NaN
  （必须 `refresh = true`，与 `getMaxBoundingBox(true)` 同口径）；障碍清单不去掉内部零件的话，
  避障会"看着在跑、实际一个都没绕开"。

  回归用例：`tests/link/visio-link-obstacle.test.ts`（中间挡一个方块时必须绕开 + 无障碍时行为不变的参照组）。
  下游实测：ice-agent-console 的真实案例由 24 处穿越降到 **0**（`tests/diagram-crossings.test.ts`）。

## [2.15.0] - 2026-09-18

### 新增

- **连线标签支持偏移**：`ICEPolyLine` 的 `style.label.offset = [dx, dy]`（本地坐标 / 世界单位）。

  为什么需要它：标签位置由 `getLabelPosition()` 钉死在折线上（2 点取中点、**多点取中间折点**），
  而折点是**路由器为了避开符号折出来的** —— 于是"共用一个汇流点"的几条连线锚点**逐像素重合**，
  标签必然互相压住；更麻烦的是这件事**对图元间距是尺度不变的**（实测整体放大 1.45 / 1.75 / 2.2 倍，
  压字数量稳定在 43~45，一动都不动），所以"把图排松一点"这个办法根本不管用。
  应用层此前唯一能做的是改数据挪走个别冲突，自动布局 / 用户拖出来的图无从下手。

  偏移只挪标签、不动折线本身；`__labelMetrics()` 是唯一度量入口，因此
  **画布（`drawLabel`）、包围盒（上屏快照盒 / 脏区擦除盒 / 离屏缓存位图范围）、SVG 导出
  （`getLabelRenderInfo`）三处必然同口径**，不会出现"屏幕上挪了、导出还在原位"。
  非法值（长度不是 2 / 含非有限数）一律当作没写，不抛错；默认**不写**这个键
  （零偏移没有表达价值，写进 state 还会污染既有快照）。

  ⚠️ `setState` 是**深合并**：运行时想清掉偏移要显式给 `[0, 0]`，省略键不会删除它
  （与引擎其余 style 键同口径，回归里钉住了这一条）。

### 文档

- `ICE.setInputPassthrough()` 补上契约说明：它解决的是**另一块 canvas**（分层渲染的手势归属），
  对**盖在画布上的 DOM 浮层无效** —— 全局拦截器挂在 `window` 上，非 canvas 目标一律照常转发；
  浮层请在根上 `stopPropagation()`（键盘不要拦，否则输入法 / 快捷键会废）。
  这两件事看起来都像"让手势落到正确的地方"，实际不是一回事，此前只能从源码读出来。

### 门禁

- 新增 `tests/link/polyline-label-offset.test.ts`（5 例）：无偏移行为不变 / 三处同源 /
  非法值容错 / `[0,0]` 等价 / 运行时改值与深合并语义。
- 回归：`npm run verify`（lint → types:check → build → jest → bench → pkg:check）✅、
  `npm run test:visual`（真机视觉 + 全部示例页冒烟）102 条 ✅。

## [2.14.1] - 2026-09-17

### 修复

- **换主题后文本贴旧位图**（热切换路径）：深色主题切换后，大量文本仍是浅色主题的深字压深底上，
  而 `?theme=dark` 刷新路径完全正常 —— 说明配色写法没错，错在"不重建的那条路径"。

  **根因是两套机制的隐含假设冲突**：主题引用（`token('ui.colors.text')`）假设"样式是引用、paint 时解析"，
  而**组件级离屏缓存**与**静态层位图**假设"内容没变就贴旧位图" —— 主题**不在它们的内容指纹里**
  （`contentKeyVector` 推的是 `st.fillStyle`，换主题前后是同一个引用对象）；
  再加上 `__reapplyPreset()` 只对「用了 preset / 没写 style」的组件 `setState`，
  **写了引用但没用 preset** 的组件根本不被置脏 → 静态命中直接贴图。

  实测（`ice-smart-water` 线上，同一页两条路径逐像素对拍，`#canvas-shell` 1552×902）：
  内容区差异 **28,281 像素 → 0**；最典型的色对是 `#212529 → #dee2e6`（浅色主题的深字 vs 深色主题的正确字色）。

  **修法**（单一汇合点，覆盖 `setTheme` / `setChrome` / `setThemePatch` / `clearThemePatch` 四条入口）：
  - 新增 `CanvasRenderer.invalidateObjectCache()`：**同时**作废组件级离屏缓存与**静态层位图**
    （后者显式置 null，不依赖 `markQueueDirty()` → `__rebuildQueue()` 的副作用 —— 那条路径哪天被优化掉就静默退化了）；
  - `ICE.__recomposeTheme()` 里调它，再 `requestRepaint()`（保证"即使一个组件都没被重新 apply 也会有帧"）。

  ⚠️ 两条**顺带澄清**（都验证过）：
  - "把主题版本号加进缓存指纹"**不可能有效** —— 只要 `!component.dirty`，静态命中路径**根本不会执行指纹比较**；
  - 静态层是**第二个同类漏洞**（成员/视口/队列都没变，所以不会重建）。当前两个大页面实测 `__layerBuilds = 0`
    未触发，但结构相同，一并修死。

### 门禁

- 新增 `tests/theme/theme-cache-invalidation.test.ts`：四条主题入口都要「清缓存 + 丢静态层 + 保证有帧」；
- 新增 `e2e/visual/theme-cache-pixel.spec.ts` + fixture：**热切换后的画布与"开机即深色"逐像素一致**
  （摘掉失效调用，这条立刻红 —— 已验证有牙）。这条补的是**像素级**盲区：样式值（库侧
  `theme-coverage.spec.ts`）与画布指纹（`theme-hot-switch.spec.ts`）都看不出位图过期。

## [2.14.0] - 2026-09-17

### 新增

- **主题补丁层 `setThemePatch(id, patch)` / `clearThemePatch(id)`**：一个 `ICE` 实例上的主题分成
  **基座**（`setTheme` / `setChrome`）与**命名补丁**（领域库注册，`id` 用库名）两层，合成顺序固定为
  `基座 → 命名补丁`。解决的问题：UI 主题与领域主题（图表调色板 / 设计器外壳）以前都直接改实例主题，
  **后写的赢** —— 换 UI 主题会把图表主题抹掉，反之亦然（成败取决于调用顺序）。现在两层互不覆盖、
  调用顺序无关；基座换了补丁**自动重放**。补丁不进快照（库装载时重新注册）。**优先级**：基座在最底层、命名补丁在其上（按注册顺序），
所以应用要覆盖领域库的 token 要写**自己的补丁**（`setThemePatch('host', …)`），`setChrome` 压不住补丁；
整个撤掉用 `clearThemePatch(id)`。
- **`ice.requestRepaint()`**：应用层"手动请求重绘"的公开表达（自绘 painter 读了新数据 / 换视口 /
  资源就绪 / 作废静态层）。以前只能写 `ice.dirty = true` 直摸内部字段 —— 全家族实测 60 处。

### 回归

- 新增 `tests/theme/theme-patch.test.ts`（6 条：基座+补丁叠加、顺序无关、多层/同 id 替换、撤销、
  引用式样式跟着补丁走、`setChrome` 语义不变）与 `tests/renderer/request-repaint.test.ts`（3 条）。

## [2.13.0] - 2026-09-17

### 变更（⚠️ 渲染顺序语义变了）

- **渲染顺序改为「树序 + 兄弟按 zIndex」**：绘制 = **先父后子**；`state.zIndex` **只在兄弟之间**
  比较（相等时保持加入顺序）。另外把**工具层整体画在组件层之上**这条摆正 —— 两层过去是
  按 zIndex **交叉排序**的，现在按渲染实际顺序（`componentQueue` → `toolsQueue`）判定。

  **修的是什么**：默认 `zIndex` 是**构造顺序计数器**（`ICEComponent.instanceCounter++`），
  而队列过去是"展平后**全局**按 zIndex 排序"。于是**父容器比子组件后构造**时，父的 zIndex
  反超自己的整棵子树 → **父把自己的子组件整个盖住**：画出来一片空白、**不报错**、单测也不红。

  真机 before/after（`e2e/visual/render-order.spec.ts` + `examples/render-order/tree-order.html`：
  子矩形先建、父分组后建，父子重叠）：

  | | 子矩形中心像素 |
  |---|---|
  | 旧实现 | `#0d6efd`（被父的蓝底盖住） |
  | 新实现 | `#dc3545`（子组件可见） |

  **对使用者的影响**：
  - 兄弟之间的分层**不变**（默认 zIndex 仍是构造顺序，所以"后加的兄弟在上面"照旧）；
  - 想跨子树压层（"我这块要盖住隔壁那块"）要抬**共同祖先那一层的兄弟**，不能只抬深层节点
    —— 子树的叠放位置由它在兄弟里的位置决定（与 DOM / Swing 同语义）；
  - 家族里为绕开这个坑写的 `raiseSubtree`（把整棵子树设成同一个 zIndex）**保留无害**，
    新代码不需要它了。

### 三处同源（改一处必须改三处）

| 位置 | 变成 |
|---|---|
| `util/data-util.ts` 的 `flattenTree` | 递归时**先排兄弟**（排副本，`childNodes` 本身不动）；新增 `sortSiblingsByZIndex` |
| `CanvasRenderer.__rebuildQueue` | **不再全局 sort**；`zIndex` 变化走重建但**保留上屏快照**（成员没变 → 局部重绘仍成立） |
| `SvgExporter` | 导出顺序同样按兄弟排，不再全局 sort |

命中判定与绘制**同源**：`hitTestComponents` 的两条路径（渲染队列 / headless 回退）都改为
「先扫工具层、再扫组件层」。顺带修掉一个既有的不一致：组件显式给很大的 zIndex（`BIG_ZINDEX_NUMBER`
那档）时，旧实现"看着被工具层盖住却点得到"。

### 回归

- 新增 `tests/renderer/render-order.test.ts`（6 条：父晚于子构造仍可见 / 兄弟 zIndex / 跨子树不越级 /
  工具层在组件层之上 / zIndex 变更后不退回全局排序 / `flattenTree` 不改 `childNodes`）；
- `tests/renderer/hit-test-ordered.test.ts` 的**独立预言机**按新语义重写（刻意不调用 `flattenTree`，
  否则等于拿实现验证实现）—— 9800 点逐点比对；
- 新增真机用例 `e2e/visual/render-order.spec.ts` + 示例页 `examples/render-order/tree-order.html`；
- `tests/renderer/CanvasRenderer.dirty-rect.test.ts` 的「zIndex 变更后仍局部重绘」继续通过。

## [2.12.3] - 2026-09-17

### 文档

- **快速开始后面补一节「接下来：写一个『页面』」**。快速开始教的是**引擎原语**（
  `new ICE().init()` → `ice.addChild(new ICERect(...))`），画图形 / 写单文件 demo 没问题；
  但一个应用真正要交付的是**页面**（若干控件、数据由宿主推、刷新时只改值不重建结构），
  而原来的路径里没有任何一处说"什么时候该从脚本升级成页面"。

  新小节给 12 行 `class DataPage extends ICEContainer`（构造期建树 + `onUpdate()` 唯一改值入口）、
  三条升级判据（第二个页面 / 宿主推数据 / 同一结构反复改值）、以及指向
  [应用层：一个页面怎么写](https://ice-render.github.io/ice-render-doc/docs/conventions/app-pages)
  的链接。同一个缺口也在 `ice-web-components` README（1.13.3）与文档站的「你的第一个场景」里补了。

### 说明

- **不含任何代码变更**：`dist/` 与 2.12.2 逐字节相同，tarball 只差 README 与版本号。

### 验证

- 2026-09-17 本机实跑：eslint 0 error / `types:check` 0 错 / jest **140 suites · 1174 用例** /
  `build` / 可视化回归 **100 passed**（含 92 个示例页冒烟）。

## [2.12.2] - 2026-09-17

### 文档

- **README 里的测试规模改成当天实测值**：`134 套件 / 1121 用例` → **140 套件 / 1173 用例**，
  可视化回归 `75 条` → **100 条**。数字会随着加测试一路漂，所以这次标了"2026-09-17 实测"，
  并在 AGENTS 里补了一句：**精确值以命令为准**（`npm test` / `npm run test:visual`），
  文档里保留数字只是为了体现这套工程有多厚。

  **不含任何代码 / 运行时变更** —— 本次发布的 tarball 与 2.12.1 只差 README 与版本号。

### 验证

- 2026-09-17 本机实跑：eslint 0 error / `types:check` 0 错 / jest **140 suites · 1173 用例** /
  `build` / 可视化回归 **100 passed**（含 92 个示例页冒烟）。

## [2.12.1] - 2026-09-15

### 修复

- **`fitCanvasToDisplaySize()` 改完尺寸没有安排重绘 —— 空闲停帧状态下 resize 会静默白屏。**

  给 canvas 的 `width` / `height` 赋值会**清空画布**，所以这个方法在把 backing store 对齐好的同时
  已经把画面抹掉了。而 2.12.0 只改尺寸、不置脏：一旦画面已经画完、帧循环已经因为「空闲停帧」停掉
  （见 `needsFrame()`），就**没有任何人会再画一次** —— 调用方拿到返回值 `true`，看到的却是一张白画布，
  而且不报错、不告警。现在改完尺寸会自行 `this.dirty = true`（setter 内部会 `FrameManager.wake()`，
  循环已在跑时只是一次布尔判断，可以安全地挂在 resize 这类路径上）。

  这不是"顺手帮忙重绘"：清空是引擎在这一行里干的，补画的义务就属于引擎。把它留给调用方，
  等于要求每个宿主都记住一条不成文的规矩，而漏掉的症状是静默白屏。

  来源是实测而非推演：`ice-agent-console` 的表单层在窗口变窄后整块变白。它当时**能**画出来
  纯属巧合 —— `compiled.setWidth()` 里的 `doLayout()` 顺手置了脏；把那条路径去掉就立刻白屏。
  这也说明 2.12.0 那段 `@returns` 的措辞（"调用方据此跳过重排 / 重绘"）有误导性：
  返回值只该用来决定**自己那层**要不要重新布局（比如表单要按新宽度重新对齐控件），
  重绘由引擎负责。文档已一并改掉。

### 验证

- `tests/ICE.fit-canvas.test.ts` 补 3 例（17 例总计）：渲染过一轮之后 fit 会把脏置回去 /
  尺寸没变时**不**置脏（否则停帧省电形同虚设）/ fit 后跑一帧回到不脏。
  去掉修复后第一例立刻失败。
- `npm run verify` 全绿（140 suite / 1173 用例）；`npm run test:visual` 全绿。

## [2.12.0] - 2026-09-15

### 新增

- **`ICE.fitCanvasToDisplaySize(cssWidth?, cssHeight?)` —— 画布尺寸对齐的唯一公开入口。**
  它做的是：backing store = 逻辑尺寸 × dpr、CSS 尺寸固定为逻辑尺寸、同步 `canvasWidth` /
  `canvasHeight`，并在尺寸变化时刷新 `canvasBoundingClientRect` 与内容盒；返回「是否真的变了」，
  调用方据此跳过重排 / 重绘。不传尺寸时从**内容盒**读（排除 border / padding）；
  没有布局信息的运行时（小程序那类没有 `getBoundingClientRect` 的宿主）退回画布当前逻辑尺寸，不抛异常。

  之所以要有这个入口：这段契约原先只活在私有的 `__applyDevicePixelRatio()` 里，
  **且只在 `init` 时跑一次** —— 初始化之后容器尺寸变了就没有任何公开入口。于是两个下游各自重写了一遍，
  还各自踩了不同的坑：

  - `ice-chart` 的 `resize()` 用 `getBoundingClientRect()` 的 **border-box** 尺寸 ——
    而引擎自己那行注释警告过"直接用 border-box 会被边框撑大（示例页画布带 1px 边框）"；
  - `ice-smart-water` 的 `sizeCanvasToParent()` **绕开引擎手写 `canvasWidth` / `canvasHeight`** ——
    而命中测试正是按这两个字段算的。该应用目前没开 HiDPI（`dpr` 恒为 1），所以数值上还没错，
    但这层手写让"以后切 HiDPI"变成一个静默错位的陷阱（引擎以为在 2× 渲染、画布却被写回 1×）。

  两次都不是"写错代码"，是"没人提供入口"。引擎的 `hitTest()` / `fitViewport()` / `zoomAt()`
  都按 `canvasWidth/Height` 加内容盒算坐标，写错了**不会报错**，只会让命中整体偏移 ——
  这类契约必须由内核兜住，不能靠文档。现在 `__applyDevicePixelRatio()` 改为委托本方法，
  契约只有一份实现，`init` 行为逐字节不变。

### 验证

- 新增 `tests/ICE.fit-canvas.test.ts`（14 例：显式传尺寸 / 内容盒读取 / dpr = 1·2·3 /
  小数尺寸不被取整 / 幂等返回 `false` / 无画布与非法尺寸的边界 / `init` 委托后的回归）。
- `npm run verify` 全绿（140 suite / 1170 用例）；`npm run test:visual` 100/100；
  bench 主 / anim / layers / micro / mem 五段全部达标；`pkg:check`（publint + attw）无问题。
- 行为兼容：`init` 的 dpr 路径逐字节不变 —— `ICE.dpr.test.ts` 原有用例一字未改仍全过。
- 一个自己在实现里抓回来的坑：初版写成"先取整再乘 dpr"，对小数宽度（400.5px）结果与原实现不同，
  等于顺手改了调用方的布局宽度。已改为先乘后取整，并加测试钉住。

## [2.11.3] - 2026-09-15

### 修复

- **连线横穿节点后"抢走"点击，节点拖不动**（`ice-entity-designer` 各域包示例实测报告）。
  `ICEPolyLine.containsPoint` 原来用三角不等式（`len1 + len2 ≈ 线段长`）判"点在线上"，
  容差会随线段长度**二次放大**：130px 的线段实际容差约 14px（本该 3px）、400px 的长线能到 24px。
  于是 BPMN 里离跨池消息流 10px 的池子中心也被判成"在线上"，点上去选中的是线而不是池子
  （statechart 2/8、BPMN 5/18、entity 1/30 的可拖图元中心被别的组件取走）。现在改用基类的
  精确点到折线距离（容差 `max(4, lineWidth/2 + 3)`，与全引擎其余命中口径一致）。
- **连线不再认领"自己端点节点盒子内部"的点**：折线的首/末段要伸进端点节点才接得到端口上；
  端口若落在背离对方的那一侧（或用户把节点拖到了线的另一侧），这段就横穿节点内部
  （状态图「库存校验」中心距折线 3.1px —— 比 4px 容差还近，光收紧容差治不了）。节点是拖拽的主交互
  对象、线是附属，所以把"线不覆盖自己的端点节点"写进命中语义：只多两次快照盒查询、不改全局命中优先级。
- **Visio 正交路由"无解"时不再抛异常**：三道过滤器（正交 / 不倒着走 / 不相交）都可能把候选路径删光，
  而 `__calcDots` 直接取 `solutions[0][2]` → `undefined[2]` → pageerror；它在**渲染**与**命中**两条路径上
  都会被调用（实测：`ice-entity-designer` 撤销/重做后移动一次鼠标就整页报错）。现在逐级兜底
  （过滤后快照 → 最小两点直连），保证 `interpolate()` 永远返回非空。

### 验证

- 新增 `tests/link/line-endpoint-hit.test.ts`（4 例：端点内部不认领 / 端点移动后按当前盒子判定 /
  未连接的线语义不变 / 长线中点旁 8px 不再误判）。
- `npm run verify` 全绿（139 suite / 1156 用例）；`npm run test:visual` 100/100；`bench:mem --check` 4 项 1.00×。
- 下游定向回归：`ice-entity-designer` 单测 364 + e2e 79 + 11 个示例页冒烟全绿；
  "线穿过自己的端点盒子"的实测从 statechart 2 / entity 2 / BPMN 6 → **全部 0**；
  "可拖图元中心被别的组件取走"从 statechart 2 / entity 1 / BPMN 5 → **0 / 0 / 1**（BPMN 剩的 1 例是
  跨池消息流横穿泳道中部，线在交叉处优先属于既有语义，泳道其余区域可选可拖）。

## [2.11.2] - 2026-09-15

### 修复

- **对齐目标漏了整个容器层**（`ice-entity-designer` 的流程图/状态图/二次回路示例实测报告）。
  `__computeTargets` 一直只取 `ice.childNodes`（顶层），而编辑器里"能自由拖动的图元"大多长在容器里 ——
  BPMN 示例 18 个可拖图元有 15 个在池/泳道内，拖动它们时提示线数量**恒为 0**
  （"发卡"拖到"申请结束"左边缘差 3.6px 也不吸附，2.10.1 / 2.11.1 行为一致）。现在改为
  **展开整棵树取参与对齐的图元**，同时**排除被拖组件自己的子树**（子组件与父组件一起平移，
  当成候选等于"自己对自己吸附"，命中后会给出一个恒定的固定偏移，父组件永远偏着指针走）。
  真机前后对照：BPMN 泳道内任务→同级任务左边缘 `1116.4`（差 3.6、提示线 0）→ `1120.0`（差 0、提示线 1）；
  二次回路 顶层节点→端子左边缘 `471.2`（差 2.8）→ `474.0`（差 0）。
- **等间距候选"不检查空隙"**（`spacing` 仍**默认关**，默认值不动）：原实现里任意一对目标中心之间
  都会贡献一条中点线，密集版面上"两个紧挨着的图元的中点"根本放不下当前元素。现在加了间隙门控
  （源盒塞得进 a、b 之间的空隙才给候选）；**显式开启** `spacing: true` 的应用会少一类无意义候选。
  两点实测边界，供应用决定是否开启（`ice-smart-water`、34 个单元、阈值 2、0.502×，
  同一条 24 步真机拖动）：开启后抖动指标与关闭时**完全一致**（相邻步最大位移变化 6.1、
  单步最大修正 4.4，粘性锁定兜住了），但吸附步数 11/24 → 13/24、换线 8 → 12；
  路径上平均每一步有 183 条中点候选（门控只筛掉 5 条）。所以**密度得靠 threshold / proximity /
  这个开关来控制，门控只负责挡掉语义上没意义的候选**。
- 对齐参数文档里的过期数字：`threshold` 默认写成 5（实为 3）、`hysteresis` 写成 2（实为 1）。

### 文档与基准

- **修正「默认配置不复制」被引用的内存数字**（README / `docs/architecture/04-rendering-performance.md` /
  文档站 `intro`、`core-concepts`、`04-rendering-performance`）。旧数字（100 万最小矩形"堆增量约 0.87GB"、
  每图元 0.9KB）**不可复现**：它其实来自 `examples/performance/max-elements.html` 读取的
  `performance.memory.usedJSHeapSize` —— 浏览器**已用堆绝对值**（还带采样/量化），却被写成"node 实测的堆增量"，
  因此不随图元数线性变化（"每图元越算越小"的来源）。重测（node + 每档独立进程 + 造对象前后各两次 gc 的**真增量**）：
  **10 万 232MB / 50 万 1156MB / 100 万 2312MB（每图元 2.37KB）**；同一场景把整份默认表显式传给每个实例约
  7.7KB/图元（3.3×）——其中"默认配置"（`props` + `state`）只占 **0.98KB/图元**。机制本身（原型共享）没有退化。
- **措辞收敛**：README 的"默认配置不复制"限定为**实例侧**，并写明 **`style` 是例外**（按主题每实例派生，
  不在共享默认里）；`docs/guide/core-concepts` 不再把旧的内存数字当作原型共享的因果证据。
- **新增内存基准 `npm run bench:mem`**（`bench/micro/memory.bench.mjs`）：字节/实例口径、缺 `--expose-gc`
  自动重入、每个规模独立进程、双次 gc；基线落在 `bench/micro/memory-baseline.json`（容差 1.3×，支持
  `--check` / `--update-baseline` / `--n=`）。已纳入 `verify:full`，这类数字从此有门禁守着，不会再漂。

### 验证

- `npm run verify` 全绿（138 suite / 1152 用例）、`npm run test:visual` 100/100（含对齐 golden 与交互）；
  `alignment-dense.test.ts` 增至 7 例（新增"候选目标展开子树但不含自己""等间距间隙门控"两条新旧对照）。
- `ice-entity-designer`：单测 364 用例、e2e 79 用例全绿；10 个示例页真机回归 10/10
  （每页都验"吸附到合法候选线 + 拖动中出提示线 + 松手后清线"）。
- 内存基准：`npm run bench:mem -- --check` 全绿（4 项，1.00×）；三档独立复测 10 万 / 50 万 / 100 万 = 2.37KB/图元（线性）。

## [2.11.1] - 2026-09-15

### 修复

- **密集版面里拖动图元时"引导线跳、图元也跳"**（ice-smart-water 工艺图实测报告）。三条根因，逐条修掉：
  1. **每帧重挑"最近候选"** → `computeSnap` 新增 `locked` 参数：命中后**锁定**那条线，
     只有当源盒移出 `threshold + hysteresis` 才重新挑选（`AlignmentGuideManager` 新增 `lockedX/lockedY`）。
     判据：锁定期间 `guideValue` 不变、`delta` 随源盒增长（元素"钉"在线上，而不是跟着指针漂）。
  2. **等间距候选默认关闭**（`spacing: false`）：它是「任意两个目标中心的中点」这种全图级别的线，
     O(n²) 且最不可预期。实测（34 个单元的工艺图）"≤4px 命中候选线"的概率：边缘+中心 60% → 加等间距 75%；
     开相关性门控后 36% → 49%。需要它的应用显式 `spacing: true`。
  3. **修正量不再 `Math.round()`**：整数取整会把连续的候选切换放大成整数级跳变（实测 8/−4/4/−2 反复）。
- 新增 **`proximity`（相关性门控，屏幕像素，默认 0 = 关闭）**：只在**另一轴**上与源盒相距不超过它的目标
  之间找对齐 —— 能砍半吸附概率（80 屏幕 px：11/24 → 7/24 吸附步数），但会挡掉合法的远距离对齐
  （引擎对齐示例需要 ≥120、设计器流程图回归需要 ≥105 屏幕 px），故默认关闭、按需开启。
  同时 `computeSnap` 增加可选的 `proximity` 参数（世界坐标）。
- 实测（同一段真机拖动，工艺图、0.502× 缩放）：**吸附步数 19/24 → 13/24**、
  **单步修正幅度 ≤4.4 世界 px（≈2 屏幕 px，原最大 8 且带取整）**、
  **相邻步位移变化 18 → 6.1 世界 px**、命中期间引导线不再换目标。

> 引擎默认值只动了 `spacing`（true → false）；`threshold` 保持 3（改成 2 会打破既有示例的合法吸附距离），
> 密集版面的应用（`ice-entity-designer`）显式收紧到 2。

### 验证

- `npm run verify` 全绿（138 suite / 1150 用例）、`npm run test:visual` 100/100（含对齐 golden 与交互）；
  新增 `tests/control-panel/alignment-dense.test.ts`（5 例；每条都带"旧行为 vs 新行为"对照，去掉修复即变红）。

## [2.11.0] - 2026-09-15

本轮主题：**把"自由排版"与"自由拖动"这两件事彻底分开**，补齐收缩能力，并让布局的序列化不再"假装能读回"。

### 新增

- **`layoutIgnore`：手动定位的子项（CSS `position:absolute` 的对应物）**。写在子项 state 上
  （`{ layoutIgnore: true }`），布局器一律跳过它、也不让它参与首选尺寸。
  这样"容器负责大多数子项、少数子项位置是数据（用户拖出来的）"这类界面才成立
  —— 例如"端子排负责排布外壳，但端子本身必须能被拖"。`ICEBoxLayout` / `ICEFlowLayout` /
  `ICEBorderLayout` / `ICEOverlayLayout` 走 `layoutChildren()` 自动获得该行为；
  `ICEGridLayout` 也跳过它，但**不可见子项仍占格**（对齐 Swing `GridLayout`）。
- **交互锁成为独立的一维策略**（原来只是 `setLayout()` 的副作用、且有副作用不可逆）：
  - `setLayout(manager, { lockInteraction: false })` 只排位置、不接管交互（`disableTransform` 仍是旧名字）；
  - `container.setInteractionLock(true/false)` 可以在**没有布局**时单独开关，并且**解锁按原值还原**
    （记录改过谁、改之前是什么，而不是一律设回 `true`）；
  - `container.getInteractionLock()` / `container.getLayout()` 读取当前状态；
  - `setLayout(null)` 清除布局：坐标留在原地，交互锁还原。
  动机：`ice-entity-designer` 的端子排**因为"挂布局就再也拖不动"而放弃了布局机制**（该仓 AGENTS
  两轮复核的结论）——耦合本就该拆开。
- **最小尺寸协议**：`ICEComponent.setMinimumSize() / getMinimumSize() / isMinimumSizeSet()`，
  布局侧 `ICELayoutManager.getMinimumSize(container)` + `minimumSizeOf(child)`。
  `ICEBoxLayout` 在空间不足时按"能压多少"收缩声明了 `grow` 的子项，压到下限就停（如实溢出，
  而不是把内容压没）。口径与 Swing 一致：**没声明下限的轴回落到首选尺寸 = 不许压缩**，
  所以既有界面一行不改、行为不变；`ICEBoxLayout.getMinimumSize()` 会把子项的最小值沿嵌套往上传。
- **等分网格与 `grow` 的整数分配（累计取整）**：`ICEBoxLayout` 的剩余空间、`ICEGridLayout`
  `cellSizing: 'equal'` 的格宽/格高，都由"累计取整"切分 —— 每份都是整数、和精确等于可分配量，
  不再产出 `33.333` 这种落点（相邻子项边缘不会错开半个像素）。只消除布局**自己引入**的分数：
  容器本身在分数坐标上时，子项仍带着那个偏移（那是调用方的构图选择）。

### 变更（破坏性：布局的序列化行为）

- **未注册的布局类型不再"回退写类名"**，改为**不写 `layout` 字段**并告警。回退写类名看着能读回，
  但下游打包改名之后那份数据就是废的（同 AGENTS 记过的判类型事故）。子项的 `left/top` 照旧在快照里，
  所以读回来**版式不变**，只是不再自动重排；想保住布局请先 `ice.registerType('your-ns:MyLayout', MyLayout)`。
  旧快照里已经是类名的数据**照旧兼容**（读回按未注册类型跳过、保留坐标）。
- **`toJSON()` 返回 `null` = 显式声明"这个策略不进文档"**：用于组件内部策略（由组件构造时重建、
  参数活在组件 state 里）。返回 `null` 时既不写也不告警；返回 `{}` 才是"没有参数但要保留策略"。
  仍用基类默认 `toJSON()` 的布局会在序列化时**告警一次**（有构造参数的布局会在这里静默丢参）。

### 内部实现（性能）

- `setMinimumSize()` 的声明值放在**模块级 `WeakMap` 侧表**，不作为实例字段：实测给组件类加一个实例字段
  会把属性挤出 V8 的"对象内属性"区，bench 场景 A 从 **0.055ms 掉到 0.21ms（3~4×）**。
  这条已写进 AGENTS「别给组件类加实例字段」铁律。

### 验证

- `npm run verify` 全绿（137 suite / 1145 用例 + lint 0 error + bench **场景 A 0.054ms、场景 B 1.834ms 达标** + pkg:check）；
  `npm run test:visual` 100/100（含全部 golden 图，等分格宽取整未造成像素偏差）。
- 新增用例：`tests/layout/layout-ignore.test.ts`、`tests/layout/layout-min-size.test.ts`、
  `tests/layout/layout-interaction-lock.test.ts`，以及序列化侧 3 例（未注册不写 / 旧快照兼容 / `null` 不进文档 / 默认 toJSON 告警）。

## [2.10.1] - 2026-09-15

### 变更

- **示例 `examples/layout/dashboard.html` 改用引擎布局器**（此前是"布局示例目录里唯一一处手写坐标"）：
  `ICEBoxLayout(axis:'y')` 排"标题栏 + 卡片区"，`ICEGridLayout({ cols: 2 })` 排 KPI 卡片，
  `ICEOverlayLayout` 做"底板 + 角饰 + 正文宿主"的叠层，卡片正文再用 `ICEBoxLayout(axis:'y')` 叠
  数值 / 标签 / 趋势 —— 页面里不再出现一处 `left/top` 算术。
  观感仅有一处 3px 级差异（趋势行与标签改为统一 12px 节奏，原来是手调的 15/9），golden 图未变。

- **README 刷新过期计数**：134 个测试套件 / 1121 个用例、100 条 Playwright（含 92 个示例页冒烟）、
  92 个示例。此前写的「96 个测试文件 / 759 个用例 / 88 个示例」是早期口径。

> 纯文档与示例改动，运行时无变化。

## [2.10.0] - 2026-09-15

## [2.10.0] - 2026-09-15

### 新增

- **`ICEFlowLayout` 支持"货架装箱"与独立行间距**（默认值保持历史行为）：
  - `gapY`：行间距独立于列间距（不传则等于 `gap`）；
  - `pack: 'first-fit'`：**优先回填到任何还放得下的行**（把零碎小件塞回上一行，页面不容易被撑高），
    默认 `'in-order'` 仍是 Swing `FlowLayout` 的"填满当前行再换行"。
  这套语义来自本仓 `ice-web-components` 示例页里那份手写的"簇 + 货架"布局
  （`examples/gallery.html` 的 `flowSections` / `admin.html` 的 `flow`，各约 100 行）——
  现在由引擎负责，页面只保留"量簇 + 让引擎排"。

## [2.9.0] - 2026-09-15

### 新增

- **分层图布局的纯内核 `computeLayeredLayout`**（公开导出）：给定节点与边，算出
  `{ left, top, rank, order }` —— 分层（最长路径法、环安全）、层内排序（重心法 4 轮）、
  方向（`horizontal` / `vertical`）、交叉轴对齐（`start` / `center`）都在里面，
  **不碰组件、没有 ctx、纯函数**。
  用途：应用层的编译器（`ice-entity-designer-dsl` 的 UML / 流程图 / BPMN 自动布局）直接调它
  "算好坐标写进文档"；引擎的 `ICELayeredLayout` 调它"写回组件 + 对齐连线端点"。
  此前两边各写一份分层算法（DSL 那份 148 行），口径会漂 —— 现在共用一份。
- **`ICELayeredLayout` 新增 `direction` 与 `crossAlign`**：`direction: 'vertical'` 让层自上而下
  （面向流程图/类图的观感），`crossAlign: 'center'` 让层内节点块居中。默认值
  （`horizontal` / `start`）与历史行为**逐像素一致**（`layered-layout` / `git-commit-graph` 基准图未变）。

## [2.8.0] - 2026-09-15

本轮主题：**布局机制回归 Java Swing 的三条口径** —— 不继承、自顶向下校验、尺寸协商问子项。
起因是 `ice-web-components` 全库 80+ 组件只有 `ICETabs` 一处敢用引擎布局：父容器设布局会把策略
递归灌进所有后代容器，而组件库每个组件都是 `ICEGroup` 子类、内部零件（按钮文字、输入框前后缀 /
清除按钮）都在同一个 `childNodes` 里 —— 于是一次 `setLayout()` 等于把整个界面的内部零件重摆一遍。

### 新增

- **布局随快照往返（持久化）**：容器的策略写成 `layout: { type, props }`，读回时按类型重建。
  布局是"怎么排"，和坐标一样属于文档内容 —— 旧行为下 `layoutManager` 完全不参与序列化，
  「存盘再打开版式散了」。
  - 七种内置布局在 `ICE` 构造时注册（`src/consts/LAYOUT_TYPE_MAPPING.ts`，`ice-render:ICEBoxLayout` …），
    各自实现 `toJSON()` 报构造参数（`ICELayoutManager.toJSON()` 默认 `{}`）；
  - 未注册的第三方布局：写出时回退类名并告警，读回时**跳过策略、保留坐标**、记入 `deserializer.unknownTypes`
    （与未注册组件的容错口径一致，不炸整份数据）；
  - 第三方布局只要 `ice.registerType('your-ns:MyLayout', MyLayout)` + 实现 `toJSON()` 即可往返。
- **`ICEGridLayout` 新增 `cellSizing: 'equal'`**：各格等宽等分容器、并把子项摆成格子大小
  （Swing `GridLayout` 的口径；默认仍是引擎原有的 `'content'` = 列宽取该列最宽子项）。
  跨格时会带上中间的间距。`equal` 模式的 `getPreferredSize()` 返回 `[0,0]`（不表态）——
  子项被拉成格子大小后再量它们等于量容器自己，父布局回落到容器自己的盒子。
- **`ICEBoxLayout.align`：箱式布局的交叉轴对齐**（`start` 默认 / `center` / `end` / `stretch`）。
  `stretch` 是 Swing BoxLayout 的默认口径（子项在交叉轴撑满容器），
  「纵向堆叠 + 每项拉满宽度」的表单类版式不用再手算宽度；`grow`（主轴分剩余）与 `stretch` 可同时用。
- **`ICEFlowLayout.crossAlign`：行内交叉轴对齐**（`start` 默认 / `center` / `end`）——
  一行里高矮不一的子项可以居中 / 贴底（`ICESpace` 的 `align` 就映射到它）。
- **`ICEFlowLayout.getPreferredSize()` 按 Swing 口径计入换行**：容器已有确定宽度时按该宽度分行，
  报「最宽行宽度 × 各行高度之和」（Swing `FlowLayout.preferredLayoutSize` 用的就是 `target.getWidth()`）；
  宽度未定（0）或 `fitContent` 时按单行报（旧实现在 0 宽上会把每个子项都换行）。
- **显隐变化触发父容器重排**（对齐 Swing `Component.setVisible()` → `invalidateParent()`）：
  `display` 变化现在和尺寸变化一样会请求父容器重排 —— 布局器跳过不可见子项，
  「藏起侧栏让内容占满」这类版式因此可以完全交给布局（`ICELayout` 的侧栏收起就是这么实现的）。

### 变更（破坏性：布局继承语义）

- **删掉布局继承**：`setLayout()` 不再把策略传播给「未显式设置布局」的子容器，`addChild()` 也
  不再让新子容器继承父层策略。对齐 Swing 的 `Container.setLayout()` / `layout()`：父布局只负责
  给子容器摆位置，子容器用**自己的**策略排自己的子项（要自动排布就自己 `setLayout()`）。
  **受影响**：此前依赖「子容器自动继承父层布局」的代码，需给每个要自动排布的容器显式 `setLayout()`。
  旧实现删掉了 `__propagateLayout` 与 `__layoutExplicit` 两个内部成员。
- **新增自顶向下校验（对齐 Swing `Container.validateTree()`）**：`doLayout()` 在排布趟之后继续
  向下，谁失效（被改了尺寸 / 请求过重排）就重排谁并递归其子树，没失效的子树整棵跳过；中间层容器
  即使没有布局也要穿过去。此前内层容器被父布局改尺寸后不会重排自己的子树，只能靠 `fitContent`
  或继承 hack 兜底。
- **`requestLayout()` 语义对齐 `Component.invalidate()`**：除了标自己失效，还会**沿父链向上冒泡**
  （此前在没有布局策略的容器上直接 return，失效请求会断在中间层）；仍然合并到下一帧只排一次。
- **尺寸协商改为问子项**：`ICELayoutManager.preferredSizeOf()` 从「直接读 `state.width/height`」
  改为调用 `child.getPreferredSize()`（对齐 `BorderLayout.preferredLayoutSize`）。配套：
  - `ICEComponent` 新增 `setPreferredSize(size)` / `isPreferredSizeSet()`（Swing 同名 API）；
  - `ICEGroup.getPreferredSize()`：`setPreferredSize()` 声明过 → 报声明值；否则有布局 → 报策略算出的
    **内容尺寸**；都没有 → 报自己的盒子（Swing `getSize()` 兜底）。**构造期给的 `width/height`
    是边界（`setBounds` 语义），不再是首选尺寸** —— 要让父布局按你给的尺寸留位，请调 `setPreferredSize()`。
  - 收益：嵌套容器**不需要 `fitContent`** 就能对外报自然尺寸（`fitContent` 回归它本来的语义：
    把自身尺寸调成内容尺寸）。
- **不可见子项口径对齐 Swing**：`ICEFlowLayout` / `ICEBoxLayout` / `ICEBorderLayout` /
  `ICEOverlayLayout` 跳过 `display:false` 的子项（用 `ICELayoutManager.layoutChildren()`）；
  **`ICEGridLayout` 不跳过**（不可见项照样占一格，与 Swing 的 `GridLayout` 一致）。

### 修复

- **父容器布局会破坏子组件内部几何**：给面板设布局后，子组件继承同一策略、下一次自己
  `requestLayout()` 时按父层的规则重摆自己的内部节点（实测 `ICETextField(prefix, allowClear)`
  的文本 `12 → 0`、清除按钮 `(170,6) → (316,0)`）。删除继承后不再发生。

### 验证

- **golden 图更新一张：`git-commit-graph`**（`e2e/visual/__snapshots__/.../git-commit-graph-darwin.png`）。
  原因是那张基准图**记录的是"布局继承"这个 bug 的画法**：示例把 `ICELayeredLayout` 设在容器组上，
  旧实现把策略递归灌进每个节点组，于是"节点内部的圆点与文字"被当成图节点排成了上下两行；
  删掉继承后它们保持示例自己写的坐标 —— 也就是示例注释里写的「标签在圆点右边、垂直居中」。
  即：**新渲染符合示例本意，是基准图过期**（本次 `--update-snapshots` 重新生成，其余 99 张与 92 个
  示例页冒烟用例全部通过）。
- 新增 `tests/layout/layout-swing-semantics.test.ts`（不继承 / validateTree / 尺寸协商 /
  `setPreferredSize` / 不可见子项 / `BoxLayout.align` / `FlowLayout.crossAlign` 共 24 例），
  改写 `flow-layout`、`layout-reflow`、`layout-responsive` 里依赖旧继承语义的用例。
- 新增 `tests/persistence/layout-serialization.test.ts`（5 例：写法 / 无布局不写字段 / 往返一致 /
  读回后仍会重排 / 未注册类型容错）。
- `npm run verify` 全绿：**133 suite / 1107+ 用例** + lint（0 error）+ build + bench + pkg:check；
  `e2e/visual/visual.spec.ts --grep layout` 8 张 golden 图与 `examples-smoke` 全过。
- 家族 e2e 端口重新分配（见 AGENTS「家族 e2e 端口分配」）：各仓 `reuseExistingServer: false`，
  `ice-smart-water` 的截图脚本从 8093 改回自己的 8092。
- 组件库侧（`ice-web-components` 同分支）用它跑完了 1307 单测 + 9 个示例页 e2e，
  `ICELayout` / `ICEForm` / `ICESpace` 已迁到引擎布局器（见该仓 CHANGELOG）。

## [2.7.0] - 2026-09-14

本轮主题：**把布局系统从「叶子排列」提升到「可组合排版」** —— 补上尺寸协商、内外距、
交互共存，以及网格 / 箱式的常用能力。设计思想仍是 Java Swing 的 `LayoutManager`（策略模式）。

### 新增

- **容器按内容自适应（`fitContent: true`）**，并带来**两趟布局**：
  父容器 `doLayout()` 的测量趟会先让 `fitContent` 的子容器把自己量成内容尺寸
  （递归、自底向上），排布趟再自顶向下落位 —— 于是**嵌套容器有自然尺寸**，
  父布局读到的不再是它那个还没定/默认 10 的盒子。
- **内外距**：容器 `padding`、子项 `margin`（`number` = 四边等距，或 `{top,right,bottom,left}`）。
  七个布局统一用同一套口径（内容盒 / 占位尺寸 / 落位偏移），不再各自为政。
- **布局与交互可以共存**：`setLayout(manager, { disableTransform: false })`。
  默认仍是「布局接管后禁用后代拖拽/变换」（历史行为不变）；传 `false` 时布局照常摆位置，
  但用户仍能拖动 —— 适合"布局打底 + 允许微调"的场景。
- **`ICEGridLayout` 支持 `rows` 与跨格**：只给 `rows` 时按子项数量反推列数；
  子项写 `gridSpan: { colSpan, rowSpan }` 可跨格（表头通栏、侧栏跨行这类版式不必再手算宽度）。
- **`ICEBoxLayout` 支持 `grow`**：声明了 `grow` 的子项按权重瓜分**剩余空间**
  （容器比内容宽时才分配；容器更小则保持原尺寸、不压缩）—— 定宽侧栏 + 自适应内容区一行搞定。
- **七个布局都实现了 `getPreferredSize()`**（内容首选尺寸），`ICELayeredLayout` 也按
  "每层最宽 + 间距"推得，因此首次布局（还没排过）就能给出正确结果。
- 导出布局相关类型：`ICELayoutInsets` / `ICELayoutInsetsValue` / `ICELayoutConstraint` /
  `ICELayoutBox` / `ICEGridSpan`。

### 变更（破坏性：网格现在按列对齐）

- **`ICEGridLayout` 的列宽改为「全局对齐」**（每列宽 = 该列最宽子项 + `gapX`）。
  旧实现是逐行各自累加，同一列在不同行里会错开 —— 那既不叫网格，也让跨格无从谈起。
  受影响的只是"同一列里子项宽度不一致"的版式，`e2e/visual` 的 `grid-layout` 基准图已按新语义更新。

### 修复

- **布局参数用 `||` 取默认值，导致 `gap: 0` / `gapX: 0` 无法表达**（会被当成未设置而套默认值）。
  七个布局统一改成 `??`：显式给 0 就是 0。`currentIndex: 0` 同理。
- `ICEBorderLayout` 的方位约束（`layoutConstraint`）不再裸字符串比较：非法值（`'top'` / `'North'`）
  会 `console.warn` 一次并落到 `center`，不再静默摆错位置。

### 验证

- `verify:full` 全绿：**1078** 单测（+12：自适应 / 内外距 / 交互共存 / 网格跨格 / grow / 约束校验）
  + 100 浏览器用例（29 张 golden，`grid-layout` 基准按列对齐更新）+ 4 套基准 + 包检查。
- 新增示例 `examples/layout/layout-composition.html`（五项能力一页演示，已进 examples 冒烟），
  并在真实浏览器里目视确认。

## [2.6.0] - 2026-09-14

本轮：**把主题机制的边界补齐** —— 一边给应用层让路（自带词汇别再被误报成问题），
一边把护栏立起来（注册表与 preset / type 对齐），再补上**主题变更通知**这个一直缺的信号。

### 新增

- **主题变更通知**：`ice.onThemeChange(fn): () => void`（返回的函数即退订）。
  `setTheme` / `setChrome` 应用完成、缓存失效之后广播一次，
  回调拿到 `{ theme, previous, kind }`（`kind: 'theme' | 'chrome'`）。
  - **为什么需要它**：以前 `setTheme` **不发任何信号**，应用层只有"自己是调用方"时才知道主题变了 ——
    图表 `theme:'auto'`（跟随引擎明暗）、设计器外壳（从引擎主题派生）这类**被动跟随**的场景
    只能等下一次重建。这是"引擎换了主题、上层纹丝不动"的根因，三条桥不必再各自发明同步时机。
  - 每个订阅者**互相隔离**：某个回调抛异常会被忽略并 `console.warn` 一次，不影响主题应用、也不影响其它订阅者。
  - 底层是 `ice.evtBus` 上的 `ICE_EVENT_NAME_CONSTS.THEME_CHANGE`；该常量与 `EventBus` 一样从包入口导出，
    不必硬编码字符串。`evtBus` 会在首次订阅时**按需创建**（`init()` 改为复用已有的那一条），
    因此 `new ICE()` → `onThemeChange()` → `init()` 这条顺序不会把订阅悄悄丢掉。
- 导出 `BUILTIN_THEME_NAMES`（内置主题名清单，与 `BUILTIN_PRESET_NAMES` 对齐）
  与 `ICE_EVENT_NAME_CONSTS`；新增类型 `ICEThemeChangeInfo`。

### 变更（破坏性：命名主题注册收紧）

- **`registerTheme(name, theme, options?)` 不再是裸赋值**，与 `registerPreset` / `registerType` 对齐：
  内置主题名（`default` / `dark`）**不允许覆盖**；同一个名字**重复注册抛错**，
  要覆盖须显式 `registerTheme(name, theme, { overwrite: true })`；名字非字符串 / 主题不是对象也明确抛错。
  **动机**：以前一个应用可以把内置 `dark` 静默换掉，整个页面跟着变；而 `themeSnapshot()` 存的是
  "相对命名主题的差异"，基线被悄悄替换会让已存快照还原出另一个样子。家族内没有依赖旧行为的用法。

### 变更：校验器不再把"应用自带词汇"当成错误

- `validateTheme()` 以前把所有不认识的 `semantic` 顶层键都判成
  「未知的语义 token「x」，**引擎不会读它**」——**这句文案本身就是错的**：
  `token('app.highlight')` 是能被解析的（`tokenValue` 按路径取，不限于内置名单）。
  现在分两类：
  - **疑似打错内置名** → `warning` / `unknown-semantic-token`，并给出候选名字
    （`primry` → "是不是想写 `primary`？"）。判定：归一化后同名，或**首字母相同且编辑距离 ≤ 2**
    —— `kind`（之于 `hint`）这类只差首字母的名字不会被误报；
  - **应用自带词汇** → `info` / `custom-semantic-token`（`ThemeDiagnostic.severity` 因此多了 `'info'`）。
  消费诊断时按 severity 过滤即可：`error` / `warning` 是要修的问题，`info` 只是说明。

### 验证

- `verify:full` 全绿：**1054** 单测（+16：注册表护栏 / 应用词汇 / 变更通知）+ 100 浏览器用例 + 4 套基准 + 包检查。
- 真实浏览器（`examples/theme/theme.html`）实测：`setTheme('dark')` 与 `setChrome(...)` 各触发一次通知
  （`kind` 分别为 `theme` / `chrome`，`previous` 正确），退订后不再收到，页面零报错。

### 修复：文本放不下时**不再压字形**

- **`fillText` / `strokeText` 不再传 `maxWidth`**。canvas 对第四个参数的语义是「把字形
  **横向压扁**」而不是截断 —— 表现是长文本挤成一团、还溢出盒子（事故现场：smart-water 顶部 Message
  的告警文案，中文一字约 13px，被压到约 7px/字的宽度里）。
- **溢出改为截断 + 省略号**：新增 `textOverflow: 'ellipsis' | 'clip'`（默认 `'ellipsis'`），
  按盒子内宽逐 grapheme 回退并追加 `ellipsis`（默认 `…`）；`'clip'` 保留「原样画出去、允许溢出」，
  交给调用方自己裁。截断算在 `getRenderLines()` 的显示行里，**画布 / SVG 导出 / 行盒三处同口径**；
  编辑态不截断（caret 按原始文本算）。
- **顺带修掉一个跨调用污染**：`splitGraphemes()` 以前把**缓存数组本身**返回给调用方，
  而截断逻辑用 `pop()` 就地回退 —— 谁截断谁改坏全局缓存。表现：先用 `ellipsis: '...'` 截过一次
  `abcdefgh`，再用默认 `…` 截同一段文本，结果从 `abcd…` 变成 `ab…`。现在返回副本。

### 验证（追加）

- `verify:full` 全绿：**1066** 单测（+12：溢出截断 / textOverflow / SVG 同口径 / grapheme 缓存污染）
  + 100 浏览器用例 + 4 套基准 + 包检查；**29 张 golden image 零差异**（示例里没有依赖压字形的场景）。
- 真实浏览器实测 smart-water 顶部 Message：放得下 → 完整显示且字形正常（面板按实测文字定宽）；
  放不下 → 末尾省略号截断，不再变形。

## [2.5.1] - 2026-09-14

补一个**遗漏的公共导出**：2.5.0 新增的家族色板常量只在模块内可见，应用层（`ice-chart`）
拿不到，就没法真正做到"共用一份色板"。纯增量，无行为变更。

### 新增

- 公共入口新增导出 `FAMILY_PALETTE` / `FAMILY_PALETTE_DARK` / `BOOTSTRAP_BASELINE`。
  `ice-chart` 直接 import 它们作为**唯一色板来源**，不再各存一份。

## [2.5.0] - 2026-09-14

本轮：**家族品牌基线落地为 Bootstrap 5**。这是一次**改变默认观感**的版本（语义色与数据系列配色都换了值），
机制与 API **完全不变**——应用层不需要改一行代码，但「没显式设主题」时引擎画出来的颜色会变。
按语义化版本给到 minor。

### 变更（破坏性：默认观感）

- **默认语义色从 Tailwind 值换成 Bootstrap 5 值**（`DEFAULT_THEME.semantic`）：
  `primary #3B82F6 → #0D6EFD`、`success → #198754`、`warning → #FFC107`、`danger → #DC3545`、
  `info → #0DCAF0`。**为什么**：`ice-chart`、`ice-web-components`、文档站门面本来就是 Bootstrap 值，
  引擎默认的 Tailwind 蓝是家族里唯一的"第三种蓝"；Bootstrap 也是这些库最常见的使用环境，对齐它是向现实靠拢。
- **灰阶阶梯刻意比 Bootstrap 默认更深一档**，保证 `text > muted > hint` 三档全部通过 WCAG AA：
  `text #212529`（对白底 15.4:1）、`muted #495057`（8.2:1）、`hint #6C757D`（4.7:1）、`border #DEE2E6`。
  （Bootstrap 自带的 `gray-500 #ADB5BD` 在纯白上只有 2.1:1，`ice.validateTheme()` 会直接判 error，
  所以 `hint` 取 gray-600；不要照抄 `gray-500`。）
- **数据系列配色抽出唯一来源**：新增导出 `FAMILY_PALETTE` / `FAMILY_PALETTE_DARK`，
  `DEFAULT_THEME.semantic.palette` 改为它的副本。此前引擎（Tailwind 500s）与 `ice-chart`
  （Bootstrap 蓝 + Tailwind 混合）各有一套 8 色，**同一份数据在两个产物里会得到不同颜色**；
  现在二者共用同一份（`ice-chart` 直接 import）。
- **`DARK_THEME` 换成 Bootstrap 5.3 的深色变体**：`background #212529`、`text #dee2e6`、
  `muted #ced4da`、`hint #adb5bd`、`border #495057`，彩色用亮一档的 `#3d8bfd / #479f76 / #ffda6a /
  #ea868f / #6edff6`，palette 用 `FAMILY_PALETTE_DARK`。
- **组件默认样式的兜底值**（主题缺字段时才命中的 `themeDefaultStyle` fallback）同步换成基线值。

### 不变（刻意保持）

- **`base.color` 那套色 ramp 原样保留**：它是"原始色料"（global token），品牌决策落在 `semantic`
  （alias token）上——两者故意的分工。不要靠合并 token 词汇来替代品牌决策。
- **主题机制、API、三条应用桥、`setTheme` / `setChrome` / token 引用全部照旧**；没有新增第二套入口。
- **XP / arcade / 高对比等产品身份主题照旧保留**——它们是产品身份，不是家族基线。
- `ice-web-components` / `ice-chart` **零代码改动**（本就是 Bootstrap 值）。

### 验证

- `verify:full` 全绿：**1038** 单测 + 100 浏览器用例 + 4 套基准 + 包检查。
- golden image（29 张）**零差异**：示例页大多是显式配色，语义 token 换值不会波及它们——
  这也顺带验证了示例的确定性。

## [2.4.1] - 2026-09-14

本轮：**把主题的类型导出去**（应用层要写 `setChrome` / `setTheme` / 自定义预设 / 处理诊断，
缺类型就只能写 `any`），顺手把一个歧义导出改名。

### 新增

- 导出主题**类型**：`ICETheme` / `ICESemanticTheme` / `ICEChromeTheme` / `ICEThemeInput` /
  `ICEThemePatch` / `ICEThemeTokenRef` / `StylePresetFactory` / `ThemeDiagnostic`。
  （应用层的实际反馈：给 `setChrome(patch)` 传参数时拿不到 `ICEChromeTheme`，只能 `any` —— 那等于没有契约。）

### 变更（破坏性：导出改名）

- **默认导出的主题工具包从 `ICETheme` 改名为 `themeUtils`**。`ICETheme` 这个名字同时被
  「运行时工具包（baseTokens / DEFAULT_THEME / registerTheme / token … 的集合）」和
  「主题**类型** `{ base, semantic }`」占用，`import { ICETheme }` 拿到的是值还是类型说不清。
  现在各归各位：值 = `themeUtils`，类型 = 上面的 `export type`。
  家族内没有任何地方 import 这个默认导出，改名零影响。

### 变更：外观入口收拢到 `style`（`labelStyle` 并入 `style.label`）

- **连线标签的外观**从独立的 `labelStyle` 容器并入 `style.label` —— 与其它 style 键走**同一条解析路径**，
  因此可以引用主题 token、可以被 `props.states` 覆盖。「标签的颜色算不算主题可控」不再有两种答案。
  老的顶层 `labelStyle` 保留为**弃用别名**：构造时单向并入 `style.label`（`style.label` 优先），一处归一化。
- **`lineBorderColor` 支持主题引用**（`'$border'` / `token(...)`），读值处统一过 `resolveThemeValue` ——
  颜色归主题、几何量（`lineBorderWidth`）归 props。
- **写成规则**（`docs/architecture/21-theme-and-style.md` §8.5 + `AGENTS.md` 铁律）：
  外观一律进 `style`（子元素用 `style.<元素>` 嵌套，不新开 `xxxStyle` 容器）；
  顶层 props 只放两类东西 —— ① 动画要写的 key（引擎按顶层 `state[key]` 写值），
  ② 几何 / 缓存签名参数（`ObjectCache` 的内容签名与脏矩形外扩量直接读它们）。
  往这两类加字段要同步改动画写值通道与缓存签名；颜色类 props 必须支持主题引用。

### 验证

- `verify:full` 全绿：**1038** 单测 + 100 浏览器用例 + 4 套基准 + 包检查。

## [2.4.0] - 2026-09-14

本轮主题：**把主题与样式机制补完** —— 让「主题」真正能覆盖引擎画出来的每一层，
而不只是用了 `preset` 的那些组件；顺带堵掉两处入口不一致。

**这是 2.x 里第一个有视觉变更的版本**，升级前值得看一眼下面的「变更」小节（应用层不需要改代码，
但观感会变；两处是刻意收紧的行为）。本轮也刻意**不做旧写法兼容**——家族仍在发布初期，
能一次做干净就不留历史包袱。

### 新增

- **主题引用：样式在 paint 时解析**。`style: { fillStyle: token('primary') }`（或字符串简写
  `'$primary'` / `'$palette.2'` / `'$chrome.slot.fill'` / `'$base.radius.md'`）在**绘制那一刻**解析，
  因此 `setTheme()` 之后**任意组件**都会跟着换 —— 以前只有用了 `preset` 的组件能跟，
  自定义组件的颜色永远停在创建那一刻。token 名写错时**跳过赋值**保留 ctx 原值
  （赋成 `undefined` 会让整块画布消失）。渐变 stops 与 `shadow: 'md'` 的颜色也走同一条解析。
- **交互状态样式**：`props.states = { focus, hover, active, selected, disabled }` +
  `setInteractionState()` / `clearInteractionStates()`。叠加顺序 focus → hover → active →
  selected → disabled（越靠后越优先），刻意排在 `state.style` **之后**（后者在构造时是
  `props.style` 的副本，排前面会把状态补丁原样盖掉）。自动驱动 `ice.enableInteractionStates()`
  **默认关闭**：引擎的 mousemove 本来不做命中检测，打开等于每次移动加一次场景命中测试。
- **交互外壳 token（`semantic.chrome`）**：选中框 / 变换手柄 / 连线端点 / 连接插槽 / 对齐引导线 /
  连线标签 / 文本选区 / 阴影色 / 调试框 / 蚂蚁线管壁色，从**写死在 11 个文件里的 ~45 处色值**
  收进主题；配套 `ice.setChrome(patch)` 只改外壳。深色主题给了一套协调值。
- **主题作用域**：`new ICEGroup({ theme: {...} })` 只影响子树（分屏大屏 / 暗底卡片），
  合并结果按「主题版本 + 参与作用域的组件身份」缓存，无作用域时是零分配快路径。
- **主题进快照**：`{ theme: { name, patch? } }`。`patch` 是**相对命名主题的真实差异**
  （`deepDiff`），所以「当初怎么设置的」（整份主题对象 / 部分补丁 / `setChrome`）不影响存下来的内容；
  与命名主题一致时只写 `{ name }`；没动过主题不写该字段（旧快照格式不变）。
- **主题校验 `validateTheme()` / `ice.validateTheme()`**：未知语义 token（警告）、颜色类型不对、
  palette 为空、motion 缺 duration 或 easing（错误）、`text` / `muted` / `hint` 与背景的
  **WCAG 对比度**（< 3 报错、< 4.5 警告）。配套 `contrastRatio`。
- **预设注册 `registerPreset` / `unregisterPreset`**（与 `registerType` 同一套纪律）；
  **深合并工具** `mergeThemes` / `deepMerge` / `deepDiff` / `deepEqual`；
  **主题查询** `listThemes` / `getRegisteredTheme` / `resolveTheme`。
- **文档《21 · 主题与样式机制》**：四层 token、引用解析、状态样式、作用域、快照、校验、
  预设纪律、**热路径性能约束**与已知取舍。

### 变更（观感 / 行为，升级前请过一遍）

- **容器默认不再画自己的盒子**。`ICEGroup` 继承自 `ICERect`，历史上因为默认样式写死 `red/blue`，
  任何没显式给 `style` 的容器都会画一个**不透明红块**（引擎自己的叠层示例里"混出来的紫色"
  就是这么来的）。现在容器默认样式是**透明**：要背景 / 边框就显式给 `style` 或用 `preset`。
- **默认样式来自主题**：没写 `style` 的叶子图元默认 `fillStyle = semantic.primary`、
  `strokeStyle = semantic.border`，并随 `setTheme` 刷新（不再是写死的 red/blue）。
- **`STYLE_PRESETS` 变成只读视图**：读照常，写与删除**抛错**并指向 `registerPreset` /
  `unregisterPreset`。以前 `STYLE_PRESETS.card = fn` 能在实例上生成同名属性盖掉原型里的内置预设，
  「内置不可覆盖」一行赋值就绕过去了。
- **默认主题的 `muted` / `hint` 调深一档**（gray-600 / gray-500）：旧值（gray-500 / gray-400）
  在纯白上分别只有 4.83:1 与 2.54:1，后者连 WCAG AA 的一半都不到 —— 这是 `validateTheme()`
  上线后第一次跑就抓到的自家问题。
- **主题合并改深合并**：`{ motion: { duration: { fast: 50 } } }` 不再抹掉 `motion.easing`
  （旧实现下动画路径读 `motion.easing[名]` 会直接抛 TypeError）；`{ base: {...} }` 现在真的生效
  （旧实现忽略它、还会污染成 `semantic.base`）。平铺 semantic 的历史写法继续支持。
- **还原顺序修正**：先切命名主题 → 再叠补丁 → 最后建组件（旧实现先叠补丁再切命名主题，
  补丁会被随后的命名主题整份覆盖）。

### 性能

`applyStyleToCtx()` 是每帧每组件都跑的热路径，新增机制必须不付代价：
样式里没有主题引用、也没有激活状态时走**快路径**（与加机制之前逐字同构），
微基准 **0.98× 基线**（`npm run bench:micro -- --check`）。
第一版用闭包实现时实测 1.88×、去掉闭包后 1.27×，最终按「快路径 + 原始应用方法」拆回来。

### 验证

- 单测 975 → **1032**；`verify:full` 全绿：单测 + 100 条浏览器用例（含像素快照）+ 4 套基准 + 包检查。
- 应用侧回归：`ice-chart`（367 单测 + 36 浏览器用例）、`ice-entity-designer`（350 + 78）、
  `ice-web-components`（1289 + 9）、`ice-smart-water`（83 + 35）全部在新引擎上通过。

## [2.3.2] - 2026-09-14

本轮主题：**把「1 万级场景」的渲染与交互热路径再压一档** —— 新增静态层位图、去掉两处每组件重复计算、
命中测试不再每次展平整棵树。**没有 API / 数据格式变更，应用层不需要做任何事**；所以按补丁级发布。

先给结论（同机真实浏览器 A/B，1600×1000 / dpr=1）：

- 「2000 文本 + 1000 折线 + 7000 矩形 + 200 个**分散**动画」：**23.75ms → 1.32ms/帧**
  （静态层位图；这是编辑器最典型、此前表现最差的形状：「每帧全量重画每一个组件」）。
- 「10,000 矩形全部动画」：**12.2ms → 9.9ms**（命令流重建信号 + 内容指纹）。
- 「2,000 文本全部动画」：**6.1ms → 5.3ms**。
- 「10,000 组件的 `ice.hitTest`」：**0.8ms → 0.3ms/次**（hover 类交互逐次 mousemove 调它）。

> 唯一需要下游知道的一条：静态层位图**默认开启**（它是纯渲染内部路径，像素口径沿用位图既定的
> 「alpha 逐位相同、预乘通道差 ≤3/255」）。若某个应用观察到异常，可用
> `ice.renderer.setStaticLayerEnabled(false)` 一键关掉并反馈。

### 变更

- **新增《20 · 引擎升版后的应用侧验证清单》**（2026-09-14，工程实践）：把"引擎升版 → 应用侧验证"固化成一页清单 —— 对齐依赖（含 `--prefer-online` 绕开本地 npm 缓存假报版本不存在）→ 门禁 → **全部示例页逐页冒烟**（内容像素占比判据，导航页列外）→ 按引擎改动类型定向检查（静态层读 `__layerBuilds` 确认是否真参与 + 层开/层关像素对照；hover 命中路径跑悬停探针；持久化改动做 save→load 往返）→ 发布。含像素对照的**两档口径**（简单场景 alpha 逐位/预乘 ≤3；密集重叠场景实测上界）、**归因顺序**（先量噪声底线 → 切组件缓存 → 单组件 → 主画布 vs 离屏 → 裁剪/陈旧），以及六个发布踩坑。

- **把「位图保真」的口径按场景写实：简单场景严格、密集场景另记实测上界（2026-09-14 文档/测试）**：
  起因是 2.3.2 的静态层在 ice-entity-designer 上做「层开 / 层关」像素对照时出现约 0.9% 的像素差。
  一串实验把静态层逐条排除 —— 单组件「直绘 vs 位图」0 差、主画布 vs 离屏画布 0 差、
  位图边界外扩 / 强制重建 / 关视口裁剪**都不能改变数值**；最后**把层在两侧都关掉、只切组件缓存开/关，
  差异与「层开 / 层关」一字不差** → 那个差是**组件级离屏缓存自身**的量化（2.3.1 及更早就有），
  静态层只是把它搬到了对照的另一侧。**静态层没有引入画质回归。**
  机制是固有的：位图是 8bit 预乘存储，贴回时还要与「底下已有的墨迹」再合成一次，
  而直接落墨时字形是直接栅格化到那块墨迹上的 —— 只在半透明边缘像素上有差。
  实测（密集文本、层两侧全关、只切缓存）：单个文本 **0 差**；300 文本不重叠 差异像素 1.34% /
  alpha 差 0.47% / 最大通道 5 / 最大预乘 2；重叠与加不透明底会更大。
  因此把口径写成两档：`offscreen-cache-fidelity.spec.ts` 继续用**简单场景的严格界**
  （alpha 差 <0.1%、预乘 ≤3/255），新增 `e2e/visual/component-cache-fidelity-repro.spec.ts`
  记录**密集场景的实测上界**（含约 2× 余量）。历史观测到的单像素 48/255 尚未在受控场景复现，
  留作独立问题，**不因此放宽任何一处界**。

- **命中测试不再「每次命中都展平整棵树 + 排序」（2026-09-14 性能）**：
  `hitTestComponents` 原先每次调用都 `flattenAllComponents()`（分配一个上万元素的数组）+ `sort()`
  再线性扫描，而它在线性交互热路径上 —— 应用层的 `ICEHoverManager`、`ice-chart` 的 `HitResolver`
  都是**逐次 mousemove** 调它。实测 1 万组件下 **0.8ms → 0.3~0.4ms/次**（同机 A/B，公共 API `ice.hitTest`），
  并且不再每次命中都分配并排序一个大数组（GC 也省一份）。
  做法：复用渲染器手里那份「只在结构 / zIndex 变化时才重建」的 z 序队列（`renderer.getOrderedQueues()`）
  **倒序**扫描，第一个命中即 z 序最高者；结构变更或 zIndex 变更时按需刷新，所以
  「点得到的位置」与「画出来的样子」仍然严格对齐。没有渲染器时回退到旧路径，两条路径语义逐条对齐。
  回归：`tests/renderer/hit-test-ordered.test.ts` 用一个**独立预言机**（不做世界盒预筛、不复用队列）
  在 6 类场景上逐点比对 9800 个点（含 zIndex 相同、工具层、裁剪、结构/zIndex 变更后立即命中、
  无渲染器回退），并带防空转护栏。
  顺带把 `__resetLeakyCtxState` 里那个 21 分支的字符串 `switch`（每个 style 键各走一次）换成查表。

- **新增「静态层位图」：一大段静态组件整层贴回，1 万级画布的静态帧从 20ms 量级降到 1ms 量级（2026-09-14 性能）**：
  「很多静态 + 少量分散动画」是编辑器最典型的场景，而此前它**每帧全量重画每一个组件** ——
  200 个分散动画会让脏区合并预算（6 块）撑不住、面积门（35%）必然触发，局部重绘整条退回全量。
  现在局部重绘不成立时改走**静态层位图**：把 z 序上**连续一大段**不需重画的组件整体光栅化成一张位图，
  每帧只「清屏 + 贴一张图 + 画剩下那几个」。成员集合 / 视口 / 结构变化才重建位图（成本 = 重画这些成员一次）。
  同机真实浏览器 A/B（`renderer.setStaticLayerEnabled(false)` 为对照）：
  混合编辑器场景（2000 文本 + 1000 折线 + 7000 矩形 + 200 个分散动画）**23.75 → 1.32ms/帧（18.0×）**；
  10000 静态 + 200 个铺满画布的动画 **11.83 → 1.30ms（9.1×）**。
  而「10000 静态 + 200 个聚在一角的动画」「2000 静态 + 50 个分散动画」两个场景**层不介入**（局部重绘已经够好）
  —— 它只在真正需要时才接管。
  **视口手势期间不建层**：位图的栅格是按当时的渲染视口对齐的，视口一变整层作废；此时「重建 + 贴回」
  比重画一遍还贵（多一次整层 blit），而下一帧又变。实测拖拽平移/滚轮缩放下每帧慢约 35%（13.0 → 17.6ms）。
  现在与组件级离屏缓存同一条纪律：**视口变化的帧一律不建位图**，手势停下后的第一帧再统一重建一次
  （实测回到 13.0ms 持平，建层次数 301 → 1）。另外 `setViewport()` 在**值没变**时不再
  `markQueueDirty()` —— 平移驱动里重复下发同一视口（钳制边界 / 视口跟随同步）很常见，
  每帧白打掉一次队列就等于每帧丢一次静态层。
  安全边界：① 只有 z 序上**连续**的干净段能成层（队列是全局 zIndex 排序，位图只能整层贴回，交错会改变叠放次序）；
  ② 有 `clipChildren` 祖先、`globalCompositeOperation` 非 `source-over`、`display:false` 的组件一律排除；
  ③ 位图栅格对齐纪律与离屏缓存完全一致（渲染视口缩放 + 整数设备像素落点 + 1:1 贴回）；
  ④ 渲染进离屏位图时若抛异常（运行时 ctx 能力不全 / 测试替身缺方法）**绝不能抛出去** ——
  那在帧回调里就是未捕获异常（小程序直接白屏）；现在捕获并整个会话关掉静态层，退回逐组件重画。
  像素验收：新增 `e2e/visual/static-layer-pixel.spec.ts`（dpr=1 与 dpr=2 各 10 步），
  判据取引擎既定的位图口径 —— **alpha 逐位相同、预乘通道差 ≤3/255**，实测 ≤1。
  单选/单元回归见 `tests/renderer/static-layer.test.ts`；文档见 [04](docs/architecture/04-rendering-performance.md)。
  顺带修掉 `bench/render.cjs` 的离屏 ctx 桩缺 `rect/closePath/arc/ellipse` 等方法的问题（它正是被这条路径打出来的）。

- **每组件热路径去掉两处重复计算：命令流重建 + 内容指纹（2026-09-14 性能）**：
  ① `ICEPath` 原先以 `dirty` 决定是否重建命令流，而 `dirty` 的语义是"本帧要重绘" ——
  **平移动画每帧都置脏，几何却一动没动**，每帧白重建 `Path2D` + 重放整条命令流。
  改为双信号判据：派生参数重算过（`refreshParams()` 消费掉一次 `paramsDirty`）**或**几何签名
  （`__pathSignature()`：宽高/半径/本地原点/dots·points 内容/closePath/curveType）变了才重建。
  签名**默认保守**（未覆盖签名的类维持旧行为），只有读的 state 字段封闭的 4 个内置 builder 声明精确签名，
  因此自定义子类（BPMN 形状 / 进度环 / Spinner 等自己实现 `createPathObject()`）语义不变。
  ② `ObjectCache.render()` 原先每帧给每个已缓存组件拼一个 40 段字符串再 `!==`，
  改为**向量采样 + 逐项比较**（`contentKeyVector()` + `keyEquals()`），字符串形态只在真要重建位图时拼；
  判定口径**严于**原字符串比较（判"不同"只会多重一次位图，不会贴旧位图）。
  同机真实浏览器 A/B：10,000 矩形全动画 **11.2 → 9.9ms（−11%）**、全量写 `left` **10.6 → 9.5ms（−10%）**、
  2,000 文本全动画 **5.8 → 5.4ms（−9%）**；四套基准门禁同步复核全部快于基线
  （场景 B 0.94×、文本静态 0.87×、文本动画 0.82×）。回归：
  `tests/renderer/path-rebuild-signal.test.ts`、`tests/renderer/offscreen-content-key-fastpath.test.ts`，
  以及 `ObjectCache.test.ts` 新增的"廉价前置判断"等价性用例；
  文档见 [04](docs/architecture/04-rendering-performance.md) 的「每组件热路径」小节与 `AGENTS.md` 的
  「路径命令流重建信号铁律」。

- **`AnimationTimeline` 播完之后 `play()` 成了空操作（2026-09-14 修）**：时间轴跑完后 `playing` 仍是 `true`，
  于是再次 `play()` 会被开头那句 `if (this.playing && !this.paused) return this;`（"已经在播就不重复启动"）
  吞掉 —— **"重播"按钮点了没反应**，`isPlaying()` 也一直说谎（示例页的"暂停/继续"按钮因此永远走 pause 分支）。
  现在全部键跑完即把 `playing` 置回 false（注意顺序：先 resolve `finished`，它依赖 `playing`）。
  回归：`tests/animation/animation-timeline.test.ts` 新增用例「播完之后 play() 必须从头重播」；
  真实浏览器路径由 ice-render-dsl 的编排 e2e 覆盖（`e2e/orchestration.spec.ts` 的"重播回起点"）。

- **基准门禁补齐：Node 侧两条热路径也能"判定"了**（2026-09-14）：`bench/render.cjs` 与 `bench/micro`
  此前只打印数字，性能有没有退化完全靠人记得跑、记得上次是多少。现在两者都有 `--check`：
  与入库基线（`bench/baselines/render.json`、`bench/micro/baseline.json`）对比，
  超宽松倍数（2.0× / 2.5×）即非 0 退出；`--update-baseline` 是有意刷新基线的入口。
  随之接进门禁：`verify` 里 `bench 2000 -- --check`、`verify:full` 追加 `bench:micro -- --check`。
  基线为 2026-09-14 实测（Apple M4）：场景 A 1.05ms / 场景 B 1.75ms / refreshQueue 0.011ms /
  文本缓存加速比 8.7×，与 2.3.0、1.4.10 跨版本复核均在 ±3% 内（无退化）。

## [2.3.1] - 2026-09-14

本轮主题：**把"连线端点手柄（hook）/ 连接插槽（slot）"这条交互链路修通、修准**。
两个用例（ice-entity-designer 的 `entity-editor` 与 `bpmn-editor`）里，点连线看不到端点手柄、
拖到手柄后放不下、手柄与插槽还整体错位 —— 根因都在引擎侧。

### 修复

- **连线端点手柄被 `transformable` 连带禁用**（2026-09-13）：`ICEControlPanelManager` 原来用**同一个**
  `transformable` 决定"要不要给这个组件控制面板"。但线条型组件的面板是 **LineControlPanel（两端
  ICELinkHook 端点手柄）**，语义是"拖动端点改变连接关系"，与"旋转/缩放手柄"是两回事。
  于是下游踩坑：应用层为了"记法不可变换"给连线设 `transformable: false`，**端点手柄与连接插槽一起没了**
  （ice-entity-designer 的 8 个域包全是这个症状：点连线看不到 hook，也没法把线拖到别的组件上）。
  现在线条组件改用新的 `linkEditable`（默认 `true`）单独控制端点手柄；`transformable` 只管变换手柄，
  要禁止改连接写 `linkEditable: false`。
- **拖拽归属：抬起事件必须回到"按下的那个组件"**（2026-09-13）：派发器对抬起事件按当前位置重新命中检测，
  于是"按下 A → 拖到 B 上松手"时 A 收不到 mouseup。对端点手柄是致命的 —— 它要在 mouseup 时
  （`HOOK_MOUSEUP` → `ICELinkSlotManager`）把连线改接到落点插槽上，收不到就"拖得动、放不下"。
  现在派发器记住按下的组件，抬起时先把事件补派给它，再按老规矩派发给命中组件（总线仍只触发一次）。
  回归：`tests/event/DOMEventDispatcher.drag-owner.test.ts`。

- **"端点手柄与插槽位置错乱"（两个真实缺陷，2026-09-13 实测于 ice-entity-designer 的 bpmn-editor.html）**：
  ① `LineControlPanel` 给面板自身设了 `top: -5`，而两个端点手柄是它的**子组件** ——
     手柄位置是按连线端点算的绝对坐标，于是整体偏离端点 5px（实测端点 [148,576] vs 手柄中心 [148,571]）。
     改为 `top: 0`，手柄中心与连线端点严格重合。回归 `tests/control-panel/line-control-panel.test.ts`。
  ② `ICELinkSlot.hostComponent` 的 setter 只订阅新宿主的 `AFTER_RENDER`、**不立刻重算位置** ——
     钩子先掠过一个很大的泳道、再落到泳道里的任务上时，插槽继续留在泳道边上
     （实测：碰撞已命中任务，插槽却仍铺在 1180×150 的泳道上）。现在 setter 里立刻 `updatePosition()`。
     回归 `tests/link/link-slot.test.ts`。
  端到端回归：ice-entity-designer 的 `e2e/link-hooks-bpmn.spec.ts`（真浏览器：手柄中心 == 连线端点；
  拖到任务上后，插槽中心 == 该任务的 T/R/B/L/C）。

> 两处一起修，ice-entity-designer 才恢复"点连线 → 出现端点手柄 → 拖到另一个实体上 → 连接关系改变"，
> 该仓新增 e2e `e2e/link-hooks.spec.ts` 钉住整条用户路径。

## [2.3.0] - 2026-09-13

本轮主题：**动画机制从「能动」走到「可控 + 可控性可验证」**（写值通道 → 分层渲染 → 帧调度 →
表达力 → 编排），并顺手修掉两个真实缺陷（聚合退化的卡帧、时间轴重播）。
唯一需要应用层动手的是一条**行为变更**：空闲停帧之后，"监听 `ICE_FRAME_EVENT`"不再等于
"帧还会来"——自己做逐帧计算的应用要显式 `ice.setContinuousFrames(true)`（见下文 ⚠️）。

### 修复

- **`coalesceRegions` 的 O(k³) 聚合退化（会把一帧卡死几秒~几分钟）**（2026-09-13）：
  "区数超上限后反复合并「面积增量最小」的两块"这一步是 O(k²)，最多跑 k 轮 → 整体 O(k³)。
  脏块一多（≥25 块、彼此不直接相接但合并划算，例如大量分散的小动画元素）就会指数级变慢 ——
  实测 100 块 108ms / 300 块 2.7s / 600 块 21.9s / **1000 块 111s**（一帧 = 一次卡死）。
  现在加了**聚合预算** `MAX_COALESCE_REGIONS = 32`：超过预算不再精挑细选，直接塌缩成一个
  并集盒交给面积阈值判定（保守解：最多回退全量重绘，绝不会画错）。修完 1000 块 **1ms**，
  单测钉住（含"2000 脏块 <200ms"）。

### 变更

- **脏区门控维持「计数门」**（2026-09-13）：原计划把 `FULL_FALLBACK_DIRTY_RATIO = 0.2`（脏组件数占比）
  换成"以脏区**面积**为主判据"，实测后**否决** —— 脏区散开时并集盒必然撞 0.35 面积阈值、面积门救不了，
  反而让注定回退全量的帧多花 ~30%（先收集再聚合）；成片脏区的交叉点在 20~30% 且低于测量噪声。
  "1 万图元里 2000 个分散在动"这个场景的正解是**分层渲染**（见 [18 §3.1](docs/architecture/18-animation-architecture.md)），
  不是这道门。数据见 [18 §3.3](docs/architecture/18-animation-architecture.md) 与
  [04 优化方向](docs/architecture/04-rendering-performance.md)。

- **动画写值通道 + 设备像素量化**（2026-09-13，见 [18 · 动画机制](docs/architecture/18-animation-architecture.md)）：
  动画此前每帧走 `setState` → 无条件置 `paramsDirty` → **离屏位图每帧重建**（1000 个文本 35.1ms/帧）。
  现在：
  - `ICEComponent.setState(patch, options?)` 支持显式 `{ paramsDirty: false }`（省略 = 旧行为）；
  - `ICEComponent.ANIMATION_SAFE_KEYS` + `isAnimationSafeKey(path)`：子类声明「纯绘制/变换」键白名单
    （基类：位置/`transform.*`/透明度/显示/zIndex/fill/stroke；`ICEText` 额外放行光标、选区、
    颜色、装饰线等**不参与量测**的键）。**未知键与未声明的组件一律保守地照旧置脏** —— 第三方组件零风险；
  - `AnimationManager` 只在"本帧写出的键全是安全键"时跳过派生参数重算；
  - `AnimationManager.snapToDevicePixel`（默认开）：把**飞行中的纯平移**吸附到设备像素栅格，
    让位移满足位图纯平移复用要求的"整数设备像素"；只对当前可离屏缓存的组件生效，
    **动画终点值永远精确写入**（`to: 100.5` 落在 100.5），单条动画可 `snapToDevicePixel: false` 关掉。
  - 实测（`npm run bench:anim`）：1,000 个文本的平移动画 **35.1ms → 2.7ms/帧**（位图重建 40000 → 0，
    复用率 100%）；矩形对照不变。门槛已接进 `verify:full`。
- **分层渲染原语**（2026-09-13，见 [18 · 动画机制 §3.1](docs/architecture/18-animation-architecture.md)）：
  引擎**不做**自动分层（层的划分有产品语义），而是给三个原语 + 一套配方：
  - `ICE.linkViewport(a, b)` / `ice.followViewport(source)`：两层视口双向/单向同步（`setViewport` /
    `zoomAt` 都覆盖、`destroy()` 自动解绑、内部防回环）；
  - `ice.setInputPassthrough(true)`：覆盖层 canvas 置 `pointer-events: none`（关闭时还原为空，不覆盖应用样式）；
  - **多实例事件归属**：`DOMEventDispatcher` 现在按**目标 canvas** 过滤"按下/滚轮"事件 ——
    目标是别人的 canvas 就忽略。此前同页多实例是全局广播，点上层画布会同时驱动下层实例的命中检测，
    "上层穿透"因此形同虚设（移动/抬起事件仍不过滤，避免拖拽途中丢事件）。
  实测（`npm run bench:layers`，10000 静态元素 + 200 动画标记）：单画布 26~34ms/帧 → 分层
  **0.4~0.6ms/帧（≈60×）**，动画期间静态层重绘 **0** 次；门槛已接进 `verify:full`。
  配套示例 `examples/animation/layered-canvas.html`（两层 + 视口同步 + 穿透开关）与
  `e2e/visual/layered.spec.ts`（5 条真实浏览器断言：两层都出画、视口始终一致、
  穿透时点得到下层 / 关掉穿透就点不到、暂停整层动画不影响另一层）。
- **跨实例迁移原语**（2026-09-13，18 §3.1 的 ②-2 切片）：`ice.moveComponentTo(component, targetIce, targetParent?)`
  `ice.detachChild(component)` + `rebindComponentTree(component, ice)`：
  - `moveComponentTo` 把组件（连同整棵子树）搬到另一个 `ICE` 实例，**保持世界坐标**（按矩阵换算，
    不照抄 left/top）、**不销毁**（组件自身监听/子树/动画配置都保留）、`ice/ctx/evtBus` 递归重绑、
    动画注册与选中态由目标实例接管；目标父级必须属于目标实例，同实例迁移返回 false（那是 addChild/adoptChild 的活）。
  - `detachChild` = "摘除但不销毁"（`removeChild` 会 `destory()` 清事件，不能用于迁移）。
  - `rebindComponentTree`：**显式子树重绑**。修掉一个真实缺口 —— `ICEGroup` 的 AFTER_ADD 子树同步钩子是
    `once`（只首次挂载触发），对"已经挂过"的容器迁移时不会重绑后代，表现为"搬过去之后后代的事件仍发到旧实例"。
  - 用途：分层渲染里"拖拽期间把元素提升到动画层、松手放回"（`examples/animation/layered-canvas.html` 已演示）。
  回归：`tests/ICE.move-component.test.ts`（9 条：世界坐标换算/子树重绑/动画注册迁移/选中态/防御/队列标记）
  + `e2e/visual/layered.spec.ts` 新增 1 条真实浏览器用例（提升→重绑→动画注册→放回，世界坐标 ≤1px）。

- **多层导出合成**（2026-09-13，18 §3.1 的 ②-3 切片）：分层渲染是**多张 canvas**，
  `ice.toDataURL()` 只拿得到自己那一层，导出"用户看到的整张图"必须按层合成：
  - `exportSvg([layerA, layerB], options)` / `exportSvgResult(...)`：**矢量合成**。
    数组顺序 = 叠加顺序（第一层在下）；`area: 'content'`（默认）各层共用覆盖全部层的内容包围盒
    → 层间按世界坐标对齐；`area: 'viewport'` 取第一层的视口与画布尺寸。**单层传单个 target 时输出与历史逐字节一致**。
  - `composeLayersDataURL([layerA, layerB], opts)` / `composeLayersToCanvas(...)`：**位图合成**
    （PNG 截图 / 缩略图）。按层序 `drawImage` 叠加，尺寸缺省取各层 canvas 的最大者，可给背景色；
    运行时无离屏画布能力时抛稳定错误码 `ICE_OFFSCREEN_CANVAS_UNSUPPORTED`。
  - 示例 `examples/animation/layered-canvas.html` 增加"导出 SVG / 导出 PNG（两层合成）"两个按钮。
  回归：`tests/export/svg-export.test.ts` 新增 4 条（单层数组=单目标逐字节一致 / 层序 / 世界坐标对齐的并集 /
  空数组安全）+ `tests/export/compose-layers.test.ts` 5 条（层序、尺寸取最大与显式尺寸、背景、类型、错误码）
  + `e2e/visual/layered.spec.ts` 新增 1 条真实浏览器用例（SVG 含两层内容且 1024×640、PNG 为 1024×640）。

- **动画配置的结构化校验与诊断（Agent 侧闭环）**（2026-09-13）：
  - 新增 `validateAnimations(animations, options?)`（`src/animation/validate-animations.ts`，**纯函数**：不依赖 ICE 实例、
    不改传入对象、不 console）：把"什么算合法动画配置"变成可编程接口，产出
    `{ severity, code, message, path }[]`，码为 `ICE_ANIM_*`（`ICE_ANIMATION_DIAGNOSTIC_CODES`）：
    `KEY_INVALID` / `DURATION_INVALID` / `DELAY_INVALID` / `ITERATION_INVALID` / `EASING_UNKNOWN` /
    `VALUE_NOT_INTERPOLATABLE` / `KEYFRAMES_INVALID` / `INFINITE_LOOP`（warning）/
    `KEY_AFFECTS_MEASUREMENT`（warning：动画尺寸/文本这类会每帧重量测的属性）。
    传 `isSafeKey` 即可让"是否影响派生参数"与 `ANIMATION_SAFE_KEYS` 白名单同源。
  - `AnimationManager.getDiagnostics()` / `clearDiagnostics()`：**运行期**真实发生的拒绝与缓动回退也记同一组码
    （按 `code|path` 去重），应用层/Agent 不必再靠 console 文本判断配置被跳过。
  - `ICEComponent.isAnimationSafeKeyFor(Ctor, path)`：下游（DSL / Agent 校验）没有实例也能按类型问"这个属性动画安全吗"。
  - 顺带修正白名单语义：基类（不量测的图形）放行整条 `style.*`（矩形动画颜色不再被误判成"影响派生参数"）；
    `ICEText` 显式列出基类项而**不继承** `style.*`（字号/字间距/行高会改变盒子，仍必须走 `paramsDirty`）。
  回归：`tests/animation/validate-animations.test.ts`（10 条）、`tests/animation/animation-diagnostics.test.ts`（5 条）、
  `tests/graphic/animation-write-channel.test.ts` 增静态查询与白名单语义断言。

### 变更

- **帧调度与合规（④）**（2026-09-13）：
  - **空闲停帧**：`FrameManager` 从"无条件续帧"改为"按需续帧"——宿主（ICE 实例）用 `needsFrame()` 回答
    "这一帧还要吗"（脏 / 动画在推进 / `setContinuousFrames(true)`）；`ice.dirty = true`、`AnimationManager.add()`、
    `resume()` 都会 `wake()` 唤醒。真实浏览器实测：静止页面 500ms 内 **0 次帧回调**（改造前约 30 次），
    有动画时恢复、暂停与结束后再次归零。`ICE.destroy()` 的顺序随之调整（先清场景再注销总线），
    否则清理阶段的置脏会把刚停下的循环又拉起来。
    - ⚠️ **应用层迁移（破坏性行为变更）**：若你自己 `evtBus.on('ICE_FRAME_EVENT', …)` 做**逐帧计算**
      （时钟、令牌仿真、自绘指示器、自定义补间…），必须调 `ice.setContinuousFrames(true)`，
      否则引擎的空闲停帧会让你的逐帧逻辑**停摆**（"挂了监听"不再等于"帧还会来"）。
      用完记得归还（`setContinuousFrames(false)`），别把宿主的常驻帧诉求一起关掉。
      这不是理论风险：`ice-entity-designer` 的 BPMN 令牌仿真就是这样被真实浏览器 e2e 抓出来的
      （令牌停在第 2 个节点不动），修复见该仓 `src/bpmn/BpmnSimulator.ts` 的 `__acquireContinuousFrames`。
  - **次要动画降频**：动画配置新增 `fps`（如 `fps: 30`）——按时间降采样，跳过帧不改变运动曲线，终点仍精确。
  - **减少动态效果**：`prefers-reduced-motion: reduce`（或 `ice.setReducedMotion(true)`）下动画**直接落终态**，
    并记 `ICE_ANIM_REDUCED_MOTION` 运行期诊断；`AnimationManager.reducedMotion` 构造时读系统偏好。
  - 拖拽期间跳过命中检测：确认是**既有行为**（移动类事件本就不做命中检测），本轮补回归钉住。
  回归：`tests/FrameManager.idle.test.ts`（6）、`tests/animation/animation-scheduling.test.ts`（6，含 fps 采样、
  reduced-motion 折叠、帧需求）、`e2e/visual/animation-scheduling.spec.ts`（4 条真实浏览器：空闲停帧三段态 /
  置脏唤醒 / reduced-motion 落终态 / 正常偏好对照组）。

- **动画表达力：应用层自定义动画（⑤）**（2026-09-13）：
  - **自定义缓动**：`easing` 可直接传函数 `(t) => number`（只对这条动画生效），或 `registerEasing(name, fn)`
    注册后按名字用（新增 `easing-registry.ts`：`registerEasing` / `unregisterEasing` / `resolveEasing` /
    `easingNames` / `customEasingNames`；内置缓动不可覆盖，重名抛 `ICE_ANIM_EASING_NAME_CONFLICT`）。
  - **颜色与带单位数字串插值**（新增 `interpolators.ts`，校验与运行时同源）：支持
    `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa` / `rgb()` / `rgba()` 与 `'12px'`（单位须一致）；
    颜色在 sRGB 空间插值、输出统一 `rgb()` / `rgba()`。此前"颜色动画不支持"的坑填上了
    （`ICE_ANIM_VALUE_NOT_INTERPOLATABLE` 不再对颜色报错）。
  - **生命周期回调**：`onStart` / `onUpdate` / `onRepeat` / `onComplete`，回调上下文
    `{ component, key, value, progress, iteration, animation }`；回调异常只记 `ICE_ANIM_CALLBACK_ERROR`
    并忽略，不打断帧循环。
  - **往返方向**：`direction: 'normal' | 'reverse' | 'alternate'`（alternate 与 loop/iterationCount
    组合即 yoyo，奇数轮反向）；校验器新增 `ICE_ANIM_DIRECTION_INVALID`。
  回归：`tests/animation/interpolators-easing-registry.test.ts`（10）、`tests/animation/animation-expressiveness.test.ts`（9）、
  `e2e/visual/animation-expressiveness.spec.ts`（2 条真实浏览器：颜色动画真的画上画布 + 自定义缓动 +
  回调链 + alternate 往返）。

- **编排（时间轴 / 错峰）与运行时控制**（2026-09-13，⑥）：
  - `ice.animationManager.timeline()`：`add(component, config, { at })`（绝对毫秒或 `'+=N'` 相对上一条）、
    `stagger(components, config, { each, at })`（"卡片依次滑入"）、`play/pause/resume/stop/restart`、
    `duration` / `isPlaying()` / `finished`（Promise）。**它是调度器而非新的求值器**：`play()` 把 `at` 折算成
    `delay` 写进 `props.animations`，推进仍由 `AnimationManager` 完成 —— 缓动/关键帧/量化/缓存复用/空闲停帧
    自动生效。`play()` 每次都从头播放，`restart()` 即"点击重播"。
  - 运行时控制：`component.setAnimation(key, cfg)` / `removeAnimation(key)`（免"必须构造时声明"）、
    `manager.replay(component)` / `isAnimating(component)`。
  - **修掉两个真实缺陷**（都由真实浏览器 e2e 抓出）：① 没在构造时声明 `animations` 的组件，
    `props.animations` 继承的是**冻结的共享默认对象**，运行时挂动画会抛
    "Cannot add property …: object is not extensible" → `setAnimation` 内部做**写时复制**；
    ② 时间轴 `stop()` 后再 `play()` 会沿用上一次的 `startTime`，elapsed 一夜之间变成"已经跑很久"，
    编排被压缩/直接跳终点 → `play()` 现在每次都重置运行时状态；顺带把 `finished` 的计数从"轨道"改为"键"
    （一条轨道可挂多个属性，否则 Promise 会提前 resolve）。
  回归：`tests/animation/animation-timeline.test.ts`（11 条）+ `e2e/visual/animation-timeline.spec.ts`
  （2 条真实浏览器：错峰入场各卡片依次开始且最终全部落位；重播/停止冻结/暂停继续）+
  示例 `examples/animation/animation-timeline.html`（自定义缓动 + 错峰入场 + 重播按钮，进 examples 冒烟）。

  **待做**：OffscreenCanvas/GPU 后端（脏区门控已于 2026-09-13 定案：维持计数门，见本文"修复/变更"与 18 §3.3）。

## [2.2.0] - 2026-09-13

### 新增

- **i18n 边界与引擎侧原语**（2026-09-13）：明确「引擎不做 i18n，但必须让 i18n 显示正确」的契约
  （见 `docs/architecture/17-i18n-boundary.md` / AGENTS.md「i18n 边界铁律」），并补上三块原语：
  - **断行策略** `ICEText.wordBreak: 'normal' | 'break-all'`（默认 `'normal'`）：拉丁词不再被硬拆、
    CJK 逐字断并做禁则（行首禁标点 / 行尾禁开括号）、**无空格脚本（泰/老挝/高棉/缅甸）按词典分词断行**
    （复用 `Intl.Segmenter` 的 word 粒度，不需 locale；宿主不支持则退回逐字），单个词整行放不下时才硬拆；
    `'break-all'` 保留旧的逐 grapheme 贪心。实现 `src/graphic/text/text-wrap.ts`。
  - **文字方向** `ICEText.direction: 'ltr' | 'rtl' | 'auto'` + `textAlign: 'start' | 'end'`：
    `'auto'` 按首个强方向字符判定；渲染时写 `ctx.direction`（**特性检测**，运行时没有该成员就跳过），
    渲染结束归位 `inherit`（不破坏「组件渲染自包含」与脏矩形/离屏缓存契约）；SVG 导出输出
    `direction="rtl"` 并按方向映射 `text-anchor`。实现 `src/graphic/text/text-direction.ts`。
  - **稳定错误码** `ICE_ERROR_CODES` / `iceError()` / `getICEErrorCode()` / `isICEError()`：
    引擎错误带 `code`（`ICE_*`）与结构化 `details`，应用层据此映射自己的语言包，
    不必再匹配中文 message。实现 `src/util/errors.ts`。
- 以上三者随包导出（`toIsoTime`、错误码、`TYPE_ID_PATTERN` 等工具同理）。
- **文本排版正式配置**（2026-09-13，B 组第 5 项）：`lineHeight` / `letterSpacing` / `textDecoration`
  从「随 style 透传给 ctx 的野生键」变成引擎正式支持的排版属性，**量测 / 换行 / 渲染 / SVG 导出四处同一口径**
  （解析规则集中在 `src/graphic/text/text-style.ts`）：
  - `style.lineHeight`：数字按 **px**；字符串支持 `'2'`（无单位 = **倍数**）/ `'40px'` / `'1.5em'` / `'150%'`；
    `0` / 空 / `'normal'` = 引擎默认（`max(字形墨迹高, 字号 × 1.35)`，即既有行为）。显式配置后**单行也按它算盒高**。
  - `style.letterSpacing`：数字按 px；字符串支持 `'2px'` / `'0.2em'` / `'20%'`。量测前写进 `ctx.letterSpacing`
    （canvas 的 `measureText` 会把间距算进宽度，含最后一个字符后的间距），因此**盒子宽度 = 浏览器实际排版宽度**，
    换行 / 省略号也按含间距的宽度断行；SVG 导出输出 `letter-spacing`。
  - `style.textDecoration`：`'none' | 'underline' | 'line-through' | 'overline'`（可空格组合）。
    canvas 没有原生支持，由引擎按行自绘（颜色 `textDecorationColor` 留空跟随 `fillStyle`，粗细
    `textDecorationWidth` 留 0 按 `字号/14`）；SVG 导出输出 `text-decoration`。
  - 注意：下划线画在基线下 `0.12em`，会**溢出**「贴合字形墨迹」的几何盒 —— 脏矩形 / 离屏缓存的落墨盒
    已把它算进 `stylePaintPad()`（否则下划线会被裁掉半截）。
- **多行编辑**（B 组第 6 项）：`ICEText.multiline: true`（文本里已有 `\n` 时也自动按多行处理）——
  编辑态改挂透明 `<textarea>`（保留换行、不自动折行、不出滚动条），回车插入 `\n` 而不是提交，
  `Escape` 提交、`Ctrl/Cmd + Enter` 提交；无 DOM 运行时的 keydown 降级路径同步支持。单行编辑行为不变（回车提交）。
- **选区与按字形命中**（B 组第 7 项）：新增 `selectionStart` / `selectionEnd` 状态与
  `setSelection(start, end)` / `getSelection()` / `selectAll()` / `clearSelection()`；无 DOM 运行时
  选区由引擎自绘（`style.selectionColor`，DOM 编辑态交给浏览器的 input/textarea）；
  新增 `getCaretIndexAt(localX, localY)` —— 按**行带 + grapheme 边界中点**把本地坐标换算成光标下标（RTL 反向量）；
  编辑态的 `containsLocalPoint` 改为**按文本行**判定（点在 padding / 盒子空白处不算命中），非编辑态仍是盒子语义。
  行带按 `textBaseline`（top / middle / bottom / alphabetic）与真实字形 / 字体度量推导，
  `textBaseline: 'top'` 这类非默认基线下的光标与选区不再整体错位。

### 变更

- **引擎对文本保持中立**（2026-09-13，写进契约）：不做 Unicode 规范化 / 大小写折叠、不做任何
  locale 相关的默认格式化（时间戳固定 ISO 8601 UTC）、序列化逐字节保留用户文本。
- **`getRenderLines()` 行宽缓存**（B 组第 8 项）：逐行宽度在量测阶段顺手记入缓存（`__lineWidthCache`），
  居中 / 右对齐、装饰线、光标、选区、SVG 导出共用，不再各自 `measureText()` 一遍；`setState`（置 `paramsDirty`）
  与 `remeasureText()` 清空缓存，缓存 key 还带「行内容 + 字体 + 字间距」自我纠正。
- **离屏缓存指纹补齐文本墨迹属性**（同上）：`ObjectCache.contentKey` 的文本分支新增
  `lineHeight / letterSpacing / textDecoration* / selectionColor / direction / wrap / wordBreak / maxLines /
  ellipsis / selectionStart / selectionEnd` —— 这些属性只改墨迹、不改合成矩阵，漏进指纹就会出现
  「属性改了画面不动」（贴回旧位图）的隐蔽 bug。

### 修复

- **文本子系统四项契约级缺陷**（2026-09-13，审计 + 回归确立，铁律见 AGENTS.md）：回归用例
  `tests/graphic/text-bugfixes.test.ts`（8 条），视觉回归 `e2e/visual/offscreen-cache-fidelity.spec.ts`。
  - **`style` 透传的 ctx 状态泄漏**：`style` 是**透传**给 canvas 的（`__applyStyleProp` 末行 `ctx[prop] = value`），
    旧实现只把 shadow / globalAlpha / lineCap / textAlign 等 11 个属性列入归位表 —— 用户只要写一个没登记的键
    （`letterSpacing`、`direction`、`filter`、`imageSmoothingQuality`…），它就会**漏给同一帧后面绘制的组件**，
    破坏「组件渲染自包含」，也就是脏矩形局部重绘 / 离屏缓存的像素契约。现在归位表补齐到 21 项，
    虚线位改由数组长度推导（`LEAKY_LINE_DASH_BIT`）——**新增 style→ctx 键必须同步登记**。
  - **无 DOM 运行时的编辑不按 grapheme**：Backspace / Delete / 左右方向键改按 grapheme 边界移动
    （`a👍b` 退格删整个 emoji，而不是留下半个代理对）；`renderCaret()` 重写，光标位置对**多行**
    （按 `\n` 折行定位）、**RTL**（从右边缘往左量）与 `textAlign: start/end/center/right` 都正确。
  - **自定义字体加载完成后不重测**：`ice.loadFont()` resolve 后自动 `remeasureTexts()`，
    首帧用回退字体量出的宽高与换行不再残留（i18n 场景下中文字体按需加载最容易踩）；
    `ICEText.remeasureText()` 只标脏，真正的重算发生在下一帧渲染。
  - **「默认值 10 = 未设置」哨兵**：文本的自动尺寸改为按「**调用方是否显式给尺寸**」判定 ——
    构造参数与 `setState({ width / height })`（含布局管理器分配的尺寸）都算显式，此后不再被量测覆盖；
    `new ICEText({ width: 10, height: 10 })` 因此不再被悄悄放大，未给尺寸时行为不变。引擎内 10 处
    依赖旧哨兵语义的测试/视觉夹具一并清理（`tests/persistence/derived-children.test.ts`、
    `tests/renderer/CanvasRenderer.dirty-rect-gate.test.ts`、
    `e2e/visual/fixtures/{offscreen-cache-fidelity,dirty-rect-compare}.html`）。

## [2.1.1] - 2026-09-13

### 修复

- **首次写出即定下 `createTime`**（2026-09-13）：`Serializer` 在没有现成 `createTime` 时，
  以前只取 `now` 却不记住它 —— 于是**同一会话里每次序列化都会得到不同的 `createTime`**
  （"首次创建时刻"名不副实，`undo/redo` 依赖的「同一份内容序列化结果稳定」也不成立）。
  现在首次写出会把它写进 `ice.documentMeta`，之后一直沿用；`clearAll()` 后重新定。
  回归用例用假时钟推进 5 秒再写一次，专门钉死这个坑（此前的用例靠"同一毫秒碰巧相等"假通过）。

## [2.1.0] - 2026-09-13

### 新增

- **导出 `toIsoTime(value)`**（2026-09-13）：把任意历史时间值（ISO 字符串 / `2022/1/1 00:00:00`
  这类 `toLocaleString` 产物 / epoch 毫秒 / `Date`）归一化成 ISO 8601 UTC；解析不了返回 `undefined`。
  下游包在自己的快照格式里带 `createTime` 时直接复用它，保证「历史格式 → ISO」的规则只有一份。

### 修复

- **载入失败不再改动文档元信息**（2026-09-13）：`Deserializer` 读 `createTime` 的时机从"解析前"
  挪到 `migrate()` **之后** —— 此前载入一个版本不支持的数据（`migrate` 抛错）会先把该数据里的
  `createTime` 写进 `ice.documentMeta`，一次失败的载入污染了当前文档的出生时间。

## [2.0.1] - 2026-09-13

### 修复

- **时间戳有了真正的语义：`createTime` 跨保存保留**（2026-09-13）：以前两个字段都是"这一次写出的时刻"，
  于是 `createTime` 名不副实（重新打开再保存就变了）。现在 `Deserializer` 会把读到的 `createTime`
  记到 `ice.documentMeta.createTime`（归一化成 ISO 8601 UTC），`Serializer` 写出时优先沿用它，
  `lastModifyTime` 才是本次写出的时刻；`ice.clearAll()` 清空即视为新文档、并清掉该值。
  数据里没有 / 解析不了（历史脏值）则回退到当前时刻。回归用例见 `tests/persistence/serialization.test.ts`。
- **序列化时间戳改用 ISO 8601 UTC**（2026-09-13）：`createTime` / `lastModifyTime` 从
  `new Date().toLocaleString()` 改为 `new Date().toISOString()`（如 `2026-09-13T04:12:33.123Z`）。
  旧实现在 **zh-CN 机器上写 `2026/9/13 12:12:33`、en-US 机器上写 `9/13/2026, 12:12:33 PM`**
  ——同一份工程换个运行环境，导出数据就不一样，而且不能直接排序/比对。新格式定长、字典序即时间序、
  任何语言与工具都能解析。两个字段**只是导出元信息**（引擎不读、反序列化不依赖），因此不需要迁移；
  需要「导出结果逐字节可比」的场景请自行丢弃它们（`ice-entity-designer` 的 `FlowDesigner` 已这么做）。

## [2.0.0] - 2026-09-13

### 变更（破坏性：自研 / 第三方自定义类型需要迁移）

- **类型标识统一为 `namespace:Type`**（2026-09-13）：`ICE.registerType()` 的第一个参数从
  「全局类名」改为 **canonical typeId**，格式 `/^[a-z][a-z0-9-]*:[A-Za-z_][A-Za-z0-9_-]*$/`
  （工具函数 `src/util/type-id.ts`）。引擎内置改为 `ice-render:*`（`ice-render:Rect`、
  `ice-render:Group`…），下游各自用自己的包名（`ice-entity-designer:*`、`ice-chart:*`、
  第三方 `my-app:*`）。**为什么要改**：无 namespace 的类名是一张全局平面表，ICE 家族
  （引擎 / 实体设计器 / 图表 / 业务方）各自的自定义图元必然撞名，而旧的注册表对该情况
  **静默覆盖**（ice-chart 甚至专门 `try/catch` 吞掉了重复注册异常）——撞名后已存数据会错乱，
  且没有任何信号。现在冲突一律显式化。
- **注册冲突明确抛错**（2026-09-13）：① 同一 typeId 注册**不同**构造函数 → 抛错；
  ② 同一构造函数注册**第二个** canonical typeId → 抛错（否则 `getTypeId()` 反查歧义，
  写出哪个名字取决于注册顺序）；③ 同一 typeId + 同一构造函数 → 幂等，不抛错。
- **不做旧名兼容**（2026-09-13）：家族仍在发布初期（引用者少、无历史包袱），因此引擎不维护
  「旧的无 namespace 类名 → 新 typeId」的别名表。`ICERect` 之类的旧写法、`ice-chart` 的旧 kebab 名
  （`ice-plot-area`）、`ice-entity-designer` 的旧领域名（`FlowNode`…）一律不再被识别；
  旧格式数据里的节点按「未注册类型」处理（跳过 + 记入 `deserializer.unknownTypes`），改数据即可。
- **注册表改为无原型对象**（2026-09-13）：`ice.typeMapping` 不再是 `{}`，
  否则 `getType('constructor')` / `getType('toString')` 会命中 `Object.prototype` 上的成员，
  把脏数据变成 `new Object(state)` 或抛出「别名冲突」的假错误。

### 新增

- **`Serializer.unregisteredTypes`**（2026-09-13）：序列化时未注册的类型仍回退写出
  `constructor.name`（保持既有约定），但会被去重记录并告警 —— 回退名在下游打包后可能被
  mangle，静默写出去等于埋雷。应用层可据此提示用户先 `registerType()`。
  对应地，反序列化侧的未注册类型仍记录在 `deserializer.unknownTypes`。
- **`ICE.hasType(typeId)` / `ICE.getRegisteredTypeIds()`**（2026-09-13）：查询当前实例的
  canonical 注册表（便于自检命名空间是否规范）。
- **插件注册失败的错误信息带上插件名**（2026-09-13）：`ICE.use(plugin)` 的 `components`
  里出现非法 / 冲突的 typeId 时，报错形如 `插件 "xxx" 注册组件类型失败：...`。

## [1.4.10] - 2026-09-13

### 新增

- **「小程序形状」运行时回归**（2026-09-13）：新增 `tests/mini-program/`，把 `document` / `window` /
  `Path2D` / `requestAnimationFrame` / `FontFace` / `OffscreenCanvas` 全部摘掉，只留 `wx.*`，
  画布对象就是小程序 canvas 节点本来的样子（只有 `width` / `height` / `getContext`），每次提交都验证：
  启动、出帧（无 rAF 走定时器兜底）、路径命令重放（无原生 `Path2D`）、离屏缓存与降级、
  文本量测降级、触摸输入归一化、序列化往返、SVG 导出，外加一条「不许触碰小程序 Canvas 2D 子集之外
  成员」的越界检查。这一层当场抓出并修掉了下面五个缺陷。
- **小程序接入示例与宿主契约**（2026-09-13）：`examples/mini-program/` 提供开发者工具可直接打开的
  页面（含触摸坐标适配层），文档补「宿主最少要做什么」与「自动验证到哪一层 / 哪些只有真机才能覆盖」。
- **模拟器级端到端脚本**（2026-09-13）：`examples/mini-program/e2e/smoke.js` 用官方
  `miniprogram-automator` 在真实小程序运行时里跑「加载 → `ICE.init` → 触摸拖拽 → 图元位移 → 截图」，
  本地手动执行（不进 CI，见脚本头部说明）。

### 修复

- **`ICE.init()` 不再无条件调用 `canvasEl.getBoundingClientRect()`**（2026-09-13）：小程序 canvas 节点
  没有这个方法，此前会**启动即崩**。新增 `ICE.readCanvasRect()`：缺失时退回「原点 (0,0) + 画布自身
  尺寸」，正好对上小程序「触摸坐标相对画布」的语义，宿主不需要再包一层假 DOM。
- **老基础库没有 `wx.createOffscreenCanvas` 时不再在帧回调里抛错**（2026-09-13）：`ObjectCache`
  建位图失败会向上抛，而它发生在帧回调里 —— 未捕获异常＝小程序白屏。现在捕获后整体关闭缓存、
  退化为直接落墨，并记住该运行时没有离屏能力。
- **无 DOM 时文本量测不再靠抛异常降级**（2026-09-13）：`ICEText.__measureByDOM()` 在没有 `document`
  的运行时（小程序 / headless）会先抛错再被吞掉，控制台刷错误日志；现在直接按 state 尺寸兜底。
- **控制面板不再假定 `evt.target` 存在**（2026-09-13）：小程序合成的事件对象没有 `target`
  （浏览器里它恰好是 canvas 元素，所以这个空值一直没暴露），此前会直接崩。
- **`fromJSONObject()` 的延迟回调不再写已销毁实例**（2026-09-13）：它在 300ms 后写
  `eventDispatcher.stopped`，若实例在窗口期内 `destroy()`，`eventDispatcher` 已置空 →
  定时器里抛未捕获异常。

### 验证

- 单测：**93 套件 / 728 用例**（含新增的 15 条小程序形状运行时用例）；
- 模拟器级：`examples/mini-program` 在真实小程序运行时里 5/5 断言通过
  （页面加载 + `ICE.init`、引擎建图、触摸拖拽使方块从 (40,40) 移动到 (240,220)、截图存档）。

## [1.4.9] - 2026-09-12

### 修复

- **祖先半透明时不再走离屏缓存**（2026-09-12）：位图是 `build() → renderTo()` 用**当时**的
  `getEffectiveOpacity()` 烤出来的，而贴图路径 `draw()` 只做 `drawImage`（不叠 alpha）——
  于是「先建位图、后改不透明度」会把组件永久定格在那一刻：淡入的模态 / 抽屉 / 消息里，
  文字永远半透明；淡入起点 `opacity=0` 的直接烤成空位图，**底板出来了、文字整条不见**
  （`ice-web-components/examples/arcade.html` 的「已暂停」提示就是这么消失的）。
  现在 `isCachable()` 把「自身 × 祖先链」的有效不透明度纳入判定（与既有契约
  「不透明度 ≠ 1 时按非不透明落墨处理」一致），并且 `render()` 在组件因透明度变得不可缓存时
  丢掉旧位图，避免它在恢复不透明后被 `!dirty` 的静态命中又贴回来。
  回归：`tests/renderer/ObjectCache.test.ts`（祖先半透明 / 自身半透明 / 恢复后重建三条）。

## [1.4.5] - 2026-09-12

### 修复

- **移动事件的输入矩形不再缓存**（2026-09-12）：图表创建之后，页面在画布**上方**插入内容
  （提示条 / 错误信息 / 广告位）会把画布往下推，而 `DOMEventDispatcher` 只在非移动事件刷新矩形 ——
  之后每一次 `mousemove` 的 canvas 内坐标都偏移同样的距离，**命中 / 悬停 / 拖拽整体错位**，
  直到用户点一下或滚一格。现在移动事件走 `ICE.refreshInputRect()`：只重读一次
  `getBoundingClientRect()`（实测 0.22µs，强制重排最坏 2.8µs），尺寸没变时平移已缓存的内容盒，
  连 `getComputedStyle` 都不用读；尺寸变化时退回完整刷新。
  另外修掉一个自己踩的坑：做位移增量不能用上一次的 rect 对象引用做差（桩/小程序返回同一个可变对象，
  增量恒为 0）。回归：`tests/ICE.input-rect.test.ts`、`tests/event/DOMEventDispatcher.input.test.ts`、
  `e2e/visual/input-rect-shift.spec.ts`（回退修复即变红）。

## [1.3.0] - 2026-09-12

### 新增

- **子树不透明度 `state.opacity`**（2026-09-12）：
  `opacity` ∈ [0,1]（默认 1）作用于**本组件及其所有后代**。引擎把树拉平、逐个组件独立绘制，
  祖先的 ctx 状态不会自动继承给后代 —— 只设 `style.globalAlpha` 只能让组件**自身**变透明，
  淡入淡出 Modal / Drawer / Message 这类「整棵子树」的场景会只剩背景在变。
  实现：渲染时把自身与所有祖先的 opacity 相乘后叠到 `ctx.globalAlpha`（顶层组件直接返回，
  热路径上只是一次字段读），并在泄漏属性归位里显式复位 —— 它的值不在 `style` 键里，
  `__resetLeakyCtxState` 的两轮扫描发现不了，不复位会污染后续组件（回归测试抓到的）。
  `opacity ≠ 1` 的组件按「非不透明落墨」处理：不参与离屏缓存、脏矩形回退更保守。
  回归测试 `tests/graphic/opacity.test.ts`（5 项）。

## [1.2.0] - 2026-09-12

### 新增

- **子树裁剪：`clipChildren`**（2026-09-12）：
  容器把 `state.clipChildren` 设为 `true` 后，**所有后代**都会被裁到自己的盒子内 —— 滚动容器、
  可裁剪视口这类需求的底座（此前引擎只有脏矩形用的 `ctx.clip`，没有任何容器级裁剪能力）。
  裁剪在**设备空间**建立，与脏矩形路径同一套做法（`setTransform(单位矩阵) → rect → clip →
  复原本组件 CTM`）：clip 记录在 ctx 的裁剪状态里，组件自己后续 `setTransform` 不会清掉它，
  `restore()` 才移除；多层裁剪容器会依次求交。祖先有旋转/斜切时按其世界 AABB 保守裁剪。
  配套两项：**命中检测**同样尊重裁剪区（滚动容器里滚出去的子组件点不到）；**被裁剪的组件
  不参与离屏缓存**（位图是单独渲染的、不含那层裁剪，贴回去会画到裁剪区外）。
  回归测试 `tests/graphic/clip-children.test.ts`（7 项）。

## [1.1.0] - 2026-09-12

> 相对 1.0.7：新增能力向后兼容，但含几处「修正类」行为变化，见下方「需要注意」。

### 修复

- **居中/右对齐的文字整体偏移半个到一个字宽 —— `ctx.textAlign` 被 canvas 二次应用**（2026-09-12）：
  `ICEText.doRender` 的水平对齐一直是**手工算 x**（「文字起点」语义），但 `applyStyleToCtx()`
  会把 `style.textAlign` 写进 ctx，canvas 于是又按其对齐一次：`center` 再左偏半个文字宽度、
  `right` 再左偏一个文字宽度（传了 `maxWidth` 时还会连带压缩字形）。
  实测（组件示例页抓到的真实 `fillText` 参数）：按钮 `x=-35.51` + `ctx.textAlign='center'` →
  文字中心左偏 **35.5px**；头像首字母因此**偏出圆形之外**；统计卡图标、复选框对勾、tab 标签同理。
  现在在居中/右对齐分支把 `ctx.textAlign` 复位为 `left`，与下方公式一致。`textBaseline` 不受影响：
  纵向本来就依赖 ctx（`middle` 分支算的是中线、其余分支算的是盒底），横向则完全由本方法接管。

- **`textAlign: 'center' / 'right'` 的起点公式把文字放到了盒边缘**（2026-09-12）：
  旧实现 `center` 时 `x = 0`、`right` 时 `x = localOrigin[0] - paddingRight` —— 等于把文字**起点**
  放到盒中心/右缘，`right` 会直接溢出到相邻列。现在按**逐行实测宽度**算起点：
  `center → x = -lineWidth / 2`，`right → x = localOrigin[0] - paddingRight - lineWidth`（flush-right，
  不溢出）。左对齐保持原逻辑，避免逐行 `measureText` 的开销。

- **`addChild(child, false)` 会吞掉「从未渲染过」的组件的脏标记**（2026-09-12）：
  `dirty` 在引擎里同时承担「本帧要重绘」与「几何缓存是否有效」两个语义，后者只在
  `ICEPath.doRender` 里以 `if (this.dirty) createPathObject()` 的形式被消费；而
  `ICEGroup.addChild(child, false)` 会执行 `this.dirty = markDirty`，把容器**自己**强制置干净 ——
  对从未绘制过的组件来说，几何缓存就永远不会建立，首帧自身画出来是**空路径**。
  线上表现：`UIButton` 构造函数里 `addChild(this.label, false)` 把自己置干净，按钮的圆角背景/边框
  全都不画，只剩白底白字的标签（`ice-web-components` 的 gallery 示例里 Primary / Danger / Small /
  Large 完全看不见）。凡「构造期用 `markDirty=false` 挂子组件、又没有被 `addChildren` 补一次置脏」
  的组件都会中招。现在新增 `__everRendered` 与 `__applyDirty()`：`markDirty=false` 只表示
  「这次操作不要主动置脏」，**不再**把从未渲染过的组件强制置干净；已上屏过的组件仍保留原有
  批量挂载的优化语义。回归测试 `tests/graphic/ICEGroup.add-child-dirty.test.ts`（3 项，改前 2 项红）。

- **离屏缓存（`ObjectCache`）与直接落墨逐像素不一致 —— 缓存一直在悄悄降画质**（2026-09-11）：
  位图的**光栅化缩放**取的是 `root.devicePixelRatio`，而主画布的实际设备比例是 `ice.dpr`（默认 1）；
  贴图还用**世界尺寸**（`lw/lh`）当 `drawImage` 的目标矩形、落点带小数（paint pad 之后是亚像素值），
  并且依赖一句 `ctx.scale(dpr,dpr)` —— 而那一句会被 `renderTo()` 内部的 `setTransform()`
  **整条覆盖**，本来就是死代码。三个问题叠加的结果是「位图被缩放着贴回」，任何 `dpr≠1`
  或视口缩放都会触发双线性重采样。
  实测（`ice-entity-designer`，视口 scale≈0.386）：开启缓存相对「直接落墨」会改变 **1.6%~2.1% 的像素**、
  **丢失 8.5%~15.5% 的墨迹**（视网膜屏上缓存文字只剩约 30% 墨迹）。
  现在改为：位图按**渲染视口**的缩放（`getRenderViewport().scale`，已含 dpr 与视口缩放）光栅化，
  base 矩阵显式写成 `[rs,0,0,rs, ox-dx, oy-dy]`；贴图落点取整到**整数设备像素**、1:1 贴回
  （`drawImage(img, dx, dy)`，不传目标宽高）——**全程零重采样**。
  改后同样的应用实测：**缓存与直接落墨逐像素 0 差异**，墨迹差 **−15px / 0.019%**。
  另外修掉两处相关缺陷：① 子类在 `super.doRender()` 之后用 `applyTransformToCtx(null, true)` 复原变换，
  在离屏通道里会按主画布视口重算、丢掉位图原点的平移（表现为**连线箭头与标签在缓存位图里整块消失**），
  现在统一走新的 `applyActiveTransform()`（同时适配主画布与离屏通道）；② 重建位图时没有扣回旧条目的
  字节数，导致 `MAX_CACHE_BYTES` 总预算被提前耗尽（现在记账精确）。
  回归用例：`tests/renderer/offscreen-cache-fidelity.test.ts`、
  `e2e/visual/offscreen-cache-fidelity.spec.ts`（6 个配置 × 12 步，断言 alpha 零差异、预乘通道差 ≤3/255、
  墨迹守恒）。
- **`coalesceRegions` 会把细长脏盒串成一个整屏大盒，导致局部重绘永远回退全量**（2026-09-11）：
  原来的合并策略是「相交就合并」，于是编辑器里拖动一个实体时，8 条横跨画布的关系连线
  旧/新盒互相交叉，22 个脏盒被串成**一个覆盖整屏的大盒**（实测面积占画布 **1.004**），
  永远撞上「脏区面积占比 > 0.35 回退全量」——而 22 个盒的**实际面积之和只有画布的 6%**。
  现在加了两条约束：① **合并护栏** —— 只有「合并后面积 ≤ 两块面积之和 × 2」才合并
  （相邻/嵌套/同向延展的正常合并比值 ≈1.0~1.3，不受影响）；② `maxRegions` 从**硬上限**改为**软上限**
  —— 没有划算的合并时就多留几块（每块区只是一遍 O(组件数) 的 AABB 过滤），
  区数超过 24 才塌缩成一个并集盒、交给面积阈值回退全量。
  回归用例：`tests/renderer/dirty-rect-util.test.ts`。
- **`ICEPolyLine.__localBox()` 并入连线标签矩形**（2026-09-11）：标签画在折线中点、天然可能超出
  「折线带宽」盒，走离屏缓存时会被位图裁掉。现在盒 = 折线带宽顶点 ∪ 箭头三角面 ∪ 标签矩形，
  由 `__measureLabelBoxForBounds()` 统一口径（量完恢复 `ctx.font`，盒子计算不留渲染副作用）。

### 变更

- **连线可以走离屏缓存了**（2026-09-11，此前一律排除 `isLine`）：排除的理由是「位图可能很大」，
  代价是 `__riskyIntersectsRegions` 里「干净但不可缓存的 risky 组件与脏区相交 → 回退全量」这条
  常态命中 —— 连线横跨画布，任何脏区都与它相交。现在改为「允许缓存，但按**设备像素面积**设上限」
  （单条 ≤200 万设备像素 ≈8MB，总量 ≤32MB，排除蚂蚁线 `lineDashFlow`）。
  实测收益（`ice-entity-designer`，拖动实体）：局部重绘计划成立次数 **0 → 20**，
  渲染耗时 **3.3ms/帧 → 2.2ms/帧（−31%）**，且「局部 ≡ 全量」逐像素 **0 差异**。
- **`ObjectCache` 只在「视口稳定」的帧生效**（2026-09-11）：新增 `beginFrame()`，渲染器每帧开头调用；
  视口一变，所有位图的栅格都要重算（代价与这一帧直接落墨同阶），因此变化的那一帧直接停用缓存、
  落到直接绘制路径，手势停下后的第一帧再统一重建 —— 避免缩放/平移过程中的整屏位图重建。
- **`maxRegions` 语义**：见上方「修复」第 2 条（硬上限 → 软上限）。

### 新增

- **连线形态可配 `linkShape: 'visio' | 'bezier'`（默认 `'visio'`）**：
  `ICEVisioLink` 此前只画 Visio 形态（正交折线 + 出口点 + 路径评分）。现在可切**普通贝塞尔曲线**：
  从两端点与**插槽外法线**构造三次贝塞尔（控制点伸出长度 = 两端直线距离 × 0.45，下限 24px），
  再按距离自适应等分采样（8~24 段）成密集折线。采样点**写回 `state.points`** 而不是只算 dots ——
  因为 `isDotsOnSameLine()` / `getLabelPosition()` 只读 points，只留首尾两点会被判「共线」，
  包围盒就退化成「弦 ± 线宽」，曲线鼓出的部分会落在盒外（dirty-rect 局部重绘会把曲线裁掉）。
  绘制仍走既有折线通路（描边 + 箭头），因此命中检测、箭头、label 都无需改动。
- **端点箭头样式可配 `arrowStyle: 'filled' | 'hollow'`（默认 `'filled'` 实心）**：
  线条端点三角箭头此前只有描边（看起来是空心），现在默认用**线色**填充成实心；
  需要旧观感的显式传 `arrowStyle: 'hollow'`。填充色跟随线色（`strokeStyle`），未新增颜色配置项；
  `arrow: 'both'` 时两端共用同一开关。
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
- **插件机制 `ICE.use(plugin)` / `ICE.unuse(name)`**：开放三层注册点——
  ① `components`（自定义图元类型，自动注册并可通过 typeId 反查，因此可序列化）；
  ② `render(frame)`（每帧世界坐标叠加绘制，两条渲染路径都调用，局部帧在 clip 之内）；
  ③ `tools`（按 `match(component)` 挂载/摘除自定义工具，`exclusive` 可屏蔽内置变换/连线面板）。
  提供 `setup` / `teardown` 生命周期与幂等注册。
- **选中统一入口 `ICE.setSelection(components)`**：写 `selectionList` 并同步插件工具；
  返回值表示是否有「排他」插件工具命中（供调用方禁用内置面板）。
- **无障碍原语**：`ICE.getAccessibilityTree(options?)` 产出可访问节点快照（角色建议 / 可读名称 /
  屏幕坐标盒 / 层级 / tab 顺序 / 可聚焦性 / 选中态，只含已上屏组件且不修改任何组件 state）；
  `ICE.setFocusedComponent(componentOrId)` 让键盘事件派发给焦点组件。
  引擎**不自建 DOM 镜像层**——镜像的 DOM 结构、ARIA 与文案由应用层决定（参考实现见
  `examples/a11y/a11y-mirror.html`，设计说明见 `docs/architecture/14-accessibility.md`）。

- **包完整性门禁 `npm run pkg:check`**：`publint`（`exports`/`types`/`files` 契约）+ `attw`
  （类型在 `node10` / `node16`(CJS/ESM) / `bundler` 各解析模式下是否正确），已接入 CI。
- **jest 覆盖率门槛**：`collectCoverageFrom` 改为全量 `src`，并按实测基线设「只许上调」的棘轮门槛
  （语句 65 / 分支 58 / 函数 72 / 行 65）；CI 单测改为 `npm test -- --coverage`。
- **`ICE.findComponent` 支持递归查找**：先查顶层（同 id 顶层优先，保持既有优先级），再深度优先
  递归子树；工具层不参与查找。这样**「连线连接嵌套子组件」**才真正生效
  （此前只搜 `childNodes` 第一层，嵌套场景的连接会静默失效）。
- **动画关键帧时间轴**：`animations: { left: { keyframes: [{ offset, value, easing? }], duration } }`。
  `offset` 为 0~1 的时间占比，缺省时按数组顺序均分、超出会被夹紧、乱序会自动排序；`easing` 写在
  **段起始帧**上，只作用于该段（未写则回落到动画级 `easing`）；时间轴之外的取值分别是首帧 / 末帧值（不外推）。
- **弹簧类缓动**：`easing: 'spring' | 'springSoft' | 'springSnappy'`（欠阻尼谐振子解析解，自带过冲），
  并已接入主题 `motion.easing` token。缓动被拆成两层：新增 `EasingProgress`（归一化进度函数，
  纯函数、不读时钟，供关键帧段内缓动按任意局部进度求值；**模块内导出，未加入包入口**），
  `Easing` 保持历史的「值语义」签名不变（9 个既有函数体逐字未改）。
- **数组字段补间**：`transform.scale` / `transform.translate` / `transform.skew` 等数组字段按分量
  **逐元素插值**，可与关键帧、弹簧缓动组合。

### 新增（2026-09-11 第二轮）

- **声明式渐变 `style.fillGradient` / `style.strokeGradient`**：用纯对象描述 `linear` / `radial` / `conic`
  渐变（`{ type, from/to | center/radius/innerRadius | startAngle, stops }`，坐标是组件本地坐标）。
  与手搓 `CanvasGradient` 的关键差别：**可序列化**（纯对象，存盘不丢，手搓的会被 `NON_SERIALIZABLE_KEYS`
  一类机制剔除）与**可写进主题 preset**（随 `setTheme` 重新按新主题色展开，内置 `preset: 'gradient'`）。
  渲染时按描述对象**引用**缓存 `CanvasGradient`（`refreshParams` 失效），`stops` 支持 `[[offset,color]]`
  与 `[{offset,color}]` 两种写法；运行时缺 `createConicGradient` 时退回中间色纯色，不会「什么都没画出来」。
  渐变在样式应用的最后一步写入，保证压过同层 `fillStyle`（不依赖 style 的键序）。
- **布局响应式重排**：子组件改 `width/height` 后，父容器会在**下一帧**重排（`ICEGroup.requestLayout()`，
  一帧内多次请求合并成一次，布局执行期间的子项变化不会自激）。此前只在 `setLayout()`/`addChild()` 排一次，
  改子项尺寸不会触发重排、兄弟节点停在老位置。另新增 `ICEGroup.getPreferredSize()` 转发布局策略。
- **`display: false` 的子树语义**：新增 `ICEComponent.isEffectivelyVisible()`（沿父链判断，顶层走 O(1) 快路径），
  渲染、命中检测、离屏缓存、无障碍快照统一用它。此前只判组件自身，隐藏父容器后子组件照样被画、照样能点中。
- **变换手柄修改键约束**：`Shift` 拖角手柄保持宽高比、`Shift` 拖旋转手柄吸附 15°（`ROTATE_SNAP_STEP`）。
  同时在输入归一化层**透传修饰键**（`shiftKey/ctrlKey/altKey/metaKey`）—— 它们是 DOM 事件原型上的
  不可枚举 getter，`ICEEvent` 的 `for...in` 拷贝带不过来，此前组件永远拿不到。
- **指针捕获**：`pointerdown` 时把指针捕获到画布、`pointerup/cancel` 释放。此前拖拽（拖组件/拖手柄/拖连线钩子）
  时指针移出画布就收不到后续事件，表现为「拖着拖着不跟手」甚至「松手了还在拖」。
- **公共几何 API**（`GeoUtil`）：`pointInPolygon`、`distanceToSegment`、`distanceToPolyline`、
  `samplePolyline`、`segmentIntersect`。这些原先都以私有实现散落在图元里（`ICEDotPath` 的射线法、
  `ICEPolyLine` 的点-线段距离），现在图元改为消费公共实现，应用层做自己的命中/碰撞/路径计算不必再抄。

### 修复（2026-09-11 第三轮）

- **每次渲染约 15% 的开销回归**（本批改动自己引入的，靠补测发现）：`isEffectivelyVisible()` 每帧被调用
  3~4 次/组件，而组件多层嵌套 → 每次都沿父链走到底。5000 图元场景实测 场景A 2.20→2.51ms（+14.5%）、
  场景C 0.090→0.111ms（+21%）；把它临时短路成旧语义即回到基线，证明回归全部来自该函数体。
  修法是**可见性代际缓存**（模块级 epoch，display 变化与树结构变化时自增，每代每组件只走一次父链）。
  同时修掉两个同源缺口（`ICEGroup.setState` 是独立实现、不调 `super.setState`）：隐藏「分组」不失效后代
  可见性缓存、分组改尺寸不请求父容器重排 —— 后者是上一轮「布局响应式」遗留的漏洞。做法是把这两件事抽成
  `setState` 的前/后置钩子。对照复测：新 2.18~2.26ms vs 旧 2.19~2.38ms（区间重叠，回归消除）。
- **富场景局部重绘：放开「仅位置变化」的变脏 risky 组件**：此前「刚变脏的 risky 组件一律回退」，
  导致编辑器里拖动含文本的实体时 100% 回退（应用实测 22/22 帧）。判据细化为：
  内容/几何变了（`paramsDirty`）→ 一律回退；仅位置变化且非文本 → 放行（盒 + paint pad 已覆盖墨迹）；
  仅位置变化且是文本 → 必须有离屏缓存。实现上必须在收集阶段先快照 `paramsDirty`
  （`__freshBox()` 会把它清掉，不先快照会把「内容变了」误判成「只是平移」）。
- **基准脚本长期静默失效**：`bench/render.cjs` 默认产物路径指向早已改名的 `dist/index.cjs.js`，
  `npm run bench` 直接跑不起来（也因此没人发现上面那个 15% 回归）；README 里「5000 图元 0.8ms」
  实测是 2.2ms。现在路径已修、加 `tests/tooling/bench-smoke.test.ts` 守住「脚本可执行 + 指标齐全」、
  CI 加 bench 步骤，文档数字改为「用 `npm run bench 5000` 复现 + 标注机器与日期」。

### 修复（2026-09-11 第二轮）

- **脏矩形局部重绘此前在「非单位视口」与「dpr≠1」下直接回退全量**：`__collect()` 曾用
  `if (vp.scale !== 1 || vp.tx !== 0 || vp.ty !== 0) return null` 与 `if (dpr !== 1) return null` 兜底，
  理由是「世界盒与屏幕 clearRect/clip 不一致」。但这两类恰好是真实场景（编辑器必然缩放平移；
  高分屏要开 dpr 才不发虚），等于招牌优化在最需要的地方完全失效。现在改为把脏区经
  `mapBoxToRender()` 映射到**渲染坐标**（`dpr · viewport`，向外取整防接缝）后再 clear/clip，
  相交判定仍在世界坐标里做。回归：`e2e/visual/dirty-rect-pixel.spec.ts` 新增 `?zoom=1`、`?hidpi=1`、
  `?zoom=1&hidpi=1` 三个场景，断言「局部重绘执行次数 > 0」且 10 步逐像素与全量 100% 一致。
- **分散脏区被并成一个大盒 → 极易回退全量**：新增 `coalesceRegions()`，把脏区聚合成若干块
  **互不相接**的裁剪区（上限 6 块，超出时合并「面积增量最小」的两块），逐块 clear + clip。
  此前画布对角两处小脏点会被并成一个覆盖大半画布的大盒，直接撞「脏区面积 > 35%」阈值。
- **命中检测有两份几乎相同的实现**（`DOMEventDispatcher` 与 `ICE.hitTest`）→ 收敛为
  `hitTestComponents()` 单一实现（含 z 序、控制面板过滤、有效可见性、包围盒预筛），避免
  「点得到但 `hitTest` 找不到」这类不一致；`flattenTree(childNodes)+flattenTree(toolNodes)`
  的重复也收敛为 `flattenAllComponents()`。
- **交互式连线连不上嵌套子组件**：`ICELinkSlotManager` 的碰撞检测只遍历顶层 `childNodes`，
  现在改用拉平后的全集并按 z 序取最上层（与点击语义一致）。同时修掉「命中后从不重置
  `collision`」——旧实现在钩子离开组件后仍把插槽粘在原处不消失。
- **`gl-matrix` 的版权声明缺失 + rollup `external` 是死代码**：产物内联了 gl-matrix（MIT），
  但此前 banner 只有引擎自己的 MIT，不满足「保留版权声明」；现在 `rollup-plugin-license` 产出
  `dist/THIRD-PARTY-NOTICES.txt`。同时删掉 `rollup.config.mjs` 里定义后从未被引用的 `external`
  —— 它是地雷：谁把它接上就会去 require 一个只声明在 `devDependencies` 的包，下游直接炸。
  文档里「运行时仅 gl-matrix 一个库」的说法一并改为「零运行时依赖（内联）」。

### 修复

- **相邻两点重合时箭头算出 NaN**：`ICEPolyLine.doCalcArrowPoints()` 用 `p2 / hypot(p2)` 归一化切线方向，
  两点重合（例如两端点完全重合的退化连线、或贝塞尔零长退化）时会得到 `0/0 = NaN`，
  而 NaN 一旦写进点集会**污染包围盒与命中判定**（且不报错）。现加零向量短路：方向无定义时返回
  退化的三角面（三点重合），保持点集有限。
- **已销毁的连线仍被 `ROUND_FINISH` 驱动 → 未捕获异常**（应用层校验时发现）：
  `ICEPolyLine.afterAddHandler` 在 **ICE 总线**上注册 `once(ROUND_FINISH, syncConnections)`，
  该监听不在组件自己的 `listeners` 里，`purgeEvents()` 清不掉；而 `once` 内部会把回调包一层，
  外部用原始 `fn` 去 `off` **永远匹配不到包装函数**（因此无法提前摘除）。
  于是「新增连线 → 同一 tick 内又删除」时，下一轮渲染完成仍会触发 `syncConnections`，
  去写已销毁组件的 `this.ice.dirty` → `Cannot set properties of null (setting 'dirty')`。
  应用层 `ice-entity-designer` 连续 undo/redo 批量增删连线时必现。
  修复三处：① `once` 记录 `__onceOriginal`、`off` 同时匹配包装函数与原始回调（**框架级**修复，
  消灭「once 注册的监听无法 off」这个陷阱）；② `ICEPolyLine.destory()` 显式 `off` 掉总线监听；
  ③ `syncConnections()` 在未挂载/已销毁（`!this.ice`）时直接返回 —— 顺带修掉
  「未挂载时 `setState({ links })` 抛 TypeError」。回归用例见 `tests/event/once-off.test.ts`、
  `tests/link/polyline-destroy.test.ts`（修复前 4 failed / 修复后全绿）。
- **无 rAF 的运行时「启动即抛错」**：`root.requestFrame` 直接取 `requestAnimationFrame` 一族，
  都没有时是 `undefined`，而 `FrameManager.start()` 无条件调用它 → 在 **Node / headless（无 rAF）**
  以及部分小程序低版本基础库下引擎连启动都做不到（这是 headless 出图的两个阻塞点之一）。
  现加定时器兜底（浏览器早期 rAF polyfill 的经典做法）；另一阻塞点「文本量测依赖 DOM」
  此前已由 `ICEText` 的「canvas 优先量测 + DOM 降级」解决。
- **折线的包围盒退化成 ≈0（导致局部重绘漏画折线）**：`ICEPolyLine.calcComponentParams` 用
  「顶点对相减」（`points[1].x - points[0].x`）推导宽高，但 `ICEPolyLine.calc4VertexPoints()` 返回的
  是**沿路径排列的笔画带宽顶点**（不是包围盒的左上/右上角）→ 近似水平的折线算出 `width ≈ 0`。
  更关键的是存在**两条各自算盒子的路径**：`getMinBoundingBox()`（被折线覆盖为顶点盒，正确）与
  `ICEComponent.__paintWorldBox()`（按 width/height 推导，退化）。后者用于上屏快照盒，于是
  dirty-rect 按快照盒挑选「需要重画的对象」时会漏掉折线 → 被擦除区域内的折线笔迹丢失
  （表现为 full 与 dirty-rect 的像素分歧，且只在「连线真正连上嵌套宿主」时才暴露）。
  修法：抽 `ICEComponent.__localBox()` 作为本地盒**唯一来源**（两条路径都消费它，从此必然一致），
  折线覆盖该方法给出真实带宽盒；`calcComponentParams` 改为取带宽顶点 min/max；
  并修掉 `splitEndpointsTo4Points()` 的**循环依赖**（它拿 `state.height` 当线宽输入，而 height 又是
  它的输出 → 结果随上一次的 height 漂移，首帧还读到默认哨兵值 10）。
- **折线宽度/高度不再依赖「上一次的 height」**：同上，反复量测现在结果稳定。
- **直线（共线）折线的包围盒不含箭头 wing 的横向张开**：`calc4VertexPoints()` 在共线时走
  `splitEndpointsTo4Points()`，那条路径只按 `lineWidth` 沿线段方向外扩，**不含箭头三角形的张开**
  （默认 `arrowLength: 15` / `arrowAngel: 30°` ⇒ 距轴线 ±7.5px，远大于线宽的一半）。
  由于 `__localBox()` 同时供 `getMinBoundingBox()`（选择框/控制面板）与渲染器的 `__paintWorldBox()`
  （dirty-rect 上屏快照盒）消费，盒子偏小会导致**局部重绘把箭头裁掉**、选择框切到箭头。
  现由 `__localBox()` 并入箭头三角面的三个顶点（**不动** `splitEndpointsTo4Points()`，
  因此 `state.width/height` 的既有语义与命中判定都不受影响）。回归见 `tests/link/line-arrow.test.ts`。
- **`composeMatrix()` 会累积平移点集（潜在漂移）**：`ICEDotPath.calcLocalOrigin()` 会就地把 `dots` 平移到
  「以 origin 为原点」，而旧实现每次 compose 都**无条件**再平移一个 origin —— 连续 `composeMatrix()`
  会让点集依次偏移 1/2/3 个原点。因此此前所有调用方都必须严格保证「compose 之前先重算 dots」，
  一旦漏掉就会出现形状/命中检测偏移。现改为记录「已应用平移量」、只补差额，compose 变为**幂等**；
  `calcDots()` 成为重建点集的唯一入口（子类改为实现 `__calcDots()`）。
- **动画 `duration` 非法时永不结束**：`duration <= 0` 或缺失时会算出 `NaN` / `Infinity`，而结束判定是
  「值是否越过 `to`」——当 `from === to` 时该比较恒为 `false`，动画永远不结束，组件永久滞留在动画列表里
  **每帧空转 `setState`**。现在明确落到终点、结束，并 `console.warn` 一次。
- **未知缓动名会抛 `TypeError`**：`Easing[name]` 为 `undefined` 时直接调用会崩。现在回退 `linear` 并提示一次。
- **非法动画配置的告警会逐帧刷屏**：改为每个动画配置只告警一次（用 `WeakSet` 记录，
  不往会被序列化的 `props` 上塞标记字段）。
- **安全**：`ICEText` 的 DOM 降级量测由 `innerHTML` 拼接 `<br>` 改为 `textContent` + `white-space: pre`，
  用户文本中的 HTML 不再被当作标签执行。
- **画布带 `border` / `padding` 时命中检测整体偏移**：坐标换算与 dpr backing store 尺寸改用
  **内容盒**（`getBoundingClientRect()` 返回的是 border-box）。
- **页面滚动 / 布局变化后命中检测偏移**：canvas 矩形改为在非移动类输入事件上刷新
  （旧实现只在 `init` 时取一次）。
- **一个未知组件导致整份数据打不开**：反序列化遇到未注册类型时跳过该节点并记录，不再抛 `TypeError`。
- **`.husky/pre-commit` 缺少可执行位**：git 会直接跳过该钩子，导致 `lint-staged` / commitlint 从未真正运行。
- **`getMinBoundingBox(refresh=true)` 首次取值偏移**：旧实现先读 `state.localOrigin` 再调
  `composeMatrix()`，而 `localOrigin` 由后者内部派生 → 首次刷新读到初始 `(0,0)`，包围盒偏一个原点
  （控制面板 / 连线插槽首次定位偏移的根因）。
- **`AFTER_REMOVE` 从不触发**（死代码）：现由 `removeChild` / `removeTool` / `ICEGroup.removeChild`
  在 `destory()` **之前**触发（`destory` 会 `purgeEvents`，之后触发监听者收不到）。
- **监听器累积**：`TransformControlPanel.targetComponent` 与 `ICELinkSlot.hostComponent` 原用
  `once(BEFORE_REMOVE, 箭头函数)`，因 `once` 内部再包一层而**永远无法 `off`**，反复选中会持续泄漏；
  改为具名属性 + `on`，切换时摘除。
- **只要存在 linkable 组件画面就永不空闲**：`ICELinkSlot.updatePosition` 挂在宿主 `AFTER_RENDER` 上
  无条件 `setState`；现仅位置真正变化时才置脏。
- **`flattenTree` 的 `_pid` 恒为 `undefined`**（旧实现取 `node.id`，而 id 在 `props` 上）。
- **连线标签的背景框按「上一次遗留字体」量宽**：`ICEPolyLine.drawLabel()` 原先**先** `ctx.measureText(label)`、
  **后**设 `ctx.font`。canvas 的 `font` 是跨调用遗留状态，于是量到的宽度来自上一次绘制留下的字体，
  背景框与实际字形不符（框过宽或过窄）。现把 `ctx.font` 提到 `measureText` 之前；
  回归用例 `tests/link/link-label.test.ts` 用「宽度随 font 变化」的 ctx 桩把调用顺序钉死。
- **连线端点不再依赖宿主 `AFTER_RENDER`**：局部重绘帧的 render 事件只对脏区域内的组件触发，
  用它驱动几何会让两条渲染路径产生不同结果；改为在建立连接时直接同步（内部会现场重算矩阵）。

### 主题能力变更（需要注意）

- **主题改为实例级**：`ice.setTheme()` 现在只改**本实例**，不再修改模块级默认主题。
  这样同页面多个 `ICE` 实例可以有各自的主题（多品牌/多租户/明暗并存）。
  模块级 `setTheme()` 仍可用，语义是「此后新建实例的默认值」。
- **preset 在加入实例时按该实例主题解析**：组件构造阶段仍按模块级默认主题展开
  （那时还不知道归属哪个 ICE），`addChild`/`addTool` 时会用实例主题再解析一次。
  用户显式传入的样式依旧优先于 preset。
- **motion token 也随实例主题**：动画里的 `duration: 'normal'` / `easing: 'out'`
  语义名按实例主题解析。
- 单实例、未显式设置主题的项目**行为完全不变**。

### 布局能力变更（需要注意）

- **布局随增删自动重排**：`ICEGroup.addChild` / `removeChild` 会立即重排，`addChildren` /
  `removeChildren` 在批量结束后排一次。旧版本只在 `setLayout()` 时排一次，之后的增删不会重排
  （加进去的子组件位置错、删掉后留空位）。**如果你的应用此前手工补了 `doLayout()` 调用，可以去掉。**
- **新增 measure 阶段**：排布前会对每个子组件调 `measure()`（刷新尺寸/点集/文本量测），
  因此首次布局就能拿到真实宽高（旧版本读到的是 `0` 或文本的 `10` 哨兵值）。
- **新增的容器型子组件继承父层布局**（与 `setLayout()` 的传播规则一致）。

### 动画能力变更（需要注意）

- **动画键支持点路径**：`animations: { 'transform.rotate': {...} }`、`'style.globalAlpha'` 现在真正生效。
  旧版本这类键会被当成**字面量键名**而静默失效（既不报错也不生效）；如果你此前因此写了外部补间，可以迁回。
- **默认不再取整**：旧版本对所有动画属性 `Math.floor`，会让 0→1 的透明度、角度、缩放失真。
  现默认保留小数（平滑）；需要整数步进（例如像素位移要锐利边缘）时显式加 `round: true`。
- **新增 `delay`**（毫秒）：延迟期内保持起始值，可做多属性错峰/多组件序列。
- **数组字段改为支持补间**：`transform.scale/translate/skew` 等数组型字段现在**逐元素插值**
  （旧版本会写出 `NaN` 导致矩阵损坏、组件消失）。只有「两端长度不一致」或「含非数字」才拒绝并
  `console.warn` 一次。此前若为此把缩放动画拆成外部补间，可以迁回 `animations`。
- **动画结束判定改为按时间**：达到 `duration` 即结束并**精确落到终点值**，不再用「值是否越过 `to`」判断。
  对既有单调缓动的结果没有差异；但这是弹簧类缓动（值会过冲越过 `to`）能正常工作的前提。
- **非法 `duration`（0 / 缺失 / 非数字）不再无限空转**：见「修复」。
- **`interactive` 不再被动画覆盖**：动画期间会保存并恢复原值（旧版本每帧强制置 `true`）。
- **组件销毁会自动摘除动画**（旧版本销毁后仍被每帧 `setState`，CPU/内存双泄漏）。

### 已知限制（仍未修）

> 2026-09-11 复核：原小节里仅存的一条写着「已修」，属自相矛盾，已按当前真实剩余项重写。
> 完整的「已做 / 未做」对照见 [docs/architecture/09-roadmap.md](docs/architecture/09-roadmap.md) 与
> [13-gap-analysis.md](docs/architecture/13-gap-analysis.md) §1。

- **含折线的富场景会稳定回退全量重绘**：折线的描边在 `clip` 下会丢失抗锯齿一致性，
  因此只要折线带宽盒与脏区相交就回退（这是**正确的保守行为**——此前「能走局部」恰恰是因为折线包围盒退化、
  漏画了折线）。要恢复局部重绘，需先解决折线描边的 clip-AA 一致性。
- **错切（skew）没有变换手柄**：skew 变换本身可用（`gl-matrix-skew.ts`），缺的是控制面板上的手柄 UI。
- **无空间索引**：命中检测与渲染已做视口裁剪 + 包围盒预筛，但「上万节点且大部分在屏内」时仍是 O(n)。
- **小程序真机未验证**：`PolyfillPath2D`、离屏 canvas、字体加载在低版本基础库上的逐像素一致性与可用性
  需真机确认（自动化测试覆盖不到）。
- **无 SVG / PDF 导出、无 SVG 导入**：需独立 exporter，且只能近似（阴影 / 虚线流动 / 字形 / `Path2D` 命令为 canvas 特有）。
- **控制面板的「按组件类型展现不同工具」尚未抽象**（插件机制的 `tools` 注册点可视为第一层）。
- **缩放手柄拖过对边时中心会跳变**：宽高变负时用 `Math.abs()` 兜底而不做 clamp（小体感问题）。

### 性能

- **移动容器不再连带重量测后代**：新增 `paramsDirty`，把「需要重绘」（`dirty`）与「自身派生参数需要重算」
  拆开。祖先变换变化时后代只置 `dirty`（必须重绘），不再重跑 `calcComponentParams()`。
  实测（4 rect + 4 小星形 + 2 大星形 + 2 文本，移动整组一帧）：`calcComponentParams` **10 → 0**、
  `calcDots` **6 → 0**，必须发生的重绘次数不变（8 次）。收益集中在点集类图元（星形 / 玫瑰线 / 正多边形 / 折线）
  不再重跑 `calcDots()`。
- **视口裁剪**：全量帧跳过「未变脏 + 有上屏快照 + 与可见区不相交」的组件。
  实测 N=6000、屏外 50%：4.44 ms/帧 → 关闭裁剪 8.38 ms/帧（**1.89x**）。
- **命中检测包围盒预筛**：复用渲染快照做 O(1) 拒绝，避免对屏外组件做矩阵反变换 + 形状判定。
- **脏矩形门控由「整场景」放宽到「相交级」**：编辑器场景（含文本 / 星形 / 半透明控制面板）此前
  几乎永久回退全量，实测富场景局部重绘执行次数 **0 → 2**，且 10 步逐像素比对仍 100% 一致。

### 需要注意（升级前请确认）

> **箭头默认由「空心描边」变为「实心填充」（行为变更）**：线条端点三角箭头现在默认 `arrowStyle: 'filled'`，
> 用**线色**填充。需要保持旧观感的，显式传 `arrowStyle: 'hollow'`。
> `stroke: false` 的折线仍然不画箭头 —— 与改动前一致（那条路径既不描边也不填充，本就看不见箭头）。
>
> **`linkShape: 'bezier'` 的四点须知**：① 它与 `curveType` 的 `quadratic/cubic` **互斥**
> （后者会把采样点当控制点、且与箭头插入点冲突），bezier 模式下 `curveType` 会被强制成 `'straight'`；
> ② `escapeDistance` / `routeOffset` **只服务正交路径**，bezier 用内部常量（本次未新增 `curveOffset` 配置项）；
> ③ 采样点写回 `state.points`，引擎 `Serializer` 里的连线点数会从 2~4 个涨到最多 25 个
> （每条约 +270B；应用层自己的项目快照是白名单、不含 `points`，**持久化体积不受影响**）；
> ④ 插槽正对且共线时（典型「右出左进且 y 对齐」）贝塞尔**就是一条直线** —— 这是插槽法线语义的固有结果。

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

### 需要注意（打包产物路径变更，**可能影响深链引用**）

- **入口文件名变更**：`dist/index.js` → **`dist/index.mjs`**（ESM）、`dist/index.cjs.js` → **`dist/index.cjs`**（CJS）。
  原因：旧布局下 package.json 没有 `type` 字段，按 Node 规范 `.js` 即 CJS，而 ESM 产物却叫 `.js`
  —— 包元数据与实际产物不一致，导致 **TS 在 ESM 解析模式下把类型当 CJS 处理**（`attw` 报
  `Unexpected module syntax`，`publint` 报 types 歧义）。现代 Node（≥22.7）的语法探测会掩盖运行时症状，
  但旧版 Node 与严格工具链不会。
- **影响面**：用裸包名 `ice-render`（经 `exports` 解析）的用法**不受影响**；
  但**直接写死文件路径**的深链引用（如 `ice-render/dist/index.js`）会 404，需改为 `.mjs` / `.cjs`。
  一次性 CDN 引用 `dist/index.umd.js` **未变**。
- 同时：`rollup.config.js` → `rollup.config.mjs`（因为新增了 `"type": "commonjs"`）；
  `repository` 字段由字符串改为 `{ type, url }` 对象式。
- 若你更在意深链兼容性，建议把这一批次发为 **2.0.0**；否则请在 1.1.0 的升级说明里保留本段。

### 需要注意（自定义组件）

- **自定义组件若覆盖了 `calcComponentParams()`**：它现在由 `refreshParams()` 按需调用（仅在 `paramsDirty` 为真时）。
  引擎已在 `setState` 里同时置 `dirty` 与 `paramsDirty`，因此既有组件无需改动。
  但如果你有**绕过 `setState` 直接改 `state`** 再依赖渲染时自动重算的写法，需要补一句 `this.paramsDirty = true;`。
  另：**不要在 `calcComponentParams()` 里用 `this.dirty` 做早退判断**（改用 `this.paramsDirty`，或干脆交给 `refreshParams()`）。
- **点集类自定义组件请实现 `__calcDots()` 而不是 `calcDots()`**：`calcDots()` 现在是维护「已应用平移量」的唯一入口，
  覆盖它会让幂等补偿失效（旧代码覆盖 `calcDots()` 的，改名即可，`state.dots` 的写法不变）。

### 工程

- **提交 `package-lock.json`，CI 改用 `npm ci`**：`.gitignore` 第 9 行的 `*lock*` 把 lockfile 一并忽略了
  （与当初 `*log*` 误伤 CHANGELOG 是同一类问题），因此它从未被跟踪，CI 每次 `npm install` 都重新解析
  依赖范围、安装不可复现。现显式放行 lockfile，并把两个 job 的安装步骤改为 `npm ci`
  （lockfile 与 `package.json` 不同步时会直接失败，正是想要的效果；已用 `npm ci --dry-run` 验证同步）。
  降级后本包唯一平台相关可选依赖是 darwin 的 `fsevents`，Linux CI 会自动跳过，无跨平台风险。

- `.eslintrc` 为 `tests/**`、`e2e/**` 关闭 `@typescript-eslint/no-var-requires`
  （测试中刻意使用 `require` 处理 `jest.mock` 的提升顺序）。
- 全仓 prettier 格式化，`npm run lint` 由「194 error」变为 **0 error**（CI 的 lint 步骤由红转绿）。
