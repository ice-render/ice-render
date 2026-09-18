/**
 * 组件级离屏缓存（对象缓存 / offscreen bitmap cache）。
 *
 * 把「昂贵组件」预渲染成一张位图，主画布上只 drawImage。收益有三点：
 *   1. 缓存命中帧跳过 measureText / fillText / strokeText / 折线光栅化等昂贵调用；
 *   2. 纯平移（left/top 变化、内容与线性变换不变且**设备像素对齐**）复用位图，只更新贴图落点；
 *   3. dirty-rect 的 clip 只作用于最终位图的整像素采样，不再改变文字/半透明落墨的内部 AA，
 *      因此缓存组件可被视为「不透明贴图」，用于放宽场景级门控。
 *
 * ## 像素保真契约（2026-09-11 修正，回归测试见 tests/renderer/offscreen-cache-fidelity.test.ts）
 *
 * 位图必须与「直接落墨」逐像素一致，否则缓存就是画质回归。做法是把位图的栅格**对齐到主画布的
 * 设备像素栅格**：
 *
 *   - 光栅化缩放取**渲染视口**的 scale（`rs = getRenderViewport().scale`，已含 dpr 与视口缩放），
 *     base 矩阵显式写成 `[rs,0,0,rs, ox-dx, oy-dy]`；
 *   - 贴图落点 `dx/dy` 取整到整数设备像素，贴回时 1:1（`drawImage(img, dx, dy)`，不传目标宽高）。
 *
 * 于是 `device(world) = world * rs + (ox, oy)` 在「位图内部坐标 + 整数平移 dx,dy」下被精确复现，
 * 贴图是纯整数拷贝，**全程没有重采样**。
 *
 * 旧实现的三个坑（都已修）：
 *   1. 用 `root.devicePixelRatio` 放大位图，但主画布的设备比例是 `ice.dpr`（默认 1）—— 二者不一致时
 *      位图被整幅缩放贴回（视网膜屏上缓存文字只剩约 30% 墨迹）；
 *   2. 依赖 `ctx.scale(dpr,dpr)` 放大离屏上下文，但 `renderTo()` 内部的 `setTransform()` 会把它
 *      整条覆盖 —— 是死代码，位图实际按 1:1 光栅化；
 *   3. 用世界尺寸 `lw/lh` 作为 drawImage 的目标矩形，且落点带小数（paint pad 之后是亚像素值），
 *      任何视口缩放/平移都会触发双线性重采样，折线、细笔画这类高频内容直接糊掉。
 */
import root from '../cross-platform/root';
import { stylePaintPad, isOpaqueDrawing } from './dirty-rect-util';
import { isEffectivelyVisible } from '../util/data-util';

/**
 * 封闭 dot-path 的最小缓存面积（逻辑像素，200x200）。
 * 大量小图形的 drawImage 光栅化成本会反超直接 fill/stroke（见 perf 回退记录），
 * 因此只缓存足够大的 dot-path。
 */
const MIN_DOT_PATH_CACHE_AREA = 40000;

/**
 * 单个**连线**位图的设备像素上限（≈8MB，4 字节/像素）。
 *
 * 连线此前被完全排除在离屏缓存之外，理由是「位图可能很大」；但代价是
 * 「干净但不可缓存的 risky 组件与脏区相交 → 回退全量」会常态命中 —— 连线通常横跨画布，
 * 任何脏区都与它相交，于是富文本场景的局部重绘 100% 失效（实测编辑器拖动实体 22/22 帧全部回退）。
 * 现在改为「允许缓存，但按设备像素面积设上限」：位图随渲染视口缩放放大，所以上限按设备像素算。
 */
const MAX_LINE_CACHE_DEVICE_AREA = 2000000;

/**
 * 离屏缓存的总位图预算（字节）：超出后**不再新增**连线缓存条目（已缓存的继续复用）。
 *
 * 只约束新增、不做 LRU 淘汰：淘汰会让「哪些连线能被贴图」随访问顺序抖动，
 * 而门控依赖「已缓存」这个稳定事实；停止新增则是可预测的。
 */
