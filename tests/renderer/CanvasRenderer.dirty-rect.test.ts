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
  root.createOffscreenCanvas = () => ({
    canvas: {},
    ctx: {
      scale: noop,
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
    },
  });
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

  test('父容器 display:false → 子组件不渲染、不捕获，旧墨迹被擦除', () => {
    const { ice, renderer, clears } = makeHarness('dirty-rect');
    const group = new ICEGroup({ left: 100, top: 100, width: 200, height: 200 });
    //子组件坐标相对父容器：世界盒 = 父(100,100) + 子(20,20) → 120..160 x 120..150
    const child = new ICERect({ left: 20, top: 20, width: 40, height: 30 });
    group.addChild(child);
    attach(ice, group);
    renderFrame(renderer, ice);
    expect(renderer.__snap.has(child)).toBe(true);

    //render() 在渲染队列里是无条件调用的（display 守卫在 __renderCore 内），
    //所以「有没有真的落笔」要看 doRender
    const drawn: any[] = [];
    const orig = child.doRender.bind(child);
    child.doRender = () => {
      drawn.push(child);
      return orig();
    };

    clears.length = 0;
    group.setState({ display: false });
    renderFrame(renderer, ice);

    //父容器隐藏 = 整棵子树隐藏：子组件不能被画
    expect(drawn).not.toContain(child);
    //子组件的快照被收敛掉，避免残留旧盒把后续局部帧反复顶成全量
    expect(renderer.__snap.has(child)).toBe(false);
    expect(child.dirty).toBe(false);
    //旧墨迹必须被擦掉（本帧有一次 clear 覆盖了子组件旧盒 120..160 x 120..150）
    const covers = clears.some((c: number[]) => c[0] <= 120 && c[1] <= 120 && c[0] + c[2] >= 160 && c[1] + c[3] >= 150);
    expect(covers).toBe(true);
  });

  test('父容器隐藏 + 其它组件同时变脏 → 局部路径也要并入子组件旧盒', () => {
    const { ice, renderer, clears } = makeHarness('dirty-rect');
    const group = new ICEGroup({ left: 100, top: 100, width: 60, height: 60, zIndex: 1 });
    //故意让子组件溢出父盒：父盒(100..160)盖不住它，子组件旧盒本身也得并入擦除区
    const child = new ICERect({ left: 80, top: 80, width: 40, height: 30, zIndex: 2 }); // 世界盒 180..220 x 180..210
    group.addChild(child);
    const mover = new ICERect({ left: 10, top: 10, width: 30, height: 20, zIndex: 3 });
    attach(ice, group);
    attach(ice, mover);
    for (let i = 0; i < 8; i++) {
      attach(ice, new ICERect({ left: 500 + i * 30, top: 500, width: 20, height: 20, zIndex: 10 + i }));
    }
    renderFrame(renderer, ice);
    clears.length = 0;

    mover.setState({ left: 40 }); // 唯一可见脏 → 应走局部路径
    group.setState({ display: false });
    renderFrame(renderer, ice);

    //三处脏区互不相接（移动的 mover / 父容器盒 / 溢出父盒的子组件）→ 切成多块，各擦各的
    expect(clears.length).toBeGreaterThan(1);
    //任何一块都不该退化成全量
    for (const c of clears) {
      expect(c[2] < 800 || c[3] < 600).toBe(true);
    }
    //其中必须有一块覆盖子组件旧盒（180..220 x 180..210），否则会留下残影
    const coversChild = clears.some(
      (c: number[]) => c[0] <= 180 && c[1] <= 180 && c[0] + c[2] >= 220 && c[1] + c[3] >= 210
    );
    expect(coversChild).toBe(true);
  });

  test('分散脏组件 → 切成多块小区域，不并成一个「大盒」把干净区域圈进来', () => {
    const { ice, renderer, clears } = makeHarness('dirty-rect');
    // 画布对角两个小方块，中间大片是干净区域
    const a = new ICERect({ left: 10, top: 10, width: 30, height: 20, zIndex: 1 });
    const b = new ICERect({ left: 740, top: 560, width: 30, height: 20, zIndex: 2 });
    attach(ice, a);
    attach(ice, b);
    for (let i = 0; i < 8; i++) {
      attach(ice, new ICERect({ left: 300, top: 250, width: 10, height: 10, zIndex: 10 + i }));
    }
    renderFrame(renderer, ice);
    clears.length = 0;

    // 两处同时变脏：单块并集大盒面积 = 780*570 ≈ 44.5 万 ≈ 画布(48 万)的 93% → 必然回退全量，
    // 多块则各自 ≈ 30*20，总面积占比 < 1%
    a.setState({ left: 20 });
    b.setState({ left: 730 });
    renderFrame(renderer, ice);

    expect(clears.length).toBe(2);
    let total = 0;
    for (const c of clears) {
      total += c[2] * c[3];
      expect(c[2]).toBeLessThan(120); // 每块都贴近真实脏区
      expect(c[3]).toBeLessThan(120);
    }
    expect(total / (800 * 600)).toBeLessThan(0.05);
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

  test('半透明组件缓存后场景可局部重绘（不再回退全量）', () => {
    const { ice, renderer, clears } = makeHarness('dirty-rect');
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 1 });
    const special = new ICERect({
      left: 30,
      top: 10,
      width: 40,
      height: 30,
      zIndex: 2,
      style: { fillStyle: 'rgba(0,0,0,0.5)' },
    });
    const far = [];
    for (let i = 0; i < 8; i++) {
      far.push(new ICERect({ left: 300 + i * 60, top: 300 + i * 40, width: 40, height: 30, zIndex: 10 + i }));
    }
    attach(ice, a);
    attach(ice, special);
    far.forEach((f) => attach(ice, f));
    renderFrame(renderer, ice);
    clears.length = 0;

    a.setState({ left: 20, top: 20 });
    renderFrame(renderer, ice);

    expect(clears.length).toBe(1);
    expect(clears[0][2]).toBeLessThan(800); // 局部而非全量
    expect(clears[0][3]).toBeLessThan(600);
  });

  test('非单位视口下仍走局部重绘：clear 用渲染坐标（世界×scale+平移）', () => {
    const { ice, renderer, clears } = makeHarness('dirty-rect');
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 1 });
    attach(ice, a);
    for (let i = 0; i < 8; i++) {
      attach(ice, new ICERect({ left: 500 + i * 30, top: 500, width: 20, height: 20, zIndex: 10 + i }));
    }
    renderFrame(renderer, ice);
    clears.length = 0;

    // 缩放 2 倍 + 平移(100,50)：世界盒 (10..70, 10..70) → 渲染坐标 (120..240, 70..190)
    ice.viewport = { scale: 2, tx: 100, ty: 50 };
    a.setState({ left: 30, top: 40 });
    renderFrame(renderer, ice);

    expect(clears.length).toBe(1);
    const [rx, ry, rw, rh] = clears[0];
    expect(rw).toBeLessThan(800); // 没有退化成全量
    expect(rx).toBeLessThanOrEqual(120);
    expect(ry).toBeLessThanOrEqual(70);
    expect(rx + rw).toBeGreaterThanOrEqual(240);
    expect(ry + rh).toBeGreaterThanOrEqual(190);
  });

  test('dpr>1 时仍走局部重绘：clear 区域按设备像素放大', () => {
    const { ice, renderer, clears } = makeHarness('dirty-rect');
    const a = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 1 });
    attach(ice, a);
    for (let i = 0; i < 8; i++) {
      attach(ice, new ICERect({ left: 500 + i * 30, top: 500, width: 20, height: 20, zIndex: 10 + i }));
    }
    renderFrame(renderer, ice);
    clears.length = 0;

    // dpr=2：backing store 与 canvasWidth 同步放大（与 ICE.__applyDevicePixelRatio 一致）
    ice.dpr = 2;
    ice.canvasWidth = 1600;
    ice.canvasHeight = 1200;
    a.setState({ left: 30, top: 40 });
    renderFrame(renderer, ice);

    expect(clears.length).toBe(1);
    const [rx, ry, rw, rh] = clears[0];
    expect(rw).toBeLessThan(1600); // 没有退化成全量
    // 世界 (10..70, 10..70) × dpr2 → (20..140, 20..140)
    expect(rx).toBeLessThanOrEqual(20);
    expect(ry).toBeLessThanOrEqual(20);
    expect(rx + rw).toBeGreaterThanOrEqual(140);
    expect(ry + rh).toBeGreaterThanOrEqual(140);
  });
});
