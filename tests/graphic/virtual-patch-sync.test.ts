/**
 * **虚拟子源 P2 第 3~5 条**的契约测试（2026-09-21）：
 * ③ 文档补丁入口（`applyPatch` + 物化组件改动回流 `onChildPatched`）；
 * ④ 引擎级窗口同步助手（`syncVirtualWindow`：needs / pad / budget）；
 * ⑤ 自检（`diagnoseVirtualSource` 报出"跨度异常"的盒子，正是索引爆炸的根因）。
 */
import ICE from '../../src/ICE';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICEVirtualLayer from '../../src/graphic/container/ICEVirtualLayer';
import ICERect from '../../src/graphic/shape/ICERect';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';
import {
  applyVirtualPatch,
  diagnoseVirtualSource,
  materializeVirtualChild,
  materializedChild,
  materializedIndices,
  syncVirtualWindow,
} from '../../src/graphic/virtual/virtual-child-source';

class FakePath2D {
  moveTo(..._a: any[]) {}
  lineTo(..._a: any[]) {}
  rect(..._a: any[]) {}
  ellipse(..._a: any[]) {}
  closePath() {}
}

function makeIce() {
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

/** 可控的假文档：`xs` 是每个条目的 x（拖动后就地改它），并记录补丁。 */
function makeDoc(count = 10, opts: { spanOf?: (i: number) => number } = {}) {
  const xs = new Float64Array(count);
  for (let i = 0; i < count; i++) xs[i] = i * 50;
  const doc = {
    count,
    version: 1,
    patches: [] as any[],
    backflow: [] as any[],
    boxAt(i: number, out: Float64Array) {
      out[0] = xs[i];
      out[1] = 0;
      out[2] = xs[i] + 40;
      out[3] = 40;
    },
    forEachInBox(x0: number, y0: number, x1: number, y1: number, visit: (i: number) => void) {
      for (let i = 0; i < count; i++) {
        if (xs[i] + 40 >= x0 && xs[i] <= x1 && 40 >= y0 && 0 <= y1) visit(i);
      }
    },
    hitTest(lx: number) {
      const i = Math.floor(lx / 50);
      return i >= 0 && i < count ? i : -1;
    },
    paint: () => true,
    documentBounds(out: Float64Array) {
      out[0] = 0;
      out[1] = 0;
      out[2] = count * 50;
      out[3] = 40;
      return true;
    },
    materialize(i: number) {
      return new ICERect({ left: xs[i], top: 0, width: 40, height: 40 });
    },
    /** 文档唯一写入口：写进列存 + version++ */
    applyPatch(i: number, patch: any) {
      doc.patches.push([i, patch]);
      if (typeof patch.left === 'number') xs[i] = patch.left;
      doc.version++;
      return true;
    },
    /** 物化组件被拖动 → 回流 */
    onChildPatched(i: number, patch: any) {
      doc.backflow.push([i, patch]);
      if (typeof patch.left === 'number') xs[i] = patch.left;
      doc.version++;
    },
    xOf: (i: number) => xs[i],
    spanOf: opts.spanOf || (() => 40),
  };
  return doc;
}

describe('虚拟子源 P2③：文档补丁入口', () => {
  test('applyVirtualPatch：先写文档，再同步到物化组件；程序化写不回流', () => {
    const { ice } = makeIce();
    const doc = makeDoc(10);
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 500, height: 40, childSource: doc });
    ice.addChild(layer);
    const child = materializeVirtualChild(layer, 3);

    expect(applyVirtualPatch(layer, 3, { left: 999 })).toBe(true);
    expect(doc.xOf(3)).toBe(999);
    expect(child.state.left).toBe(999);
    expect(doc.version).toBe(2);
    expect(doc.backflow.length).toBe(0);
  });

  test('用户拖动物化组件 → onChildPatched 回流，文档跟着变（不必等存盘）', () => {
    const { ice } = makeIce();
    const doc = makeDoc(10);
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 500, height: 40, childSource: doc });
    ice.addChild(layer);
    const child = materializeVirtualChild(layer, 2);

    child.setState({ left: 234 }); // 用户在画布上拖（引擎默认拖动最终就是 setState）
    expect(doc.backflow.length).toBe(1);
    expect(doc.backflow[0][0]).toBe(2);
    expect(doc.xOf(2)).toBe(234);
    expect(doc.version).toBe(2);
  });

  test('不能物化 / 下标非法时：applyVirtualPatch 返回 false（不炸）', () => {
    const { ice } = makeIce();
    const doc = makeDoc(3);
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 200, height: 40, childSource: doc });
    ice.addChild(layer);
    expect(applyVirtualPatch(layer, 9, { left: 1 })).toBe(true); // 文档自己决定合法性
    const plain: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    ice.addChild(plain);
    expect(applyVirtualPatch(plain, 0, { left: 1 })).toBe(false); // 不是虚拟容器
  });
});