const MAX_CACHE_BYTES = 32 * 1024 * 1024;

export interface CachedSurface {
  canvas: any;
  ctx: any;
  /** 位图尺寸（设备像素，四周各含 1px 透明余量，用于吸收贴图取整误差）。 */
  pw: number;
  ph: number;
  /** 当前贴图落点（整数设备像素）。 */
  dx: number;
  dy: number;
  /** 建位图时的贴图落点；纯平移复用由 `dx0/dy0` 加「设备像素取整的位移」推出，不会累积漂移。 */
  dx0: number;
  dy0: number;
  /** 建位图时的世界盒左上角（paint pad 之后）。 */
  buildMinX: number;
  buildMinY: number;
  /** 建位图时的渲染视口：`device = world * rs + (ox, oy)`。视口一变，位图即失效。 */
  rs: number;
  ox: number;
  oy: number;
  contentKey: string;
  /**
   * 内容指纹的**比较基准**（`contentKey` 的向量形态）：数组元素已深拷贝，
   * 因此每帧只需与它逐项比较，不必再拼字符串。见 `contentKeyVector`。
   */
  contentKeys: any[];
  linearKey: string;
}

/**
 * 指纹向量的深拷贝：数组元素复制成新数组（`lineDash` / `dots` 这类会被就地改写，
 * 只存引用会让「比较基准」跟着一起变，等于永远比不出差异）。
 */
function cloneKeyVector(vec: any[]): any[] {
  const out = new Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i];
    out[i] = Array.isArray(v) ? cloneKeyVector(v) : v;
  }
  return out;
}

/**
 * 指纹向量比较。
 *
 * **必须严于字符串比较**：字符串不同时这里必须判「不同」（宁可多重一次位图，也不能贴旧位图）。
 * 反向不要求 —— 判成「不同」只是多重建一次，安全。所以这里的边角取舍一律偏保守：
 * `NaN` / `undefined` / 稀疏数组在 `JSON.stringify` 里都会被抹平，这里一律判为「不同」。
 */
export function keyEquals(a: any, b: any): boolean {
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr || bArr) {
    if (!aArr || !bArr || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!keyEquals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  return Object.is(a, b);
}

/** 向量 → 字符串指纹（与改造前逐字一致：数组走 JSON，标量走 String，`|` 连接）。 */
function stringifyKeyVector(vec: any[]): string {
  let key = '';
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i];
    const part = Array.isArray(v) ? JSON.stringify(v) : String(v);
    key = i === 0 ? part : key + '|' + part;
  }
  return key;
}

class ObjectCache {
  private ice: any;
  private map = new WeakMap<object, CachedSurface>();
  /** 已缓存位图的累计字节数（用于总预算门控；WeakMap 不可遍历，故显式记账）。 */
  private __bytes = 0;

  /**
   * 运行时是否**没有**离屏 canvas 能力。
   *
   * 小程序老基础库没有 `wx.createOffscreenCanvas`，极简 headless 环境也没有 —— 这类运行时
   * 建位图会抛错；由于 build 发生在帧回调里，抛出去就是未捕获异常（小程序直接白屏）。
   * 一旦探测到这种情况就整体关掉缓存，退化为直接落墨。
   */
  private __offscreenUnavailable = false;
  /** 上一帧的渲染视口（复用同一对象，避免每帧分配）。 */
  private __vp: { scale: number; tx: number; ty: number } | null = null;
  /** 本帧的渲染视口是否与上一帧不同。视口变化帧一律不缓存，见 `beginFrame()`。 */
  private __vpChanged = false;
  /** `contentKeyVector` 的复用缓冲（每帧复用，避免为每个组件分配一个 40 元素数组）。 */
  private __keyScratch: any[] = [];

  constructor(ice: any) {
    this.ice = ice;
  }

  /** 渲染视口：世界 → 画布设备像素的仿射映射（`device = world * scale + (tx, ty)`）。 */
  private __rvp(): { scale: number; tx: number; ty: number } {
    if (this.ice && typeof this.ice.getRenderViewport === 'function') {
      return this.ice.getRenderViewport();
    }
    return (this.ice && this.ice.viewport) || { scale: 1, tx: 0, ty: 0 };
  }

