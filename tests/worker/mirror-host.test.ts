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
import { MIRROR_PROTOCOL_VERSION } from '../../src/worker/mirror-protocol';

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

/**
 * 模拟 worker 回一张位图（`rendered`）。
 *
 * 背压之后这是"推进一轮"的唯一方式：宿主发帧 → worker 回位图 → 才允许发下一帧。
 */
function arrive(worker: any, seq: number): void {
  worker.onmessage({
    data: {
      t: 'rendered',
      v: MIRROR_PROTOCOL_VERSION,
      seq,
      bitmap: { close: jest.fn() },
      stats: { renderMs: 1, components: 1, frames: seq, appliedOps: 0 },
    },
  });
}

/** 假画布：2d 上下文记录 drawImage；另提供一个位图渲染上下文用于合成路径。 */
function makeFakeCanvas() {
  const calls: any[] = [];
  const ctx2d: any = {
    // 合成前必须把画布上下文复位（`setTransform` 到单位矩阵 + 复位裁剪/透明度）：
    // 主画布的 2d 上下文里可能还留着上一个组件的 CTM，带着它 drawImage 会让整张位图错位
    transform: [9, 9, 9, 9, 42, 42],
    globalAlpha: 0.5,
    globalCompositeOperation: 'multiply',
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    setTransform: (...a: any[]) => {
      ctx2d.transform = a.length === 6 ? a : [1, 0, 0, 1, 0, 0];
      calls.push(['setTransform', ...a]);
    },
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
    // 回退时要"立刻用主线程重绘一帧"（见 MirrorHost.__fallback），假渲染器补上这个入口
    frameEvtHandler: () => {},
  };
  return { ice, cachableCalls: () => cachableCalls };
}

