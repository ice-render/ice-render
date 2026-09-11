/**
 * 主画布 HiDPI（devicePixelRatio）支持。
 *
 * 契约：
 * - dpr 默认 1：getRenderViewport() 直接返回 viewport 本身（零分配、既有行为逐字节不变）
 * - 传 dpr>1：canvas backing store = cssSize*dpr，渲染变换乘以 dpr
 * - 交互侧（screenToWorld/worldToScreen）仍用 CSS 像素语义 —— 鼠标坐标即 CSS 像素
 * - dpr>1 时 dirty-rect 回退全量（clearRect 为物理像素，与组件世界盒不一致）
 */
import ICE from '../src/ICE';
import ICERect from '../src/graphic/shape/ICERect';
import root from '../src/cross-platform/root';

const CSS_W = 400;
const CSS_H = 300;

function makeCtx() {
  const noop = () => {};
  return {
    transforms: [] as any[],
    clears: [] as any[],
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    setTransform: function (...a: any[]) {
      this.transforms.push(a);
    },
    clearRect: function (...a: any[]) {
      this.clears.push(a);
    },
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    rect: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    clip: noop,
    setLineDash: noop,
    drawImage: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  };
}

function makeCanvas() {
  const ctx = makeCtx();
  const el: any = {
    width: CSS_W,
    height: CSS_H,
    style: {},
    oncontextmenu: null,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: CSS_W, height: CSS_H }),
  };
  return { el, ctx };
}

const originalRequestFrame = root.requestFrame;

beforeEach(() => {
  root.requestFrame = () => 0; // 阻止真实 rAF 循环
});

afterEach(() => {
  root.requestFrame = originalRequestFrame;
});

describe('ICE.dpr 主画布高分屏', () => {
  it('默认 dpr=1：getRenderViewport 返回 viewport 本体（引用相等，零分配）', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el);
    expect(ice.dpr).toBe(1);
    expect(ice.getRenderViewport()).toBe(ice.viewport);
    ice.destroy();
  });

  it('dpr=2：backing store 放大到 css*dpr，CSS 尺寸固定为逻辑尺寸', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 2 });

    expect(ice.dpr).toBe(2);
    expect(el.width).toBe(CSS_W * 2);
    expect(el.height).toBe(CSS_H * 2);
    expect(el.style.width).toBe(CSS_W + 'px');
    expect(el.style.height).toBe(CSS_H + 'px');
    expect(ice.canvasWidth).toBe(CSS_W * 2);
    expect(ice.canvasHeight).toBe(CSS_H * 2);
    // 命中检测用的 rect 仍是 CSS 尺寸
    expect(ice.canvasBoundingClientRect.width).toBe(CSS_W);
    ice.destroy();
  });

  it('dpr=2：渲染视口 = dpr * viewport，且缓存复用同一对象', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 2 });
    ice.setViewport(1.5, 10, -20);

    const rvp = ice.getRenderViewport();
    expect(rvp.scale).toBe(3); // 1.5 * 2
    expect(rvp.tx).toBe(20);
    expect(rvp.ty).toBe(-40);
    expect(ice.getRenderViewport()).toBe(rvp); // 稳态零分配
    ice.destroy();
  });

  it('dpr=2：渲染视口缓存是「原地复用」的同一个对象，viewport 变化后就地刷新', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 2 });
    const first = ice.getRenderViewport();
    expect(first.scale).toBe(2);

    ice.setViewport(2, 0, 0);
    const second = ice.getRenderViewport();

    // 刻意复用同一对象以避免每组件每帧分配 -> 调用方不得长期持有该返回值
    expect(second).toBe(first);
    expect(second.scale).toBe(4);
    expect(second.tx).toBe(0);
    ice.destroy();
  });

  it('交互侧坐标换算不参与 dpr（鼠标坐标是 CSS 像素）', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 2 });
    ice.setViewport(1, 0, 0);

    // 世界坐标与 CSS 屏幕坐标一一对应，与 dpr 无关
    expect(ice.screenToWorld(100, 50)).toEqual([100, 50]);
    expect(ice.worldToScreen(100, 50)).toEqual([100, 50]);

    ice.setViewport(2, 10, 20);
    expect(ice.screenToWorld(110, 70)).toEqual([50, 25]);
    ice.destroy();
  });

  it('dpr=2：组件渲染时 CTM 乘以 dpr', () => {
    const { el, ctx } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 2 });
    const rect: any = new ICERect({ left: 10, top: 20, width: 30, height: 40 });
    ice.addChild(rect);

    ctx.transforms.length = 0;
    rect.render();

    const applied = ctx.transforms[ctx.transforms.length - 1];
    expect(applied.slice(0, 4)).toEqual([2, 0, 0, 2]); // 单位视口 × dpr=2
    ice.destroy();
  });

  it('dpr=2 时 dirty-rect 回退全量（物理像素与组件世界盒不一致）', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 2 });
    // 8 个不透明组件、只脏 1 个：脏占比 1/8 <= 0.2，其余前置条件都满足，
    // 这样 __collect 若返回 null 就只能是 dpr 分支拦下的（避免断言变成空转）。
    const comps: any[] = [];
    for (let i = 0; i < 8; i++) {
      const r: any = new ICERect({ left: 20 + i * 30, top: 20, width: 20, height: 20, zIndex: i });
      ice.addChild(r);
      comps.push(r);
    }

    const renderer: any = ice.renderer;
    const prime = () => {
      renderer.__snap = new WeakMap();
      renderer.__primed = false;
      ice.dirty = true;
      renderer.frameEvtHandler();
    };

    prime();
    expect(renderer.__primed).toBe(true);
    comps[0].setState({ left: 22 }); // 只脏 1 个
    ice.dirty = true;
    // 前置条件自检：脏占比门控不该拦住（否则下面的断言不成立）
    expect(renderer.__preCount(renderer.componentQueue).dirty).toBe(1);
    expect(renderer.__collect()).toBeNull(); // dpr=2 -> 回退全量

    // 对照：dpr 归 1 后可正常构造局部重绘计划
    ice.dpr = 1;
    prime();
    comps[0].setState({ left: 24 });
    ice.dirty = true;
    expect(renderer.__collect()).not.toBeNull();
    ice.destroy();
  });

  it('destroy 复位 dpr 与渲染视口缓存', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 3 });
    expect(ice.dpr).toBe(3);
    ice.destroy();
    expect(ice.dpr).toBe(1);
    expect(ice.getRenderViewport()).toBe(ice.viewport);
  });

  it('dpr 非正数 / 非数字时忽略，保持 1', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 0 });
    expect(ice.dpr).toBe(1);
    ice.destroy();
  });
});