  /**
   * 渲染器每帧开头调用：记录「渲染视口是否相对上一帧发生了变化」。
   *
   * 视口一变，所有位图的栅格都要重算（重新光栅化），代价与「这一帧直接落墨」同阶；
   * 而缩放/平移过程中视口每帧都在变 —— 那时缓存只会白扫一遍整屏。因此视口变化的那一帧
   * 直接停用缓存（`isCachable` 返回 false），落到与旧引擎一致的直接绘制路径；
   * 手势停下后的第一帧再统一重建一次。
   */
  public beginFrame(): void {
    const vp = this.__rvp();
    const prev = this.__vp;
    this.__vpChanged = !!prev && (prev.scale !== vp.scale || prev.tx !== vp.tx || prev.ty !== vp.ty);
    if (!prev) {
      this.__vp = { scale: vp.scale, tx: vp.tx, ty: vp.ty };
    } else {
      prev.scale = vp.scale;
      prev.tx = vp.tx;
      prev.ty = vp.ty;
    }
  }

  /**
   * 本帧的渲染视口是否相对上一帧变过（由 `beginFrame()` 记录）。
   *
   * @internal 给静态层位图用：位图与组件位图同一条纪律 —— **视口变化的帧一律不建位图**
   * （栅格已错位，加一次"重建 + 贴回"比直接画还贵），手势停下后的第一帧再统一重建。
   */
  public viewportChangedThisFrame(): boolean {
    return this.__vpChanged;
  }

  /** 位图是否与当前渲染视口同源（缩放与平移都必须一致，否则栅格不再对齐）。 */
  private __sameViewport(cache: CachedSurface, rs: number, ox: number, oy: number): boolean {
    return cache.rs === rs && cache.ox === ox && cache.oy === oy;
  }

