# 虚拟子源（VirtualChildSource）设计草案

> 状态（2026-09-21）：**P0 + P1 + P3 已落地**（批量绘制 + 窗口裁剪 + 命中即物化 + 窗口内物化的廉价增删），
> P2（导出/序列化/undo/a11y）待做。依据是 `/tmp/ice-virt-spike/`
> 那份可运行 spike（真机 Chrome + CDP 实测）+ 引擎 API 版 spike 的复测。

## 0. 一句话

让"文档里的图元"和"内存里的组件对象"**解耦**：文档用紧凑列存（SoA）当唯一真相，引擎只为
**视口窗口内**的子项建真实组件；窗口外的既没有对象、也不用画。

目标场景是"**文档大、屏幕小**"：IED 工艺图、水务管网、地图、大画布编辑器。

## 1. spike 已经证明了什么（以及没证明什么）

真机 Chrome + CDP，10 万图元、1600×1000 视口、同一份确定性几何，**对象树 vs 虚拟层**对拍：

| 指标 | 对象树（现状） | 虚拟层 spike（自绘） | 引擎 API 版（P0/P3） |
|---|---|---|---|
| 堆自有大小 | 173.8 MB | 5.4 MB / 6.5 MB（1/3 带标签） | **5.8 MB / 6.9 MB** |
| 堆节点 | 548 万 | 4.7 万 | 4.7 万 |
| 单帧（强制全量重画，zoom 1×） | 123.1 ms | 0.2 ms | **0.3 ms** |
| 单帧（zoom 0.1×，几乎全在屏） | 180.4 ms | 44.4 ms | — |
| 真实 rAF 平移 | 116.6 fps（官方 API，2026-09-21 修正后） | 121 fps | **121.2 fps / 0 长任务** |
| 命中（空点最坏 / 命中图元） | 3,994 µs / ~3.2 µs | 0.14 µs | **0.15 µs** |
| 按需新建 1 个图元 | 117 ms | 0.3 ms | **0.3 ms** |
| 拖动 1 个物化图元 | 5.3 ms/帧 | 0.5 ms/帧 | **0.6 ms/帧** |
| 像素一致性（vs 对象树） | — | 3/1,600,000 像素差，最大通道差 9 | **同上（3 个）** |

百万级：堆 32.0 MB（引擎 API 版 35.9 MB —— 那 4 MB 是 spike 页自己加的 `forEachInBox` 去重数组
`1M × 4B`，不是引擎的开销）、窗口内画 6,653 个、单帧 1.1 ms、平移 121 fps、命中 0.6 µs。
混合模式（标签只在窗口 ±400 内物化）：**6.9 MB**、单帧 1.8 ms、平移 121 fps / 0 长任务。

**证明了的**：窗口裁剪 + 批量落墨 + 网格索引命中 + "点到才物化"这条链路在真实输入下成立
（CDP 真鼠标：按下 → 命中 → 物化真实 `ICEStar` → 拖 40 步位移精确 [+80,+40]）；
而且**引擎侧 0 改动就能跑通** —— 所以 P0/P3 的价值不是"让它能跑"，而是把"每个应用各写一遍"
收成一份有契约、有隔离、有廉价通道的 API（见 §3 的落地口径修正：坐标系、ctx 隔离、挂树归属）。

**没证明的**：① 导出/序列化/undo/无障碍**完全没接**；② 只有一台 ICE、一个容器层；
③ 文字类图元用"窗口内物化成真组件"兜（混合模式），没有做字形图集；
④ 物化增删仍走 `addChild/removeChild`（= 结构变更语义），靠"活对象少"侥幸不掉帧。

## 2. 为什么必须做进引擎，而不是每个应用自己写

1. **一处实现、四处受益**：命中、选中（含控制面板）、导出、序列化/undo 都要读同一份数据。
   各应用各写一遍的结果必然是"渲染能虚拟、选中就崩"。
2. **命中语义要统一**：命中一个批量图元时，`evt.target` 到底给谁？物化成真组件再派发，
   编辑器的手感（拖动、控制面板、对齐参考线）才与现在一致。这条只有引擎能定。
