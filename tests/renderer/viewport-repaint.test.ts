/**
 * 视口变化 = **整屏重画**，但**不是**结构变更（2026-09-21）。
 *
 * 背景：`ICE.setViewport()` 以前调 `renderer.markQueueDirty()` —— 那是给"组件树结构变了"用的：
 * 它会丢渲染队列、**清空上屏快照**、丢静态层，然后下一帧全量 prime。而视口是**视图**状态：
 * 队列成员没变、上屏快照存的是**世界坐标盒**（与视口无关）、静态层自带栅格对齐校验。
 * 后果是"每帧平移"变成"每帧从零重建"：真机 10 万图元实测 **9.9fps / p50 103ms / 3 秒 28 个长任务**；
 * 只置"整屏重画"标记后 **119.9fps / p50 8.3ms / 0 长任务**。
 *
 * 契约（这个文件钉住的）：
 * ① 视口变化**不**重建队列、**不**清上屏快照、**不**丢静态层；
 * ② 但那一帧必须**整屏重画**（跳过局部重绘）—— 视口一变屏幕上每处落墨都错位，
 *    局部重绘会在裁剪区外留下旧视图的像素；
 * ③ 快照保留 ⇒ 当帧就按**新可见区**裁剪（屏外组件本来就不该画）；
 * ④ 视口值没变时什么都不做（重复下发同值很常见：钳制边界、视口跟随同步）。
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
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
  ellipse(...a: any[]) {
    this._commands.push(['ellipse', ...a]);
  }
  closePath() {
    this._closed = true;
  }
}

function makeHarness() {
  const noop = () => {};
  const clears: any[] = [];
  const drawImages: any[] = [];
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect: (...a: any[]) => clears.push(a),
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
    setTransform: noop,
    setLineDash: noop,
    drawImage: (...a: any[]) => drawImages.push(a),
    measureText: (t: string) => ({ width: t.length * 10 }),
  };
  (global as any).Path2D = FakePath2D;
  root.createPath2D = () => new FakePath2D();
  root.devicePixelRatio = 1;
  // 静态层位图要一块离屏画布（Proxy 兜住所有 ctx 方法）
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
  return { ice, renderer, clears, drawImages };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

const FULL = [0, 0, 800, 600];

describe('视口变化：整屏重画，但不是结构变更', () => {
  test('平移不清队列、不清快照，且当帧仍按新可见区裁剪', () => {
    const { ice, renderer } = makeHarness();
    const near = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 1 });
    const far = new ICERect({ left: 3000, top: 3000, width: 40, height: 30, zIndex: 2 });
    ice.addChild(near);
    ice.addChild(far);
    renderFrame(renderer, ice); // prime
    renderFrame(renderer, ice);
    expect(renderer.__lastFrameCulled).toBe(1); // far 屏外 → 稳态帧被裁

    ice.setViewport(1, 5, 0); // 纯平移（缩放不变）
    expect(renderer.__queueDirty).toBe(false); // ← 不是结构变更（旧写法这里是 true）
    renderFrame(renderer, ice);

    expect(renderer.__primed).toBe(true); // 快照没被清
    expect(renderer.__snap.has(near)).toBe(true);
    expect(renderer.__queueDirty).toBe(false); // 帧末也没有被重建
    expect(renderer.__lastFrameCulled).toBe(1); // 快照还在 → 裁剪照常生效
  });

  test('平移帧即便有脏组件也整屏重画（不走进局部重绘）', () => {
    const { ice, renderer, clears } = makeHarness();
    // 一段"连续干净"的大组件 + 一个远处的脏组件：局部重绘完全成立的那种场景
    for (let i = 0; i < 400; i++) {
      ice.addChild(new ICERect({ left: (i % 20) * 20, top: Math.floor(i / 20) * 12, width: 8, height: 6 }));
    }
    renderFrame(renderer, ice);
    renderFrame(renderer, ice);

    ice.setViewport(1, 7, 3);
    clears.length = 0;
    renderFrame(renderer, ice);

    // 整屏 clear（局部重绘会是 [x,y,w,h] 的裁剪区，而不是整幅）
    expect(clears).toContainEqual(FULL);
  });

  test('缩放变化同样整屏重画，且不清快照（静态层自己会退回全量）', () => {
    const { ice, renderer, clears } = makeHarness();
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30 });
    ice.addChild(a);
    renderFrame(renderer, ice);
    renderFrame(renderer, ice);

    ice.setViewport(2, 0, 0);
    clears.length = 0;
    const buildsBefore = renderer.__layerBuilds;
    renderFrame(renderer, ice);

    expect(clears).toContainEqual(FULL);
    expect(renderer.__layerBuilds).toBe(buildsBefore); // 缩放变了：本帧不建层（栅格已作废）
    expect(renderer.__snap.has(a)).toBe(true);
  });

  test('视口值没变时不请求整屏重画（重复下发同值是常态）', () => {
    const { ice, renderer, clears } = makeHarness();
    // 300 个干净组件 + 1 个脏组件：脏占比够低，局部重绘完全成立
    const clean: any[] = [];
    for (let i = 0; i < 300; i++) {
      const c = new ICERect({ left: (i % 20) * 20, top: Math.floor(i / 20) * 12, width: 8, height: 6 });
      ice.addChild(c);
      clean.push(c);
    }
    const a = new ICERect({ left: 400, top: 300, width: 40, height: 30 });
    ice.addChild(a);
    renderFrame(renderer, ice);
    renderFrame(renderer, ice);

    a.setState({ width: 50 }); // 单个组件变脏 → 局部重绘完全成立
    ice.setViewport(1, 0, 0); // 与当前视口同值
    clears.length = 0;
    renderFrame(renderer, ice);

    expect(clears).not.toContainEqual(FULL); // 没有被"整屏重画"顶成全量
    expect(clears.length).toBeGreaterThan(0); // 而是局部裁剪区
  });

  /**
   * 这条是"官方 API 平移"真正的快路径：缩放不变、位移是**整数设备像素**时，
   * 静态层位图整体平移贴回（1:1、零重采样），既不用逐组件重画，也不用重建位图。
   * 改动前它**只有直改 `ice.viewport` 才走得到**（`setViewport` 每帧清掉层）——
   * 10 万图元实测：清层 9.9fps → 复用 116.6fps。
   */
  test('平移（缩放不变 + 整数设备像素）整体复用静态层，不重建、不逐组件重画', () => {
    const { ice, renderer, drawImages } = makeHarness();
    const rects: any[] = [];
    for (let i = 0; i < 400; i++) {
      const c = new ICERect({
        left: (i % 40) * 18,
        top: Math.floor(i / 40) * 12,
        width: 8,
        height: 6,
        style: { fillStyle: '#3366cc' },
      });
      ice.addChild(c);
      rects.push(c);
    }
    renderFrame(renderer, ice); // prime
    renderFrame(renderer, ice); // 全干净 → 建层
    const builds = renderer.__layerBuilds;
    expect(builds).toBeGreaterThan(0);

    let rendered = 0;
    const restores = rects.map((c) => {
      const orig = c.render.bind(c);
      c.render = (...a: any[]) => {
        rendered++;
        return orig(...a);
      };
      return () => (c.render = orig);
    });

    ice.setViewport(1, 8, 4); // 整数设备像素的纯平移
    drawImages.length = 0;
    renderFrame(renderer, ice);
    restores.forEach((f) => f());

    expect(renderer.__layerBuilds).toBe(builds); // 层没重建
    expect(drawImages.length).toBeGreaterThan(0); // 走了整层贴回
    expect(rendered).toBe(0); // 且没有逐组件重画
  });
});
