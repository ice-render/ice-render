/**
 * 脏矩形局部重绘（dirty-rect）的纯函数工具集。
 *
 * 本模块不依赖任何引擎实例/ctx，所有几何与阈值计算都可用 jest 直接单测。
 * 设计目标见 docs/architecture/04-rendering-performance.md「脏矩形局部重绘」章节。
 *
 * 盒的表示：一维数组 [minX, minY, maxX, maxY]（世界/画布坐标，轴对齐，已含 paint pad）。
 */

import { resolveTextDecorations } from '../graphic/text/text-style';

/** 抗锯齿兜底余量（px），覆盖 1px 级 AA 溢出与文字 baseline 溢出。 */
export const PAD_AA = 2;

/**
 * 命中预筛的包围盒容差（px）。
 *
 * 命中的第一道筛子用「渲染快照的世界盒」做 O(1) 拒绝；快照盒本身已含 paint pad
 * （含 AA 余量），但折线的命中判定自带 errorRange 容差，这里再放宽 1px 作为安全余量，
 * 确保预筛绝不误杀边界命中。
 */
export const HIT_BOX_TOLERANCE = 1;

/** 阴影简写 → 阴影外扩量（shadowBlur + max(|offsetX|,|offsetY|)），与 ICEComponent.SHADOW_PRESETS 数值一致。 */
const SHADOW_PAD = { sm: 4 + 1, md: 10 + 3, lg: 20 + 6 };

/** `blur(Npx)` / `drop-shadow(dx dy N)` —— 取 `ctx.filter` 里会**把墨迹画到几何盒外**的两项。 */
const FILTER_BLUR_RE = /blur\(\s*(-?[0-9]*\.?[0-9]+)(?:px)?\s*\)/g;
const FILTER_DROP_SHADOW_RE =
  /drop-shadow\(\s*(-?[0-9]*\.?[0-9]+)(?:px)?\s+(-?[0-9]*\.?[0-9]+)(?:px)?(?:\s+([0-9]*\.?[0-9]+)(?:px)?)?/g;

/**
 * `ctx.filter` 的落墨外扩量（**设备像素**）。
 *
 * 为什么必须算：滤镜是在**光栅化阶段**生效的，模糊/投影会把墨迹画到几何盒之外。
 * 不扩盒的后果很具体 —— 离屏位图按几何盒切、脏矩形按几何盒裁，边缘会被切掉一条
 * （和文档里已经记过的「下划线被切掉半截」是同一类事故）。
 *
 * 系数一，真机实测（Chromium，`blur(Npx)` 画一个 50×50 实心块，量 alpha>0 的最远像素）：
 * `blur(4)` 溢出 10px、`blur(10)` 溢出 24px、`blur(20)` 溢出 49px —— 即 **≈2.5σ**；
 * `drop-shadow(6 8 10)` 四向溢出 18/16/30/32（≈2.5σ ± 偏移）。
 * 这里取 **3σ**（比实测再宽一点），与阴影沿用同一套「宁可多扩、不可切边」的口径。
 *
 * 系数二（**这一条是踩过的坑**）：滤镜的长度参数是**设备像素**，**不随视图缩放变化**。
 * 实测把同一个 `blur(8px)` 画在 `setTransform(1 / 0.62 / 0.5)` 下，溢出恒为 18~19 设备像素
 * —— 与 `stroke` / `shadowBlur`（这两个在用户坐标里、随变换缩放）**是反的**。
 * 因此 `stylePaintPad()` 用它时必须除以渲染视口缩放，否则缩略视图下位图会切掉滤镜的尾巴
 * （真机复现：scale=0.62 时 `drop-shadow` 差 118 像素、`blur(8px)` 差 76 像素）。
 *
 * 其它滤镜函数（`grayscale` / `saturate` / `sepia` / `contrast` …）只改颜色、不扩墨迹，返回 0。
 */
export function filterDevicePad(filter: any): number {
  if (typeof filter !== 'string' || !filter) return 0;
  // 绝大多数组件没有滤镜：先做一次廉价的子串判断，别为它们付正则的钱（本函数在每帧每组件上跑）
  if (filter.indexOf('blur') < 0 && filter.indexOf('drop-shadow') < 0) return 0;

  let pad = 0;
  FILTER_BLUR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FILTER_BLUR_RE.exec(filter)) !== null) {
    const blur = Number(m[1]) || 0;
    if (blur > 0) pad = Math.max(pad, Math.ceil(blur * 3));
  }
  FILTER_DROP_SHADOW_RE.lastIndex = 0;
  while ((m = FILTER_DROP_SHADOW_RE.exec(filter)) !== null) {
    const dx = Math.abs(Number(m[1]) || 0);
    const dy = Math.abs(Number(m[2]) || 0);
    const blur = Number(m[3]) || 0;
    pad = Math.max(pad, Math.ceil(blur * 3) + Math.ceil(Math.max(dx, dy)));
  }
  return pad;
}

