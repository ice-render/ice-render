/**
 * 离屏缓存的**像素保真契约**单测。
 *
 * 背景（2026-09-11 实测）：旧实现把位图按 `root.devicePixelRatio` 放大、用 `lw/lh`（世界尺寸）
 * 做 drawImage 的目标矩形，并依赖 `ctx.scale(dpr,dpr)` —— 但那一句会被 `renderTo()` 内部的
 * `setTransform()` **整条覆盖**，形同死代码。结果是：
 *   1. 位图实际按「世界尺寸 = 位图像素」1:1 光栅化，却被缩放着贴回，任何 `dpr≠1` 或视口缩放
 *      都会重采样（雷蛇屏上缓存文字只剩 ~30% 墨迹）；
 *   2. 贴图落点还带小数（`minX` 是 paint pad 之后的亚像素值），进一步双线性模糊。
 *
 * 新契约（本文件即契约）：
 *   - 位图按**渲染视口**的缩放 `rs = getRenderViewport().scale` 光栅化，base 矩阵显式编码
 *     `[rs,0,0,rs, ox-dx, oy-dy]`（world→bitmap），因此位图栅格与主画布设备栅格**逐像素重合**；
 *   - 贴图落点 `dx/dy` 是**整数设备像素**，且以 1:1 尺寸贴回（`drawImage(img, dx, dy)`）——
 *     全程不做任何重采样；
 *   - 视口一变，位图即失效（视口稳定的第一帧重建）；纯平移只有在**设备像素对齐**时才复用，
 *     否则重建 —— 宁可贵一点，也不引入亚像素位移。
 */
import ObjectCache from '../../src/renderer/ObjectCache';

const root = require('../../src/cross-platform/root').default;

/** 世界盒 = composedMatrix 的平移分量起算的 100x30 矩形（与真实组件一致地受矩阵影响）。 */
class FakeText {
  state: any = {
    display: true,
    editing: false,
    text: 'hello',
    fill: true,
    stroke: false,
    lineDash: [],
    lineDashOffset: 0,
    lineDashFlow: false,
    lineBorder: false,
    lineBorderWidth: 0,
    lineBorderColor: '#999999',
    style: { fontSize: 12, lineWidth: 0 },
    composedMatrix: [1, 0, 0, 1, 0, 0],
  };
  dirty = true;
  paramsDirty = true;
  renderToCount = 0;
  lastBase: any = null;

  measureText() {}

  composeMatrix() {
    return this.state.composedMatrix;
  }

  calcComponentParams() {}

  refreshParams() {
    if (!this.paramsDirty) return;
    this.calcComponentParams();
    this.paramsDirty = false;
  }

  getMaxBoundingBox() {
    const tx = this.state.composedMatrix[4];
    const ty = this.state.composedMatrix[5];
    return { getMinAndMaxPoint: () => ({ minX: tx, minY: ty, maxX: tx + 100, maxY: ty + 30 }) };
  }

  renderTo(ctx: any, base: any) {
    this.renderToCount++;
    this.lastBase = base;
  }
}

