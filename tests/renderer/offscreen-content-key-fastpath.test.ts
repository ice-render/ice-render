/**
 * 内容指纹（`contentKey`）的**快速比较路径**契约。
 *
 * 背景：`ObjectCache.render()` 每帧都要回答「这块位图的内容变了没」。原实现是给每个已缓存组件
 * 拼一个 40 段的字符串再 `!==` 比较 —— 实测 2000 个文本动画场景里占 1.29ms/帧（该场景整帧的 21%）。
 * 改造后改为「采样向量 + 逐项比较」，字符串只在真正要重建位图时才拼。
 *
 * 这组用例钉的是**语义不变**（快路径只允许更保守，即多重建，不允许漏重建）：
 * - 任何进指纹的字段变了 → 必须重建位图；
 * - 只改位置（平移动画）→ 复用位图；
 * - 深比较函数的判定必须**严于**字符串比较（字符串不同 ⇒ 判定必须为「不同」）。
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICEText from '../../src/graphic/text/ICEText';
import ICERect from '../../src/graphic/shape/ICERect';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';
import { keyEquals } from '../../src/renderer/ObjectCache';

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
    fillText: noop,
    strokeText: noop,
    setTransform: noop,
    setLineDash: noop,
    drawImage: noop,
    measureText: (t: string) => ({ width: t.length * 10 }),
  };
  root.createPath2D = () => ({
    _commands: [],
    closePath() {},
    moveTo() {},
    lineTo() {},
    rect() {},
    arc() {},
    ellipse() {},
  });
  root.document = {
    getElementById: () => null,
    createElement: () => ({
      style: {},
      setAttribute: () => {},
      contenteditable: false,
      innerHTML: '',
      offsetWidth: 100,
      offsetHeight: 20,
    }),
    body: { appendChild: () => {} },
  };
  root.createOffscreenCanvas = jest.fn().mockReturnValue({ canvas: { offscreen: true }, ctx });
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
  return { ice, renderer };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

/** 计位图重建次数：`build()` 会调 `component.renderTo()`。 */
function countRebuilds(component: any) {
  let n = 0;
  const orig = component.renderTo.bind(component);
  component.renderTo = (...args: any[]) => {
    n++;
    return orig(...args);
  };
  return () => n;
}

