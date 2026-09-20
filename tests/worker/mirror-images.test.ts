/**
 * 镜像的**图片下发**：worker 里没有 `Image` 构造器，带图片的树今天会直接抛错 →
 * 兼容层把整个镜像退回主线程（实测：加一个 `ICEImage` 就 `hostActive: false`）。
 *
 * 这里钉住四件事：
 * ① worker 侧拿到下发过的图片（ImageBitmap）就直接可用；
 * ② 还没下发时不抛、返回"未加载"，等下发后再画（镜像不能因为一张图崩掉整棵树）；
 * ③ 主线程渲染用到图片时，把 URL 交给宿主（宿主在主线程解码 → 零拷贝下发）；
 * ④ 宿主收到请求后用 `createImageBitmap` 解码，同一条 URL 只解码一次。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder(), devicePixelRatio: 1 } };
});

import root from '../../src/cross-platform/root';
import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEImage from '../../src/graphic/ICEImage';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';
import MirrorBridge from '../../src/worker/MirrorBridge';
import MirrorTarget from '../../src/worker/MirrorTarget';
import MirrorHost from '../../src/worker/MirrorHost';
import ImageCache from '../../src/util/ImageCache';
import { MIRROR_PROTOCOL_VERSION } from '../../src/worker/mirror-protocol';
import { registerImageBitmap, imageBitmapOf, clearImageBitmaps } from '../../src/worker/mirror-hooks';

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.serializer = new Serializer(ice);
  ice.deserializer = new Deserializer(ice);
  ice.ctx = { fillStyle: '', drawImage: () => {} };
  ice.canvasWidth = 640;
  ice.canvasHeight = 400;
  ice.renderer = { cache: { isCachable: () => true }, markQueueDirty: () => {}, frameEvtHandler: () => {} };
  // 真实 ICE.init() 会建它（ICE.ts 的 `this.imageCache = new ImageCache(this)`）
  ice.imageCache = new ImageCache(ice);
  return ice;
}

/** 一个"像图片组件"的组件：state.src 是它的图源（与 ICEImage 同口径）。 */
function makeImageHolder(src: string) {
  const c: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
  c.setState({ src });
  return c;
}

