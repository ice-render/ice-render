<p align="center">
  <img width="150" src="./examples/assets/ice-render.png" alt="ICERender logo">
</p>

<h1 align="center">ICERender · 雪花渲染器</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/ice-render"><img src="https://img.shields.io/npm/v/ice-render" alt="npm version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"></a>
  <a href="https://github.com/ice-render/ice-render"><img src="https://img.shields.io/badge/repo-github-181717.svg" alt="github repository"></a>
  <img src="https://img.shields.io/badge/TypeScript-100%25-3178c6.svg" alt="TypeScript">
</p>

ICERender 是一款 **Canvas 2D 交互图形渲染引擎**，面向 **ER 图 / 流程图 / 工艺图（给排水、电力二次）/ 拓扑图 / 大画布编辑器**。
它借鉴 React 的组件模型与 W3C 的事件模型，提供嵌套坐标系、序列化、动画与 Visio 风格连接线；
三条设计约束贯穿始终：**零运行时依赖**、**浏览器与 Node 双运行时**、**大规模下的内存与帧率**。

> 当前版本 **4.3.0** · 变更见 [CHANGELOG.md](./CHANGELOG.md) · 文档站 <https://ice-render.github.io/ice-render-doc/>
> 要求：**现代浏览器**或 **Node ≥ 18**；包体提供 ESM / CJS / UMD 三种格式。
> 引擎对较新规范成员（`Path2D.roundRect` / `PointerEvent` / `Intl.Segmenter` / `ResizeObserver`…）都做了特性检测与等价回退，
> 但**回归与基准目前只在 Chromium 上跑**（Playwright + 无头），其他浏览器请以自测为准。

## ⭐ 三条差异化能力

### 1. 大文档、小窗口：看不见的图元根本不存在（虚拟子源）

容器挂一份应用提供的**列存文档**（`childSource`），引擎按可见窗口向它要**批量落墨**；
点到某个批量图元时再由应用物化一个真组件、引擎把 `evt.target` 重定向过去 ——
选中 / 控制面板 / 拖动 / 对齐参考线**零改动**可用。典型场景：厂站工艺图、管网图、地图、大画布编辑器。

代价是应用要提供列存 + 空间索引 + `paint()`（IED 的参考实现约 350 行）。

### 2. 局部重绘是一条可证明的像素契约

默认渲染路径是**脏矩形局部重绘**（不满足局部条件时自动回退全量，`renderMode: 'full'` 可强制全量）。
为保证两条路径**逐像素一致**，每个组件在 `render()` 末尾把自身污染过的 ctx 全局状态（阴影 / `globalAlpha` /
合成模式 / 虚线等）归位，使组件渲染自包含；配套组件级离屏缓存（含纯平移复用位图）、静态层与渲染队列缓存。
这条契约由 golden image 与像素一致性回归守着（`e2e/visual/dirty-rect-pixel.spec.ts` 等）。

### 3. 浏览器 + Node 双运行时，零运行时依赖

目标运行时只有两个：**现代浏览器**与 **Node / headless**。所有全局对象访问收敛到 `cross-platform/root` 适配层，
无 rAF 时用定时器兜底；`ICE.init(ctx)` 可直接传 Canvas 上下文绕开 DOM，`ICE.headless()` 用于服务端建树与出图。
路径对象一律走 `Path2DRecorder`（一边转发原生 `Path2D` 上屏、一边记录命令流），因此**同一份场景**既能上屏、
又能导出 SVG、还能用断言校验形状，不需要 canvas。

## 🚀 快速开始

### 浏览器（UMD）

```html
<script src="https://unpkg.com/ice-render/dist/index.umd.js"></script>
<canvas id="canvas-1" width="1024" height="768"></canvas>
<script>
  const ice = new ICE.ICE().init('canvas-1');

  const rect = new ICE.ICERect({
    left: 100, top: 100, width: 50, height: 50,
    style: { strokeStyle: '#ff3300', fillStyle: '#00ff00' },
  });
  ice.addChild(rect);
</script>
```

### npm 安装

```shell
npm i ice-render --save
```

```javascript
import { ICE, ICERect, ICEGroup } from 'ice-render';

const ice = new ICE().init('canvas-1');
ice.addChild(new ICERect({ width: 100, height: 50 }));
```

