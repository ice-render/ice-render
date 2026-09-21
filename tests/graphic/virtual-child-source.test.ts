/**
 * **虚拟子源（P0：批量绘制 + 窗口裁剪）契约测试**（2026-09-21）。
 *
 * 一句话契约：容器声明 `childSource` 之后，引擎按**可见窗口**向它要批量落墨
 * （`paint(ctx, view)`），窗口外的子项既没有对象也不用画；`materialize()` 出来的真子项
 * 走常规路径、画在批量层之上。
 *
 * 这里钉住四件事：
 * ① `childSource` 不进 `state/props`（不污染序列化）；
 * ② 窗口**跟着视口走**（缩放/平移/容器自身位移都算在内），并且是**局部坐标**；
 * ③ 窗口是"可见窗口"而不是整个容器；
 * ④ 批量层先画、物化子项后画（选中态/手柄不会被盖住）。
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICEVirtualLayer from '../../src/graphic/container/ICEVirtualLayer';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';
import { lastVirtualWindow } from '../../src/graphic/virtual/virtual-child-source';
import Serializer from '../../src/persistence/Serializer';

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
  /** 每次 `fill()` 当时的 `fillStyle`（用来验"批量落墨不许把状态泄漏给容器自己的绘制"）。 */
  const fills: string[] = [];
  /** 最小的 ctx 状态栈：save/restore 真的生效（否则"泄漏"这件事在桩里根本测不出来）。 */
  const stack: any[] = [];
  const SAVED = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'lineDash'];
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    clearRect: noop,
    clip: noop,
    save: () => {
      const snap: any = {};
      for (const k of SAVED) snap[k] = ctx[k];
      stack.push(snap);
    },
    restore: () => {
      const snap = stack.pop();
      if (snap) for (const k of SAVED) ctx[k] = snap[k];
    },
    beginPath: noop,
    rect: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: (..._a: any[]) => fills.push(ctx.fillStyle),
    setTransform: noop,
    setLineDash: (d: any) => {
      ctx.lineDash = d;
    },
    drawImage: noop,
  };
  (global as any).Path2D = FakePath2D;
  root.createPath2D = () => new FakePath2D();
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

  const renderer: any = new CanvasRenderer(ice, { renderMode: 'full' });
  renderer.start();
  ice.renderer = renderer;
  return { ice, renderer, fills };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

/** 只实现引擎需要的那几个方法的最小虚拟源。 */
function makeSource(n: number, calls: { paint: number; windows: number[][] }) {
  const canvas = { v: 0 };
  return {
    count: n,
    version: 1,
    boxAt(i: number, out: Float64Array) {
      out[0] = i * 20;
      out[1] = 0;
      out[2] = i * 20 + 10;
      out[3] = 10;
    },
    forEachInBox(x0: number, y0: number, x1: number, y1: number, visit: (i: number) => void) {
      for (let i = 0; i < n; i++) {
        const bx = i * 20;
        if (bx + 10 >= x0 && bx <= x1 && 10 >= y0 && 0 <= y1) visit(i);
      }
    },
    hitTest(lx: number) {
      return lx >= 0 && lx < n * 20 ? Math.floor(lx / 20) : -1;
    },
    paint(_ctx: any, view: any) {
      calls.paint++;
      calls.windows.push([view.x0, view.y0, view.x1, view.y1, view.scale]);
      canvas.v += view.x1 - view.x0;
    },
  };
}

describe('虚拟子源：绑定与序列化安全', () => {
  test('childSource 绑定成功，且不进 props / state（不进快照）', () => {
    const { ice } = makeHarness();
    const calls = { paint: 0, windows: [] as number[][] };
    const source = makeSource(100, calls);
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 2000,
      height: 1000,
      childSource: source,
    });
    ice.addChild(layer);

    expect(layer.getChildSource()).toBe(source);
    expect(layer.props.childSource).toBeUndefined();
    expect(layer.state.childSource).toBeUndefined();
    // 序列化里也不该出现（文档是应用的数据，引擎序列化不了它）
    expect(new Serializer(ice).toJSONString().indexOf('childSource')).toBe(-1);
  });

  test('setChildSource(null) 解绑；解绑后不再批量落墨', () => {
    const { ice, renderer } = makeHarness();
    const calls = { paint: 0, windows: [] as number[][] };
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 2000,
      height: 1000,
      childSource: makeSource(50, calls),
    });
    ice.addChild(layer);
    renderFrame(renderer, ice);
    expect(calls.paint).toBe(1);

    layer.setChildSource(null);
    renderFrame(renderer, ice);
    expect(calls.paint).toBe(1); // 没再调
  });
});