describe('内容指纹快速路径', () => {
  beforeEach(() => {
    // node 环境没有 document，文本的 DOM 降级量测会 console.error，这里静音
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('只改位置（平移动画）：复用位图，不重建', () => {
    const { ice, renderer } = makeHarness();
    const text: any = new ICEText({ text: 'hello', left: 10, top: 10, width: 100, height: 20 });
    ice.addChild(text);
    renderFrame(renderer, ice); // prime：建位图
    expect(renderer.cache.has(text)).toBe(true);

    const rebuilds = countRebuilds(text);
    for (let i = 1; i <= 3; i++) {
      text.setState({ left: 10 + i * 4 }, { paramsDirty: false }); // 整数位移 → 可纯平移复用
      renderFrame(renderer, ice);
    }
    expect(rebuilds()).toBe(0);
  });

  it('颜色动画（style.fillStyle）：必须重建位图', () => {
    const { ice, renderer } = makeHarness();
    const text: any = new ICEText({ text: 'hello', left: 10, top: 10, width: 100, height: 20 });
    ice.addChild(text);
    renderFrame(renderer, ice);

    const rebuilds = countRebuilds(text);
    // 动画写值通道会把 style.* 折成嵌套补丁；即便 paramsDirty 为 false，指纹也必须发现变化
    text.setState({ style: { ...text.state.style, fillStyle: '#00ff00' } }, { paramsDirty: false });
    renderFrame(renderer, ice);
    expect(rebuilds()).toBe(1);
  });

  it('进指纹的标量逐个改都必须让位图失效', () => {
    const { renderer } = makeHarness();
    const make = () => new ICEText({ text: 'hello', left: 10, top: 10, width: 100, height: 20 }) as any;
    const base = renderer.cache.contentKey(make());

    // 每个用例都在**全新的实例**上改一个字段：避免 setState 的合并在同一个实例上累积，
    // 也避免「原本没有的键无法被还原」这类干扰。
    const probes: Array<(t: any) => void> = [
      (t) => t.setState({ text: 'hello2' }),
      (t) => t.setState({ fill: false }),
      (t) => t.setState({ stroke: false }),
      (t) => t.setState({ lineDash: [4, 2] }),
      (t) => t.setState({ selectionStart: 1, selectionEnd: 3 }),
      (t) => t.setState({ direction: 'rtl' }),
      (t) => t.setState({ maxLines: 2 }),
      (t) => t.setState({ ellipsis: '...' }),
      (t) => t.setState({ style: { ...t.state.style, lineWidth: 9 } }),
      (t) => t.setState({ style: { ...t.state.style, shadowBlur: 3 } }),
      (t) => t.setState({ style: { ...t.state.style, fillStyle: '#00ff00' } }),
      (t) => t.setState({ style: { ...t.state.style, textDecoration: 'underline' } }),
      (t) => t.setState({ style: { ...t.state.style, letterSpacing: 3 } }),
      // 滤镜是"透传到 ctx"的现代 Canvas 成员（ctx.filter）：它被烤进离屏位图，
      // 漏出指纹就会表现为「改了滤镜画面不动，贴的还是旧位图」
      (t) => t.setState({ style: { ...t.state.style, filter: 'blur(2px)' } }),
    ];
    for (const probe of probes) {
      const t = make();
      probe(t);
      expect(renderer.cache.contentKey(t)).not.toBe(base);
    }

    // 同样的值再设一遍：指纹必须不变（否则每帧都会白重建）
    const same = make();
    same.setState({ text: 'hello', fill: true, stroke: true, lineDash: [] });
    expect(renderer.cache.contentKey(same)).toBe(base);
  });

  it('不进指纹的字段（left/top/transform）不改变指纹', () => {
    const { ice, renderer } = makeHarness();
    const rect: any = new ICERect({ left: 0, top: 0, width: 40, height: 30 });
    const text: any = new ICEText({ text: 'hi', left: 0, top: 0, width: 60, height: 20 });
    ice.addChild(rect);
    ice.addChild(text);
    renderFrame(renderer, ice);

    const base = renderer.cache.contentKey(text);
    text.setState({ left: 100, top: 50 }, { paramsDirty: false });
    text.setState({ transform: { rotate: 30, translate: [5, 5], scale: [1, 1] } }, { paramsDirty: false });
    expect(renderer.cache.contentKey(text)).toBe(base);
  });
});

describe('keyEquals：必须严于字符串比较', () => {
  const cases: Array<[any, any]> = [
    [1, 1],
    [1, 2],
    ['a', 'a'],
    ['a', 'b'],
    [undefined, undefined],
    [undefined, null],
    [0, -0],
    [NaN, NaN],
    [NaN, 1],
    [[], []],
    [
      [1, 2],
      [1, 2],
    ],
    [
      [1, 2],
      [2, 1],
    ],
    [
      [1, 2],
      [1, 2, 3],
    ],
    [
      [
        [0, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 1],
      ],
    ],
    [
      [
        [0, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 2],
      ],
    ],
    [true, false],
    ['', 0],
    [{ a: 1 }, { a: 1 }],
  ];

  it.each(cases)('keyEquals(%p, %p) 与「字符串相等」不冲突', (a, b) => {
    const strEq = stringify(a) === stringify(b);
    // 判定为「相同」时，字符串必须也相同 —— 否则就是漏重建（画面上会出现旧位图）。
    // 写成单个断言而不是 if：条件式断言在用例里意味着「有一半情况根本没验」。
    expect(keyEquals(a, b) && !strEq).toBe(false);
  });

  function stringify(v: any): string {
    return Array.isArray(v) ? JSON.stringify(v) : String(v);
  }
});
