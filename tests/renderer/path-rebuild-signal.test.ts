/**
 * 路径命令流重建信号的契约。
 *
 * 背景：`ICEPath.doRender()` 原先用 `if (this.dirty)` 决定「重建命令流」，而 `dirty` 的语义是
 * **本帧要重绘**（祖先移动、只改 `left`/`top` 的平移动画都会置脏）。于是「几何根本没变」的帧
 * 也在重建 `Path2D` + 重放整条命令流 —— 实测 10k 全动画场景里这一项占 2.28ms/帧（≈17%）。
 *
 * 新契约：命令流只在**几何真的变了**时重建，判据是两路信号取并集：
 * 1. 派生参数被重算过（`refreshParams()` 消费掉一次 `paramsDirty`）；
 * 2. 几何签名变了（宽/高/半径/圆心半径/本地原点/dots·points 的引用与长度/closePath/原点模式）。
 *
 * 为什么必须是两路：几何并不总是由组件自己算出来的 —— 父组件在 `calcComponentParams()` 里
 * **直接写子组件的 state** 是引擎里既有的写法（见 ice-entity-designer 的 Entity：注释明确说
 * 「calcComponentParams 不允许再调用 setState，这里直接写派生位置」），此时子组件的
 * `paramsDirty` 不会被置位，只有签名能发现变化。
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEStar from '../../src/graphic/shape/ICEStar';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';

class FakePath2D {
  _commands: any[] = [];
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
  ellipse(...a: any[]) {
    this._commands.push(['ellipse', ...a]);
  }
  arc(...a: any[]) {
    this._commands.push(['arc', ...a]);
  }
  closePath() {
    this._commands.push(['closePath']);
  }
}

function makeHarness() {
  const noop = () => {};
  const baseCtx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    measureText: () => ({ width: 30 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
  };
  const ctx: any = new Proxy(baseCtx, {
    get(t, prop) {
      if (typeof prop === 'symbol') return (t as any)[prop];
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      if (prop in t) return (t as any)[prop];
      return noop;
    },
    set(t, prop, v) {
      (t as any)[prop] = v;
      return true;
    },
  });
  (global as any).Path2D = FakePath2D;
  root.createPath2D = () => new FakePath2D();
  root.devicePixelRatio = 1;
  root.createOffscreenCanvas = jest.fn().mockReturnValue({ canvas: {}, ctx });

  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = root;
  ice.ctx = ctx;
  ice.canvasWidth = 800;
  ice.canvasHeight = 600;
  ice.evtBus = new EventBus();
  ice.dirty = true;

  const renderer: any = new CanvasRenderer(ice, { renderMode: 'full' });
  renderer.start();
  ice.renderer = renderer;
  return { ice, renderer };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

/** 包住 createPathObject 计数。返回计数器。 */
function spyCreatePath(component: any) {
  let n = 0;
  const orig = component.createPathObject.bind(component);
  component.createPathObject = () => {
    n++;
    return orig();
  };
  return () => n;
}

/** 命令流里最后一条 rect 命令（[rect, x, y, w, h]），没有则 null。 */
function lastRectCmd(component: any): any[] | null {
  const cmds = component.path2D && component.path2D._commands;
  if (!cmds) return null;
  for (let i = cmds.length - 1; i >= 0; i--) {
    if (cmds[i][0] === 'rect') return cmds[i];
  }
  return null;
}