describe('镜像图片：worker 侧落地', () => {
  it('下发过的图（ImageBitmap）直接可用，不再走 Image 构造器', () => {
    const ice = makeIce();
    const target = new MirrorTarget(ice);
    const holder = makeImageHolder('https://example.com/a.png');
    ice.addChild(holder);
    holder.dirty = false;
    const bitmap: any = { width: 2, height: 2, __bitmap: true };

    const result: any = target.applyCommand({
      t: 'images',
      v: MIRROR_PROTOCOL_VERSION,
      seq: 1,
      images: [{ key: 'https://example.com/a.png', bitmap }],
    });

    expect(result.added).toBe(1);
    expect(target.appliedImages).toBe(1);
    // 图片缓存拿到的就是那块位图，且"已加载"（ImageBitmap 没有 complete/naturalWidth 那套语义）
    const cached: any = ice.imageCache.setImage('https://example.com/a.png');
    expect(cached.loaded).toBe(true);
    expect(cached.image).toBe(bitmap);
    // 用这张图的组件要被标脏（否则它会停在"没图"的那一帧上）
    expect(holder.dirty).toBe(true);
    expect(ice.dirty).toBe(true);
  });

  it('同一张下发图第二次取用时仍然"已加载"（缓存命中不能退回 Image 的 complete/naturalWidth 判定）', () => {
    const ice = makeIce();
    const target = new MirrorTarget(ice);
    const bitmap: any = { width: 2, height: 2 };
    target.applyImages([{ key: 'K', bitmap }]);

    const first: any = ice.imageCache.setImage('K');
    const second: any = ice.imageCache.setImage('K');

    expect(first.loaded).toBe(true);
    // 关键：第二次走的是"缓存命中"那条分支 —— ImageBitmap 没有 complete / naturalWidth，
    // 用 Image 那套判定会得到 undefined（falsy），组件就永远不画（真实页面实测踩到）
    expect(second.loaded).toBe(true);
    expect(second.image).toBe(bitmap);
  });

  it('worker 侧：下发过的图会被**真的画出来**（drawImage 拿到那块 ImageBitmap）', () => {
    const ice = makeIce();
    const target = new MirrorTarget(ice);
    const bitmap: any = { width: 2, height: 2, __bitmap: true };
    (root as any).createImage = () => {
      throw new Error('worker 里没有 Image 构造器');
    };
    target.applyImages([{ key: 'K', bitmap }]);

    const drawImage = jest.fn();
    const ctx: any = new Proxy(
      { drawImage, canvas: { width: 640, height: 400 } },
      {
        get: (t: any, k: any) => (k in t ? t[k] : () => {}),
        set: (t: any, k: any, v: any) => ((t[k] = v), true),
      }
    );
    const img: any = new ICEImage({ src: 'K', left: 0, top: 0, width: 10, height: 10 });
    ice.addChild(img);

    img.renderTo(ctx);

    expect(drawImage).toHaveBeenCalled();
    expect(drawImage.mock.calls[0][0]).toBe(bitmap);
    delete (root as any).createImage;
  });

  it('运行时不支持 Image、图又还没下发时：不抛，返回未加载（等下发后再画）', () => {
    const ice = makeIce();
    const target = new MirrorTarget(ice);
    // root.createImage 在 worker 里会抛（没有 Image 构造器）——这里显式模拟
    (root as any).createImage = () => {
      throw new Error('当前运行时没有可用的 Image 构造器，无法加载图片。');
    };

    const cached: any = ice.imageCache.setImage('https://example.com/pending.png');

    expect(cached.loaded).toBe(false);
    expect(cached.image).toBe(null);
    expect(target.appliedImages).toBe(0);
    delete (root as any).createImage;
  });
});