### 事件：先订阅，再渲染

组件与全局总线（`ice.evtBus`）共用一套 API。**组件上用 `on` / `off` / `once`，DOM 元素才用 `addEventListener`**
—— 两套在组件上是**同一个实现、两种参数形状**。

```js
const rect = new ICERect({ left: 100, top: 100, width: 120, height: 80 });
ice.addChild(rect);

const onPick = (evt) => console.log('点到谁：', evt.target.constructor.name);
rect.on('click', onPick);      // 订阅
rect.off('click', onPick);     // 取消：必须是同一个函数引用
rect.once('click', onPick);    // 只触发一次
rect.trigger('my-event', null, { source: 'demo' }); // 手动触发（第三个参数是 param）

// 全局总线：组件之间解耦通信用它，引擎的生命周期事件（AFTER_RENDER / 选中变化…）也在这里
ice.evtBus.on('click', (evt) => console.log('总线最后收到一次：', evt.param.component));
```

派发路径固定三段：**命中组件（`AT_TARGET`）→ 各级父容器（`BUBBLING_PHASE`）→ 全局总线（最后收一次）**。
`evt.target` 恒为命中的组件、`evt.currentTarget` 随"正在处理它的组件"走；`stopPropagation()` 只挡祖先、
**挡不住总线**（总线是引擎内部通道）；容器只想认「点在自己身上」用 `evt.target === this` 守卫。