/**
 * 计算组件「实际绘制会溢出几何边界多少像素」的保守 padding。
 * 依据 state（style.lineWidth / lineBorderWidth / shadow 等）实时估算，
 * 用于把几何包围盒扩成「真实落墨盒」。
 *
 * @param state 组件 state（只读）
 * @param scale 渲染视口缩放（世界 → 设备），默认 1。
 *   **只有 `ctx.filter` 用得上它** —— 滤镜的长度参数是设备像素、不随变换缩放，
 *   而本函数返回的是**世界坐标**的 pad，两者相差一个 `scale`（见 `filterDevicePad`）。
 */
export function stylePaintPad(state: any, scale: number = 1): number {
  const style = (state && state.style) || {};
  let pad = PAD_AA;

  // 描边 / 蚂蚁线管壁：以线宽（保守取整条线宽）外扩。
  const lineWidth = Number(style.lineWidth) || 0;
  const borderWidth = Number(state.lineBorderWidth) || 0;
  const strokePad = Math.ceil(Math.max(lineWidth, borderWidth));
  if (strokePad > 0) pad += strokePad;

  // 阴影：显式数值优先；style.shadow 简写映射到简写档。
  const shadowBlur = Number(style.shadowBlur);
  if (shadowBlur > 0) {
    pad +=
      shadowBlur + Math.max(Math.abs(Number(style.shadowOffsetX) || 0), Math.abs(Number(style.shadowOffsetY) || 0));
  } else if (typeof style.shadow === 'string' && SHADOW_PAD[style.shadow]) {
    pad += SHADOW_PAD[style.shadow];
  }

  // 滤镜（ctx.filter）：blur / drop-shadow 的墨迹会溢出几何盒，且它的长度是**设备像素** ——
  // 除以 scale 才能与世界坐标的 pad 相加（scale ≤ 0 视作 1，避免除零）
  pad += filterDevicePad(style.filter) / (scale > 0 ? scale : 1);

  // 文本装饰线：下划线画在**基线下方**（0.12em + 半个线宽），会溢出「贴合字形墨迹」的几何盒。
  // 不把这段算进落墨盒，脏矩形会把它裁掉半截、离屏位图也会切掉 —— 表现为「下划线时有时无」。
  if (resolveTextDecorations(style.textDecoration).indexOf('underline') >= 0) {
    const fontSize = Number(style.fontSize) || 0;
    pad += Math.ceil(fontSize * 0.2);
  }
  return pad;
}

export function boxWidth(box: number[]): number {
  return box[2] - box[0];
}
export function boxHeight(box: number[]): number {
  return box[3] - box[1];
}
export function boxArea(box: number[]): number {
  return boxWidth(box) * boxHeight(box);
}

/**
 * 把 src 盒并进 target 盒（原地修改 target，减少分配）。
 * target 传入空盒（[Infinity,Infinity,-Infinity,-Infinity]）即可从 src 开始累加。
 */
export function unionBoxes(target: number[], src: number[]): number[] {
  if (src[0] < target[0]) target[0] = src[0];
  if (src[1] < target[1]) target[1] = src[1];
  if (src[2] > target[2]) target[2] = src[2];
  if (src[3] > target[3]) target[3] = src[3];
  return target;
}

/** 判断盒 a 与盒 b 是否相交（含边界相触）。 */
export function intersects(a: number[], b: number[]): boolean {
  return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
}

/**
 * 盒内是否有限（无 NaN/Infinity）。非法盒不得参与区域计算或写入快照。
 */
export function isFiniteBox(box: number[]): boolean {
  return isFinite(box[0]) && isFinite(box[1]) && isFinite(box[2]) && isFinite(box[3]);
}

/**
 * 生成一个「空盒」，可用作 unionBoxes 的起点。
 */
export function emptyBox(): number[] {
  return [Infinity, Infinity, -Infinity, -Infinity];
}

/**
 * 把盒外扩到整像素边界（min 向下取整、max 向上取整），保证 clearRect/clip 用同一像素掩码，
 * 消除「清除区域与裁剪区域亚像素不一致」导致的接缝。
 */
export function integerAlign(box: number[]): number[] {
  box[0] = Math.floor(box[0]);
  box[1] = Math.floor(box[1]);
  box[2] = Math.ceil(box[2]);
  box[3] = Math.ceil(box[3]);
  return box;
}