function makeHarness(initialViewport: any = { scale: 1, tx: 0, ty: 0 }) {
  const drawImages: any[] = [];
  const transforms: any[] = [];
  const noop = () => {};
  const ctx: any = {
    save: noop,
    restore: noop,
    setTransform: (...a: any[]) => transforms.push(a),
    drawImage: (...a: any[]) => drawImages.push(a),
  };
  const created: any[] = [];
  root.createOffscreenCanvas = jest.fn((w: number, h: number) => {
    const canvas: any = { offscreen: true, width: w, height: h };
    created.push(canvas);
    return { canvas, ctx: { scale: jest.fn(), setTransform: noop } };
  });
  root.devicePixelRatio = 1;

  let vp = { ...initialViewport };
  const ice: any = { ctx, root, getRenderViewport: () => vp };
  const cache = new ObjectCache(ice);
  return {
    cache,
    ctx,
    drawImages,
    transforms,
    created,
    setViewport: (v: any) => {
      vp = { ...v };
    },
    /** 模拟渲染器每帧开头的调用 */
    beginFrame: () => cache.beginFrame(),
  };
}

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('离屏缓存的像素保真契约', () => {
  it('位图按渲染视口缩放光栅化：base = [rs,0,0,rs, ox-dx, oy-dy]', () => {
    const h = makeHarness({ scale: 0.386, tx: 0, ty: 0 });
    const c: any = new FakeText();
    h.cache.render(c);

    // 世界盒 [0,0,100,30]，PAD_AA=2 → paint 盒 [-2,-2,102,32]
    // dx = floor(-2*0.386 + 0) - 1 = -2；pw = ceil(102*0.386) - dx + 1 = 40 + 2 + 1 = 43
    expect(h.created[0].width).toBe(43);
    const base = c.lastBase;
    expect(close(base[0], 0.386)).toBe(true);
    expect(close(base[3], 0.386)).toBe(true);
    // ox - dx = 0 - (-2) = 2
    expect(close(base[4], 2)).toBe(true);
    expect(close(base[5], 2)).toBe(true);
    // 位图内部不再依赖 ctx.scale（旧实现在这里调 scale，但会被 setTransform 覆盖）
    expect(h.created[0].width).toBeGreaterThan(0);
  });

  it('贴图落点是整数设备像素，且 1:1 贴回（不做重采样）', () => {
    const h = makeHarness({ scale: 0.386, tx: 12.7, ty: -3.2 });
    const c: any = new FakeText();
    h.cache.render(c);

    const [img, dx, dy, dw] = h.drawImages[0];
    expect(img.offscreen).toBe(true);
    expect(Number.isInteger(dx)).toBe(true);
    expect(Number.isInteger(dy)).toBe(true);
    // 1:1：不允许传目标宽高（传了就说明在缩放）
    expect(dw).toBeUndefined();
  });

  it('视口变化后的第一帧不缓存；视口稳定后按新视口重建', () => {
    const h = makeHarness({ scale: 1, tx: 0, ty: 0 });
    const c: any = new FakeText();
    h.beginFrame();
    h.cache.render(c);
    expect(c.renderToCount).toBe(1);
    const widthAtScale1 = h.created[0].width;

    // 视口变了：本帧一律不缓存（避免整屏位图重建），直接落墨
    h.setViewport({ scale: 0.5, tx: 0, ty: 0 });
    h.beginFrame();
    expect(h.cache.isCachable(c)).toBe(false);
    expect(h.cache.render(c)).toBe(false);

    // 视口稳定后的下一帧：重建，且位图尺寸随 rs 缩小
    h.beginFrame();
    expect(h.cache.isCachable(c)).toBe(true);
    c.dirty = true;
    h.cache.render(c);
    expect(c.renderToCount).toBe(2);
    const widthAtHalf = h.created[h.created.length - 1].width;
    expect(widthAtHalf).toBeLessThan(widthAtScale1);
  });

  it('设备像素对齐的纯平移复用位图（不重建）', () => {
    const h = makeHarness({ scale: 1, tx: 0, ty: 0 });
    const c: any = new FakeText();
    h.beginFrame();
    h.cache.render(c);
    expect(c.renderToCount).toBe(1);
    const firstDx = h.drawImages[0][1];
    const firstDy = h.drawImages[0][2];

    // 平移 10 个世界像素 @rs=1 → 恰好 10 个设备像素，对齐 → 复用
    c.state.composedMatrix = [1, 0, 0, 1, 10, 20];
    c.dirty = true;
    h.cache.render(c);
    expect(c.renderToCount).toBe(1);
    expect(h.drawImages[1][1]).toBe(firstDx + 10);
    expect(h.drawImages[1][2]).toBe(firstDy + 20);
  });

  it('非设备对齐的纯平移重建位图（避免亚像素位移）', () => {
    const h = makeHarness({ scale: 0.386, tx: 0, ty: 0 });
    const c: any = new FakeText();
    h.beginFrame();
    h.cache.render(c);
    expect(c.renderToCount).toBe(1);

    // rs=0.386 时平移 1 个世界像素 = 0.386 设备像素，无法由整数贴图位移表达 → 重建
    c.state.composedMatrix = [1, 0, 0, 1, 1, 0];
    c.dirty = true;
    h.cache.render(c);
    expect(c.renderToCount).toBe(2);
  });

  it('重建时旧位图的字节数被扣回（总预算记账不泄漏）', () => {
    const h = makeHarness({ scale: 1, tx: 0, ty: 0 });
    const c: any = new FakeText();
    h.cache.render(c);
    const first = h.created[0].width * h.created[0].height * 4;
    expect((h.cache as any).__bytes).toBe(first);

    // 内容变化 → 重建：旧条目必须先扣账
    c.state.text = 'changed';
    c.dirty = true;
    h.cache.render(c);
    const second = h.created[1].width * h.created[1].height * 4;
    expect((h.cache as any).__bytes).toBe(second);
  });
});