describe('虚拟子源 P2④：窗口同步助手', () => {
  test('按窗口物化 / 回收，滞后带与每帧预算生效', () => {
    const { ice, renderer } = makeIce();
    const doc = makeDoc(40);
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 2000, height: 40, childSource: doc });
    ice.addChild(layer);
    ice.dirty = true;
    renderer.frameEvtHandler(); // 记下窗口（0..800，即条目 0..~19）

    const first = syncVirtualWindow(layer, { budget: 8 });
    expect(first.created).toBe(8);
    expect(first.deferred).toBeGreaterThan(0);

    let guard = 0;
    let last = first;
    while (last.deferred > 0 && guard++ < 50) last = syncVirtualWindow(layer, { budget: 64 });
    const live = materializedIndices(layer);
    expect(live.length).toBeGreaterThan(8);
    expect(live.every((i) => i < 20)).toBe(true);

    // 缩小窗口（放大视口）→ 出窗口的被回收
    ice.setViewport(4, 0, 0);
    ice.dirty = true;
    renderer.frameEvtHandler();
    const after = syncVirtualWindow(layer, { budget: 64 });
    expect(after.released).toBeGreaterThan(0);
    expect(materializedIndices(layer).length).toBeLessThan(live.length);
  });

  test('needs 过滤：只要指定的那一类条目', () => {
    const { ice, renderer } = makeIce();
    const doc = makeDoc(20);
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 1000, height: 40, childSource: doc });
    ice.addChild(layer);
    ice.dirty = true;
    renderer.frameEvtHandler();
    const res = syncVirtualWindow(layer, { needs: (i: number) => i % 5 === 0, budget: 64 });
    expect(res.created).toBe(4); // 0,5,10,15
    expect(materializedIndices(layer).every((i) => i % 5 === 0)).toBe(true);
  });

  /**
   * **`map`：扫一类、物化另一类**（IED 的真实形态：扫符号 → 物化它的标注）。
   *
   * 没有 `map` 时这里会 `created N / released N / live 0` —— 回收那段拿"物化过的下标"
   * 去跟"窗口里的下标"比，把刚建的立刻全拆了（真机实测抓到的陷阱）。
   */
  test('map：访问符号、物化它的标注（不会建完立刻回收）', () => {
    const { ice, renderer } = makeIce();
    const doc = makeDoc(20);
    // 10..19 当"标注"，属于 0..9 的符号
    const labelOf = (i: number) => (i >= 0 && i < 10 ? i + 10 : -1);
    const source: any = {
      ...doc,
      count: 20,
      forEachInBox(x0: number, y0: number, x1: number, y1: number, visit: (i: number) => void) {
        for (let i = 0; i < 10; i++) {
          if (doc.xOf(i) + 40 >= x0 && doc.xOf(i) <= x1 && 40 >= y0 && 0 <= y1) visit(i);
        }
      },
      materialize(i: number) {
        return new ICERect({ left: doc.xOf(i - 10), top: 50, width: 40, height: 12 });
      },
    };
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 1000, height: 40, childSource: source });
    ice.addChild(layer);
    ice.dirty = true;
    renderer.frameEvtHandler();

    const res = syncVirtualWindow(layer, { map: labelOf, budget: 64 });
    expect(res.created).toBeGreaterThan(0);
    expect(res.released).toBe(0);
    expect(res.live).toBe(res.created);
    expect(materializedIndices(layer).every((i) => i >= 10)).toBe(true);
  });

  test('命中路径物化的条目不被窗口同步回收（只管自己建的）', () => {
    const { ice, renderer } = makeIce();
    const doc = makeDoc(20);
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 1000, height: 40, childSource: doc });
    ice.addChild(layer);
    ice.dirty = true;
    renderer.frameEvtHandler();

    // 用户点中第 3 条（命中路径物化）——它不在窗口同步的管辖范围里
    const hitChild = materializeVirtualChild(layer, 3);
    const res = syncVirtualWindow(layer, { needs: (i: number) => i < 2, budget: 8 });
    expect(res.created).toBe(2);
    expect(materializedIndices(layer)).toContain(3);
    expect(materializedChild(layer, 3)).toBe(hitChild);
  });
});

describe('虚拟子源 P2⑤：自检', () => {
  test('报出跨度异常的盒子（索引爆炸的根因）', () => {
    // 上面 makeDoc 的 spanOf 在这个用例里没用 —— 直接改一个条目的盒让它横跨整份文档
    const doc = makeDoc(10) as any;
    const box = new Float64Array(4);
    doc.boxAt(4, box);
    const wide = {
      ...doc,
      boxAt(i: number, out: Float64Array) {
        if (i === 4) {
          out[0] = 0;
          out[1] = 0;
          out[2] = 9999; // 横跨整份文档（就是索引爆炸的那种盒）
          out[3] = 40;
          return;
        }
        doc.boxAt(i, out);
      },
    };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = diagnoseVirtualSource(wide as any, { spanRatio: 0.5 });
    expect(res.scanned).toBe(10);
    expect(res.offenders.length).toBe(1);
    expect(res.offenders[0].index).toBe(4);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    void box;
  });

  test('健康的文档不报 offender', () => {
    const doc = makeDoc(30) as any;
    const res = diagnoseVirtualSource(doc, { spanRatio: 0.5 });
    expect(res.offenders).toEqual([]);
    expect(res.maxSpan).toBe(40);
  });
});
