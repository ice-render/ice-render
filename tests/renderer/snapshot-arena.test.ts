/**
 * 上屏快照盒的 arena 表示（2026-09-21 内存优化）。
 *
 * 改造前：每个曾上屏的组件各持一个 Float64Array(4)（+ 一个 32B 的 ArrayBuffer）。
 * 真机 Chrome + V8 堆快照（10 万图元）实测 10 万个 JSTypedArray + 10 万个 ArrayBuffer = 10.7MB，
 * 只为存 32 字节。改成「WeakMap 存槽位号（Smi）+ 分块 Float64Array 存数据」后：
 * 对象数省掉 20 万，数据并成连续内存，getWorldBox() 依然返回一个指向当前值的 Float64Array 视图。
 *
 * 这个文件守三件事：
 * ① 读出来的盒与改造前一致（对外可见语义不变）；
 * ② 槽位会归还：隐藏组件不再占槽位，反复显隐不会让 arena 无限增长；
 * ③ 结构变化（成员进出）后快照整体作废、槽位从 0 重新发号。
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import EventBus from '../../src/event/EventBus';

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
  const root = require('../../src/cross-platform/root').default;
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
  // `ICE.addChild()` 通过 `ice.renderer.markQueueDirty()` 通知结构变化（harness 里手动接上）
  ice.renderer = renderer;
  return { ice, renderer };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

describe('上屏快照盒 arena', () => {
  test('快照值可读，且与组件世界盒一致', () => {
    const { ice, renderer } = makeHarness();
    const a = new ICERect({ left: 10, top: 20, width: 40, height: 30 });
    ice.addChild(a);
    renderFrame(renderer, ice);

    const box: any = renderer.getWorldBox(a);
    expect(box).toBeInstanceOf(Float64Array);
    expect(box.length).toBe(4);
    // 盒是 [minX,minY,maxX,maxY]（含 paint pad，因此只断言包含关系与顺序）
    expect(box[0]).toBeLessThanOrEqual(10);
    expect(box[1]).toBeLessThanOrEqual(20);
    expect(box[2]).toBeGreaterThanOrEqual(50);
    expect(box[3]).toBeGreaterThanOrEqual(50);
  });

  test('未上屏的组件没有槽位（getWorldBox 返回 null）', () => {
    const { renderer } = makeHarness();
    const a = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    expect(renderer.getWorldBox(a)).toBeNull();
    expect(renderer.__snapSlotOf(a)).toBe(-1);
  });

  test('槽位会归还：反复隐藏/显示不会让 arena 无限增长', () => {
    const { ice, renderer } = makeHarness();
    const a = new ICERect({ left: 10, top: 10, width: 20, height: 20 });
    ice.addChild(a);
    renderFrame(renderer, ice);
    expect(renderer.__snapSlotOf(a)).toBeGreaterThanOrEqual(0);

    for (let i = 0; i < 20; i++) {
      a.setState({ display: false }); // 隐藏 → __finalizeHidden 归还槽位
      renderFrame(renderer, ice);
      expect(renderer.__snapSlotOf(a)).toBe(-1);

      a.setState({ display: true });
      renderFrame(renderer, ice);
      expect(renderer.__snapSlotOf(a)).toBeGreaterThanOrEqual(0);
    }
    // 只有一个组件在场，槽位号始终在极小的范围内（归还后被复用）
    expect(renderer.__snapNext).toBeLessThanOrEqual(2);
    expect(renderer.__snapChunks.length).toBeLessThanOrEqual(1);
  });

  test('结构变化后快照整体作废，槽位从 0 重新发号', () => {
    const { ice, renderer } = makeHarness();
    const a = new ICERect({ left: 10, top: 10, width: 20, height: 20 });
    ice.addChild(a);
    renderFrame(renderer, ice);
    expect(renderer.__snap.has(a)).toBe(true);

    ice.addChild(new ICERect({ left: 100, top: 10, width: 20, height: 20 })); // 成员进 → 结构变化
    renderFrame(renderer, ice);

    // 重新 prime 之后每个组件仍然各有自己的盒，且槽位从头分配
    expect(renderer.__snapSlotOf(a)).toBe(0);
    expect(renderer.__snapNext).toBe(2);
  });
});
