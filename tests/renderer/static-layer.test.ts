// 静态层位图（引擎内自动分层）的契约测试。
//
// 背景：全量重绘路径里，**每个**组件每帧都要重画一遍；一万个静态组件就是 20ms 量级。
// 静态层把"连续一大段本帧不需要重画"的组件整体光栅化成一张位图，之后每帧只贴一张图。
//
// 契约：
// - 只有 z 序上**连续**的干净段才能成层（全局 zIndex 排序下，交错会改变叠放次序）；
// - 成员集合/视口/结构变化才重建位图；成员稳定时每帧零重建；
// - 开关关掉后与旧行为逐字一致（这条也是像素对比测试的 A/B 依据）。
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';

class FakePath2D {
  _commands: any[] = [];
  _closed = false;
  moveTo(...a: any[]) {
    this._commands.push(['moveTo', ...a]);
  }
  lineTo(...a: any[]) {
    this._commands.push(['lineTo', ...a]);
  }
  rect(...a: any[]) {
    this._commands.push(['rect', ...a]);
  }
  arcTo(...a: any[]) {
    this._commands.push(['arcTo', ...a]);
  }
  arc(...a: any[]) {
    this._commands.push(['arc', ...a]);
  }
  ellipse(...a: any[]) {
    this._commands.push(['ellipse', ...a]);
  }
  closePath() {
    this._closed = true;
  }
}

function makeHarness() {
  const noop = () => {};
  const drawImages: any[] = [];
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect: noop,
    clip: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    rect: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    fillText: noop,
    strokeText: noop,
    setTransform: noop,
    setLineDash: noop,
    drawImage: (...a: any[]) => drawImages.push(a),
    measureText: (t: string) => ({ width: t.length * 10 }),
  };
  (global as any).Path2D = FakePath2D;
  root.createPath2D = () => new FakePath2D();
  root.devicePixelRatio = 1;
  root.createOffscreenCanvas = jest.fn((w: number, h: number) => {
    const offCtx: any = new Proxy(
      {
        canvas: { width: w, height: h, offscreen: true },
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
      },
      {
        get(t, p) {
          if (typeof p === 'symbol') return (t as any)[p];
          if (p === 'then' || p === 'catch' || p === 'finally') return undefined;
          if (p in t) return (t as any)[p];
          return noop;
        },
        set(t, p, v) {
          (t as any)[p] = v;
          return true;
        },
      }
    );
    return { canvas: { width: w, height: h, offscreen: true }, ctx: offCtx };
  });

  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = root;
  ice.ctx = ctx;
  ice.canvasWidth = 800;
  ice.canvasHeight = 600;
  ice.evtBus = new EventBus();
  ice.dirty = true;

  const renderer: any = new CanvasRenderer(ice, { renderMode: 'dirty-rect' });
  renderer.start();
  ice.renderer = renderer;
  return { ice, renderer, ctx, drawImages };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

/** 造 n 个互不重叠的小矩形（都干净时构成一整段连续可入层组件）。 */
function makeRects(ice: any, n: number) {
  const out: any[] = [];
  for (let i = 0; i < n; i++) {
    const c = new ICERect({
      left: (i % 40) * 18,
      top: Math.floor(i / 40) * 12,
      width: 8,
      height: 6,
      style: { fillStyle: '#3366cc' },
    });
    ice.addChild(c);
    out.push(c);
  }
  return out;
}

/** 统计一帧里各组件 render() 的调用次数。 */
function countRenders(comps: any[]) {
  const counter = { total: 0 };
  const restores: Array<() => void> = [];
  for (const c of comps) {
    const orig = c.render.bind(c);
    c.render = (...a: any[]) => {
      counter.total++;
      return orig(...a);
    };
    restores.push(() => {
      c.render = orig;
    });
  }
  return { counter, restore: () => restores.forEach((f) => f()) };
}