3. **窗口物化需要廉价增删**：`addChild/removeChild` 现在的语义是"结构变更"（`markQueueDirty`
   → 重建队列 + 清上屏快照 → 下一帧全量 prime，10 万图元世界里一次 **117 ms**）。
   虚拟化每帧都要进出几十上百个子项，需要一条"**只重排这一段、不动快照**"的通道
   （与刚落地的 `markViewportChanged()` 同源：把"非结构性的可见集变化"从"结构变更"里分出来）。

## 3. 契约定稿（引擎只认这几个方法）

> **已落地（P0/P3）**。实际实现与下面这份契约的差异有三处，见本节末尾的"落地后的口径修正"。

引擎**不碰**应用的数据结构，只认接口：

```ts
/** 虚拟子源：一个会自己回答"有多少、在哪、点到谁、怎么画"的只读视图。 */
export interface VirtualChildSource {
  /** 文档里的真实子项数（不是物化数）。 */
  readonly count: number;
  /**
   * 文档版本：任何影响"画出来是什么 / 命中什么"的变更都要 +1。
   * 引擎只用它失效缓存（同 `paramsRev` 的思路），不做细粒度 diff。
   */
  readonly version: number;

  /** 第 i 项的世界轴对齐盒（写进 out[0..3]）。窗口遍历与命中预筛只读它，不建对象。 */
  boxAt(i: number, out: Float64Array): void;

  /**
   * 窗口遍历：把与 [x0,y0,x1,y1] 相交的子项下标交给 visit。
   * 应用自己的空间索引负责"快"（网格 / R 树 / 分块），引擎只负责调用。
   */
  forEachInBox(x0: number, y0: number, x1: number, y1: number, visit: (i: number) => void): void;

  /** 点 → 下标（世界坐标；找不到返回 -1）。引擎的命中路径优先用它，避免线性扫描。 */
  hitTest(wx: number, wy: number): number;

  /**
   * **批量落墨**（可选）：能画就返回 true，引擎不再为这些子项建组件。
   * `view` 是当前窗口的**世界坐标**矩形与缩放；ctx 的 CTM 已经包含视口（与组件 `doRender` 同源）。
   */
  paint?(ctx: any, view: { x0: number; y0: number; x1: number; y1: number; scale: number }): boolean;

  /** **按需物化**（可选）：窗口内需要真组件时引擎调它要一个 ICEComponent（返回 null = 放弃）。 */
  materialize?(i: number): any | null;
}
```

容器侧接入（两种形态，各有用途）：

```ts
// 形态 A：容器 + 虚拟子源（推荐的通用形态）——物化出来的子项就是它真正的 childNodes
const group = new ICEGroup({ width: W, height: H, childSource: doc.source });

// 形态 B：纯批量层（spike 的形态）——树里一个子组件都没有，只有一块"会自己画"的组件
const layer = new ICEVirtualLayer({ left: 0, top: 0, width: W, height: H, childSource: doc.source });
```

### 落地后的口径修正（2026-09-21，实现完才发现的）

1. **坐标系是"容器局部"而不是"世界"**（本文上一版写的是世界盒）。理由：这样虚拟容器可以像任何
   组件一样被摆放 / 嵌套 / 放进变换组；引擎负责把可见窗口经逆合成矩阵变换到局部坐标
   （`visibleLocalRect`，旋转/缩放下取 4 角的包围盒）。常见用法（容器在 (0,0)、无变换）下两者等价。
2. **`paint` 被引擎包在 `save/restore` 里**：容器自己的样式在 `doRender` 之前就写进了 ctx，
   而批量落墨会一路改 `fillStyle` —— 不隔离的话，紧接着画容器自己的盒子时会用**最后一个图元的颜色**
   填满整块容器。真机实测：整张画布被紫色盖住、像素对拍 99.9% 不一致；加隔离后回到 3/1,600,000。
3. **`materialize` 只负责"造"，挂树由调用方做**（`layer.addChild(comp)`）。引擎的贡献是保证
   这类增删走**窗口变更**通道（保留其他组件的上屏快照），而不是"引擎自动帮你挂"。

### 已落地 API 速览

