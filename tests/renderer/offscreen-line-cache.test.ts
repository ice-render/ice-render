/**
 * 连线（`isLine`：折线 / 贝塞尔 / Visio 连线）走离屏缓存的**策略**单测。
 *
 * 背景：`isCachable` 此前**完全排除** `isLine`，理由是「位图可能很大」。
 * 但代价是 `__riskyIntersectsRegion` 里「干净但不可缓存的 risky 组件与脏区相交 → 回退全量」这条会
 * 常态命中 —— 连线通常横跨画布，任何脏区都会与它相交，于是富文本场景的局部重绘 100% 失效
 * （在 ice-entity-designer 里实测：拖动实体 22/22 帧全部回退全量）。
 *
 * 现在的策略：**允许缓存，但按「设备像素面积」设上限**（位图随 dpr 放大，因此上限按物理像素算），
 * 并排除蚂蚁线（每帧都在动，缓存只会白扫）。
 */
import ObjectCache from '../../src/renderer/ObjectCache';

/** 最小连线夹具：只需要 isCachable 用到的字段/方法。 */
function makeLine(w: number, h: number, overrides: any = {}) {
  const line: any = {
    isLine: true,
    state: {
      display: true,
      lineDashFlow: false,
      lineDash: [],
      lineDashOffset: 0,
      lineBorder: false,
      lineBorderWidth: 0,
      lineBorderColor: '#999999',
      width: w,
      height: h,
      style: { strokeStyle: '#333333', lineWidth: 2 },
      ...overrides.state,
    },
    __localBox() {
      return [0, 0, w, h];
    },
    calcDots() {},
    ...overrides,
  };
  return line;
}

const root = require('../../src/cross-platform/root').default;

describe('连线离屏缓存策略', () => {
  let cache: any;
  beforeEach(() => {
    root.devicePixelRatio = 1;
    cache = new ObjectCache({ root });
  });

  it('中等尺寸的静态连线可以缓存（这正是编辑器里「关系连线」的典型尺寸）', () => {
    // 实测某编辑器 39 条连线的中位数是 219x352、最大 725x518
    expect(cache.isCachable(makeLine(219, 352))).toBe(true);
    expect(cache.isCachable(makeLine(725, 518))).toBe(true);
  });

  it('超过设备像素上限的大连线不缓存（位图开销会超过重扫收益）', () => {
    expect(cache.isCachable(makeLine(2000, 2000))).toBe(false); // 4M 逻辑像素 @dpr1
  });

  it('上限按「设备像素」算：渲染视口放大时同样逻辑尺寸会因位图放大 4 倍而被拒', () => {
    // 契约变更（2026-09-11）：位图缩放取「渲染视口」的 scale（已含 dpr 与视口缩放），
    // 不再是 root.devicePixelRatio —— 后者与主画布的实际设备比例未必一致。
    const ice: any = { root, getRenderViewport: () => ({ scale: 2, tx: 0, ty: 0 }) };
    const cache2: any = new ObjectCache(ice);
    expect(cache2.isCachable(makeLine(600, 600))).toBe(true); // 1.44M 设备像素
    expect(cache2.isCachable(makeLine(900, 900))).toBe(false); // 3.24M 设备像素
  });

  it('蚂蚁线（lineDashFlow）永远不缓存：每帧落点都在变', () => {
    expect(cache.isCachable(makeLine(200, 200, { state: { lineDashFlow: true } }))).toBe(false);
  });

  it('不可见的连线不缓存', () => {
    expect(cache.isCachable(makeLine(200, 200, { state: { display: false } }))).toBe(false);
  });
});
