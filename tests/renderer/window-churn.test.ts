/**
 * **窗口内物化的廉价增删（P3）**（2026-09-21）。
 *
 * 虚拟容器每帧都在进出子项（窗口内物化 / 回收）。走老的"结构变更"路径
 * （`markQueueDirty` → 清空**所有**上屏快照 → 下一帧没有视口裁剪）代价是灾难性的：
 * 10 万图元世界里一次 `addChild` 实测 **117 ms/帧**（全屏重画所有图元）。
 *
 * 契约：
 * ① 虚拟容器的子项进出 → 队列照重建，但**其他组件的上屏快照保留**（普通容器仍然全清）；
 * ② 进出窗口的**那一个**组件的快照被单独丢掉（它日后复用同一对象时不拿旧盒参与裁剪）；
 * ③ 该帧**整屏重画**（旧墨必须清掉），但**仍按新可见区裁剪** —— 屏外组件不重画；
 * ④ 真·结构变更（`markQueueDirty`）优先：不许被"保留快照"污染。
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICEVirtualLayer from '../../src/graphic/container/ICEVirtualLayer';
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

  const renderer: any = new CanvasRenderer(ice, { renderMode: 'dirty-rect' });
  renderer.start();
  ice.renderer = renderer;
  return { ice, renderer, clears };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

/** 造一个"什么都不画"的虚拟源（窗口变更的测试不关心批量落墨内容）。 */
function emptySource(n = 1000) {
  return {
    count: n,
    version: 1,
    boxAt: (_i: number, out: Float64Array) => {
      out[0] = out[1] = 0;
      out[2] = out[3] = 1;
    },
    forEachInBox: () => {},
    hitTest: () => -1,
    paint: () => true,
  };
}

const FULL = [0, 0, 800, 600];

describe('窗口内物化的廉价增删', () => {
  test('虚拟容器：子项进出保留其他组件的快照，只丢"那一个"', () => {
    const { ice, renderer } = makeHarness();
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 2000, height: 1000, childSource: emptySource() });
    const other = new ICERect({ left: 10, top: 10, width: 20, height: 20, zIndex: 1 });
    const far = new ICERect({ left: 5000, top: 5000, width: 20, height: 20, zIndex: 2 });
    ice.addChild(layer);
    ice.addChild(other);
    ice.addChild(far);
    renderFrame(renderer, ice); // prime（结构变更帧不做裁剪）
    renderFrame(renderer, ice); // 稳态
    expect(renderer.__snap.has(other)).toBe(true);
    expect(renderer.__lastFrameCulled).toBe(1); // far 屏外、有快照 → 稳态帧被裁

    const child = new ICERect({ left: 100, top: 100, width: 20, height: 20 });
    layer.addChild(child); // 窗口内物化
    expect(renderer.__queueDirty).toBe(true); // 队列照重建（成员变了）
    renderFrame(renderer, ice);
    // ★ 关键区别：物化那一帧**照旧裁剪**（别人的快照保住了）。老路径这里会是 0（快照全清 → 全部重画）。
    expect(renderer.__lastFrameCulled).toBe(1);

    layer.removeChild(child); // 滚出窗口 → 回收
    expect(renderer.__snap.has(child)).toBe(false); // 它自己的快照被单独丢掉
    expect(renderer.__snap.has(other)).toBe(true);
  });

  test('普通容器：子项进出仍然清空全部快照（老语义不变）', () => {
    const { ice, renderer } = makeHarness();
    const group: any = new ICEGroup({ left: 0, top: 0, width: 2000, height: 1000 });
    const other = new ICERect({ left: 10, top: 10, width: 20, height: 20, zIndex: 1 });
    const far = new ICERect({ left: 5000, top: 5000, width: 20, height: 20, zIndex: 2 });
    ice.addChild(group);
    ice.addChild(other);
    ice.addChild(far);
    renderFrame(renderer, ice); // prime
    renderFrame(renderer, ice); // 稳态
    expect(renderer.__snap.has(other)).toBe(true);
    expect(renderer.__lastFrameCulled).toBe(1);

    group.addChild(new ICERect({ left: 100, top: 100, width: 20, height: 20 }));
    renderFrame(renderer, ice);
    expect(renderer.__lastFrameCulled).toBe(0); // 结构变更 → 快照全清 → 整屏一切都得重画
  });

  test('窗口变更帧：整屏重画，但仍然裁剪屏外组件', () => {
    const { ice, renderer, clears } = makeHarness();
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 2000, height: 1000, childSource: emptySource() });
    const near = new ICERect({ left: 10, top: 10, width: 20, height: 20, zIndex: 1 });
    const far = new ICERect({ left: 5000, top: 5000, width: 20, height: 20, zIndex: 2 });
    ice.addChild(layer);
    ice.addChild(near);
    ice.addChild(far);
    renderFrame(renderer, ice);
    renderFrame(renderer, ice);
    expect(renderer.__lastFrameCulled).toBe(1); // far 屏外

    layer.addChild(new ICERect({ left: 200, top: 200, width: 20, height: 20 }));
    clears.length = 0;
    let farRendered = 0;
    const origFar = far.render.bind(far);
    far.render = () => {
      farRendered++;
      return origFar();
    };
    renderFrame(renderer, ice);
    far.render = origFar;

    expect(clears).toContainEqual(FULL); // 整屏重画（窗口进出会留下旧墨）
    expect(farRendered).toBe(0); // 但屏外的照旧被裁 —— 这正是"保留快照"的价值
    expect(renderer.__lastFrameCulled).toBe(1);
  });

  test('真·结构变更优先：markQueueDirty 会清掉"保留快照"的意图', () => {
    const { ice, renderer } = makeHarness();
    const layer: any = new ICEVirtualLayer({ left: 0, top: 0, width: 2000, height: 1000, childSource: emptySource() });
    const other = new ICERect({ left: 10, top: 10, width: 20, height: 20, zIndex: 1 });
    const far = new ICERect({ left: 5000, top: 5000, width: 20, height: 20, zIndex: 2 });
    ice.addChild(layer);
    ice.addChild(other);
    ice.addChild(far);
    renderFrame(renderer, ice); // prime
    renderFrame(renderer, ice); // 稳态

    layer.addChild(new ICERect({ left: 100, top: 100, width: 20, height: 20 })); // 置了 keepSnapshots
    renderer.markQueueDirty(); // 紧接着来了一个真结构变更
    renderFrame(renderer, ice);
    expect(renderer.__lastFrameCulled).toBe(0); // 快照被清 → 当帧不做裁剪（真结构变更的语义）
  });
});