  /**
   * 组件是否走离屏缓存。v1 只缓存「非编辑态、可见」的 ICEText；后续可扩展到 dot-path /
   * 半透明 / ICEGroup 子树。
   */
  isCachable(component: any): boolean {
    // 视口变化帧一律不缓存：位图栅格与设备栅格已错位，重建代价又和直接落墨同阶。
    // 见 `beginFrame()`。（只是一次字段读 —— 本方法在热路径上每个组件每帧都会被调用。）
    if (this.__vpChanged) return false;
    // 运行时没有离屏 canvas（老基础库的 `wx.createOffscreenCanvas` 缺失、极简 headless 环境）：
    // 缓存整条不可用，一律直接落墨。见 `render()` 里对 build 失败的兜底。
    if (this.__offscreenUnavailable) return false;
    //@perf 廉价前置判断：下面能判真的分支只有四类 —— 文本 / 连线 / 点集路径 / 半透明落墨。
    //       四类都不是时结果必为 false，此时连**祖先链都不该遍历**（`getEffectiveOpacity` /
    //       `hasClippingAncestor` 是这条谓词里最贵的两段，而它在渲染热路径上每帧每组件都要问）。
    //       判定口径与下面的分支**逐条对应**，只是提前挡掉注定为 false 的那些。
    //
    //       注意：`isOpaqueDrawing()` 必须**放在最后**求值 —— 它带着两条颜色正则，是这几个判断里最贵的；
    //       而文本 / 连线 / 点集这三类根本不看它（见下面的分支）。写成常量先算的话，每帧给每个文本
    //       白付一次正则 —— 实测文本静态场景因此慢 15%（bench/render.cjs 场景 C）。
    const isText = typeof component.measureText === 'function';
    const isLine = !!component.isLine; // 与下面的分支同为「真值判断」，不用 `=== true`
    const isDotPath = typeof component.calcDots === 'function';
    let opaqueDrawing = true;
    if (!isText && !isLine && !isDotPath) {
      opaqueDrawing = isOpaqueDrawing(component.state);
      if (opaqueDrawing) return false; // 不透明落墨且不是上面三类 → 永远不可缓存
    }
    // 有效不透明度 ≠ 1（自身或**任一祖先**）时不缓存。
    //
    // 位图是 `build() → renderTo()` 用「当时」的 effectiveOpacity 烤出来的，而贴图路径 `draw()`
    // 只做 `drawImage`（不叠 alpha）。于是「先建位图、后改不透明度」会把组件永久定格在那一刻：
    // 淡入的模态 / 抽屉 / 消息里的文字永远半透明；淡入起点 opacity=0 的更狠 —— 底板出来了、
    // 文字整条不见（arcade 掌机的「已暂停」提示就是这么消失的）。
    // 祖先链必须在这里一并看：子组件自己的 state.opacity 是 1，变化发生在祖先身上。
    if (!this.__isOpaque(component)) return false;
    // 祖先开了 clipChildren 时，位图里没有那层裁剪（位图是单独渲染的），
    // 贴回去会画到裁剪区外 —— 这类组件一律走直接落墨。
    if (typeof component.hasClippingAncestor === 'function' && component.hasClippingAncestor()) {
      return false;
    }
    if (isText) {
      return !component.state.editing && isEffectivelyVisible(component);
    }
    // 连线（折线 / 贝塞尔 / Visio 连线）：`dots` 已进入 `contentKey`，纯平移复用位图同样成立，
    // 因此「缓存后被视为不透明贴图」的结论对连线也适用 —— 这正是让富场景局部重绘生效的关键
    //（见文件头的第 3 条收益）。唯一要挡住的是位图开销：按设备像素面积设上限，并排除蚂蚁线。
    if (component.isLine) {
      if (component.state.lineDashFlow) return false; // 蚂蚁线每帧落点都在变，缓存只会白扫
      if (!isEffectivelyVisible(component)) return false;
      const rs = this.__rvp().scale; // 只有连线按「设备像素面积」设上限，这里才需要渲染视口
      if (!(rs > 0)) return false;
      const box = typeof component.__localBox === 'function' ? component.__localBox() : null;
      const w = box ? box[2] - box[0] : Number(component.state.width) || 0;
      const h = box ? box[3] - box[1] : Number(component.state.height) || 0;
      const deviceArea = Math.max(0, w) * Math.max(0, h) * rs * rs;
      if (deviceArea > MAX_LINE_CACHE_DEVICE_AREA) return false;
      // 已缓存的连线继续复用；只有「新增」受总预算约束
      if (!this.map.has(component) && this.__bytes + deviceArea * 4 > MAX_CACHE_BYTES) return false;
      return true;
    }
    // 封闭点集路径（星形/正N边形/玫瑰）：排除蚂蚁线流动，
    // 且仅缓存足够大的图形（小图形 drawImage 不划算）。
    if (typeof component.calcDots === 'function' && !component.isLine) {
      const w = Number(component.state.width) || 0;
      const h = Number(component.state.height) || 0;
      return isEffectivelyVisible(component) && !component.state.lineDashFlow && w * h >= MIN_DOT_PATH_CACHE_AREA;
    }
    // 半透明普通 path 图形（rgba/阴影/globalAlpha/composite）：排除容器/图片/连线。
    if (!opaqueDrawing) {
      if (typeof component.createPathObject !== 'function') return false;
      if (component.childNodes || component.isLine) return false;
      return isEffectivelyVisible(component);
    }
    return false;
  }

  has(component: any): boolean {
    return this.map.has(component);
  }

  /**
   * 内容指纹：决定位图是否需要重新光栅化。只涵盖影响文本外观的 state 字段，
   * 不包含 left/top/transform（由 linearKey 单独处理，以便纯平移复用）。
   *
   * 字符串形态只给「需要人看的场合 / 测试」用；热路径请用 `contentKeyVector` + `keyEquals`。
   */
  contentKey(component: any): string {
    return stringifyKeyVector(this.contentKeyVector(component, []));
  }