describe('静态层位图', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('局部重绘不成立时改走静态层：一大段干净组件整层贴回，只逐组件画非成员', () => {
    const { ice, renderer } = makeHarness();
    const clean = makeRects(ice, 400);
    // 再加 300 个组件、本帧全部置脏 → 脏占比 43% > 20%，局部重绘必然不成立
    const dirty: any[] = [];
    for (let i = 0; i < 300; i++) {
      const c: any = new ICERect({ left: (i % 30) * 20, top: 300 + Math.floor(i / 30) * 10, width: 8, height: 6 });
      ice.addChild(c);
      dirty.push(c);
    }
    // 首帧全脏（组件刚建出来），没有干净段 → 建不了层；第二帧全干净 → 建层（成员 = 全体）
    renderFrame(renderer, ice);
    renderFrame(renderer, ice);
    expect(renderer.__layerBuilds).toBe(1);

    for (const c of dirty) c.dirty = true; // 后 300 个变脏 → 连续干净段收缩为前 400 个 → 重建
    const { counter, restore } = countRenders([...clean, ...dirty]);
    renderFrame(renderer, ice);
    restore();

    expect(counter.total).toBe(300); // 400 个静态组件一个都没被逐组件重画
    expect(renderer.__layerBuilds).toBe(2); // 成员集合变了 → 重建一次

    // 成员集合稳定下来之后：再跑一帧不重建
    for (const c of dirty) c.dirty = true;
    renderFrame(renderer, ice);
    expect(renderer.__layerBuilds).toBe(2);
  });

  it('成员稳定时每帧零重建；层内成员变脏才重建', () => {
    const { ice, renderer } = makeHarness();
    const clean = makeRects(ice, 400);
    const dirty: any[] = [];
    for (let i = 0; i < 300; i++) {
      const c: any = new ICERect({ left: (i % 30) * 20, top: 300 + Math.floor(i / 30) * 10, width: 8, height: 6 });
      ice.addChild(c);
      dirty.push(c);
    }
    renderFrame(renderer, ice); // prime
    renderFrame(renderer, ice); // 全干净 → 建层
    for (const c of dirty) c.dirty = true;
    renderFrame(renderer, ice); // 连续干净段收缩为前 400 → 重建
    const afterRebuild = renderer.__layerBuilds;
    expect(afterRebuild).toBe(2);

    // 连续 3 帧只有段外组件脏 → 成员集合不变 → 不重建
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < dirty.length; k++) dirty[k].dirty = true;
      renderFrame(renderer, ice);
    }
    expect(renderer.__layerBuilds).toBe(afterRebuild);

    // 把一个层内成员弄脏 → 成员集合变化 → 必须重建
    clean[10].setState({ left: 1 }, { paramsDirty: false });
    for (const c of dirty) c.dirty = true;
    renderFrame(renderer, ice);
    expect(renderer.__layerBuilds).toBe(afterRebuild + 1);
  });

  it('关掉开关后完全回到逐组件重画', () => {
    const { ice, renderer } = makeHarness();
    const rects = makeRects(ice, 400);
    renderer.setStaticLayerEnabled(false);
    expect(renderer.isStaticLayerEnabled()).toBe(false);

    renderFrame(renderer, ice);
    for (const c of rects) c.dirty = true;
    const { counter, restore } = countRenders(rects);
    renderFrame(renderer, ice);
    restore();
    expect(counter.total).toBe(400);
    expect(renderer.__layerBuilds).toBe(0);
  });

  it('z 序上被脏组件切成小段时不成层（连续段不足下限）', () => {
    const { ice, renderer } = makeHarness();
    // 每 100 个干净矩形之间夹一个脏矩形 → 最长连续干净段只有 100 < 256
    const all: any[] = [];
    for (let g = 0; g < 5; g++) {
      all.push(...makeRects(ice, 100));
      const dirty: any = new ICERect({ left: 780, top: 10 * g, width: 8, height: 6 });
      ice.addChild(dirty);
      all.push(dirty);
    }
    renderFrame(renderer, ice);
    for (const c of all) c.dirty = true;
    renderFrame(renderer, ice);
    // 全脏：没有干净段
    expect(renderer.__layerBuilds).toBe(0);
  });

  it('有 clipChildren 祖先的组件不入层', () => {
    const { ice, renderer } = makeHarness();
    const group: any = new ICEGroup({ left: 0, top: 0, width: 200, height: 200, clipChildren: true });
    ice.addChild(group);
    const inner: any[] = [];
    for (let i = 0; i < 400; i++) {
      const c = new ICERect({ left: (i % 20) * 9, top: Math.floor(i / 20) * 9, width: 8, height: 6 });
      group.addChild(c);
      inner.push(c);
    }
    renderFrame(renderer, ice);
    renderFrame(renderer, ice);
    expect(renderer.__layerBuilds).toBe(0);
    // 仍然能正常渲染（不走层，退回逐组件重画）
    for (const c of inner) c.dirty = true;
    const { counter, restore } = countRenders(inner);
    renderFrame(renderer, ice);
    restore();
    expect(counter.total).toBe(400);
  });

  it('视口变化帧不使用静态层（手势期间直接逐组件画），手势停下后重建一次再复用', () => {
    const { ice, renderer } = makeHarness();
    const clean = makeRects(ice, 400);
    const dirty: any[] = [];
    for (let i = 0; i < 300; i++) {
      const c: any = new ICERect({ left: (i % 30) * 20, top: 300 + Math.floor(i / 30) * 10, width: 8, height: 6 });
      ice.addChild(c);
      dirty.push(c);
    }
    renderFrame(renderer, ice); // prime
    renderFrame(renderer, ice); // 全干净 → 建层
    expect(renderer.__layerBuilds).toBe(1);
    for (const c of dirty) c.dirty = true;
    renderFrame(renderer, ice); // 连续干净段收缩 → 重建
    const base = renderer.__layerBuilds;
    expect(base).toBe(2);

    // ① 视口变化帧：不重建、也不用层（整屏逐组件画 —— 但**上屏快照不再被清**，
    //    所以屏外的组件当帧就能裁掉，拉进来的只有可见的那些。见 culling 用例的说明。）
    ice.setViewport(1.2, 10, 5);
    for (const c of dirty) c.dirty = true;
    const { counter, restore } = countRenders([...clean, ...dirty]);
    renderFrame(renderer, ice);
    restore();
    expect(renderer.__layerBuilds).toBe(base); // 视口变化帧不建位图
    expect(counter.total).toBe(700 - renderer.__lastFrameCulled); // 走的是直接落墨，不是层
    expect(renderer.__lastFrameCulled).toBeGreaterThan(0); // 快照保留 → 当帧按新可见区裁剪

    // ② 视口稳定后的第一帧：统一重建一次
    for (const c of dirty) c.dirty = true;
    renderFrame(renderer, ice);
    expect(renderer.__layerBuilds).toBe(base + 1);

    // ③ 之后继续复用（每帧零重建）
    for (const c of dirty) c.dirty = true;
    renderFrame(renderer, ice);
    expect(renderer.__layerBuilds).toBe(base + 1);
  });

  it('视口值没变时 setViewport 不打掉渲染队列与静态层', () => {
    const { ice, renderer } = makeHarness();
    const clean = makeRects(ice, 400);
    const dirty: any[] = [];
    for (let i = 0; i < 300; i++) {
      const c: any = new ICERect({ left: (i % 30) * 20, top: 300 + Math.floor(i / 30) * 10, width: 8, height: 6 });
      ice.addChild(c);
      dirty.push(c);
    }
    renderFrame(renderer, ice);
    renderFrame(renderer, ice);
    for (const c of dirty) c.dirty = true;
    renderFrame(renderer, ice);
    const base = renderer.__layerBuilds;
    expect(base).toBeGreaterThan(0);

    // 平移驱动里重复下发同一个视口（钳制边界 / 视口跟随同步都会这么写）
    for (let i = 0; i < 3; i++) {
      for (const c of dirty) c.dirty = true;
      ice.setViewport(1, 0, 0);
      renderFrame(renderer, ice);
    }
    expect(renderer.__layerBuilds).toBe(base); // 没有被白打掉、也没重建
    expect(clean.length).toBe(400);
  });
});
