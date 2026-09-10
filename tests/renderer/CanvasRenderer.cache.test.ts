/**
 * CanvasRenderer 组件级离屏缓存集成测试（stub ctx 录制）。
 *
 * 验证：文本首帧建立缓存、缓存文本不再阻塞局部重绘、缓存命中用 drawImage 而非 render。
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEText from '../../src/graphic/text/ICEText';
import ICEStar from '../../src/graphic/shape/ICEStar';
import EventBus from '../../src/event/EventBus';

class FakePath2D {
  _isPolyfill = true;
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

function makeHarness(renderMode: 'full' | 'dirty-rect' = 'dirty-rect') {
  const clears: any[] = [];
  const clips: any[] = [];
  const drawImages: any[] = [];
  const noop = () => {};
  const ctx: any = {
    clears,
    clips,
    drawImages,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect: (...a: any[]) => clears.push(a),
    clip: (...a: any[]) => clips.push(a),
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
  const root = require('../../src/cross-platform/root').default;
  root.createPath2D = () => new FakePath2D();
  root.document = {
    getElementById: () => null,
    createElement: () => ({
      style: {},
      setAttribute: () => {},
      contenteditable: false,
      innerHTML: '',
      offsetWidth: 100,
      offsetHeight: 20,
    }),
    body: { appendChild: () => {} },
  };
  const offCtx: any = {
    scale: jest.fn(),
    fillText: noop,
    strokeText: noop,
    setTransform: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    rect: noop,
    stroke: noop,
    fill: noop,
    setLineDash: noop,
    lineWidth: 1,
    fillStyle: '',
    strokeStyle: '',
  };
  const offCanvas: any = { offscreen: true };
  root.createOffscreenCanvas = jest.fn().mockReturnValue({ canvas: offCanvas, ctx: offCtx });
  root.devicePixelRatio = 1;

  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = root;
  ice.ctx = ctx;
  ice.canvasWidth = 800;
  ice.canvasHeight = 600;
  ice.evtBus = new EventBus();
  ice.dirty = true;

  const renderer: any = new CanvasRenderer(ice, { renderMode });
  renderer.start();
  return { ice, ctx, renderer, clears, clips, drawImages, offCtx };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

describe('CanvasRenderer 组件级离屏缓存', () => {
  it('首帧全量 prime 后 ICEText 已建立缓存', () => {
    const { ice, renderer, clears } = makeHarness('dirty-rect');
    const text = new ICEText({ text: 'hello', left: 10, top: 10, width: 100, height: 20 });
    const rect = new ICERect({ left: 200, top: 200, width: 40, height: 30 });
    ice.addChild(text);
    ice.addChild(rect);

    renderFrame(renderer, ice);

    expect(clears[0]).toEqual([0, 0, 800, 600]);
    expect(renderer.cache.has(text)).toBe(true);
  });

  it('场景含已缓存文本时，移动其他组件走局部重绘而非全量', () => {
    const { ice, renderer, clears, drawImages } = makeHarness('dirty-rect');
    const text = new ICEText({ text: 'hello', left: 10, top: 10, width: 100, height: 20, zIndex: 1 });
    const a = new ICERect({ left: 200, top: 200, width: 40, height: 30, zIndex: 3 });
    const far = [];
    for (let i = 0; i < 8; i++) {
      far.push(new ICERect({ left: 300 + i * 50, top: 300, width: 40, height: 30, zIndex: 10 + i }));
    }
    ice.addChild(text);
    ice.addChild(a);
    far.forEach((f) => ice.addChild(f));
    renderFrame(renderer, ice);
    expect(renderer.cache.has(text)).toBe(true);
    clears.length = 0;
    drawImages.length = 0;

    a.setState({ left: 220, top: 220 });
    renderFrame(renderer, ice);

    // 文本已缓存 → 不再因文本阻塞局部重绘，脏区仍是局部
    expect(clears.length).toBe(1);
    expect(clears[0][2]).toBeLessThan(800);
    expect(clears[0][3]).toBeLessThan(600);
  });

  it('缓存命中的文本用 drawImage 贴图，不重新执行 render', () => {
    const { ice, renderer, clears, drawImages } = makeHarness('dirty-rect');
    const text = new ICEText({ text: 'hello', left: 10, top: 10, width: 80, height: 20, zIndex: 5 });
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 3 });
    const far = [];
    for (let i = 0; i < 8; i++) {
      far.push(new ICERect({ left: 300 + i * 50, top: 300, width: 40, height: 30, zIndex: 10 + i }));
    }
    ice.addChild(text);
    ice.addChild(a);
    far.forEach((f) => ice.addChild(f));
    renderFrame(renderer, ice);
    clears.length = 0;
    drawImages.length = 0;

    const renderSpy = jest.spyOn(text, 'render');
    a.setState({ left: 20, top: 20 }); // 脏区与文本相交
    renderFrame(renderer, ice);

    expect(clears[0][2]).toBeLessThan(800);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(drawImages.length).toBeGreaterThan(0);
  });

  it('封闭 dot-path（星形）缓存后场景可局部重绘', () => {
    const { ice, renderer, clears } = makeHarness('dirty-rect');
    const star = new ICEStar({
      left: 10,
      top: 10,
      outerRadius: 150,
      innerRadius: 60,
      zIndex: 1,
      style: { fillStyle: '#EC4899', strokeStyle: '#111111', lineWidth: 1 },
    });
    const a = new ICERect({ left: 200, top: 200, width: 40, height: 30, zIndex: 3 });
    const far = [];
    for (let i = 0; i < 8; i++) {
      far.push(new ICERect({ left: 300 + i * 50, top: 300, width: 40, height: 30, zIndex: 10 + i }));
    }
    ice.addChild(star);
    ice.addChild(a);
    far.forEach((f) => ice.addChild(f));
    renderFrame(renderer, ice);
    expect(renderer.cache.has(star)).toBe(true);
    clears.length = 0;

    a.setState({ left: 220, top: 220 });
    renderFrame(renderer, ice);

    // 星形已缓存 → 不再因 dot-path 阻塞局部重绘
    expect(clears.length).toBe(1);
    expect(clears[0][2]).toBeLessThan(800);
    expect(clears[0][3]).toBeLessThan(600);
  });

  it('半透明 shape 缓存后场景可局部重绘', () => {
    const { ice, renderer, clears } = makeHarness('dirty-rect');
    const alpha = new ICERect({
      left: 10,
      top: 10,
      width: 40,
      height: 30,
      zIndex: 1,
      style: { fillStyle: 'rgba(0,0,0,0.5)', strokeStyle: '#111111', lineWidth: 1 },
    });
    const a = new ICERect({ left: 200, top: 200, width: 40, height: 30, zIndex: 3 });
    const far = [];
    for (let i = 0; i < 8; i++) {
      far.push(new ICERect({ left: 300 + i * 50, top: 300, width: 40, height: 30, zIndex: 10 + i }));
    }
    ice.addChild(alpha);
    ice.addChild(a);
    far.forEach((f) => ice.addChild(f));
    renderFrame(renderer, ice);
    expect(renderer.cache.has(alpha)).toBe(true);
    clears.length = 0;

    a.setState({ left: 220, top: 220 });
    renderFrame(renderer, ice);

    // 半透明组件已缓存 → 不再因非不透明落墨阻塞局部重绘
    expect(clears.length).toBe(1);
    expect(clears[0][2]).toBeLessThan(800);
    expect(clears[0][3]).toBeLessThan(600);
  });
});