```ts
import { ICEVirtualLayer, type VirtualChildSource } from 'ice-render';

const source: VirtualChildSource = {
  count: doc.length,
  version: doc.version,
  boxAt: (i, out) => doc.boxAt(i, out),
  forEachInBox: (x0, y0, x1, y1, visit) => doc.grid.forEachInBox(x0, y0, x1, y1, visit),
  hitTest: (lx, ly) => doc.grid.hitTest(lx, ly),
  paint: (ctx, view) => { doc.paintWindow(ctx, view); doc.syncMaterialized(view); return true; },
  materialize: (i) => doc.createComponent(i), // 只造，不挂
};

const layer = new ICEVirtualLayer({ left: 0, top: 0, width: doc.w, height: doc.h, childSource: source });
ice.addChild(layer);
// 物化 / 回收：挂到 layer 上（引擎自动判定为"窗口变更"，保留其他组件的快照）
layer.addChild(source.materialize!(i));
```

**引擎侧的存储纪律**：`childSource` 这类"每实例一个引用"**不许加实例字段**（AGENTS「热路径类不加
实例字段铁律」），用模块级 `WeakMap` 侧表（`MIN_SIZE` 的既有范例）。

## 4. 引擎要开的六个缝（现状 → 改法 → 风险）

| 缝 | 现状 | 改法 | 风险 |
|---|---|---|---|
| **渲染** | `flattenTree` 拉平 `childNodes`；`doRenderFull` 逐组件画；culling 用世界盒快照（`__snap`） | 容器 `doRender` 里调 `source.paint(ctx, view)`；窗口外的子项**根本没有对象**，天然不参与队列。物化出来的子项进 `childNodes` → 走原路（拖动/控制面板直接可用） | 低。spike 已证 0 改动能跑；引擎化只是把"每应用各写一遍"收成一份 |
| **命中** | `util/data-util.ts` 的 `hitTestComponents`：倒序扫队列 + `getWorldBox` 预筛 + `containsPoint` | 容器 `containsPoint` 走 `source.hitTest`；命中策略二选一（见 §9 决策 3） | 中。`evt.target` 语义要定死并进回归 |
| **选中 / 控制面板 / 对齐参考线** | 控制面板挂在一个 `targetComponent` 上；对齐参考线遍历 `ice.childNodes` | 命中即物化 → 控制面板拿到真组件（spike 已验证可行）；`AlignmentGuideManager` 的遍历要尊重虚拟源（否则"对齐到看不见的图元"直接失效） | 中。这些管理器目前不认识"虚拟子项" |
| **导出（SVG / 位图）** | `SvgExporter.collectOrdered` 与渲染同源遍历 `childNodes` | 容器导出时向 `source` 要"窗口/全量"的子项（需要新增可选方法 `paintToSvg?` 或 `describe(i)`）；也可只导出物化子项 + 明确声明 | 中高。矢量导出要"全量文档"而不是"窗口" |
| **序列化 / undo** | `Serializer.__encodeChildren` 已有 `getSerializableChildren()` 先例（复合组件用它声明"真实子节点"） | 沿同一先例：虚拟容器序列化**物化的子项** + `virtual: { count, version }` 标记；**文档本体由应用自己存**（引擎不认应用的数据结构） | 高。这是"两套真相"的核心，必须定契约 |
| **布局 / 无障碍 / worker 镜像** | `ICELayoutManager` 读 `container.childNodes` 量尺寸；`getAccessibilityTree()` 遍历 `childNodes`；镜像走结构钩子（`mirror-hooks` 遍历 `childNodes`） | 明确**不支持**虚拟容器的自动布局（尺寸在文档里，应用自己算）；无障碍/镜像先只认物化子项，并在文档里写死这一条 | 中。`ice-web-components` 的容器与 a11y 都建立在"childNodes 是全集"上 |

## 5. 分期与验收

### P0 —— 接口 + 批量绘制 + 窗口裁剪 ✅ 已落地（2026-09-21）

交付：`VirtualChildSource` 类型 + `ICEGroup({ childSource })` + `ICEVirtualLayer`；
窗口由渲染期的可见世界矩形算（复用 culling 已有的视口语义）。

验收（真机，10 万图元）：堆 ≤10 MB；zoom 1× 单帧 ≤1 ms；平移 ≥60 fps 且 0 长任务；
与对象树**覆盖率严格一致**、通道差 ≤3/255；引擎 `verify:full` + 家族 11/11 不破。