  /**
   * 内容指纹的**输入向量**（顺序即指纹顺序）。
   *
   * 与 `contentKey()` 是同一份口径：字符串指纹由本向量拼出，两者不可能漂移。
   * 单独拆出来的意义是热路径可以复用缓冲、逐项比较，省掉每帧为每个已缓存组件
   * 拼一个长字符串的开销（实测 2000 文本动画场景里这一项占 1.29ms/帧）。
   *
   * @param out 复用缓冲：调用方负责清空
   */
  contentKeyVector(component: any, out: any[]): any[] {
    const s = component.state;
    if (typeof component.measureText === 'function') {
      const st = s.style || {};
      out.push(
        s.text,
        st.fontWeight,
        st.fontSize,
        st.fontFamily,
        st.font,
        st.textAlign,
        st.textBaseline,
        st.paddingTop,
        st.paddingBottom,
        st.paddingLeft,
        st.paddingRight,
        // 文本排版属性：它们只改**墨迹**、不改合成矩阵（纯平移复用那条路只看矩阵），
        // 因此必须进指纹 —— 否则改了字间距 / 行高 / 装饰线 / 选区后，缓存会把旧位图继续贴回来
        //（这类「属性变了画面不动」的 bug 只在离屏缓存路径上出现，最难查）。
        st.lineHeight,
        st.letterSpacing,
        st.textDecoration,
        st.textDecorationColor,
        st.textDecorationWidth,
        st.selectionColor,
        s.direction,
        s.wrap,
        s.wordBreak,
        s.maxLines,
        s.ellipsis,
        s.textOverflow,
        // 选区 / 光标是编辑器状态：不计入就会出现「选中了却看不到高亮（贴的是旧位图）」
        s.selectionStart,
        s.selectionEnd,
        s.fill,
        s.stroke,
        s.lineDash,
        s.lineDashOffset,
        s.lineDashFlow,
        s.lineBorder,
        s.lineBorderWidth,
        s.lineBorderColor,
        this.__styleKey(s)
      );
      return out;
    }
    if (typeof component.calcDots === 'function') {
      // dot-path：dots 是「以 origin 为原点」的派生坐标；contentKey 在读之前已经过
      // calcComponentParams + compose 刷新，因此对同一原始参数是稳定的。
      out.push(
        s.dots,
        s.closePath,
        s.fill,
        s.stroke,
        s.lineDash,
        s.lineDashOffset,
        s.lineDashFlow,
        s.lineBorder,
        s.lineBorderWidth,
        s.lineBorderColor,
        this.__styleKey(s)
      );
      return out;
    }
    // 半透明普通 shape：几何参数 + 路径/样式指纹。
    out.push(
      s.width,
      s.height,
      s.radius,
      s.radiusX,
      s.radiusY,
      s.closePath,
      s.fill,
      s.stroke,
      s.lineDash,
      s.lineDashOffset,
      s.lineDashFlow,
      s.lineBorder,
      s.lineBorderWidth,
      s.lineBorderColor,
      this.__styleKey(s)
    );
    return out;
  }

  private __styleKey(s: any): string {
    const st = s.style || {};
    return [
      st.fillStyle,
      st.strokeStyle,
      st.lineWidth,
      st.globalAlpha,
      st.globalCompositeOperation,
      st.shadow,
      st.shadowColor,
      st.shadowBlur,
      st.shadowOffsetX,
      st.shadowOffsetY,
    ].join('|');
  }

  /** 线性变换指纹（composedMatrix 的 a,b,c,d）；平移分量单独保存，供纯平移复用。 */
  linearKey(component: any): string {
    const m = component.state.composedMatrix;
    if (!m || m.length < 6) return '';
    return `${m[0]},${m[1]},${m[2]},${m[3]}`;
  }