/**
 * 合并两个盒为一个盒（取并集，不修改入参）。
 */
export function mergeBox(a: number[], b: number[]): number[] {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/**
 * 把一组脏盒聚合成若干块**互不相接**的裁剪区。
 *
 * 为什么不是并成一个盒：脏组件常是分散的（多选拖拽、布局重排、若干条独立动画），
 * 一个并集大盒会把中间大片干净区域一起圈进来，很容易撞上「脏区面积占比」阈值
 * 从而回退全量 —— 局部重绘的收益被吃掉。多块裁剪区让每块都贴近真实脏区。
 *
 * 策略：
 * 1. 贪心合并 —— 与已有区相交/相接**且合并划算**的盒并进去；合并会改变相邻关系，故迭代到收敛；
 * 2. 区数超 `maxRegions` 时，反复合并「并集面积增量最小」的两块（只合并划算的）。
 *    `maxRegions` 是**软上限**：没有划算的合并时就多留几块（多跑几遍便宜的 AABB 过滤，
 *    好过把脏区撑成整屏）；区数超过 `MAX_REGIONS_HARD` 时塌缩成一个并集盒，
 *    让面积阈值去回退全量。
 * 3. **聚合预算 `MAX_COALESCE_REGIONS`**（2026-09-13 加）：第 2 步的「挑代价最小的两块」
 *    是 O(k²)，最多跑 k 轮 → 整体 O(k³)。脏块数量上百时，聚合本身就够把一帧卡死
 *    （实测：100 块 108ms / 300 块 2.7s / 600 块 21.9s / 1000 块 111s）。
 *    因此区数一旦超过预算就**不再精挑细选**，直接塌缩成并集盒 —— 保守解，
 *    最多回退全量重绘，绝不会画错。
 *
 * ## 「合并划算」护栏（`isWorthMerging`，2026-09-11 加）
 *
 * 只按「相交就合并」会把**细长盒串联**：编辑器里拖动一个实体时，8 条横跨画布的关系连线
 * 旧/新盒互相交叉，22 个脏盒会被串成一个**整屏大盒**（实测面积占画布 1.004），
 * 于是永远撞上「脏区面积占比 > 0.35 回退全量」——局部重绘在该编辑器里 100% 失效，
 * 而 22 个盒的**实际面积之和只有画布的 6%**。
 * 护栏用「合并后面积 ≤ 两块面积之和 × 2」把这类无意义的合并挡掉，同时不影响
 * 相邻 / 嵌套 / 同向延展的正常合并（它们的比值 ≈ 1.0~1.3）。
 *
 * 返回值保证两两不相接（可安全地按块分别 clearRect + clip）。
 */
/**
 * 合并两块时允许的**面积增长倍数**上限（见 `coalesceRegions` 的护栏说明）。
 *
 * 2 的含义：合并后的盒最多只能比「两块之和」大一倍（即至少一半面积是真脏的）。
 * 相邻/嵌套/同向延展的正常脏盒合并后 ≈ 1.0~1.3，远在阈值内；
 * 而两条互相交叉的细长连线合并后能到 10 倍以上 —— 那种合并必须拒绝。
 */
const MAX_MERGE_AREA_GROWTH = 2;

/**
 * 区数的**硬上限**。`maxRegions`（默认 6）是「尽量做到」的目标，不是硬闸门：
 * 当已经没有划算的合并时，多留几块区只是多跑几遍「组件 ↔ 区域」的 AABB 过滤
 *（每遍 O(组件数)，很便宜），而强行合并会把脏区撑成整屏、白扔掉局部重绘。
 * 但区数必须仍然有界 —— 超过本上限就直接塌缩成一个并集盒，交给面积阈值回退全量。
 */
const MAX_REGIONS_HARD = 24;

/**
 * 进入「精挑细选合并」阶段前允许的**区数预算**。
 *
 * 该阶段是 O(k³)：预算内的最坏代价 ≈ 32³ ≈ 3.3 万次基本运算（远低于一帧预算），
 * 一旦超预算就塌缩成并集盒。之所以留到 32（而不是直接卡在 `MAX_REGIONS_HARD = 24`）：
 * 现实中 25~32 块分散脏区（多选拖拽、若干条独立动画）还能靠划算合并收敛进少数几块，
 * 这条路径要保住；再多的脏块，并集盒几乎必然覆盖大片画布，回退全量本来就是更优解。
 */
const MAX_COALESCE_REGIONS = 32;

/** 合并两块是否「划算」：不会把大片干净区域圈进来。 */
function isWorthMerging(a: number[], b: number[]): boolean {
  const sum = boxArea(a) + boxArea(b);
  if (sum <= 0) return true;
  return boxArea(mergeBox(a, b)) <= sum * MAX_MERGE_AREA_GROWTH;
}

/**
 * 把所有有限盒塌缩成一个并集盒（超预算时的保守解；空输入返回空数组）。
 */
function collapseToUnion(boxes: number[][]): number[][] {
  const union = emptyBox();
  for (let i = 0; i < boxes.length; i++) {
    if (!isFiniteBox(boxes[i])) continue;
    unionBoxes(union, boxes[i]);
  }
  return union[0] === Infinity ? [] : [union];
}

export function coalesceRegions(boxes: number[][], maxRegions = 6): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!isFiniteBox(b)) continue;
    let merged = false;
    for (let j = 0; j < out.length; j++) {
      if (intersects(out[j], b) && isWorthMerging(out[j], b)) {
        out[j] = mergeBox(out[j], b);
        merged = true;
        break;
      }
    }
    if (!merged) out.push([b[0], b[1], b[2], b[3]]);
    // 超预算：立刻塌缩，避免下面的 O(k³) 阶段把一帧卡死。
    // 并集对「已聚合的块 ∪ 剩余未处理的盒」取并，与逐步合并的结果同集。
    if (out.length > MAX_COALESCE_REGIONS) return collapseToUnion(boxes);
  }

  // 合并后可能产生新的相接关系，迭代到收敛（通常 1~2 轮）
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (intersects(out[i], out[j]) && isWorthMerging(out[i], out[j])) {
          out[i] = mergeBox(out[i], out[j]);
          out.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
  }

  // 区数超上限：合并「并集面积增量最小」的两块。**优先挑划算的合并**（同样受护栏约束），
  // 只有在所有配对都不划算时才退而求其次 —— 否则上限这道闸门会把刚被护栏挡住的
  // 「细长盒串成一整块」又放进来。
  while (out.length > maxRegions) {
    let bi = 0;
    let bj = 1;
    let best = Infinity;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const cost = boxArea(mergeBox(out[i], out[j])) - boxArea(out[i]) - boxArea(out[j]);
        if (isWorthMerging(out[i], out[j]) && cost < best) {
          best = cost;
          bi = i;
          bj = j;
        }
      }
    }
    if (best === Infinity) {
      // 已经没有划算的合并了：细长盒再合只会把大片干净区圈进来。此时宁可多留几块。
      if (out.length > MAX_REGIONS_HARD) {
        // 但区数必须仍然有界：塌缩成一个并集盒，让面积阈值去回退全量（保持既有保守行为）。
        const union = out.reduce(
          (acc: number[], b: number[]) => mergeBox(acc, b),
          [Infinity, Infinity, -Infinity, -Infinity]
        );
        return [union];
      }
      break;
    }
    out[bi] = mergeBox(out[bi], out[bj]);
    out.splice(bj, 1);
  }
  return out;
}

