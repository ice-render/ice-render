/**
 * `MirrorHost`（主线程侧宿主）的契约。
 *
 * 它做三件容易做错、且做错了会静默劣化的事：
 * ① 把主线程的**落墨**换到"几何通道"（跑管线但不产出像素）—— 命中检测依赖渲染期的世界盒快照，
 *    所以不能简单地把渲染停掉；
 * ② 同时关掉主线程的离屏位图缓存（不产出像素了，缓存只剩白烧 CPU）；
 * ③ `stop()` 时把这两样**原样还原**（宿主可能接着用主线程渲染）。
 *
 * 这里用假 worker + 假画布把这三条钉死，真机行为另有 e2e（worker-mirror.spec.ts）。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});
global.Path2D = class {
  rect() {}
  roundRect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  ellipse() {}
  arc() {}
} as any;

import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICERect from '../../src/graphic/shape/ICERect';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';
import MirrorHost, { createGeometryOnlyContext } from '../../src/worker/MirrorHost';

/** 假 worker：把发出去的消息收进数组，方便断言协议。 */
function makeFakeWorker() {
  const sent: any[] = [];
  return {
    sent,
    postMessage: (msg: any) => sent.push(msg),
    terminate: jest.fn(),
    onmessage: null as any,
    onerror: null as any,
  };
}

/** 假画布：2d 上下文记录 drawImage；另提供一个位图渲染上下文用于合成路径。 */
function makeFakeCanvas() {
  const calls: any[] = [];
  const ctx2d: any = {
    clearRect: (...a: any[]) => calls.push(['clearRect', ...a]),
    drawImage: (...a: any[]) => calls.push(['drawImage', ...a]),
  };
  const bitmapCtx = {
    transferFromImageBitmap: (bmp: any) => calls.push(['transferFromImageBitmap', bmp]),
  };
  const canvas: any = {
    width: 640,
    height: 400,
    getContext: (kind: string) => (kind === 'bitmaprenderer' ? bitmapCtx : ctx2d),
  };
  return { canvas, calls };
}

function makeIce(ctx: any): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.serializer = new Serializer(ice);
  ice.deserializer = new Deserializer(ice);
  ice.ctx = ctx;
  ice.canvasWidth = 640;
  ice.canvasHeight = 400;
  let cachableCalls = 0;
  ice.renderer = {
    cache: {
      isCachable: () => {
        cachableCalls++;
        return true;
      },
    },
    // `addChild` 会通知渲染器重建队列 —— 假渲染器把这个入口补上
    markQueueDirty: () => {},
  };
  return { ice, cachableCalls: () => cachableCalls };
}