  /**
   * 按缓存路径渲染组件。
   * @returns true = 已由缓存处理；false = 组件不可缓存，调用方应回退到 component.render()。
   */
  render(component: any): boolean {
    if (!this.isCachable(component)) {
      // 曾经缓存过、现在不可缓存了：若原因是「不透明变成了半透明」（自身或祖先），必须把位图丢掉，
      // 否则等它重新变回不透明时，`!component.dirty` 的静态命中会把**烤进旧 alpha 的位图**贴回来。
      if (this.map.has(component) && !this.__isOpaque(component)) this.invalidate(component);
      return false;
    }
    const vp = this.__rvp();
    const rs = vp.scale;
    const ox = vp.tx;
    const oy = vp.ty;

    let cache = this.map.get(component);
    if (!component.dirty && cache && this.__sameViewport(cache, rs, ox, oy)) {
      // 静态命中：位图、落点、视口都没变，直接贴图，零指纹计算。
      this.draw(cache);
      return true;
    }

    // dirty：先刷新派生状态与合成矩阵，才能区分「纯平移」与「内容/线性变化」。
    // 用 refreshParams()（按需重算）：只在「自身派生参数已变脏」时重算点集，
    // 祖先移动导致的「只需重绘」不会连带重算 dots。
    // （composeMatrix 对 dots 的平移已改为幂等，不再要求每次 compose 前都重算 dots。）
    if (typeof component.calcDots === 'function') {
      component.refreshParams();
    }
    component.composeMatrix();
    const linearKey = this.linearKey(component);
    //@perf 内容指纹走「向量 + 逐项比较」：拼字符串要分配一个 40 段的长串，
    //       而绝大多数帧的内容根本没变（跑的多是平移/旋转这类不动位图的动画）。
    //       字符串只在真的要重建位图时才拼。
    const keys = this.__keyScratch;
    keys.length = 0;
    this.contentKeyVector(component, keys);
    let needRebuild =
      !cache ||
      !cache.contentKeys ||
      !keyEquals(cache.contentKeys, keys) ||
      cache.linearKey !== linearKey ||
      !this.__sameViewport(cache, rs, ox, oy);

    if (!needRebuild) {
      // 内容、线性变换、视口都没变 → 疑似纯平移，尝试复用位图（只挪贴图落点）。
      // 复用失败（越界 / 非设备像素对齐）时必须重建：贴图位移是整数的，无法表达亚像素位移。
      needRebuild = !this.refreshPosition(component, cache as CachedSurface);
    }

    if (needRebuild) {
      const prev = cache || null;
      if (prev) this.__bytes = Math.max(0, this.__bytes - prev.pw * prev.ph * 4);
      try {
        cache = this.build(component, this.contentKey(component), cloneKeyVector(keys), linearKey, rs, ox, oy);
      } catch (err) {
        // 离屏 canvas 建不出来（小程序老基础库没有 wx.createOffscreenCanvas / 极简运行时）：
        // 这里**不能**把异常抛出去 —— build 是在帧回调里被调用的，抛出去就是未捕获异常，
        // 在小程序里表现为直接白屏。降级为「不缓存、直接落墨」，并记住这个运行时没有离屏能力。
        this.__offscreenUnavailable = true;
        this.map.delete(component);
        return false;
      }
      this.__bytes += cache.pw * cache.ph * 4;
    }
    this.map.set(component, cache as CachedSurface);
    this.draw(cache as CachedSurface);
    component.dirty = false;
    return true;
  }

  /**
   * 是否「完全不透明」：自身 `state.opacity` × 祖先链，语义与 `ICEComponent.getEffectiveOpacity()`
   * 一致。组件没提供该方法时（测试替身 / 宿主对象）退化成只看自身 `state.opacity`。
   */
  private __isOpaque(component: any): boolean {
    if (component && typeof component.getEffectiveOpacity === 'function') {
      return component.getEffectiveOpacity() === 1;
    }
    const opacity = component && component.state ? component.state.opacity : undefined;
    return opacity === undefined || opacity === 1;
  }

  /** 组件的「真实落墨盒」（世界坐标）：几何盒 + paint pad。 */
  private __paintBox(component: any): { minX: number; minY: number; maxX: number; maxY: number } {
    const mm = component.getMaxBoundingBox().getMinAndMaxPoint();
    const pad = stylePaintPad(component.state);
    return { minX: mm.minX - pad, minY: mm.minY - pad, maxX: mm.maxX + pad, maxY: mm.maxY + pad };
  }