/**
 * 多块裁剪区的总面积占画布的比例（用于「接近整屏则回退全量」的判定）。
 * 各块互不相接，面积可直接相加。
 */
export function regionsAreaRatio(regions: number[][], canvasWidth: number, canvasHeight: number): number {
  if (!canvasWidth || !canvasHeight) return 1;
  let area = 0;
  for (let i = 0; i < regions.length; i++) {
    area += boxArea(regions[i]);
  }
  return area / (canvasWidth * canvasHeight);
}

/**
 * 把「世界坐标盒」映射到「渲染坐标盒」（含 dpr），并向外取整。
 *
 * 渲染坐标 = 世界坐标 × 渲染视口 scale + 渲染视口 tx/ty，而 `ICE.getRenderViewport()` 已经
 * 把 dpr 乘进 scale 与 tx/ty（见 `ICE.getRenderViewport`）。`clearRect` / `clip` 用的正是这个
 * 坐标系，但脏区收集是在**世界坐标**里做的（上屏快照盒、组件几何盒都是世界盒），
 * 两者只在「视口为单位变换且 dpr === 1」时才重合 —— 这个函数就是它们之间唯一的换算点。
 *
 * 向外取整（min 向下、max 向上）保证映射后的区域不小于真实脏区，避免缩放时边缘出现接缝。
 */
export function mapBoxToRender(
  box: number[],
  viewport: { scale: number; tx: number; ty: number },
  out?: number[]
): number[] {
  const o = out || [0, 0, 0, 0];
  o[0] = Math.floor(box[0] * viewport.scale + viewport.tx);
  o[1] = Math.floor(box[1] * viewport.scale + viewport.ty);
  o[2] = Math.ceil(box[2] * viewport.scale + viewport.tx);
  o[3] = Math.ceil(box[3] * viewport.scale + viewport.ty);
  return o;
}

