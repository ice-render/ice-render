/**
 * **虚拟化：命中 → 物化 → 事件重定向（P1）** 的契约测试（2026-09-21）。
 *
 * 这是虚拟化"能真用起来"的那一步：批量图元没有对象，命中检测命中的是**容器**；
 * 引擎按策略把"刚被点到的那一个子项"物化成真组件，并把事件重定向过去 ——
 * 于是 `evt.target`、选中、控制面板、拖动**完全不用知道虚拟化的存在**。
 *
 * 契约：
 * ① 命中批量图元 → 返回**物化出来的真组件**（不是容器），且它已挂进容器 `childNodes`；
 * ② 同一子项重复命中**幂等**（不会越点越多）；
 * ③ 空白处不命中（虚拟容器不回退到自己的大盒子）；策略 `container` 时保持旧行为；
 * ④ 回收后可以再次物化；`materialize` 缺失/返回 null 时退回容器（不炸）；
 * ⑤ 拖拽链路：按下之后就跟着那个真组件走（引擎的 `componentCache` 语义）。
 */
import ICE from '../../src/ICE';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICEVirtualLayer from '../../src/graphic/container/ICEVirtualLayer';
import ICERect from '../../src/graphic/shape/ICERect';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';
import {
  materializedIndices,
  materializedIndexOf,
  releaseVirtualChild,
  resolveVirtualHit,
  setVirtualHitPolicy,
} from '../../src/graphic/virtual/virtual-child-source';

class FakePath2D {
  moveTo(..._a: any[]) {}
  lineTo(..._a: any[]) {}
  rect(..._a: any[]) {}
  ellipse(..._a: any[]) {}
  closePath() {}
}