describe('镜像图片：主线程请求 → 宿主下发', () => {
  it('主线程与 worker 用**同一份解码结果**：位图注册后两边都走它（缩放绘制也能逐点一致）', () => {
    const ice = makeIce();
    const bitmap: any = { width: 2, height: 2 };
    // 两次 createImageBitmap 的解码结果逐点一致（实测 1:1 / 半尺寸 / 缩放全 0 差异），
    // 所以"主线程留一份、worker 传一份"能给出完全相同的像素
    registerImageBitmap('https://example.com/d.png', bitmap);
    (root as any).createImage = () => {
      throw new Error('不该再走 Image 构造器');
    };

    const cached: any = ice.imageCache.setImage('https://example.com/d.png');

    expect(cached.loaded).toBe(true);
    expect(cached.image).toBe(bitmap);
    delete (root as any).createImage;
    clearImageBitmaps();
  });

  it('镜像已请求、位图还没到时：主线程**不先退回 Image**（否则图片会在位图到达时像素跳变）', () => {
    const ice = makeIce();
    const bridge: any = new MirrorBridge(ice, { send: () => {} });
    ice.__mirrorBridge = bridge;
    let created = 0;
    (root as any).createImage = () => {
      created++;
      return { complete: false, naturalWidth: 0, set src(v: string) {} };
    };

    bridge.recordImageRequest('https://example.com/pending2.png');
    const cached: any = ice.imageCache.setImage('https://example.com/pending2.png');

    expect(cached.loaded).toBe(false);
    expect(cached.image).toBe(null);
    expect({ created, cached }).toEqual({ created: 0, cached: { loaded: false, image: null } });
    delete (root as any).createImage;
  });

  it('渲染用到图片时把 URL 交给宿主（宿主据此解码后零拷贝下发）', () => {
    const ice = makeIce();
    const requested: string[] = [];
    const sent: any[] = [];
    const bridge = new MirrorBridge(ice, {
      send: (msg) => sent.push(msg),
      onImageRequest: (url) => requested.push(url),
    });
    ice.__mirrorBridge = bridge;
    // 主线程有 Image：走常规加载路径，但同时要把 URL 报给宿主
    (root as any).createImage = () => ({ complete: false, naturalWidth: 0, set src(v: string) {} });

    ice.imageCache.setImage('https://example.com/b.png');

    expect(requested).toEqual(['https://example.com/b.png']);
    delete (root as any).createImage;
  });

  it('桥把下发的图片排进消息，并把位图放进 transfer 列表（零拷贝）', () => {
    const ice = makeIce();
    const sent: any[] = [];
    const transfers: any[] = [];
    const bridge = new MirrorBridge(ice, {
      send: (msg, transfer) => {
        sent.push(msg);
        transfers.push(transfer || null);
      },
    });
    const bitmap: any = { width: 2, height: 2 };

    bridge.recordImages([{ key: 'k', bitmap }]);
    bridge.flush();

    const msg = sent.find((m: any) => m.t === 'images');
    expect(msg).toBeDefined();
    expect(msg.images).toEqual([{ key: 'k', bitmap }]);
    expect(transfers[sent.indexOf(msg)]).toEqual([bitmap]);
  });

  it('宿主收到请求 → 解码两份（主线程留一份、给 worker 一份）→ 下发；同一条 URL 只处理一次', async () => {
    clearImageBitmaps();
    const ice = makeIce();
    const worker: any = {
      sent: [],
      postMessage: (msg: any, transfer?: any) => worker.sent.push({ msg, transfer }),
      terminate: () => {},
      onmessage: null,
      onerror: null,
    };
    let decoded = 0;
    const bitmap: any = { width: 4, height: 4, close: () => {} };
    (global as any).fetch = jest.fn(async () => ({ blob: async () => ({ size: 1 }) }));
    (global as any).createImageBitmap = jest.fn(async () => {
      decoded++;
      return bitmap;
    });
    const host = new MirrorHost({
      canvas: { width: 10, height: 10, getContext: () => null },
      ice,
      workerFactory: () => worker,
      autoFrame: false,
      staleTimeout: 0,
    });
    host.start();
    worker.sent.length = 0;

    // 触发两次同 URL 的请求：只应处理一次（两次解码 = 主线程一份 + worker 一份）
    ice.imageCache.setImage('https://example.com/c.png');
    ice.imageCache.setImage('https://example.com/c.png');
    await new Promise((resolve) => setTimeout(resolve, 20));
    // 解码是异步的：宿主把图片排进待发队列并标记"这一帧要画"。
    // 背压下"启动那一帧"还在途，先让它回来，再要一帧把图片冲出去（真实宿主由 rAF 驱动）
    worker.onmessage({
      data: {
        t: 'rendered',
        v: MIRROR_PROTOCOL_VERSION,
        seq: 1,
        bitmap: { close: () => {} },
        stats: { renderMs: 1, components: 1, frames: 1, appliedOps: 0 },
      },
    });
    host.paint();

    expect(decoded).toBe(2); // 主线程一份、随 transfer 发给 worker 一份（两次解码逐点一致）
    // 主线程这边也换用解码好的位图（否则主线程画 Image、worker 画 ImageBitmap，缩放绘制会有差异）
    expect(imageBitmapOf('https://example.com/c.png')).toBeTruthy();
    const imagesMsg = worker.sent.map((e: any) => e.msg).find((m: any) => m && m.t === 'images');
    expect(imagesMsg).toBeDefined();
    expect(imagesMsg.images[0].key).toBe('https://example.com/c.png');
    expect(imagesMsg.images[0].bitmap).toBe(bitmap);
    delete (global as any).fetch;
    delete (global as any).createImageBitmap;
  });
});