完整口径见 [事件系统](https://ice-render.github.io/ice-render-doc/docs/guide/events)，
可运行示例在 [`examples/event/`](./examples/event)。

### 导出 SVG（矢量，不依赖 canvas）

画布的 `toDataURL()` / `toBlob()` 是**光栅快照**（分辨率写死、放大就糊）。引擎的路径对象保留**命令流**，
所以同一份场景能再生成一份**矢量描述**——任意放大、进 Illustrator / Figma、走打印 / PDF 流程，
或者在 Node 里出图（不需要 canvas）。

```javascript
const svg = ice.toSvg();                                       // 内容自适应 + 透明背景
const svg = ice.toSvg({ background: '#ffffff', padding: 16 });  // 白底 + 留白
const svg = ice.toSvg({ area: 'viewport' });                    // 当前视口所见即所得
const { svg, width, height } = ice.toSvgResult({ scale: 2 });   // 需要宽高（写文件 / 排版预览）

// 不在浏览器里也能用（路径命令流不依赖 canvas）
const svg = exportSvg(ice);   // 或 exportSvg(任意组件) 导出子树
```

导出**镜像渲染口径**而不是另起一套：绘制顺序、世界矩阵、`props.style` / `state.style` 合并顺序、
有效透明度、祖先 `clipChildren`、阴影预设、线性 / 径向渐变、虚线都按同一份口径落到 SVG。
限制（阴影用 `feDropShadow` 近似、雪碧图切图暂不支持、文本为静态瞬间且字形度量允许微差）都写在 JSDoc 里。

```js
// 服务端（Node，没有 document / canvas）
const { ICE, ICERect } = require('ice-render');
const ice = ICE.headless();
ice.addChild(new ICERect({ width: 240, height: 120, radius: 12, style: { fillStyle: '#4f46e5' } }));
const svg = ice.toSvg({ padding: 16, background: '#ffffff' });
```

PNG / PDF 不内置依赖：SVG 是通用中间格式，`resvg`、`sharp`、`rsvg-convert`、headless Chrome 打印都能接着走
—— 引擎保持零运行时依赖。示例：`examples/export/svg-export.html`、`examples/node/export.mjs`。

## ✨ 核心特性

**架构与组件模型**

- **React 式组件模型** —— `props`（不可变构造入参）/ `state`（可变运行时状态）分离，`render()` 模板方法 + 清晰的类继承体系；`ICEGroup` 可无限嵌套。
- **默认配置原型共享（实例侧）** —— 所有实例原型继承同一份默认 `props` / `state`，只有显式传入的字段才落到实例上；嵌套对象在合并时才写时复制。**例外是 `style`**：它按当前主题每实例派生（共享会串味）。
- **`display: false` 是整棵子树隐藏** —— 隐藏父容器后子组件不再绘制、也不参与命中（判定收敛在 `isEffectivelyVisible()`，渲染 / 命中 / a11y / 离屏缓存共用）。
- **声明式渐变（可序列化）** —— `style.fillGradient` / `style.strokeGradient` 用纯对象描述 `linear` / `radial` / `conic`，**能进 JSON**（存盘不丢）且**能写进主题 preset**（随 `setTheme` 重新展开）。

**坐标系与变换**

- **完整仿射变换** —— 平移 / 缩放 / 旋转 / 错切（skew），基于 `gl-matrix` 的列向量 `mat2d` 约定（构建期内联，运行时零依赖）。
- **嵌套坐标系** —— 子组件自动复合祖先变换，`localToGlobal` / `globalToLocal` 双向换算；容器移动时向所有后代递归派发 `AFTER_MOVE`（只派发事件、不改 state），订阅了宿主事件的组件自动跟上。
- **视口与图元分离** —— `setViewport()` 与锚点缩放 `zoomAt(screenX, screenY, factor)` 只动视图，**不与图元自身的缩放混淆**；视口变化不再触发渲染队列重建。
- **HiDPI** —— `ICE.init(el, { dpr })` 把 backing store 放大到内容盒尺寸 × dpr。

**交互与连接线**

- **统一输入层** —— 鼠标 / 触控 / 触控笔 / 滚轮收敛到 Pointer 事件族（无 `PointerEvent` 的运行时回退 `mouse* + touch*`）；拖拽、方向键微调、修饰键透传（`Shift` 拖角手柄保持宽高比、`Shift` 拖旋转手柄吸附 15°）。
- **Visio 风格连接线** —— 端点插槽吸附（上 / 右 / 下 / 左 / 中心），正交路由**避障**（把走廊里的其他图元当障碍绕开；给排水工艺图实测 37 条管线由 24 处穿线降到 **0**）；`linkShape: 'visio' | 'bezier'` 可切换折线 / 贝塞尔，端点箭头默认实心（`arrowStyle: 'hollow'` 切空心）。
- **对齐吸附** —— 边缘 / 中心 / 等间距吸附与提示线，默认关闭、按需 `alignmentGuide.enable()`（未启用零开销）。
- **变换控制面板** —— 选中后出现旋转 / 缩放手柄，尺寸可配。

**文本与国际化**

- **断行策略** —— `wrap` 后按 `wordBreak: 'normal'`（默认）：拉丁词不硬拆、CJK 逐字断并做**禁则**、泰 / 老 / 高棉 / 缅甸等无空格脚本按 `Intl.Segmenter` 词典分词断行（不支持则退回逐字）。
- **文字方向（RTL / BiDi）** —— `direction: 'ltr' | 'rtl' | 'auto'` 与 `textAlign: 'start' | 'end'`，写 `ctx.direction` 前做特性检测、渲染完归位；SVG 导出同口径。
- **溢出截断不变形** —— 放不下按宽度截断加省略号（`textOverflow: 'ellipsis'`，默认），多名行配合 `maxLines`；**绝不压字形**（不再把盒子宽度当 `fillText` 的 `maxWidth`）。
- **i18n 边界** —— 引擎**不做 i18n**：词条、复数与 `Intl` 格式化归应用层；引擎只负责断行、方向、输入法与**稳定错误码**（`ICE_ERROR_CODES`）。契约见 [`docs/architecture/17-i18n-boundary.md`](./docs/architecture/17-i18n-boundary.md)。

**主题与样式**

- **四层 token** —— base（色 ramp / spacing / radius / fontSize）→ semantic（primary / text / border / palette / motion）→ chrome（选中框 / 手柄 / 插槽 / 引导线 / 连线标签 / 选区 / 阴影色）→ preset（card / panel / button …）。
- **主题引用在绘制那一刻解析** —— `style: { fillStyle: token('primary') }`，`setTheme()` 之后**任意组件**（不只是用了 preset 的）都会跟着换；交互状态用 `states: { hover, active, selected, disabled, focus }` 声明。
- **主题能力** —— 深合并、子树作用域（`new ICEGroup({ theme })`）、进快照（`theme: { name | patch }`）、变更通知（`ice.onThemeChange(fn)`）、结构化校验（`ice.validateTheme()`：拼错 token / 类型不对 / WCAG 对比度不足）、命名主题注册护栏（内置 `default` / `dark` 不可覆盖，重复注册抛错）。
- 机制细节见 [`docs/architecture/21-theme-and-style.md`](./docs/architecture/21-theme-and-style.md)。

**序列化与动画**

- **整图序列化** —— 组件树可无损序列化 / 反序列化；类型键用**稳定 typeId**（`namespace:Type`，如 `ice-render:Rect`，由构造函数反查，与类名解耦，压缩改名不影响已存数据），带 `version` 与迁移表；未注册类型跳过并记录而不是整份数据打不开。同一 typeId 注册不同构造函数、或同一构造函数注册第二个 typeId 都**明确抛错**。
- **文档时间戳** —— `createTime` / `lastModifyTime` 是 ISO 8601 UTC（与语言、时区无关，可直接排序）；`createTime` 表示首次创建时刻，载入时读回、`clearAll()` 后重新计。
- **关键帧动画** —— 单段 `{ from, to, duration }` 或多段 `{ keyframes: [{ offset, value, easing? }], duration }`；内置缓动 + **弹簧类缓动**（`spring` / `springSoft` / `springSnappy`，自带过冲）；支持 `delay` / `loop` / `iterationCount` / `round`，动画键可为 `'transform.rotate'` 这类点路径，取值可为数组。
- **动画写值通道** —— `setState(patch, { paramsDirty: false })` + `ANIMATION_SAFE_KEYS` 白名单让纯绘制 / 变换键**复用离屏位图**（1,000 个文本平移动画 35.1ms → 2.7ms/帧）；`ice.setContinuousFrames(true)` 供应用自行做逐帧计算（空闲停帧默认开启）。

**Worker 镜像与虚拟化（4.0 起）**

- **Worker / OffscreenCanvas 镜像渲染** —— `new ICE.MirrorHost({ canvas, ice, workerUrl })` 一行把落墨通道交给 Worker：主线程持有组件树与状态（唯一真相，命中检测也在主线程），Worker 持镜像树只负责画，位图用 `transferToImageBitmap` 回传（`transferCanvas: true` 可直绘省掉回传）。
- **起不来就回退** —— `MirrorHost.detect()` 启动前探测 + 运行期看门狗，任一失败立即还原落墨通道并用主线程重绘一帧；不支持的浏览器上页面与"从没接过 worker"完全一致。帧节拍有背压（至多一帧在途），镜像滞后上界是一次往返。
- **虚拟子源（`ICVirtualLayer` + `VirtualChildSource`）** —— 见上文「差异化能力 1」；配套 `paintToSvg` 全量导出、`virtual` + `virtualIndex` 序列化契约（`registerVirtualSource` 重建）、`applyPatch` / `onChildPatched` 文档补丁入口、`syncVirtualWindow` 窗口物化循环、`diagnoseVirtualSource` 自检。引擎侧的契约回归在 `tests/graphic/virtual-*.test.ts`；**应用侧参考实现**见 IED 的 `examples/water-large.html`（2 万符号厂站图）。
- **LOD** —— `renderer.setLodMinDeviceArea(px²)`（默认 `0` = 关闭）：设备像素面积小于阈值的图元不画，缩略视图下 10 万图元整屏重绘 237.5ms → **107.3ms（−54.8%）**；1× 场景无亚像素图元、收益为 0，所以默认关闭对既有场景零影响。

**扩展与可访问性**

- **插件机制** —— `ICE.use(plugin)` 开放三层注册点：自定义图元类型、每帧渲染回调、自定义交互工具；`registerType('my-app:Badge', Badge)` 注册后即可持久化与加载。
- **无障碍原语** —— `getAccessibilityTree()` 产出可访问节点快照（角色 / 可读名称 / 屏幕坐标盒 / tab 顺序），`setFocusedComponent()` 让键盘事件派发给焦点组件。**引擎不自建 DOM 镜像层**：镜像结构、ARIA 与文案由应用层决定（参考实现见 `examples/a11y/`）。

**出图与离屏**

- **`ICEComponent.renderTo(ctx, baseMatrix)`** —— 把**单个组件**渲染到指定上下文（组件级离屏缓存用的就是它），**不遍历子组件**。
- **`renderSubtreeTo(component, ctx, baseMatrix)`（4.3.0 新增）** —— 把**一棵子树**渲染到指定上下文，次序与渲染队列 / SVG 导出同源（先父后子、同级派生件在前、各自按 `zIndex` 升序）。批量精灵、导出缩略图、服务端出图都应该用它；对复合组件只调一次 `renderTo()` 只会得到一张空白位图。

## 📈 规模与性能

> **口径**：Apple M4 / Chrome 153 / 1600×1000 / dpr=1，真机（CDP 接管可见窗口）与无头各跑一遍，
> `examples/performance/bench-scene.html` 与 `max-elements.html`，每档开新页面、取 p50。
> **数字跨机器会差数倍**——以本机 `npm run bench*` 的输出为准；仓库里的基准都带**棘轮基线**（`--check` 漂了就红）。

### 按负载分类的规模边界

"不可用"不能只看图元数，要看**每帧要重新光栅化多少**：

| 图元数 | 静态整屏重绘 | **每帧全量重光栅** | 单组件拖动（局部重绘） | 命中检测 / 次 |
|---|---|---|---|---|
| 1,000 | 0.1 ms | 2.3 ms（435 fps） | 0.2 ms | ~0 ms |
| 5,000 | 0.2 ms | 12.9 ms（78 fps） | 0.6 ms | — |
| 10,000 | 0.3 ms | 24.6 ms（41 fps） | 1.2 ms | 0.2 ms |
| 20,000 | 0.7 ms | 53.9 ms（19 fps） | 2.6 ms | — |
| 50,000 | 3.1 ms | 123 ms（8 fps） | 11.3 ms（88 fps） | 2.0 ms |
| 100,000 | **8.3 ms（120 fps）** | 282 ms（4 fps） | **20.6 ms（49 fps）** | 7.6 ms |

同一批页面里的**常规动画**路径（写值通道 + 位图复用）：1,000 → 1.1ms、5,000 → 6.2ms、
10,000 → 13.6ms（73 fps）、20,000 → 27.4ms（36.5 fps）。

**四条结论**：

1. **60 fps 线按负载分类**：每帧全量重光栅只有 **4~5 千**；常规动画 **1 万**；**"静态大图 + 局部编辑"到 10 万仍可用**
   （稳态 120 fps、拖动 49 fps）；带 hover 的交互受命中检测限制（10 万 **7.6 ms/次**），60 fps 线约 **3~5 万**。
2. **内存先于渲染成为硬天花板**：对象树每图元约 **2.37 KB**（node 独立进程真增量：10 万 232MB / 50 万 1156MB / **100 万 2312MB**），
   且这是最简单矩形的口径，文本 / 连线 / 阴影更低。
3. **构建 / 首帧 / 整屏重绘**（`max-elements.html?full=1`）：10 万 0.51s / 0.26s / 89ms；
   50 万 2.6s / 1.5s / 213ms；**100 万（堆约 2.3GB）6.1s / 4.3s / 455ms** —— 100 万在对象树模式下"建得起来但不可用"。
4. **真机 GPU 只帮"光栅化密集"那一档**（比无头快 1.6~1.7×），静态整屏、局部重绘、命中检测、常规动画四类基本一致
   —— 瓶颈在每组件的 JS，不在 GPU。

### 内存：4.2.0 的四刀（10 万图元）

| 措施 | 效果 |
|---|---|
| 几何签名：每图元常驻数组 → 双 32 位哈希 | 少常驻 ≈11.7 MB |
| 默认事件监听：构造期注册 → 类级声明 + 派发时解析 | 每图元少 3 个数组 + 3 条记录 |
| 上屏快照盒：每组件一个 `Float64Array(4)` → 分块 arena | 少 10 万个 JSTypedArray + ArrayBuffer ≈10.7 MB |
| 同几何图元共享 `Path2D` | 10 万图元 100,018 条路径 → **24 条**（55.7 MB → ≈13 KB） |

合计（真机堆快照"全堆自有大小"）：**234.6 → 171.3 MB（−27.0%）**、堆节点 **681.5 万 → 454.9 万**；
拖动 53.8 → **95.8~108.7 fps**、平移 77.7 → **105~112 fps**；相对最初的 648.5 MB 基线**累计 −73.6%**。

### 虚拟子源：把"文档规模"和"内存"解耦

| 指标 | 对象树（现状） | 虚拟子源 |
|---|---|---|
| 堆（10 万图元） | 173.8 MB | **5.8 MB**（纯批量）/ 6.9 MB（1/3 带标注） |
| 单帧（强制全量重画） | 123.1 ms | **0.3 ms** |
| 平移（官方 API） | 116.6 fps | **121.2 fps / 0 长任务** |
| 命中（空点最坏） | 3,994 µs | **0.15 µs** |
| 按需新建 1 个图元 | 117 ms | **0.3 ms** |
| **100 万图元** | 建不起来 | **32 MB、窗口内画 6,653 个、单帧 1.1 ms** |

> 边界（不是万能药）：收益 = **看不见的比例**（全都在一屏时只有每项成本那点收益）；文字 / 图片 / 自定义子类走"窗口内物化"（内存 O(窗口)）；Worker 镜像目前只含物化子项（引擎会告警一次）。
> 完整决策记录（每一刀的 A/B、被否决的方案、复现口径）见 [`docs/architecture/23-memory-and-virtualization.md`](./docs/architecture/23-memory-and-virtualization.md)。

## 🧪 工程化与质量门禁

| 门禁 | 现状（2026-09-21，v4.3.0） |
|---|---|
| 单元测试 | **175 套 / 1,466 条**（jest，镜像 `src/` 结构；带只许上调的覆盖率门槛） |
| 像素 / 交互回归 | **Playwright 111 条 / 25 个 spec**：golden image、脏矩形像素一致性、离屏缓存保真、SVG 与画布对照、viewport / 对齐 / 交互、**95 个示例页冒烟** |
| 基准（带棘轮基线） | 场景基准 + 微基准 + 动画 + 分层 + 内存四套，`--check` 在 `verify:full` 里跑，数字漂了会红 |
| 发布包门禁 | `publint`（exports / types / files 契约）+ `attw`（各解析模式下的类型）+ **`prepublishOnly = npm run verify`**（发布前必过类型 / 构建 / 单测，避免打包旧产物） |

| 命令 | 说明 |
|---|---|
| `npm run verify` | lint + 类型检查 + 构建 + 单测 + 场景基准 + 发布包门禁（**发版前必跑**） |
| `npm run verify:full` | `verify` + 可视化回归 + 动画 / 分层 / 微基准 / 内存基准（CI 与发版的完整门禁） |
| `npm test` / `npm run test:visual` | 单测 / Playwright 回归（`test:visual:ci` 是跨平台稳定子集） |
| `npm run bench` / `bench:micro` / `bench:anim` / `bench:layers` / `bench:mem` | 五套基准（改 `src/` 后先 `npm run build`） |
| `npm run pkg:check` | 发布包完整性（`publint` + `attw`） |

提交前自动跑 lint-staged（husky）；CI 在 [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)。
代码同时托管在 **GitHub**（`package.json` 的 `repository` 指向这里）与 Gitee 镜像，CI 只在 GitHub 上跑。

## 📚 文档与生态

- **架构设计文档** —— [`docs/architecture/`](./docs/architecture/README.md)：**23 篇**。运行时链路 / 组件模型 / 坐标系与矩阵 / 渲染性能 / 事件系统 / 序列化 / 交互动画 / 多运行时兼容 / 路线图与边界 / Worker 与离屏 / 视口缩放 / 对齐吸附 / 能力缺口 / 无障碍 / 应用驱动复盘 / 连线端点评估 / i18n 边界 / 动画机制 / 主题与样式 / 布局 / 性能评估（脏矩形与空间索引）/ 引擎升级验证 / **内存与虚拟化决策记录**。
- **在线文档站** —— <https://ice-render.github.io/ice-render-doc/>（含可交互示例、API 参考、家族产品页）。
- **示例** —— [`examples/`](./examples/index.html)：**95 个**可直接在浏览器打开的页面（图形、容器、事件、拖拽、连接线、动画、布局、文本、视口、对齐、插件、无障碍、worker、虚拟化、性能基准…）。

**家族成员**（都建立在同一套引擎 / 组件模型之上）

| 层 | 项目 | 说明 |
|---|---|---|
| 引擎 | **ice-render** | 本仓 |
| 应用 | [ice-entity-designer](https://github.com/ice-render/ice-entity-designer) | 可视化建模工具集：ER / 流程图 / BPMN / UML / 状态机 / 甘特 / 电力一次 / 电力二次 / 给水排水，9 个域包 |
| 应用 | [ice-chart](https://github.com/ice-render/ice-chart) | 交互式图表库（折线 / 柱 / 饼 / 雷达 / 桑基 / 关系图…），命中与交互全部交给引擎 |
| 应用 | [ice-web-components](https://github.com/ice-render/ice-web-components) | 仿 Swing 风格的 Canvas 原生 UI 组件库（86 个组件 + Bootstrap 5 令牌主题） |
| 应用 | [ice-trading-chart](https://github.com/ice-render/ice-trading-chart) | 金融交易图表：K 线、影线命中、OHLC 提示框、价格轴量程 |
| DSL | ice-render-dsl / [ice-chart-dsl](https://github.com/ice-render/ice-chart-dsl) / [ice-entity-designer-dsl](https://github.com/ice-render/ice-entity-designer-dsl) / ice-web-components-dsl | 让 AI Agent 只产出 JSON 就能驱动引擎与产品（带结构化自修复诊断） |

## 🔧 二次开发

基于引擎的类接口即可扩展自定义图元。以 `ice-entity-designer` 中的连线组件为例：

```javascript
import { ICEVisioLink } from 'ice-render';

export default class Relation extends ICEVisioLink {
  constructor(props) {
    super({ title: 'Relation', relationType: 'one-to-one', referencedColumnName: 'id', ...props });
  }

  toEntityObject() {
    const { title, relationType, referencedColumnName } = this.state;
    const resolveEndpoint = (linkKey, prefix) => {
      const id = this.state.links?.[linkKey]?.id;
      if (!id) return {};
      return { [prefix + 'Id']: id, [prefix + 'Name']: this.ice.findComponent(id).state.entityName };
    };
    return { title, relationType, referencedColumnName, ...resolveEndpoint('start', 'from'), ...resolveEndpoint('end', 'to') };
  }
}
```

> [`ice-entity-designer`](https://github.com/ice-render/ice-entity-designer) 是引擎二次开发的完整示范（9 个域包 + 虚拟文档 + worker 镜像）；
> 它已被用于 [`craft-codeless-designer`](https://github.com/craft-codeless-designer) 低代码项目。

## 📸 截图

> 截图由 `examples/` 下的示例页直接采集（Playwright、2× 像素比、按内容包围盒裁切，不含浏览器外壳与页面留白）。

**图元与样式** —— 形状库、渐变、阴影、虚线（`examples/shapes/shapes-basic.html`）

<img src="./examples/assets/shot-shapes-basic.png" alt="图元与样式">

**卡片 / 网格布局** —— 容器嵌套 + 布局引擎（`examples/layout/dashboard.html`）

<img src="./examples/assets/shot-layout-dashboard.png" alt="卡片与网格布局">

**Visio 风格连线** —— 端点插槽吸附 + 连线标签（`examples/line-and-link/link-label.html`）

<img src="./examples/assets/shot-visio-link-label.png" alt="Visio 风格连线与标签">

**嵌套容器** —— `ICEGroup` 任意层级嵌套与坐标复合（`examples/group/group-basic.html`）

<img src="./examples/assets/shot-container-nesting.jpg" alt="嵌套容器">

**视口缩放 / 平移** —— 视图缩放与图元缩放分离（`examples/viewport/viewport-zoom.html`）

<img src="./examples/assets/shot-viewport-zoom.png" alt="视口缩放与平移">

**实例级主题** —— 同一页面两套主题互不污染（`examples/theme/theme-multi-instance.html`）

<img src="./examples/assets/shot-theme-isolation.png" alt="实例级主题隔离">

**插件机制** —— `ICE.use()` 三层注册点（`examples/plugin/plugin-basic.html`）

<img src="./examples/assets/shot-plugin.png" alt="插件三层注册点">

**极端规模** —— 100 万图元对象树：构建 6.1s、首帧 4.3s、整屏重绘 455ms（堆约 2.3GB，2026-09-20 真机实测）；
同规模改用**虚拟子源**则是 32 MB / 单帧 1.1 ms（`examples/performance/max-elements.html`）

<img src="./examples/assets/shot-max-elements.jpg" alt="极端规模下的图元密度">

## 📄 License

[MIT](./LICENSE) © 大漠穷秋
