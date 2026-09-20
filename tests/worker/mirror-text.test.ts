/**
 * 镜像的**文本口径**：语言（lang / dir）与字体（FontFace 字节）下发。
 *
 * 为什么需要：worker 里既没有主画布元素可以继承语言，也没有主线程加载过的字体 ——
 * 而引擎对"组件缓存 / 静态层"承诺与主画布**逐像素一致**，字形（简/繁/日汉字）与字体族
 * 一旦分叉，这条承诺就破了。协议把这两样显式推过去，worker 用同一套口径画。
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
import { MIRROR_PROTOCOL_VERSION } from '../../src/worker/mirror-protocol';

function makeTarget() {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.serializer = new Serializer(ice);
  ice.deserializer = new Deserializer(ice);
  ice.ctx = { lang: '', dir: '', fillStyle: '' };
  ice.canvasWidth = 800;
  ice.canvasHeight = 600;
  ice.renderer = { cache: { isCachable: () => true }, markQueueDirty: () => {} };
  return { ice, target: new MirrorTarget(ice) };
}

const textMsg = (lang: string, dir: string) => ({
  t: 'text',
  v: MIRROR_PROTOCOL_VERSION,
  seq: 1,
  lang,
  dir,
});

describe('镜像文本口径：lang / dir 下发', () => {
  afterEach(() => {
    delete (root as any).textLanguage;
  });

  it('applyText 落地到 worker 的 ctx 与 root.textLanguage（缓存 / 静态层的离屏画布也要继承）', () => {
    const { ice, target } = makeTarget();

    const result: any = target.applyCommand(textMsg('zh-Hant', 'rtl'));

    expect(result.lang).toBe('zh-Hant');
    expect(ice.ctx.lang).toBe('zh-Hant');
    expect(ice.ctx.dir).toBe('rtl');
    // 关键：之后的离屏画布（组件缓存 / 静态层）也要带上，否则"逐像素一致"那条承诺会破
    expect((root as any).textLanguage).toEqual({ lang: 'zh-Hant', dir: 'rtl' });
  });
});

describe('镜像文本口径：字体下发', () => {
  afterEach(() => {
    delete (global as any).FontFace;
    delete (global as any).fonts;
    delete (root as any).FontFace;
    delete (root as any).fonts;
  });

  it('applyFonts 用 worker 自己的 FontFace + fonts 注册并 load（字体族与主线程一致）', () => {
    const added: any[] = [];
    const loaded: string[] = [];
    class FakeFontFace {
      constructor(
        public family: string,
        public source: any,
        public descriptors?: any
      ) {}
      load() {
        loaded.push(this.family);
        return Promise.resolve(this);
      }
    }
    (global as any).FontFace = FakeFontFace;
    (root as any).FontFace = FakeFontFace;
    (global as any).fonts = { add: (face: any) => added.push(face) };
    (root as any).fonts = (global as any).fonts;

    const { target } = makeTarget();
    const result: any = target.applyCommand({
      t: 'fonts',
      v: MIRROR_PROTOCOL_VERSION,
      seq: 2,
      fonts: [{ family: 'DemoFont', source: new ArrayBuffer(8), weight: '700' }],
    });

    expect(result.added).toBe(1);
    expect(result.errors).toEqual([]);
    expect(added.map((f) => f.family)).toEqual(['DemoFont']);
    expect(added[0].descriptors).toEqual({ weight: '700' });
    expect(loaded).toEqual(['DemoFont']);
  });

  it('运行时不支持 FontFace / fonts 时如实报错、不抛（兼容保护：字形分叉可解释，页面不能崩）', () => {
    const { target } = makeTarget();

    const result: any = target.applyCommand({
      t: 'fonts',
      v: MIRROR_PROTOCOL_VERSION,
      seq: 2,
      fonts: [{ family: 'DemoFont', source: new ArrayBuffer(8) }],
    });

    expect(result.added).toBe(0);
    expect(result.errors[0]).toContain('FontFace');
  });
});