function makeHarness() {
  const noop = () => {};
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
    setTransform: noop,
    setLineDash: noop,
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
  return { ice, renderer };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

/**
 * 100 个 10×10 的方块，排在 y∈[0,10]、x∈[i*20, i*20+10]：
 * 命中第 i 个 ⇒ 局部坐标在 `[i*20, i*20+10]` 内。
 */
function makeSource(hits: number[]) {
  return {
    count: 100,
    version: 1,
    boxAt(i: number, out: Float64Array) {
      out[0] = i * 20;
      out[1] = 0;
      out[2] = i * 20 + 10;
      out[3] = 10;
    },
    forEachInBox(x0: number, y0: number, x1: number, y1: number, visit: (i: number) => void) {
      for (let i = 0; i < 100; i++) {
        const bx = i * 20;
        if (bx + 10 >= x0 && bx <= x1 && 10 >= y0 && 0 <= y1) visit(i);
      }
    },
    hitTest(lx: number, ly: number) {
      if (ly < 0 || ly > 10) return -1;
      const i = Math.floor(lx / 20);
      return i >= 0 && i < 100 && lx - i * 20 <= 10 ? i : -1;
    },
    paint() {
      return true;
    },
    materialize(i: number) {
      hits.push(i);
      return new ICERect({
        left: i * 20,
        top: 0,
        width: 10,
        height: 10,
        style: { fillStyle: '#3366cc' },
      });
    },
  };
}

describe('虚拟化命中：物化与重定向', () => {
  test('ice.hitTest 命中的是"物化出来的真组件"，且已挂进容器', () => {
    const { ice, renderer } = makeHarness();
    const hits: number[] = [];
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 2000,
      height: 1000,
      childSource: makeSource(hits),
    });
    ice.addChild(layer);
    renderFrame(renderer, ice);

    const hit = ice.hitTest(45, 5); // 局部/世界同坐标（容器在原点）：x=45 → 第 2 个（x∈[40,50]）
    expect(hit).not.toBe(layer);
    expect(hit.state.left).toBe(40);
    expect(layer.childNodes).toContain(hit);
    expect(materializedIndexOf(layer, hit)).toBe(2);
    expect(hits).toEqual([2]);
  });

  test('同一子项重复命中是幂等的（不会越点越多）', () => {
    const { ice, renderer } = makeHarness();
    const hits: number[] = [];
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 2000,
      height: 1000,
      childSource: makeSource(hits),
    });
    ice.addChild(layer);
    renderFrame(renderer, ice);

    const a = ice.hitTest(45, 5);
    const b = ice.hitTest(45, 5);
    expect(b).toBe(a);
    expect(hits).toEqual([2]); // materialize 只被调了一次
    expect(materializedIndices(layer)).toEqual([2]);
  });

  test('空白处不命中虚拟容器（不回退到它的大盒子）', () => {
    const { ice, renderer } = makeHarness();
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 2000, height: 1000, childSource: makeSource([]) });
    ice.addChild(layer);
    renderFrame(renderer, ice);

    expect(layer.containsPoint(15, 5)).toBe(false); // 两个方块之间的缝
    expect(ice.hitTest(15, 5)).toBeNull();
    expect(materializedIndices(layer)).toEqual([]);
  });

  test('策略 container：保持旧行为（返回容器，由应用自己接管）', () => {
    const { ice, renderer } = makeHarness();
    const hits: number[] = [];
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 2000,
      height: 1000,
      childSource: makeSource(hits),
    });
    setVirtualHitPolicy(layer, 'container');
    ice.addChild(layer);
    renderFrame(renderer, ice);

    expect(ice.hitTest(45, 5)).toBe(layer);
    expect(hits).toEqual([]);
  });

  test('回收后可以再次物化；materialize 返回 null 时退回容器', () => {
    const { ice, renderer } = makeHarness();
    const hits: number[] = [];
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 2000,
      height: 1000,
      childSource: makeSource(hits),
    });
    ice.addChild(layer);
    renderFrame(renderer, ice);

    const first = ice.hitTest(45, 5);
    expect(releaseVirtualChild(layer, 2)).toBe(true);
    expect(layer.childNodes).not.toContain(first);
    expect(materializedIndices(layer)).toEqual([]);

    const again = ice.hitTest(45, 5);
    expect(again).not.toBe(first); // 重新物化了一个
    expect(hits).toEqual([2, 2]);

    // 源不会物化时：退回容器本身
    const naked: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 2000,
      height: 1000,
      childSource: { ...makeSource([]), materialize: () => null },
    });
    ice.addChild(naked);
    renderFrame(renderer, ice);
    expect(ice.hitTest(45, 5)).toBe(naked);
  });

  test('物化出来的组件是"真组件"：能选中、能按引擎默认拖动逻辑走', () => {
    const { ice, renderer } = makeHarness();
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 2000, height: 1000, childSource: makeSource([]) });
    ice.addChild(layer);
    renderFrame(renderer, ice);

    const hit = ice.hitTest(45, 5);
    expect(hit.state.interactive).toBe(true); // 默认就是可交互
    expect(hit.state.draggable).toBe(true);
    ice.setSelection([hit]);
    expect(ice.selectionList).toContain(hit); // 选中链路认它（未 init 的夹具里 syncTools 返回 false，这里只验选中表）

    // 引擎默认的拖动通道：按下 → 注册 mousemove/mouseup → 移动 → 抬起
    hit.trigger('mousedown', null, {});
    expect(hit.hasListener('mousemove', hit.mouseMoveEvtHandler, hit)).toBe(true);
    hit.mouseMoveEvtHandler({ target: hit, movementX: 3, movementY: 4 });
    expect(hit.state.left).toBe(43);
    hit.mouseUpEvtHandler();
    expect(hit.hasListener('mousemove', hit.mouseMoveEvtHandler, hit)).toBe(false);
  });

  test('resolveVirtualHit 对普通组件是恒等（不干扰既有链路）', () => {
    const { ice } = makeHarness();
    const rect: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    ice.addChild(rect);
    expect(resolveVirtualHit(rect)).toBe(rect);
    expect(resolveVirtualHit(null)).toBeNull();
  });
});
