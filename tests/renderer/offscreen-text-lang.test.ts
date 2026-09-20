/**
 * **离屏层要跟随主画布的文本语言**（`lang` / `dir`）。
 *
 * 为什么值得一条专门的回归：同一个汉字有多种字形（简 / 繁 / 日 / 韩），Canvas 按元素的
 * **语言**选字形 —— 而引擎对静态层与组件缓存承诺「与主画布**逐像素一致**」（脏矩形、
 * 离屏缓存、像素回归全建立在这条不变量上）。宿主一旦在主画布上显式写了 `lang`，
 * 离屏层不跟随就会画成另一批字形：差异只有几个像素，肉眼几乎看不出，
 * 却会让"逐像素一致"这条契约在最不该红的时候红。
 *
 * 判据分两层，缺一层都可能"看着改了、其实没生效"：
 * 1. `root.createOffscreenCanvas` 把语言镜像到新建的画布上（含**宿主对象写不进去**的降级）；
 * 2. **渲染链路真的把主画布传下去了** —— 静态层与组件缓存两条路径都验。
 */
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEText from '../../src/graphic/text/ICEText';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ObjectCache from '../../src/renderer/ObjectCache';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';

class FakePath2D {
  _commands: any[] = [];
  moveTo(...a: any[]) {
    this._commands.push(a);
  }
  lineTo(...a: any[]) {
    this._commands.push(a);
  }
  rect(...a: any[]) {
    this._commands.push(a);
  }
  arcTo(...a: any[]) {
    this._commands.push(a);
  }
  arc(...a: any[]) {
    this._commands.push(a);
  }
  ellipse(...a: any[]) {
    this._commands.push(a);
  }
  closePath() {}
}

/** 假 canvas 元素：带 lang/dir，getContext 返回一个"什么都能调"的上下文。 */
function makeFakeCanvas(width = 100, height = 100) {
  const noop = () => {};
  const ctx: any = new Proxy(
    {
      canvas: null,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      measureText: (t: string) => ({ width: t.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    },
    {
      get(t, p) {
        if (typeof p === 'symbol') return (t as any)[p];
        if (p in t) return (t as any)[p];
        return noop;
      },
      set(t, p, v) {
        (t as any)[p] = v;
        return true;
      },
    }
  );
  const el: any = {
    width,
    height,
    style: {},
    offscreen: true,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: el.width, height: el.height }),
  };
  ctx.canvas = el;
  return el;
}

const originalDocument = (root as any).document;
const originalWx = (root as any).wx;
const originalCreateOffscreenCanvas = root.createOffscreenCanvas;

afterEach(() => {
  (root as any).document = originalDocument;
  (root as any).wx = originalWx;
  root.createOffscreenCanvas = originalCreateOffscreenCanvas;
});

describe('离屏 canvas 的文本语言镜像', () => {
  it('主画布写了 lang / dir → 新建的离屏画布跟着用同一套', () => {
    const created: any[] = [];
    (root as any).document = {
      createElement: () => {
        const el = makeFakeCanvas();
        created.push(el);
        return el;
      },
    };
    (root as any).wx = undefined;
    const main: any = { lang: 'zh-CN', dir: 'rtl' };

    root.createOffscreenCanvas(10, 10, main);

    expect(created[0].lang).toBe('zh-CN');
    expect(created[0].dir).toBe('rtl');
  });

  it('不给主画布 / 主画布没写 lang → 保持原样（不缺省塞值）', () => {
    const created: any[] = [];
    (root as any).document = {
      createElement: () => {
        const el = makeFakeCanvas();
        created.push(el);
        return el;
      },
    };
    (root as any).wx = undefined;

    root.createOffscreenCanvas(10, 10);
    root.createOffscreenCanvas(10, 10, {});

    expect(created[0].lang).toBeUndefined();
    expect(created[1].lang).toBeUndefined();
  });

  it('没有 document 时抛明确错误（headless 没有离屏 canvas 可用）', () => {
    (root as any).document = undefined;

    expect(() => root.createOffscreenCanvas(10, 10, { lang: 'zh-CN' })).toThrow(/没有可用的离屏 canvas/);
  });
});

describe('渲染链路把主画布传下去（否则镜像逻辑再对也不会生效）', () => {
  function makeHarness() {
    (global as any).Path2D = FakePath2D;
    root.createPath2D = () => new FakePath2D() as any;
    root.devicePixelRatio = 1;

    const offscreen: any[] = [];
    (root as any).wx = undefined;
    (root as any).document = {
      createElement: () => {
        const el = makeFakeCanvas();
        offscreen.push(el);
        return el;
      },
    };

    const mainCanvas = makeFakeCanvas(400, 300);
    mainCanvas.lang = 'zh-CN';

    const ice: any = new ICE();
    ice.childNodes = [];
    ice.toolNodes = [];
    ice.root = root;
    ice.canvasEl = mainCanvas;
    ice.ctx = mainCanvas.getContext('2d');
    ice.canvasWidth = 400;
    ice.canvasHeight = 300;
    ice.evtBus = new EventBus();
    ice.dirty = true;
    return { ice, offscreen, mainCanvas };
  }

  it('静态层：位图建出来时带上了主画布的 lang', () => {
    const { ice, offscreen } = makeHarness();
    const renderer: any = new CanvasRenderer(ice, { renderMode: 'dirty-rect' });
    renderer.start();
    ice.renderer = renderer;

    // 触发条件与 static-layer.test.ts 一致：一大段干净组件 + 本帧脏占比 > 20%
    // （局部重绘不成立）→ 首帧全脏建不了层，第二帧全干净才建层
    for (let i = 0; i < 400; i++) {
      ice.addChild(new ICERect({ left: (i % 40) * 9, top: Math.floor(i / 40) * 7, width: 6, height: 5 }));
    }
    const dirty: any[] = [];
    for (let i = 0; i < 300; i++) {
      const c: any = new ICERect({ left: (i % 30) * 13, top: 300 + Math.floor(i / 30) * 9, width: 6, height: 5 });
      ice.addChild(c);
      dirty.push(c);
    }
    ice.dirty = true;
    renderer.frameEvtHandler();
    dirty.forEach((c) => (c.dirty = false));
    ice.dirty = true;
    renderer.frameEvtHandler();

    // 数组断言：既覆盖"一个离屏层都没建"（空数组会红），也覆盖"建了但没带上 lang"
    const langs = offscreen.map((el) => el.lang);
    expect(langs).toContain('zh-CN');
  });

  it('组件缓存：文本组件的离屏位图也带上了主画布的 lang', () => {
    const { ice, offscreen } = makeHarness();
    const cache: any = new ObjectCache(ice);
    const text: any = new ICEText({ left: 10, top: 10, text: '直骨海', style: { fontSize: 20 } });
    ice.addChild(text);

    cache.render(text);

    const langs = offscreen.map((el) => el.lang);
    expect(langs.length).toBeGreaterThan(0);
    expect([...new Set(langs)]).toEqual(['zh-CN']);
  });
});
