/**
 * CanvasRenderer 脏矩形局部重绘路径单测（stub ctx 录制）。
 *
 * 用录制型 ctx 观察每帧实际发生的 clearRect 区域与「哪些组件被真正 render」，
 * 验证：首帧全量 prime、单组件移动→局部区域、脏占比超阈→全量回退、
 * display:false 旧区域擦除、相交组件被补画、zIndex 变更排序。
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICECircle from '../../src/graphic/shape/ICECircle';
import EventBus from '../../src/event/EventBus';

// ---- node 环境桩：ICEComponent 构造需要 root.createPath2D，PolyfillPath2D 走命令记录 ----
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
  const noop = () => {};
  const ctx: any = {
    clears,
    clips,
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
    setTransform: noop,
    setLineDash: noop,
    drawImage: noop,
  };

  // mock root 的 Path2D
  (global as any).Path2D = FakePath2D;
  const root = require('../../src/cross-platform/root').default;
  root.createPath2D = () => new FakePath2D();

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

  return { ice, ctx, renderer, clears, clips };
}

function attach(ice: any, comp: any) {
  ice.addChild(comp);
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

describe('CanvasRenderer dirty-rect', () => {
  test('首帧（结构重建后）走全量并 prime 快照', () => {
    const { ice, ctx, renderer, clears } = makeHarness('dirty-rect');
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30 });
    attach(ice, a);
    renderFrame(renderer, ice);
    expect(clears.length).toBe(1);
    expect(clears[0]).toEqual([0, 0, 800, 600]); // 全量 clear
    expect(renderer.__primed).toBe(true);
    expect(renderer.__snap.has(a)).toBe(true);
  });

  test('单个组件移动 → 只 clear 旧∪新区域，且只重画相交组件', () => {
    const { ice, ctx, renderer, clears } = makeHarness('dirty-rect');
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 1 });
    const c = new ICERect({ left: 40, top: 10, width: 60, height: 30, zIndex: 3 }); // 与 a 区域相交
    const far = [];
    for (let i = 0; i < 8; i++) {
      // 一堆远距组件，让 a 的脏占比 1/10 < 0.2，不触发全量回退
      far.push(new ICERect({ left: 300 + i * 60, top: 300 + i * 40, width: 40, height: 30, zIndex: 10 + i }));
    }
    attach(ice, a);
    attach(ice, c);
    far.forEach((f) => attach(ice, f));
    renderFrame(renderer, ice);
    clears.length = 0;

    // 记录本帧谁被 render
    const called: any[] = [];
    for (const comp of [a, c, ...far]) {
      const orig = comp.render.bind(comp);
      comp.render = () => {
        called.push(comp);
        return orig();
      };
    }

    a.setState({ left: 30, top: 40 }); // 移动 a
    renderFrame(renderer, ice);

    expect(clears.length).toBe(1);
    const [rx, ry, rw, rh] = clears[0];
    expect(rw).toBeLessThan(800);
    expect(rh).toBeLessThan(600);
    // 移动后的 a 必被画；far 组件不相交不该画；c 与 a 的新区域相交应被补画
    expect(called).toContain(a);
    expect(called).toContain(c);
    for (const f of far) expect(called).not.toContain(f);
  });

  test('脏组件占比过高 → 回退全量 clear', () => {
    const { ice, ctx, renderer, clears } = makeHarness('dirty-rect');
    const comps = [];
    for (let i = 0; i < 10; i++) {
      const r = new ICERect({ left: i * 60, top: 0, width: 40, height: 30 });
      attach(ice, r);
      comps.push(r);
    }
    renderFrame(renderer, ice);
    clears.length = 0;
    for (const r of comps) r.setState({ left: r.state.left + 1 }); // 10/10 全脏
    renderFrame(renderer, ice);
    expect(clears[0]).toEqual([0, 0, 800, 600]); // 全量回退
  });

  test('display:false 的曾上屏组件只擦除旧区域并收敛脏位', () => {
    const { ice, ctx, renderer, clears } = makeHarness('dirty-rect');
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30 });
    attach(ice, a);
    renderFrame(renderer, ice);
    expect(renderer.__snap.has(a)).toBe(true);
    clears.length = 0;

    a.setState({ display: false });
    renderFrame(renderer, ice);
    expect(clears.length).toBe(1);
    expect(clears[0][0] + clears[0][2]).toBeLessThanOrEqual(800); // 局部擦除而非全屏
    expect(renderer.__snap.has(a)).toBe(false); // 快照移除，避免永久脏组件
    expect(a.dirty).toBe(false);

    // 后续无其他脏 → 再次置 dirty 的空帧会回退全量（无局部必要）
    clears.length = 0;
    renderFrame(renderer, ice);
    expect(clears[0]).toEqual([0, 0, 800, 600]);
  });

  test('renderMode=full 恒走全量 clear', () => {
    const { ice, ctx, renderer, clears } = makeHarness('full');
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30 });
    attach(ice, a);
    renderFrame(renderer, ice);
    clears.length = 0;
    a.setState({ left: 30 });
    renderFrame(renderer, ice);
    expect(clears[0]).toEqual([0, 0, 800, 600]);
  });

  test('zIndex 变更后部分帧仍按新序补画相交组件（集合交集包含最上层）', () => {
    const { ice, ctx, renderer, clears } = makeHarness('dirty-rect');
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 1 });
    const c = new ICERect({ left: 40, top: 10, width: 60, height: 30, zIndex: 5 });
    const far = [];
    for (let i = 0; i < 8; i++) {
      far.push(new ICERect({ left: 300 + i * 60, top: 300 + i * 40, width: 40, height: 30, zIndex: 10 + i }));
    }
    attach(ice, a);
    attach(ice, c);
    far.forEach((f) => attach(ice, f));
    renderFrame(renderer, ice);
    clears.length = 0;
    const called: any[] = [];
    for (const comp of [a, c, ...far]) {
      const orig = comp.render.bind(comp);
      comp.render = () => {
        called.push(comp);
        return orig();
      };
    }
    c.setState({ zIndex: 0 }); // 层级下降，仍属脏 → 本帧应被补画
    renderFrame(renderer, ice);
    expect(clears[0][2]).toBeLessThan(800); // 局部而非全量
    expect(called).toContain(c);
    for (const f of far) expect(called).not.toContain(f);
  });
});
