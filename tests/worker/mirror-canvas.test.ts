/**
 * **直绘模式**（`transferControlToOffscreen`）：主线程把可见画布整块交给 worker，
 * 省掉每帧"位图回传 + 主线程合成"这一跳。
 *
 * 这一组钉住三件事：
 * ① worker 侧拿到 OffscreenCanvas 之后，落墨目标与尺寸都要跟着换过去（`MirrorTarget.attachCanvas`）；
 * ② 宿主要在**转移之前**把落墨通道切成自己的离屏画布（转移之后主线程再也拿不到那块画布的 ctx）；
 * ③ 直绘模式下 worker 不再回传位图，但"帧到了"的水印与统计必须照旧推进
 *   （背压 / 静止态对账都靠它，见 `MirrorHost.renderedSeq`）。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder(), devicePixelRatio: 1 } };
});

import root from '../../src/cross-platform/root';
import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';
import MirrorTarget from '../../src/worker/MirrorTarget';
import MirrorHost from '../../src/worker/MirrorHost';
import { MIRROR_PROTOCOL_VERSION } from '../../src/worker/mirror-protocol';

function makeIce() {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.serializer = new Serializer(ice);
  ice.deserializer = new Deserializer(ice);
  ice.ctx = { fillStyle: '', clearRect: () => {} };
  ice.canvasWidth = 640;
  ice.canvasHeight = 400;
  ice.renderer = {
    cache: { isCachable: () => true, isCachableSource: () => true },
    markQueueDirty: () => {},
    frameEvtHandler: () => {},
  };
  return ice;
}

function makeOffscreen(w: number, h: number) {
  const ctx: any = { fillStyle: '', clearRect: () => {}, lang: '', dir: '' };
  const canvas: any = {
    width: w,
    height: h,
    getContext: (kind: string) => (kind === '2d' ? ctx : null),
    __offscreen: true,
  };
  return { canvas, ctx };
}

describe('MirrorTarget.attachCanvas（worker 侧直绘）', () => {
  it('把落墨目标与尺寸换到 OffscreenCanvas 上，并沿用下发的文本语言', () => {
    const ice = makeIce();
    const target = new MirrorTarget(ice);
    (root as any).textLanguage = { lang: 'zh-CN', dir: 'ltr' };
    const { canvas, ctx } = makeOffscreen(800, 600);

    const result: any = target.applyCommand({
      t: 'attach-canvas',
      v: MIRROR_PROTOCOL_VERSION,
      seq: 3,
      canvas,
    });

    expect(result.attached).toBe(true);
    expect(ice.ctx).toBe(ctx); // 落墨目标换过去了
    expect(ice.canvasWidth).toBe(800);
    expect(ice.canvasHeight).toBe(600);
    expect(target.directCanvas).toBe(canvas);
    // 新画布的 ctx 也要带上文本语言（字形口径与主线程一致）
    expect(ctx.lang).toBe('zh-CN');
  });

  it('形状不对（没有 canvas / 拿不到 2d ctx）时如实返回 false，不抛', () => {
    const ice = makeIce();
    const target = new MirrorTarget(ice);
    expect(
      (target.applyCommand({ t: 'attach-canvas', v: MIRROR_PROTOCOL_VERSION, seq: 1, canvas: null }) as any).attached
    ).toBe(false);
    expect(
      (
        target.applyCommand({
          t: 'attach-canvas',
          v: MIRROR_PROTOCOL_VERSION,
          seq: 1,
          canvas: { getContext: () => null },
        }) as any
      ).attached
    ).toBe(false);
  });
});

describe('MirrorHost 直绘模式（transferCanvas）', () => {
  const makeHostCanvas = () => {
    const transferred: any[] = [];
    const offscreen = makeOffscreen(640, 400);
    const calls: any[] = [];
    const ctx2d: any = {
      measureText: () => ({ width: 1 }),
      save: () => {},
      restore: () => {},
      setTransform: () => {},
      clearRect: () => {},
      drawImage: () => {},
    };
    const canvas: any = {
      width: 640,
      height: 400,
      lang: 'zh-CN',
      getContext: (kind: string) => (kind === '2d' ? ctx2d : null),
      transferControlToOffscreen: () => {
        transferred.push(offscreen.canvas);
        return offscreen.canvas;
      },
    };
    return { canvas, calls, offscreen, transferred };
  };

  const makeFakeWorker = () => {
    const sent: any[] = [];
    const transfers: any[] = [];
    return {
      sent,
      transfers,
      postMessage: (msg: any, transfer?: any) => {
        sent.push(msg);
        transfers.push(transfer || null);
      },
      terminate: () => {},
      onmessage: null as any,
      onerror: null as any,
    };
  };

  it('请求直绘时：**先把落墨通道换成自己的离屏画布**，再把可见画布转移给 worker', () => {
    const { canvas, offscreen } = makeHostCanvas();
    const ice = makeIce();
    const originalCtx = ice.ctx;
    const worker = makeFakeWorker();
    // 主线程侧的离屏画布（几何通道的 measureText 落到它上面）
    const geometry = makeOffscreen(640, 400);
    (root as any).createOffscreenCanvas = () => ({ canvas: geometry.canvas, ctx: geometry.ctx });

    const host = new MirrorHost({
      canvas,
      ice,
      workerFactory: () => worker,
      autoFrame: false,
      staleTimeout: 0,
      transferCanvas: true,
    });
    host.start();

    const attach = worker.sent.find((m: any) => m.t === 'attach-canvas');
    expect(attach).toBeDefined();
    expect(attach.canvas).toBe(offscreen.canvas);
    // 转移列表里必须带上那块画布（否则 worker 拿到的是空壳）
    const idx = worker.sent.indexOf(attach);
    expect(worker.transfers[idx]).toEqual([offscreen.canvas]);
    // 主线程不再用被转移的那块画布做量测：几何通道指向新建的离屏画布
    expect(ice.ctx).not.toBe(originalCtx);
    expect(host.directCanvas).toBe(true);
    // 而且要排在首帧之前（worker 先拿到画布再画）
    expect(worker.sent.map((m: any) => m.t).indexOf('attach-canvas')).toBeLessThan(
      worker.sent.map((m: any) => m.t).lastIndexOf('frame')
    );
  });

  it('运行时不支持 transferControlToOffscreen 时：退回位图模式并如实上报', () => {
    const { canvas } = makeHostCanvas();
    delete canvas.transferControlToOffscreen;
    const ice = makeIce();
    const worker = makeFakeWorker();
    const events: any[] = [];
    const host = new MirrorHost({
      canvas,
      ice,
      workerFactory: () => worker,
      autoFrame: false,
      staleTimeout: 0,
      transferCanvas: true,
      onEvent: (evt) => events.push(evt),
    });
    host.start();

    expect(worker.sent.some((m: any) => m.t === 'attach-canvas')).toBe(false);
    expect(host.directCanvas).toBe(false);
    expect(events.some((e) => e.code === 'MIRROR_CANVAS_TRANSFER_UNSUPPORTED')).toBe(true);
  });

  it('直绘模式下 worker 不回传位图，"帧到了"的水印与统计照旧推进（背压 / 静止态对账靠它）', () => {
    const { canvas } = makeHostCanvas();
    const ice = makeIce();
    const worker = makeFakeWorker();
    const geometry = makeOffscreen(640, 400);
    (root as any).createOffscreenCanvas = () => ({ canvas: geometry.canvas, ctx: geometry.ctx });
    const host = new MirrorHost({
      canvas,
      ice,
      workerFactory: () => worker,
      autoFrame: false,
      staleTimeout: 0,
      transferCanvas: true,
    });
    host.start();
    const before = host.renderedSeq;

    worker.onmessage({
      data: {
        t: 'rendered',
        v: MIRROR_PROTOCOL_VERSION,
        seq: 42,
        stats: { renderMs: 1, components: 1, frames: 1, appliedOps: 0 },
      },
    });

    expect(host.renderedSeq).toBe(42);
    expect(host.renderedSeq).toBeGreaterThan(before);
    expect(host.frames).toBe(1);
    expect(host.stats).toBeTruthy();
  });
});