describe('createGeometryOnlyContext（几何通道）', () => {
  it('守卫：引擎用到的每一个 ctx 成员都登记在几何通道上（漏一个就是真实应用崩溃）', () => {
    // 扫描 src/ 里所有 `ctx.xxx(` / `this.ctx.xxx(` 调用，逐个断言桩上有这个方法。
    // 2026-09-20 的由来：bench 场景没有文字，桩漏了 `fillText` 一直没暴露；
    // 接上 ice-entity-designer 的流程图（真实应用）后当场 `this.ctx.fillText is not a function`。
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(__dirname, '../../src');
    const names = new Set<string>();
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
          walk(full);
        } else if (name.endsWith('.ts')) {
          const text = fs.readFileSync(full, 'utf8');
          const re = /\bctx\.([A-Za-z_$][\w$]*)\s*\(/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(text))) {
            // createXxxGradient 是注释里的占位写法，忽略
            if (m[1] === 'createXxxGradient') continue;
            names.add(m[1]);
          }
        }
      }
    };
    walk(root);
    expect(names.size).toBeGreaterThan(15); // 正则失效就得先修这条，不能空转

    const ctx: any = createGeometryOnlyContext({ measureText: () => ({ width: 1 }) });
    const missing: string[] = [];
    names.forEach((name) => {
      if (typeof ctx[name] !== 'function') missing.push(name);
    });
    expect(`几何通道缺少这些 ctx 成员（真实应用一画到这里就抛）：${missing.join(', ')}`).toBe(
      '几何通道缺少这些 ctx 成员（真实应用一画到这里就抛）：'
    );
  });

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

    const host = new MirrorHost({ canvas, ice, workerFactory: () => worker, autoFrame: false, staleTimeout: 0 });
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
      data: {
        t: 'rendered',
        v: MIRROR_PROTOCOL_VERSION,
        seq: 1,
        bitmap,
        stats: { renderMs: 1, components: 2, frames: 1, appliedOps: 0 },
      },
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
      staleTimeout: 0,
      onBitmap: (bitmap, stats) => seen.push([bitmap, stats.frames]),
    });
    host.start();

    const bitmap: any = { close: jest.fn() };
    worker.onmessage({
      data: {
        t: 'rendered',
        v: MIRROR_PROTOCOL_VERSION,
        seq: 1,
        bitmap,
        stats: { renderMs: 1, components: 1, frames: 7, appliedOps: 0 },
      },
    });
    expect(seen).toEqual([[bitmap, 7]]);
  });

  it('prime()：宿主后接上来时，视口/选择要对齐（否则镜像从默认视口出发，两边看不同区域）', () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const worker = makeFakeWorker();
    // 模拟"应用已经跑了一阵"：视口被缩放过、有选中项
    ice.viewport = { scale: 0.62, tx: 40, ty: 10 };
    const selected = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    ice.addChild(selected);
    ice.selectionList = [selected];

    const host = new MirrorHost({ canvas, ice, workerFactory: () => worker, autoFrame: false, staleTimeout: 0 });
    host.start();

    const types = worker.sent.map((m: any) => m.t);
    expect(types).toContain('scene');
    // 接上来时要把"当前视口/当前选中"一起发过去（否则新镜像从默认视口出发）
    expect(types.includes('viewport') ? 'ok' : `缺 viewport：${types.join(',')}`).toBe('ok');
    expect(types.includes('selection') ? 'ok' : `缺 selection：${types.join(',')}`).toBe('ok');
    const vp = worker.sent.filter((m: any) => m.t === 'viewport')[0];
    expect([vp.scale, vp.tx, vp.ty]).toEqual([0.62, 40, 10]);
  });

  it('stop()：还原落墨通道与位图缓存，并终止 worker', () => {
    const { canvas } = makeFakeCanvas();
    const realCtx: any = { measureText: () => ({ width: 1 }) };
    const { ice } = makeIce(realCtx);
    const worker = makeFakeWorker();
    const host = new MirrorHost({ canvas, ice, workerFactory: () => worker, autoFrame: false, staleTimeout: 0 });
    host.start();
    host.stop();

    expect(ice.ctx).toBe(realCtx);
    expect(worker.terminate).toHaveBeenCalled();
    // 桥也摘了：钩子回到零成本
    expect(ice.__mirrorBridge).toBeNull();
  });

  it('2d 合成路径先复位画布状态（残留 CTM 会让整张位图错位）', () => {
    // 没有位图渲染上下文的宿主：`getContext('bitmaprenderer')` 返回 null → 走 2d 合成
    const calls: any[] = [];
    const ctx2d: any = {
      transform: [2, 0, 0, 2, 30, 40],
      globalAlpha: 0.3,
      globalCompositeOperation: 'multiply',
      save: () => calls.push(['save']),
      restore: () => calls.push(['restore']),
      setTransform: (...a: any[]) => calls.push(['setTransform', ...a]),
      clearRect: (...a: any[]) => calls.push(['clearRect', ...a]),
      drawImage: (...a: any[]) => calls.push(['drawImage', ...a]),
    };
    const canvas: any = {
      width: 640,
      height: 400,
      getContext: (kind: string) => (kind === 'bitmaprenderer' ? null : ctx2d),
    };
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const worker = makeFakeWorker();
    const host = new MirrorHost({ canvas, ice, workerFactory: () => worker, autoFrame: false, staleTimeout: 0 });
    host.start();

    const bitmap: any = { close: jest.fn() };
    worker.onmessage({
      data: {
        t: 'rendered',
        v: MIRROR_PROTOCOL_VERSION,
        seq: 1,
        bitmap,
        stats: { renderMs: 1, components: 1, frames: 1, appliedOps: 0 },
      },
    });

    const order = calls.map((c) => c[0]).filter((n) => n !== 'save' && n !== 'restore');
    expect(order[0]).toBe('setTransform');
    expect(calls.filter((c) => c[0] === 'setTransform')[0]).toEqual(['setTransform', 1, 0, 0, 1, 0, 0]);
    // clearRect / drawImage 必须排在 setTransform 之后（否则就是"带着残留变换合成"）
    expect(order.indexOf('clearRect')).toBeGreaterThan(0);
    expect(order.indexOf('drawImage')).toBeGreaterThan(order.indexOf('clearRect'));
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('空闲门控：没有待发消息、主线程也没脏组件时不发节拍（省 postMessage 与 worker 的一次渲染）', () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const worker = makeFakeWorker();
    // `needsFrame()` 是引擎的空闲判定（脏组件 / 活动动画）；这里显式控制它
    let needs = false;
    ice.needsFrame = () => needs;
    const host = new MirrorHost({ canvas, ice, workerFactory: () => worker, autoFrame: false, staleTimeout: 0 });
    host.start();
    // 启动时那一帧还在路上（背压：至多一帧在途）→ 先让它回来，否则后面的节拍都会被挡住
    arrive(worker, 1);
    worker.sent.length = 0;

    host.frame(1); // 空闲：应跳过
    expect(worker.sent).toHaveLength(0);

    needs = true; // 主线程有脏组件/动画 → 必须发
    host.frame(2);
    expect(worker.sent.map((m: any) => m.t)).toEqual(['frame']);

    arrive(worker, 2);
    needs = false;
    worker.sent.length = 0;
    ice.addChild(new ICERect({ left: 0, top: 0, width: 5, height: 5 }));
    host.frame(3); // 有结构变更排队（v2 起是 add op）→ 必须发
    // 结构增量不需要重建镜像树，所以视口不用补发（补发只发生在真的发了 scene 之后）
    expect(worker.sent.map((m: any) => m.t)).toEqual(['ops', 'frame']);
  });

  it('启动时把文本语言与字体推给 worker（worker 里没有主画布可继承、也没有主线程的字体）', () => {
    const { canvas } = makeFakeCanvas();
    // 主画布上写了语言：汉字字形（简/繁/日）靠它选，worker 侧必须拿到同一口径
    canvas.lang = 'zh-Hant';
    canvas.dir = 'rtl';
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const worker = makeFakeWorker();
    const host = new MirrorHost({
      canvas,
      ice,
      workerFactory: () => worker,
      autoFrame: false,
      staleTimeout: 0,
      fonts: [{ family: 'DemoFont', source: new ArrayBuffer(8), weight: '700' }],
    });
    host.start();

    const types = worker.sent.map((m: any) => m.t);
    const text = worker.sent.find((m: any) => m.t === 'text');
    const fonts = worker.sent.find((m: any) => m.t === 'fonts');
    // jest 的 expect 只接受一个参数（带说明的那种是 Playwright 的）—— 消息里带上实际序列便于排查
    expect({ text, types }).toEqual(expect.objectContaining({ text: expect.any(Object) }));
    expect(text.lang).toBe('zh-Hant');
    expect(text.dir).toBe('rtl');
    expect(fonts).toBeDefined();
    expect(fonts.fonts[0].family).toBe('DemoFont');
    // 必须在首帧之前：worker 是先收 scene 才 boot 的，语言/字体要落在第一张画之前
    expect(types.indexOf('scene')).toBeLessThan(types.indexOf('text'));
    expect(types.indexOf('text')).toBeLessThan(types.indexOf('fonts'));
    expect(types.indexOf('fonts')).toBeLessThan(types.indexOf('frame'));
  });

  it('背压：至多一帧在途 —— 上一帧没回来就不再发，队列不会随交互无限增长', () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const worker = makeFakeWorker();
    ice.needsFrame = () => true;
    const host = new MirrorHost({ canvas, ice, workerFactory: () => worker, autoFrame: false, staleTimeout: 0 });
    host.start();
    arrive(worker, 1);
    worker.sent.length = 0;

    // 连续要帧：只有第一帧真的发出去，后面的只记一个"还想画"（否则 worker 那边会积压成一条长队）
    host.frame(1);
    host.frame(2);
    host.frame(3);
    host.frame(4);
    expect(worker.sent.map((m: any) => m.t)).toEqual(['frame']);

    // 这一帧回来 → 立刻补一帧（补的是"最新状态"，不是把 2/3/4 三帧照样补回来）
    arrive(worker, 2);
    expect(worker.sent.map((m: any) => m.t)).toEqual(['frame', 'frame']);

    // 补帧也在路上时再要帧，同样只记一次
    worker.sent.length = 0;
    host.frame(5);
    host.frame(6);
    expect(worker.sent).toHaveLength(0);
    arrive(worker, 3);
    expect(worker.sent.map((m: any) => m.t)).toEqual(['frame']);
  });

  it('缺少必需参数时明确报错（不静默半残）', () => {
    expect(() => new MirrorHost({ canvas: {}, ice: null as any, workerUrl: 'x' })).toThrow(/ice/);
    expect(() => new MirrorHost({ canvas: null as any, ice: {}, workerUrl: 'x' })).toThrow(/canvas/);
    expect(() => new MirrorHost({ canvas: {}, ice: {} })).toThrow(/workerUrl/);
  });
});