describe('createGeometryOnlyContext（几何通道）', () => {
  it('吞掉绘制调用，但把 measureText / 渐变 / 文本状态委派给真实上下文', () => {
    const real: any = {
      font: '12px Arial',
      measureText: (t: string) => ({ width: t.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
      createLinearGradient: () => ({ addColorStop: () => {}, kind: 'real' }),
    };
    const ctx: any = createGeometryOnlyContext(real);

    // 绘制调用吞掉：不抛、也不该碰到真实上下文
    expect(() => {
      ctx.clearRect(0, 0, 10, 10);
      ctx.beginPath();
      ctx.moveTo(1, 1);
      ctx.fill();
      ctx.stroke();
      ctx.drawImage({}, 0, 0);
    }).not.toThrow();

    // 文本：量测必须来自真实上下文（盒高靠它）
    ctx.font = 'bold 18px Arial';
    expect(ctx.measureText('abcd').width).toBe(40);
    expect(real.font).toBe('bold 18px Arial'); // 量测前把文本状态同步过去
    // 渐变：必须返回能 addColorStop 的对象
    expect(typeof ctx.createLinearGradient(0, 0, 1, 1).addColorStop).toBe('function');
  });

  it('没有真实上下文时不抛（极简宿主）', () => {
    const ctx: any = createGeometryOnlyContext(null);
    expect(ctx.measureText('x').width).toBe(0);
    expect(() => ctx.fill()).not.toThrow();
  });
});

describe('MirrorHost', () => {
  it('start()：换落墨通道、关位图缓存、发 resize + scene，并把 worker 位图合成上屏', () => {
    const { canvas, calls } = makeFakeCanvas();
    const realCtx: any = { fillStyle: '', measureText: () => ({ width: 1 }) };
    const { ice, cachableCalls } = makeIce(realCtx);
    ice.addChild(new ICERect({ left: 1, top: 2, width: 30, height: 20 }));
    const worker = makeFakeWorker();

    const host = new MirrorHost({ canvas, ice, workerFactory: () => worker, autoFrame: false });
    host.start();

    // ① 落墨换成了几何通道（不再是原来的 ctx）
    expect(ice.ctx).not.toBe(realCtx);
    expect(typeof ice.ctx.measureText).toBe('function');
    // ② 主线程位图缓存被关掉
    ice.renderer.cache.isCachable();
    expect(cachableCalls()).toBe(0); // 原来的 isCachable 没被调用 = 已被替换
    // ③ 协议：resize + scene
    const types = worker.sent.map((m: any) => m.t);
    expect(types[0]).toBe('resize');
    expect(types).toContain('scene');
    expect(types).toContain('frame');

    // ④ worker 位图 → 合成到可见画布（优先位图渲染上下文）
    const bitmap: any = { close: jest.fn() };
    worker.onmessage({
      data: { t: 'rendered', v: 1, seq: 1, bitmap, stats: { renderMs: 1, components: 2, frames: 1, appliedOps: 0 } },
    });
    expect(calls.some((c) => c[0] === 'transferFromImageBitmap' && c[1] === bitmap)).toBe(true);
    expect(host.frames).toBe(1);
    expect(host.stats && host.stats.components).toBe(2);
  });

  it('onBitmap 在合成之前回调（宿主可拿位图取像素/二次合成）', () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    ice.addChild(new ICERect({ left: 0, top: 0, width: 10, height: 10 }));
    const worker = makeFakeWorker();
    const seen: any[] = [];
    const host = new MirrorHost({
      canvas,
      ice,
      workerFactory: () => worker,
      autoFrame: false,
      onBitmap: (bitmap, stats) => seen.push([bitmap, stats.frames]),
    });
    host.start();

    const bitmap: any = { close: jest.fn() };
    worker.onmessage({
      data: { t: 'rendered', v: 1, seq: 1, bitmap, stats: { renderMs: 1, components: 1, frames: 7, appliedOps: 0 } },
    });
    expect(seen).toEqual([[bitmap, 7]]);
  });

  it('stop()：还原落墨通道与位图缓存，并终止 worker', () => {
    const { canvas } = makeFakeCanvas();
    const realCtx: any = { measureText: () => ({ width: 1 }) };
    const { ice } = makeIce(realCtx);
    const worker = makeFakeWorker();
    const host = new MirrorHost({ canvas, ice, workerFactory: () => worker, autoFrame: false });
    host.start();
    host.stop();

    expect(ice.ctx).toBe(realCtx);
    expect(worker.terminate).toHaveBeenCalled();
    // 桥也摘了：钩子回到零成本
    expect(ice.__mirrorBridge).toBeNull();
  });

  it('空闲门控：没有待发消息、主线程也没脏组件时不发节拍（省 postMessage 与 worker 的一次渲染）', () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const worker = makeFakeWorker();
    // `needsFrame()` 是引擎的空闲判定（脏组件 / 活动动画）；这里显式控制它
    let needs = false;
    ice.needsFrame = () => needs;
    const host = new MirrorHost({ canvas, ice, workerFactory: () => worker, autoFrame: false });
    host.start();
    worker.sent.length = 0;

    host.frame(1); // 空闲：应跳过
    expect(worker.sent).toHaveLength(0);

    needs = true; // 主线程有脏组件/动画 → 必须发
    host.frame(2);
    expect(worker.sent.map((m: any) => m.t)).toEqual(['frame']);

    needs = false;
    worker.sent.length = 0;
    ice.addChild(new ICERect({ left: 0, top: 0, width: 5, height: 5 }));
    host.frame(3); // 有结构变更排队（scene）→ 必须发
    expect(worker.sent.map((m: any) => m.t)).toEqual(['scene', 'frame']);
  });

  it('缺少必需参数时明确报错（不静默半残）', () => {
    expect(() => new MirrorHost({ canvas: {}, ice: null as any, workerUrl: 'x' })).toThrow(/ice/);
    expect(() => new MirrorHost({ canvas: null as any, ice: {}, workerUrl: 'x' })).toThrow(/canvas/);
    expect(() => new MirrorHost({ canvas: {}, ice: {} })).toThrow(/workerUrl/);
  });
});