describe('虚拟子源：窗口跟着视口走（局部坐标）', () => {
  test('窗口 = 可见世界矩形（zoom 1、容器在原点）', () => {
    const { ice, renderer } = makeHarness();
    const calls = { paint: 0, windows: [] as number[][] };
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 20000,
      height: 12000,
      childSource: makeSource(1000, calls),
    });
    ice.addChild(layer);
    renderFrame(renderer, ice);

    const w = lastVirtualWindow(layer)!;
    expect(w[0]).toBeCloseTo(0, 6);
    expect(w[1]).toBeCloseTo(0, 6);
    expect(w[2]).toBeCloseTo(800, 6);
    expect(w[3]).toBeCloseTo(600, 6);
    expect(w[4]).toBe(1);
    // 是"可见窗口"而不是整个容器
    expect(w[2] - w[0]).toBeLessThan(20000);
  });

  test('缩放 2× → 窗口缩到一半；平移跟着走；scale 字段是渲染视口缩放', () => {
    const { ice, renderer } = makeHarness();
    const calls = { paint: 0, windows: [] as number[][] };
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 20000,
      height: 12000,
      childSource: makeSource(1000, calls),
    });
    ice.addChild(layer);

    ice.setViewport(2, 0, 0);
    renderFrame(renderer, ice);
    let w = lastVirtualWindow(layer)!;
    expect(w[2] - w[0]).toBeCloseTo(400, 6);
    expect(w[3] - w[1]).toBeCloseTo(300, 6);
    expect(w[4]).toBe(2);

    ice.setViewport(2, -200, -100); // 屏幕 (0,0) 对应世界 (100, 50)
    renderFrame(renderer, ice);
    w = lastVirtualWindow(layer)!;
    expect(w[0]).toBeCloseTo(100, 6);
    expect(w[1]).toBeCloseTo(50, 6);
  });

  test('容器自身有位移时窗口换算到**局部**坐标', () => {
    const { ice, renderer } = makeHarness();
    const calls = { paint: 0, windows: [] as number[][] };
    const layer: any = new ICEVirtualLayer({
      left: 100,
      top: 50,
      width: 20000,
      height: 12000,
      childSource: makeSource(1000, calls),
    });
    ice.addChild(layer);
    renderFrame(renderer, ice);

    const w = lastVirtualWindow(layer)!;
    expect(w[0]).toBeCloseTo(-100, 6); // 可见世界 x∈[0,800] → 局部 x∈[-100,700]
    expect(w[1]).toBeCloseTo(-50, 6);
    expect(w[2]).toBeCloseTo(700, 6);
    expect(w[3]).toBeCloseTo(550, 6);
  });
});

describe('虚拟子源：绘制次序与兼容', () => {
  test('批量层先画、物化出来的真子项后画（手柄/选中态不会被盖住）', () => {
    const { ice, renderer } = makeHarness();
    const order: string[] = [];
    const calls = { paint: 0, windows: [] as number[][] };
    const source: any = makeSource(100, calls);
    const rawPaint = source.paint;
    source.paint = (ctx: any, view: any) => {
      order.push('paint');
      return rawPaint(ctx, view);
    };
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 2000, height: 1000, childSource: source });
    ice.addChild(layer);

    const child: any = new ICERect({ left: 10, top: 10, width: 20, height: 20 });
    const origRender = child.render.bind(child);
    child.render = () => {
      order.push('child');
      return origRender();
    };
    layer.addChild(child);

    renderFrame(renderer, ice);
    expect(order).toEqual(['paint', 'child']);
  });

  test('只实现 materialize / 不实现 paint 的源也能挂（纯物化型）', () => {
    const { ice, renderer } = makeHarness();
    const source: any = {
      count: 3,
      version: 0,
      boxAt: (_i: number, out: Float64Array) => {
        out[0] = out[1] = 0;
        out[2] = out[3] = 10;
      },
      forEachInBox: () => {},
      hitTest: () => -1,
      materialize: () => null,
    };
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 100, height: 100, childSource: source });
    ice.addChild(layer);
    expect(() => renderFrame(renderer, ice)).not.toThrow();
    expect(lastVirtualWindow(layer)).toBeNull(); // 没 paint 就不记窗口
  });

  test('ICEGroup 也接同一套机制（不强制用 ICEVirtualLayer）', () => {
    const { ice, renderer } = makeHarness();
    const calls = { paint: 0, windows: [] as number[][] };
    const group: any = new ICEGroup({ left: 0, top: 0, width: 2000, height: 1000, childSource: makeSource(10, calls) });
    ice.addChild(group);
    renderFrame(renderer, ice);
    expect(calls.paint).toBe(1);
  });

  /**
   * **ctx 状态隔离**（2026-09-21 真机实测抓到）：容器自己的样式在 `doRender` **之前**就写进 ctx，
   * 而批量落墨会一路改 `fillStyle` —— 不隔离的话，紧接着画容器自己的盒子时会用**最后一个图元的颜色**
   * 填满整块容器（spike 里表现为"整张画布被紫色盖住"，像素对拍 99.9% 不一致）。
   */
  test('批量落墨改过的 ctx 状态不会泄漏到容器自己的绘制', () => {
    const { ice, renderer, fills } = makeHarness();
    const calls = { paint: 0, windows: [] as number[][] };
    const source: any = makeSource(10, calls);
    source.paint = (ctx: any, view: any) => {
      ctx.fillStyle = '#ff0000'; // 应用在这里随手改色（很正常）
      ctx.fill(); // 它自己的落墨
      return true;
    };
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      style: { fillStyle: '#123456', strokeStyle: 'transparent' }, // 容器自己有背景
      childSource: source,
    });
    ice.addChild(layer);
    renderFrame(renderer, ice);

    expect(fills[0]).toBe('#ff0000'); // 应用自己的落墨
    expect(fills[fills.length - 1]).toBe('#123456'); // 容器自己的盒子仍然用自己的样式
  });
});
