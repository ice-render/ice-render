/**
 * 组件级离屏缓存（对象缓存 / offscreen bitmap cache）。
 *
 * 把「昂贵组件」（当前先支持 ICEText）预渲染成一张不透明位图，主画布上只 drawImage。
 * 收益有三点：
 *   1. 缓存命中帧跳过 measureText / fillText / strokeText 等昂贵调用；
 *   2. 纯平移（left/top 变化、内容与线性变换不变）复用位图，只更新贴图位置；
 *   3. dirty-rect 的 clip 只作用于最终位图的整像素采样，不再改变文字/半透明落墨的内部 AA，
 *      因此缓存组件可被视为「不透明贴图」，用于放宽场景级门控。
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

export interface CachedSurface {
  canvas: any;
  ctx: any;
  /** 物理像素宽高（已乘 devicePixelRatio）。 */
  pw: number;
  ph: number;
  /** 逻辑尺寸（世界坐标，含 paint pad）。 */
  lw: number;
  lh: number;
  /** 当前位图贴到主画布的逻辑左上角（世界坐标，含 pad）。 */
  minX: number;
  minY: number;
  dpr: number;
  contentKey: string;
  linearKey: string;
}

class ObjectCache {
  private ice: any;
  private map = new WeakMap<object, CachedSurface>();

  constructor(ice: any) {
    this.ice = ice;
  }

  /**
   * 组件是否走离屏缓存。v1 只缓存「非编辑态、可见」的 ICEText；后续可扩展到 dot-path /
   * 半透明 / ICEGroup 子树。
   */
  isCachable(component: any): boolean {
    if (typeof component.measureText === 'function') {
      return !component.state.editing && isEffectivelyVisible(component);
    }
    // 封闭点集路径（星形/正N边形/玫瑰）：排除连线类（isLine）与蚂蚁线流动，
    // 且仅缓存足够大的图形（小图形 drawImage 不划算）。
    if (typeof component.calcDots === 'function' && !component.isLine) {
      const w = Number(component.state.width) || 0;
      const h = Number(component.state.height) || 0;
      return isEffectivelyVisible(component) && !component.state.lineDashFlow && w * h >= MIN_DOT_PATH_CACHE_AREA;
    }
    // 半透明普通 path 图形（rgba/阴影/globalAlpha/composite）：排除容器/图片/连线。
    if (!isOpaqueDrawing(component.state)) {
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
   */
  contentKey(component: any): string {
    const s = component.state;
    if (typeof component.measureText === 'function') {
      const st = s.style || {};
      return [
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
        s.fill,
        s.stroke,
        JSON.stringify(s.lineDash),
        s.lineDashOffset,
        s.lineDashFlow,
        s.lineBorder,
        s.lineBorderWidth,
        s.lineBorderColor,
        this.__styleKey(s),
      ].join('|');
    }
    if (typeof component.calcDots === 'function') {
      // dot-path：dots 是「以 origin 为原点」的派生坐标；contentKey 在读之前已经过
      // calcComponentParams + compose 刷新，因此对同一原始参数是稳定的。
      return [
        JSON.stringify(s.dots),
        s.closePath,
        s.fill,
        s.stroke,
        JSON.stringify(s.lineDash),
        s.lineDashOffset,
        s.lineDashFlow,
        s.lineBorder,
        s.lineBorderWidth,
        s.lineBorderColor,
        this.__styleKey(s),
      ].join('|');
    }
    // 半透明普通 shape：几何参数 + 路径/样式指纹。
    return [
      s.width,
      s.height,
      s.radius,
      s.radiusX,
      s.radiusY,
      s.closePath,
      s.fill,
      s.stroke,
      JSON.stringify(s.lineDash),
      s.lineDashOffset,
      s.lineDashFlow,
      s.lineBorder,
      s.lineBorderWidth,
      s.lineBorderColor,
      this.__styleKey(s),
    ].join('|');
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
    if (!this.isCachable(component)) return false;

    let cache = this.map.get(component);
    if (!component.dirty && cache) {
      // 静态命中：位图与位置均未变，直接贴图，零指纹计算。
      this.draw(component, cache);
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
    const contentKey = this.contentKey(component);
    const needRebuild = !cache || cache.contentKey !== contentKey || cache.linearKey !== linearKey;

    if (needRebuild) {
      cache = this.build(component, contentKey, linearKey);
    } else {
      // 内容与线性变换都没变 → 纯平移，复用位图，只刷新贴图位置。
      this.refreshPosition(component, cache);
    }
    this.map.set(component, cache);
    this.draw(component, cache);
    component.dirty = false;
    return true;
  }

  private build(component: any, contentKey: string, linearKey: string): CachedSurface {
    // 先量测尺寸 + 合成矩阵，得到含 pad 的世界盒，确定离屏画布大小与 base 矩阵。
    component.refreshParams();
    component.composeMatrix();
    const box = component.getMaxBoundingBox();
    const mm = box.getMinAndMaxPoint();
    const pad = stylePaintPad(component.state);
    const minX = mm.minX - pad;
    const minY = mm.minY - pad;
    const lw = mm.maxX - mm.minX + pad * 2;
    const lh = mm.maxY - mm.minY + pad * 2;
    const dpr = this.dpr();
    const pw = Math.max(1, Math.ceil(lw * dpr));
    const ph = Math.max(1, Math.ceil(lh * dpr));

    const { canvas, ctx } = root.createOffscreenCanvas(pw, ph);
    ctx.scale(dpr, dpr);
    const base = [1, 0, 0, 1, -minX, -minY];
    component.renderTo(ctx, base);

    return { canvas, ctx, pw, ph, lw, lh, minX, minY, dpr, contentKey, linearKey };
  }

  private refreshPosition(component: any, cache: CachedSurface): void {
    const box = component.getMaxBoundingBox();
    const mm = box.getMinAndMaxPoint();
    const pad = stylePaintPad(component.state);
    cache.minX = mm.minX - pad;
    cache.minY = mm.minY - pad;
    // 内容与线性变换未变，位图本身的宽高不变，只需移动贴图位置。
  }

  private draw(component: any, cache: CachedSurface): void {
    const ctx = this.ice.ctx;
    const vp = (this.ice && typeof this.ice.getRenderViewport === 'function'
      ? this.ice.getRenderViewport()
      : this.ice.viewport) || {
      scale: 1,
      tx: 0,
      ty: 0,
    };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (vp.scale === 1 && vp.tx === 0 && vp.ty === 0) {
      ctx.drawImage(cache.canvas, cache.minX, cache.minY, cache.lw, cache.lh);
    } else {
      // 缓存位图是世界坐标下的组件外观，按视口缩放/平移到屏幕坐标。
      ctx.drawImage(
        cache.canvas,
        cache.minX * vp.scale + vp.tx,
        cache.minY * vp.scale + vp.ty,
        cache.lw * vp.scale,
        cache.lh * vp.scale
      );
    }
    ctx.restore();
  }

  private dpr(): number {
    return (this.ice.root && this.ice.root.devicePixelRatio) || 1;
  }

  invalidate(component: any): void {
    this.map.delete(component);
  }

  clear(): void {
    this.map = new WeakMap();
  }
}

export default ObjectCache;