/**
 * **兼容保护：探测 → 握手 → 看门狗 → 回退**。
 *
 * 这一组回答的是"某些浏览器不支持怎么办"：不支持就**根本别接**（画面与从没接过 worker 一致），
 * 接了之后半路死掉也要**自动回退**（还原落墨通道 + 立刻重绘一帧），而不是留一块冻住的画布。
 */
describe('MirrorHost 兼容保护', () => {
  const rootModule: any = require('../../src/cross-platform/root').default;
  const { detectMirrorSupport, describeMirrorSupport } = require('../../src/worker/mirror-support');

  /** 临时改平台能力（root 是模块单例，跑完必须还原） */
  const withCaps = async (caps: any, fn: () => any) => {
    const saved = {
      worker: rootModule.workerSupported,
      offscreen: rootModule.offscreenCanvasSupported,
      imageBitmap: rootModule.imageBitmapSupported,
    };
    if (caps.worker !== undefined) rootModule.workerSupported = caps.worker;
    if (caps.offscreen !== undefined) rootModule.offscreenCanvasSupported = caps.offscreen;
    if (caps.imageBitmap !== undefined) rootModule.imageBitmapSupported = caps.imageBitmap;
    try {
      return await fn();
    } finally {
      rootModule.workerSupported = saved.worker;
      rootModule.offscreenCanvasSupported = saved.offscreen;
      rootModule.imageBitmapSupported = saved.imageBitmap;
    }
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /** 收到消息不发、也不回应 ready 的"哑巴 worker"（模拟脚本 404 / CSP 挡住 / 握手前就卡住） */
  function makeSilentWorker() {
    return { postMessage: jest.fn(), terminate: jest.fn(), onmessage: null as any, onerror: null as any };
  }

  it('探测：三项必要条件任一缺失就算不支持，并给出人能读的原因', async () => {
    await withCaps({ worker: true, offscreen: true, imageBitmap: true }, () => {
      const { canvas } = makeFakeCanvas();
      const support = detectMirrorSupport({ canvas });
      expect(support.supported).toBe(true);
      expect(support.missing).toEqual([]);
      expect(support.caps.worker).toBe(true);
      // bitmapRenderer 是"运行时能力"（在一块临时画布上问的）：jest 里没有 DOM / OffscreenCanvas，
      // 保守为 false —— 它只影响合成路径（退 2d drawImage），不在 missing 里、不致命
      expect(support.caps.bitmapRenderer).toBe(false);
      expect(describeMirrorSupport(support)).toContain('支持');
    });

    await withCaps({ worker: false, offscreen: true, imageBitmap: true }, () => {
      const support = detectMirrorSupport({});
      expect(support.supported).toBe(false);
      expect(support.missing).toEqual(['worker']);
      expect(describeMirrorSupport(support)).toContain('Worker');
    });

    await withCaps({ worker: true, offscreen: false, imageBitmap: true }, () => {
      const support = detectMirrorSupport({});
      expect(support.missing).toEqual(['offscreenCanvas']);
      expect(describeMirrorSupport(support)).toContain('OffscreenCanvas');
    });
  });

  it('能力探测不得在**被测画布**上创建上下文（那会让 transferControlToOffscreen 永久失败）', () => {
    const getContext = jest.fn(() => ({}));
    const canvas: any = { width: 10, height: 10, getContext };
    const support = detectMirrorSupport({ canvas });
    // 探测走一块临时画布；调用方那块必须一个字节都没被碰过
    expect(getContext).not.toHaveBeenCalled();
    // 拿不到临时画布时保守为 false（bitmapRenderer 只是合成路径，缺了不致命）
    expect(support.caps.bitmapRenderer).toBe(false);
  });

  it('不支持时**根本不接管**落墨通道（宿主什么都不用做，主线程渲染照旧）', async () => {
    await withCaps({ worker: false }, async () => {
      const { canvas } = makeFakeCanvas();
      const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
      const originalCtx = ice.ctx;
      const fallbacks: any[] = [];
      const worker = makeSilentWorker();
      const host = new MirrorHost({
        canvas,
        ice,
        workerFactory: () => worker,
        autoFrame: false,
        skipSupportCheck: false, // 显式打开探测（默认给 workerFactory 时会跳过）
        onFallback: (info) => fallbacks.push(info),
      });
      host.start();

      expect(host.fallbackReason).toContain('unsupported:');
      expect(host.fallbackReason).toContain('worker');
      // 关键：ctx 没被换成几何通道、缓存开关没被改、worker 也没被创建
      expect(ice.ctx).toBe(originalCtx);
      expect(ice.renderer.cache.isCachable()).toBe(true);
      expect(worker.postMessage).not.toHaveBeenCalled();
      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0].support.missing).toContain('worker');
      expect(host.support && host.support.supported).toBe(false);
    });
  });

  it('new Worker 抛错（CSP worker-src / file:// / 宿主策略）→ 回退并还原', () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const originalCtx = ice.ctx;
    const repaint = jest.spyOn(ice.renderer, 'frameEvtHandler');
    const fallbacks: any[] = [];
    const savedWorker = (global as any).Worker;
    (global as any).Worker = class {
      constructor() {
        throw new Error('Refused to create a worker: CSP');
      }
    };
    try {
      const host = new MirrorHost({
        canvas,
        ice,
        workerUrl: 'mirror-worker.js',
        skipSupportCheck: true,
        readyTimeout: 0,
        onFallback: (info) => fallbacks.push(info),
      });
      host.start();

      expect(host.fallbackReason).toBe('worker-ctor');
      expect(fallbacks[0].message).toContain('CSP');
      // 回退必须"还原 + 立刻重绘一帧"，否则画布上留的是空白/上一张位图
      expect(ice.ctx).toBe(originalCtx);
      expect(ice.renderer.cache.isCachable()).toBe(true);
      expect(repaint).toHaveBeenCalled();
    } finally {
      (global as any).Worker = savedWorker;
    }
  });

  it('握手超时（脚本 404 / 卡在 importScripts）→ 回退并还原', async () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const originalCtx = ice.ctx;
    const repaint = jest.spyOn(ice.renderer, 'frameEvtHandler');
    const fallbacks: any[] = [];
    const worker = makeSilentWorker();
    const host = new MirrorHost({
      canvas,
      ice,
      workerFactory: () => worker,
      autoFrame: false,
      readyTimeout: 20,
      staleTimeout: 0,
      onFallback: (info) => fallbacks.push(info),
    });
    host.start();
    expect(host.ready).toBe(false);
    await wait(40);

    expect(host.fallbackReason).toBe('ready-timeout');
    expect(ice.ctx).toBe(originalCtx);
    expect(repaint).toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalled();
    expect(fallbacks).toHaveLength(1);
  });

  it('worker 自报没有 OffscreenCanvas / 协议版本不一致 → 回退（并说清是哪一条）', () => {
    const run = (readyMsg: any) => {
      const { canvas } = makeFakeCanvas();
      const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
      const worker = makeSilentWorker();
      const fallbacks: any[] = [];
      const host = new MirrorHost({
        canvas,
        ice,
        workerFactory: () => worker,
        autoFrame: false,
        staleTimeout: 0,
        onFallback: (info) => fallbacks.push(info),
      });
      host.start();
      worker.onmessage({ data: readyMsg });
      return { host, fallbacks };
    };

    const noOffscreen = run({
      t: 'ready',
      v: MIRROR_PROTOCOL_VERSION,
      caps: { offscreen: false, path2d: true, pointerEvents: true },
    });
    expect(noOffscreen.host.fallbackReason).toBe('ready-caps');
    expect(noOffscreen.fallbacks[0].message).toContain('OffscreenCanvas');

    const badVersion = run({
      t: 'ready',
      v: 999,
      caps: { offscreen: true, path2d: true, pointerEvents: true },
    });
    expect(badVersion.host.fallbackReason).toBe('protocol-mismatch');
  });

  it('worker 运行期报错 → 回退并还原（不留一块冻住的画面）', () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const originalCtx = ice.ctx;
    const repaint = jest.spyOn(ice.renderer, 'frameEvtHandler');
    const worker = makeSilentWorker();
    const fallbacks: any[] = [];
    const host = new MirrorHost({
      canvas,
      ice,
      workerFactory: () => worker,
      autoFrame: false,
      readyTimeout: 0,
      staleTimeout: 0,
      onFallback: (info) => fallbacks.push(info),
    });
    host.start();
    worker.onerror({ message: 'boom' });

    expect(host.fallbackReason).toBe('worker-error');
    expect(ice.ctx).toBe(originalCtx);
    expect(ice.renderer.cache.isCachable()).toBe(true);
    expect(repaint).toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('看门狗：有帧在途却迟迟不回 → 判定 worker 已死并回退', async () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    ice.needsFrame = () => true; // 强制"有活要画"，否则空闲门控会把帧挡住
    const worker = makeSilentWorker();
    const fallbacks: any[] = [];
    const host = new MirrorHost({
      canvas,
      ice,
      workerFactory: () => worker,
      autoFrame: false,
      readyTimeout: 0,
      staleTimeout: 40,
      onFallback: (info) => fallbacks.push(info),
    });
    host.start();
    expect(worker.postMessage).toHaveBeenCalled(); // 首帧确实发出去了（在途）
    await wait(300);

    expect(host.fallbackReason).toBe('no-frame');
    expect(fallbacks[0].message).toContain('没有回帧');
  });

  it('fallback: "off" 时只上报、不接管（留给"我自己处理失败"的宿主）', () => {
    const { canvas } = makeFakeCanvas();
    const { ice } = makeIce({ measureText: () => ({ width: 1 }) });
    const savedWorker = (global as any).Worker;
    (global as any).Worker = class {
      constructor() {
        throw new Error('nope');
      }
    };
    const fallbacks: any[] = [];
    try {
      const host = new MirrorHost({
        canvas,
        ice,
        workerUrl: 'x.js',
        skipSupportCheck: true,
        readyTimeout: 0,
        staleTimeout: 0,
        fallback: 'off',
        onFallback: (info) => fallbacks.push(info),
      });
      host.start();
      expect(fallbacks).toHaveLength(1);
      expect(host.fallbackReason).toBe('worker-ctor');
      // 没有自动回退：宿主自己决定什么时候 stop()
      expect(host.running).toBe(true);
      host.stop();
    } finally {
      (global as any).Worker = savedWorker;
    }
  });
});