**实测**：纯批量 5.8 MB / 单帧 0.3 ms / 平移 121.2 fps / 0 长任务 / 像素差 3 个（0.0002%）✓；
回归见 `tests/graphic/virtual-child-source.test.ts`（9 条）。

### P1 —— 命中 / 选中 / 控制面板 ✅ 已落地（2026-09-21）

交付：`containsPoint` → `source.hitTest`；命中策略（自动物化 + 重定向 `evt.target`）；
`AlignmentGuideManager` 尊重虚拟源；窗口内物化/回收的循环（含滞后带）。

验收：真鼠标"按下 → 拖动 → 抬起"位移精确；命中 ≤5 µs/次（含 100 万文档）；
缩放平移期间无 >50 ms 长任务；命中/选中的回归用例进 `tests/`。

**落地形态**（与设计稿的差异写在括号里）：

- `ICEGroup.containsLocalPoint()`：挂了虚拟子源就走 `source.hitTest()`，并把命中的**下标**记下来
  （模块级侧表）。**语义定死为"命中 = 命中子项"**：不回退到容器自己的盒子 —— 虚拟容器的盒通常
  覆盖整个世界，回退会让"点空白处"命中巨型容器（控制面板挂上去、空白拖拽变成拖容器）。
- **命中即物化 + 事件重定向**（`resolveVirtualHit`）：派发器在"按下 / 点击 / 右键"这一支
  （**移动类事件不做命中检测，所以 hover 不会批量物化**）与 `ICE.hitTest()` 里把容器换成
  **被点中那一个子项物化出来的真组件**；随后 `componentCache` 就是它，mousemove/mouseup
  自然落到它身上 ⇒ 选中、控制面板、引擎默认拖动**零改动**可用。
- **幂等与回收**：引擎维护 `容器 → (下标 → 组件)`；`materializeVirtualChild` 幂等
  （同一下标只物化一次），`releaseVirtualChild` 回收后可再物化。
- **策略**：`setVirtualHitPolicy(container, 'materialize' | 'container')`，默认前者；
  后者保持"命中给容器、应用自己接管"的旧行为。
- **对齐参考线**：`AlignmentGuideManager.__computeTargets` 对虚拟容器用
  `forEachInBox(被拖盒 ± 阈值×2)` + `boxAt` 取候选 —— 否则"对齐到看不见的图元"直接失效。
  （设计稿里提到的"窗口内物化/回收的循环"仍由应用在 `paint` 里驱动；引擎只提供两个助手。）

**实测**：真鼠标"按下 → 拖 40 步 → 抬起"位移精确 **[+80, +40]**，且 **spike 页面里的胶水代码已删除**
（原来要自己接 `mousedown`/`mousemove`/`mouseup` + 覆写 `containsPoint`）；
纯命中 0.85 µs（含 10 万文档）；平移 121.3 fps / 0 长任务；像素仍差 3/1,600,000。
回归见 `tests/event/virtual-hit-materialize.test.ts`（7 条）。

### P2 —— 导出 / 序列化 / undo / a11y（约 1～2 周）

交付：`Serializer` 的虚拟容器契约（物化子项 + `virtual` 标记）、`SvgExporter` 的虚拟源导出、
应用侧 undo 契约（写回文档、`version` 递增）、a11y 只认物化子项并把口径写进文档。

验收：一条 1 万图元的工艺图能"虚拟渲染 → 导出 SVG → 反序列化 → 再渲染"往返一致；
undo/redo 100 次无泄漏（堆漂移 ≤1 MB）。

### P3 —— 窗口物化的廉价增删 ✅ 已落地（2026-09-21，与 P0 同批）

交付：`renderer.markWindowChanged(container)`：只重排**容器这一段**、**不清上屏快照**、
不整队重建；`ICEGroup` 的物化增删走它。

验收：10 万图元世界里连续平移 3 秒，物化/回收 ~2 万次：0 长任务、堆漂移 ≈0
（现状：一次 `addChild` = 117 ms）。

