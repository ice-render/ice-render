/**
 * LOD 阈值（`setLodMinDeviceArea`）的契约。
 *
 * 背景：可缩放的大画布缩到低倍率时，大量图元只剩一两个设备像素，但它们仍要付完整的每组件成本
 *（真机实测 2.15µs/个）。10 万图元 / 0.1× 下，66,642 个图元落在 4px² 以下，跳过它们实测省 45.9%。
 *
 * 三条契约：
 * 1. **默认关闭**（阈值 0）—— 不改变任何既有像素；
 * 2. 打开后**只跳亚像素图元**（设备面积 < 阈值），正常尺寸的图元照画；
 * 3. 跳过数与 `__lodSkipped` 对得上，且**命中检测不受影响**（命中走世界盒，与画不画无关）。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
} as any;

import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICERect from '../../src/graphic/shape/ICERect';

function makeHarness() {
  const noop = () => {};
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    save: noop,
    restore: noop,
    setTransform: noop,
    beginPath: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    clearRect: noop,
    clip: noop,
    drawImage: noop,
    measureText: () => ({ width: 30 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
  };
  const root = require('../../src/cross-platform/root').default;
  root.createPath2D = () => new (global as any).Path2D();
  root.createOffscreenCanvas = jest.fn().mockReturnValue({ canvas: {}, ctx });
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
  ice.viewport = { scale: 1, tx: 0, ty: 0 };
  ice.getRenderViewport = () => ice.viewport;
  const renderer = new CanvasRenderer(ice);
  ice.renderer = renderer;
  return { ice, renderer };
}

const frame = (ice: any, renderer: any) => {
  ice.dirty = true;
  renderer.frameEvtHandler();
};

describe('LOD：亚像素图元不画（默认关闭）', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('默认关闭：阈值 0 时一个都不跳（既有像素不变）', () => {
    const { ice, renderer } = makeHarness();
    const small = new ICERect({ left: 10, top: 10, width: 2, height: 2, style: { fillStyle: '#333' } });
    const big = new ICERect({ left: 100, top: 100, width: 200, height: 200, style: { fillStyle: '#333' } });
    ice.addChild(small);
    ice.addChild(big);
    frame(ice, renderer);

    expect(renderer.getLodMinDeviceArea()).toBe(0);
    expect(renderer.__lodSkipped).toBe(0);
  });

  it('打开后只跳亚像素图元：小图元跳过、大图元照画', () => {
    const { ice, renderer } = makeHarness();
    const small = new ICERect({ left: 10, top: 10, width: 2, height: 2, style: { fillStyle: '#333' } });
    const big = new ICERect({ left: 100, top: 100, width: 200, height: 200, style: { fillStyle: '#333' } });
    ice.addChild(small);
    ice.addChild(big);
    frame(ice, renderer); // 先 prime 出上屏快照（LOD 靠快照盒算面积）

    // 阈值 50 设备像素²：2×2 的图元（含 paint pad 的墨迹盒约 6×6=36）会被跳，
    // 200×200 的（约 204×204）不会。
    // 阈值 50 设备像素²：2×2 的图元（几何面积 4）会被跳，200×200 的不会。
    renderer.setLodMinDeviceArea(50);
    frame(ice, renderer);
    expect(renderer.__lodSkipped).toBe(1);

    // 放大到 10×：同一个图元变成 20×20 = 400 设备像素² → 不该再被跳
    ice.viewport = { scale: 10, tx: 0, ty: 0 };
    frame(ice, renderer);
    expect(renderer.__lodSkipped).toBe(0);
  });

  it('命中检测不受 LOD 影响（世界盒还在，只是不画）', () => {
    const { ice, renderer } = makeHarness();
    const small = new ICERect({ left: 10, top: 10, width: 20, height: 20, style: { fillStyle: '#333' } });
    ice.addChild(small);
    frame(ice, renderer);
    renderer.setLodMinDeviceArea(50);
    ice.viewport = { scale: 0.1, tx: 0, ty: 0 };
    frame(ice, renderer);
    expect(renderer.__lodSkipped).toBeGreaterThan(0);

    // 视口 0.1×：屏幕 (2,2) → 世界 (20,20)，正落在这个 20×20、位于 (10,10) 的矩形里
    const hit = ice.hitTest(2, 2);
    expect(hit).toBeTruthy();
    expect(hit.props.id).toBe(small.props.id);
  });
});