/**
 * 区域占画布总面积的比例，用于「接近整屏则回退全量」的判定。
 */
export function regionRatio(box: number[], canvasWidth: number, canvasHeight: number): number {
  if (!canvasWidth || !canvasHeight) return 1;
  return boxArea(box) / (canvasWidth * canvasHeight);
}

/**
 * 颜色字符串的 alpha（0~1）。
 *
 * 为什么要**解析值**而不是看字符串里有没有半透明写法：`'transparent'` / `rgba(…,0)` / `#RRGGBB00`
 * 的 alpha 是 **0 —— 该通道根本不落墨**。"不描边"最常见的写法就是 `strokeStyle: 'transparent'`，
 * 旧实现一看到 `transparent` 就把整个图元判成半透明，后果见 `isOpaqueDrawing` 的注释。
 *
 * 返回 `null` = 解析不出（当未知处理，由调用方决定保守口径）。
 */
function colorAlpha(v: any): number | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (s === 'transparent') return 0;
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    const h = hex[1];
    if (h.length === 4) return parseInt(h[3], 16) / 15; // #RGBA
    if (h.length === 8) return parseInt(h.slice(6), 16) / 255; // #RRGGBBAA
    return 1;
  }
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
  if (fn) {
    // 兼容两种写法：`rgba(0,0,0,.5)` 与 `rgb(0 0 0 / 50%)`
    const args = fn[2].split(/[,\s/]+/).filter((x: string) => x !== '');
    const token = args.length >= 4 ? args[3] : null;
    if (token === null) return fn[1].endsWith('a') ? null : 1; // `rgba()` 少写 alpha：未知
    const n = token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token);
    return Number.isFinite(n) ? n : null;
  }
  // 具名颜色 / currentColor / 其它关键字：canvas 侧都是不透明的
  return 1;
}

/**
 * 判断组件是否以「完全不透明、仅 source-over」的方式绘制。
 *
 * dirty-rect 用 clip 把补画限定在脏区域内；clip 边界与「半透明落墨（alpha 色 / 阴影 /
 * globalAlpha / 合成模式）」相交时，canvas 的 clip 会改变边界像素的子像素覆盖率，
 * 产生与全量渲染不一致的接缝。因此 v1 约定：本帧区域涉及任何非不透明落墨的组件时回退全量，
 * 局部重绘只服务于不透明场景（编辑器里的大多数实体/卡片/表格）。
 * 语义化渐变色（对象）视为不透明。
 */
export function isOpaqueDrawing(state: any): boolean {
  const style = (state && state.style) || {};
  // 子树不透明度（opacity）≠ 1 时整棵子树都可能半透明
  if (state && state.opacity !== undefined && state.opacity !== 1) return false;
  if (style.globalAlpha !== undefined && style.globalAlpha !== 1) return false;
  if (style.globalCompositeOperation && style.globalCompositeOperation !== 'source-over') return false;
  if (style.shadow || (Number(style.shadowBlur) || 0) > 0) return false;
  // 滤镜（ctx.filter）：模糊/投影会画出几何盒之外，且边界像素是半透明的 —— 与阴影同一档处理
  if (style.filter && style.filter !== 'none') return false;
  for (const key of ['fillStyle', 'strokeStyle']) {
    const v = style[key];
    // 非字符串（语义化渐变 / 图案对象）：沿用旧口径 —— 视为不透明（见上方注释）
    if (typeof v !== 'string') continue;
    const a = colorAlpha(v);
    if (a === null) return false; // 解析不出 alpha：按半透明保守处理
    /**
     * **alpha === 0 的通道不落墨，不构成"半透明落墨"**（2026-09-21 修）。
     *
     * 旧口径是"字符串里有 `transparent` / `rgba(` 就算半透明"，于是
     * `style: { fillStyle: '#10B981', strokeStyle: 'transparent' }`（= 只填充、不描边）被误判为半透明：
     * ① dirty-rect 会把它当 risky 组件 → 富场景稳定回退全量；
     * ② `ObjectCache` 会走"半透明 path"分支，**给每个这样的图元单独建一块离屏画布**。
     * 实测（`examples/performance/bench-scene.html` 10 万图元、真机 Chrome + V8 堆快照）：
     * 66,642 个图元命中 ②，JS 堆 364.7MB → 231.6MB（`strokeStyle` 换成实色后），**白吃 133MB**。
     */
    if (a <= 0) continue;
    if (a < 1) return false;
  }
  return true;
}