**实测**：`materialize + 挂树 + 渲染一帧` 0.3 ms（对象树世界同操作 117 ms）；
混合模式连续平移 3 秒（每帧进出标签）121 fps / 0 长任务 ✓；
回归见 `tests/renderer/window-churn.test.ts`（4 条：保留快照 / 普通容器仍全清 / 整屏重画但照旧裁剪 / 真结构变更优先）。

**顺带修掉两条**：① 虚拟容器**永不入静态层**（它的内容依赖视口，烤进位图后平移会把旧窗口整体挪走）；
② `source.paint` 被 `save/restore` 包住（否则容器自己的盒子会被"最后一个图元的颜色"填满）。

## 6. 与既有机制的关系（必须写进文档的口径）

- **静态层**：虚拟容器是一个"永远脏"的大组件，静态层对它无效（要显式声明，避免"以为有层"）。
- **LOD**：虚拟源自己就能跳过亚像素子项（`boxAt` × `scale` 的面积），比引擎级 LOD 更准。
- **dirty-rect**：批量图层一脏就是整层重画；窗口内只有几百个图元时这仍然便宜（0.2 ms），
  但**不要把虚拟层放进脏矩形路径**（避免"裁剪区外留旧墨"）。
- **worker 镜像**：物化子项走既有结构钩子；批量图元需要新协议（把文档列存下发）——
  **建议 P2 之后再评估**，在此之前虚拟容器只支持主线程渲染（明确不支持，而不是静默降级）。
- **主题**：批量落墨要自己解析主题 token（`paint` 是应用实现的，主题变更必须让应用重画）。

## 7. 应用侧契约（不遵守就会出问题）

1. **文档是唯一真相**；物化出来的组件是**投影**。应用要么禁止直接改物化组件的 state，
   要么在改动后回写文档（并 `version++`）。
2. `id` 必须稳定（序列化、undo、A11y、选中都靠它）。
3. `forEachInBox` 必须与 `boxAt` 自洽（引擎的窗口裁剪只信这两个）。
4. 窗口外**不得**依赖"组件还存在"（`ice.childNodes` 里的物化子项是窗口内的子集）。
5. 复杂子项（文字 / 图片 / 自定义子类）走 `materialize`，不要硬塞进 `paint`。

## 8. 风险清单

| 风险 | 缓解 |
|---|---|
| 两套真相漂移（物化组件被改、文档不知道） | 契约定死"文档为准"；提供 `source.applyPatch(i, patch)` 唯一写入口（P2） |
| 命中语义变化打破既有应用 | 命中策略是**显式配置**（`virtualHitPolicy`），默认"自动物化"，并把回归钉在 `tests/` |
| 导出/序列化"少了一半内容" | P2 之前**不发布**虚拟容器；或发布时把导出明确降级为"仅窗口"并 warn |
| 窗口滚动时的物化尖峰 | 滞后带 + 每帧物化预算（spike 实测 121fps / 0 长任务，留有余量） |
| 应用被迫实现空间索引 | 引擎提供一份**参考实现**（网格索引，spike 里 ~60 行，1M 图元索引 19 MB） |

## 9. 要拍板的三件事

1. **做不做 / 做哪一半**：只做 P0（批量绘制 + 窗口裁剪，收益最大、改动最小），
   还是 P0–P3 全套（含导出/序列化/undo 的契约）。
2. **真相归属**：文档为真相（推荐：引擎只做投影与交互）还是"物化组件为真相"（那等于放弃虚拟化）。
3. **命中语义**：命中批量图元时，`evt.target` 给**容器**（+ `evt.virtualIndex`，应用自己决定）
   还是**自动物化后给真组件**（推荐：编辑器手感与现在完全一致，代价是一次 0.3 ms 的物化）。

## 附：参考实现（spike）

- 页面：`/tmp/ice-virt-spike/virtual-100k.html`（列存文档、网格索引、`VirtualLayer`、混合策略、探针钩子）
- 探针：`/tmp/ice-virt-spike/probe.mjs`（heap / perf / zoom / pixel / 真事件拖动）
- 堆快照：`/tmp/heap/spike-pure-100k.heapsnapshot`（5.4 MB）、`spike-hybrid-100k.heapsnapshot`（6.5 MB）、
  `spike-virtual-1000000.heapsnapshot`（32.0 MB）、`spike-objects-100000.heapsnapshot`（173.8 MB，对照）