  private build(
    component: any,
    contentKey: string,
    contentKeys: any[],
    linearKey: string,
    rs: number,
    ox: number,
    oy: number
  ): CachedSurface {
    // 先量测尺寸 + 合成矩阵，得到含 pad 的世界盒，确定离屏画布大小与 base 矩阵。
    component.refreshParams();
    component.composeMatrix();
    const box = this.__paintBox(component);

    // 贴图落点取整到**设备像素栅格**，且四周各留 1px 透明余量：
    //   - 取整 → 贴回时是纯整数拷贝，零重采样；
    //   - 余量 → 纯平移复用时的取整误差（≤0.5px）不会把墨迹顶到位图外。
    const dx = Math.floor(box.minX * rs + ox) - 1;
    const dy = Math.floor(box.minY * rs + oy) - 1;
    const pw = Math.max(1, Math.ceil(box.maxX * rs + ox) - dx + 1);
    const ph = Math.max(1, Math.ceil(box.maxY * rs + oy) - dy + 1);

    // 第三个参数：组件缓存位图同样要跟随主画布的文本语言，否则缓存的字形与主画布分叉
    const { canvas, ctx } = root.createOffscreenCanvas(pw, ph, this.ice && this.ice.canvasEl);
    // world → bitmap：先按 rs 缩放，再平移到以 (dx, dy) 为原点。
    // 等价于「主画布 CTM（world*rs + (ox,oy)）减去整数平移 (dx,dy)」——栅格因此逐像素对齐。
    const base = [rs, 0, 0, rs, ox - dx, oy - dy];
    component.renderTo(ctx, base);

    return {
      canvas,
      ctx,
      pw,
      ph,
      dx,
      dy,
      dx0: dx,
      dy0: dy,
      buildMinX: box.minX,
      buildMinY: box.minY,
      rs,
      ox,
      oy,
      contentKey,
      contentKeys,
      linearKey,
    };
  }

  /**
   * 纯平移复用：保持位图内容不变，把贴图落点按「设备像素取整的位移」挪过去。
   *
   * @returns false = 位图已罩不住新盒（或位移非设备像素对齐）→ 调用方必须重建。
   */
  private refreshPosition(component: any, cache: CachedSurface): boolean {
    const box = this.__paintBox(component);
    const rs = cache.rs;
    const shiftX = rs * (box.minX - cache.buildMinX);
    const shiftY = rs * (box.minY - cache.buildMinY);
    // 位移必须恰好是**整数设备像素**：否则贴图只能做整数位移，会引入 ≤0.5px 的亚像素错位。
    // 宁可贵一次重建，也不让「缓存帧」与「直接落帧」的墨迹位置不一样。
    if (Math.abs(shiftX - Math.round(shiftX)) > 1e-6) return false;
    if (Math.abs(shiftY - Math.round(shiftY)) > 1e-6) return false;
    const dx = cache.dx0 + Math.round(shiftX);
    const dy = cache.dy0 + Math.round(shiftY);
    // 新盒必须仍完整落在位图覆盖范围内（位图四边各有 1px 余量吸收取整误差）
    if (box.minX * rs + cache.ox < dx) return false;
    if (box.minY * rs + cache.oy < dy) return false;
    if (box.maxX * rs + cache.ox > dx + cache.pw) return false;
    if (box.maxY * rs + cache.oy > dy + cache.ph) return false;
    cache.dx = dx;
    cache.dy = dy;
    return true;
  }

  /** 贴图：回到单位变换，按整数设备像素落点 1:1 拷贝位图（不传目标宽高 → 零重采样）。 */
  private draw(cache: CachedSurface): void {
    const ctx = this.ice.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(cache.canvas, cache.dx, cache.dy);
    ctx.restore();
  }

  invalidate(component: any): void {
    const entry = this.map.get(component);
    if (entry) {
      this.__bytes = Math.max(0, this.__bytes - entry.pw * entry.ph * 4);
    }
    this.map.delete(component);
  }

  clear(): void {
    this.map = new WeakMap();
    this.__bytes = 0;
  }
}

export default ObjectCache;