describe('路径命令流的重建信号', () => {
  beforeEach(() => {
    // node 环境没有 document，文本的 DOM 降级量测会 console.error，这里静音
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('只改位置（平移）：命令流一次都不重建', () => {
    const { ice, renderer } = makeHarness();
    const rect: any = new ICERect({ left: 0, top: 0, width: 20, height: 20, style: { fillStyle: '#3366cc' } });
    ice.addChild(rect);
    renderFrame(renderer, ice); // prime：建立命令流

    const calls = spyCreatePath(rect);
    for (let i = 1; i <= 3; i++) {
      rect.setState({ left: i * 5 }, { paramsDirty: false }); // 动画写值通道的形态
      renderFrame(renderer, ice);
    }

    expect(rect.state.left).toBe(15); // 确实在动
    expect(rect.dirty).toBe(false); // 帧末被清脏
    expect(calls()).toBe(0); // 但几何没变 → 不该重建
  });

  it('只改 transform（旋转/缩放）：命令流一次都不重建', () => {
    const { ice, renderer } = makeHarness();
    const rect: any = new ICERect({ left: 0, top: 0, width: 20, height: 20 });
    ice.addChild(rect);
    renderFrame(renderer, ice);

    const calls = spyCreatePath(rect);
    for (let i = 1; i <= 3; i++) {
      rect.setState({ transform: { rotate: i * 10, translate: [i, i], scale: [1, 1] } }, { paramsDirty: false });
      renderFrame(renderer, ice);
    }
    expect(calls()).toBe(0);
  });

  it('setState 改几何：必须重建（且命令流跟着变）', () => {
    const { ice, renderer } = makeHarness();
    const rect: any = new ICERect({ left: 0, top: 0, width: 20, height: 20 });
    ice.addChild(rect);
    renderFrame(renderer, ice);

    const calls = spyCreatePath(rect);
    rect.setState({ width: 50 });
    renderFrame(renderer, ice);

    expect(calls()).toBeGreaterThan(0);
    expect(lastRectCmd(rect)![3]).toBe(50);
  });

  it('几何连续多帧不变：只在第一帧重建一次（同几何可能直接命中共享路径）', () => {
    const { ice, renderer } = makeHarness();
    const rect: any = new ICERect({ left: 0, top: 0, width: 20, height: 20 });
    ice.addChild(rect);
    renderFrame(renderer, ice);

    rect.setState({ width: 50 }); // 几何变一次
    const calls = spyCreatePath(rect);
    for (let i = 0; i < 4; i++) renderFrame(renderer, ice);

    // 2026-09-21 起「同几何的内置图元共享同一条 Path2D」：这里可能一次都不建（命中缓存），
    // 但**绝不会**逐帧重建，且命令流必须是新几何。
    expect(calls()).toBeLessThanOrEqual(1);
    expect(lastRectCmd(rect)![3]).toBe(50);
  });

  it('父组件直写子图形几何（Entity.ts 的写法）：必须重建', () => {
    const { ice, renderer } = makeHarness();
    const group: any = new ICEGroup({ left: 0, top: 0, width: 200, height: 200 });
    const child: any = new ICERect({ left: 0, top: 0, width: 20, height: 20, style: { fillStyle: '#3366cc' } });
    group.addChild(child);
    ice.addChild(group);
    renderFrame(renderer, ice);
    const before = lastRectCmd(child);
    expect(before![3]).toBe(20);

    // 模拟 Entity.calcComponentParams()：不许调 setState（会递归置脏），直接写派生尺寸。
    // 子组件的 paramsDirty 不会被置位 —— 只有几何签名能发现这次变化。
    child.state.width = 80;
    child.dirty = true;
    renderFrame(renderer, ice);

    expect(lastRectCmd(child)![3]).toBe(80);
  });

  it('点集图元：改 outerRadius 重建、纯平移不重建', () => {
    const { ice, renderer } = makeHarness();
    const star: any = new ICEStar({ left: 0, top: 0, outerRadius: 20, innerRadius: 8 });
    ice.addChild(star);
    renderFrame(renderer, ice);

    const calls = spyCreatePath(star);
    star.setState({ left: 40 }, { paramsDirty: false });
    renderFrame(renderer, ice);
    expect(calls()).toBe(0);

    star.setState({ outerRadius: 30 });
    renderFrame(renderer, ice);
    expect(calls()).toBe(1);
  });

  it('从未渲染过的组件首帧仍会建命令流（dirty 语义不回归）', () => {
    const { ice, renderer } = makeHarness();
    const rect: any = new ICERect({ left: 10, top: 10, width: 20, height: 20 });
    ice.addChild(rect, false); // UIButton 那种「挂载时不要主动置脏」的写法
    renderFrame(renderer, ice);
    // 判据是「首帧拿得到可用的命令流」，而不是「一定调用了 createPathObject」——
    // 同几何若已在他处建过，这里会直接共享那条路径。
    expect(lastRectCmd(rect)![3]).toBe(20);
  });

  it('同几何的内置图元共享同一条 Path2D；几何不同则不共享', () => {
    const { ice, renderer } = makeHarness();
    const a: any = new ICERect({ left: 0, top: 0, width: 33, height: 33 });
    const b: any = new ICERect({ left: 100, top: 0, width: 33, height: 33 }); // 只有位置不同
    const c: any = new ICERect({ left: 0, top: 100, width: 34, height: 33 }); // 宽度差 1
    ice.addChild(a);
    ice.addChild(b);
    ice.addChild(c);
    renderFrame(renderer, ice);

    expect(b.path2D).toBe(a.path2D); // 位置不进路径坐标（走 CTM），因此可共享
    expect(c.path2D).not.toBe(a.path2D);
  });
});
