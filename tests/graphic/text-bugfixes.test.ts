/**
 * 文本子系统四个「契约级」缺陷的回归（2026-09-13 审计发现）：
 *
 * 1. `style` 透传到 ctx 的属性必须**渲染后归位**（否则漏给同帧后面的组件，破坏
 *    「组件渲染自包含」与脏矩形/离屏缓存的像素契约）；
 * 2. 无 DOM 运行时（小程序 / Node）的光标与编辑按 **grapheme** 移动，且位置对多行 / RTL 正确；
 * 3. 自定义字体**加载完成**后要重新量测已挂载的文本；
 * 4. 「自动尺寸」以**用户是否显式传了 width/height** 判断，而不是拿默认值 10 当哨兵。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return {
    __esModule: true,
    default: {
      createPath2D: () => new Path2DRecorder(),
      loadFont: jest.fn(() => Promise.resolve('ok')),
      document: {
        getElementById: () => null,
        createElement: () => ({
          style: {},
          setAttribute: () => {},
          innerHTML: '',
          offsetWidth: 100,
          offsetHeight: 20,
        }),
        body: { appendChild: () => {}, removeChild: () => {} },
      },
    },
  };
});

import ICE from '../../src/ICE';
import ICEText from '../../src/graphic/text/ICEText';
import root from '../../src/cross-platform/root';
import EventBus from '../../src/event/EventBus';

/** 记录每次 fillText/strokeText 时 ctx 上的关键状态，用来观察「有没有漏给下一个组件」。 */
function makeRecordingCtx(log: any[]): any {
  const ctx: any = {
    font: '',
    textAlign: 'left',
    letterSpacing: '0px',
    textBaseline: 'alphabetic',
    measureText: (s: string) => ({
      width: Array.from(s).length * 10,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    fillText: (t: string) => log.push({ text: t, letterSpacing: ctx.letterSpacing }),
    strokeText: () => {},
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    rect() {},
    fill() {},
    stroke() {},
    clip() {},
    translate() {},
    scale() {},
    rotate() {},
    transform() {},
    setTransform() {},
    resetTransform() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    setLineDash() {},
  };
  return ctx;
}

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.renderer = { markQueueDirty() {}, stop() {}, start() {}, getRenderMode: () => 'full', setRenderMode() {} };
  return ice;
}

describe('文本缺陷回归 1：style 透传的 ctx 状态渲染后归位', () => {
  it('letterSpacing 不会漏给同帧后面绘制的文本', () => {
    const log: any[] = [];
    const ctx = makeRecordingCtx(log);

    const withSpacing = new ICEText({ text: 'A', width: 40, height: 20, style: { letterSpacing: '4px' } });
    const plain = new ICEText({ text: 'B', width: 40, height: 20 });
    (withSpacing as any).ctx = ctx;
    (plain as any).ctx = ctx;

    (withSpacing as any).render();
    expect(ctx.letterSpacing).toBe('0px'); // 渲染结束即归位（旧实现会残留 '4px'）
    (plain as any).render();

    expect(log.map((item) => item.text)).toEqual(['A', 'B']);
    expect(log[0].letterSpacing).toBe('4px'); // 自己这帧生效
    expect(log[1].letterSpacing).toBe('0px'); // 不污染下一个组件
  });
});

describe('文本缺陷回归 2：编辑按 grapheme 移动 + 多行 / RTL 光标位置', () => {
  function editingText(extra: any = {}): ICEText {
    const text = new ICEText({ text: 'a👍b', width: 200, height: 40, editing: true, caretIndex: 3, ...extra });
    (text.state as any).localOrigin = [100, 20];
    (text as any).ctx = makeRecordingCtx([]);
    return text;
  }

  function press(text: ICEText, key: string): void {
    (text as any).keyboardEvtHandler({ type: 'keydown', key });
  }

  it('退格删除整个 emoji（而不是半个代理对）', () => {
    const text = editingText();
    press(text, 'Backspace');
    expect(text.getText()).toBe('ab');
    expect((text.state as any).caretIndex).toBe(1);
  });

  it('左右方向键按 grapheme 跳（跨过 emoji）', () => {
    const text = editingText();
    press(text, 'ArrowLeft');
    expect((text.state as any).caretIndex).toBe(1);
    press(text, 'ArrowRight');
    expect((text.state as any).caretIndex).toBe(3);
  });

  it('多行：光标画在 caretIndex 所在那一行（旧实现全量在一行上量前缀）', () => {
    const text = new ICEText({ text: 'ab\ncd', width: 200, height: 60, editing: true, caretIndex: 4 });
    (text.state as any).localOrigin = [100, 30];
    const strokes: any[] = [];
    const ctx: any = makeRecordingCtx([]);
    ctx.stroke = (): void => undefined;
    ctx.moveTo = (x: number, y: number): void => strokes.push({ x, y });
    ctx.lineTo = (x: number, y: number): void => strokes.push({ x, y });
    (text as any).ctx = ctx;
    (text as any).renderCaret();

    // caret=4 → 第二行第 1 列；x = 左内边距 + measure('c') = -100 + 10
    expect(strokes[0].x).toBeCloseTo(-90, 5);
    // y 落在第二行：textHeight 由量测给出，这里只断言「比第一行低」
    expect(strokes[1].y).toBeGreaterThan(strokes[0].y);
  });

  it('RTL：光标 x 从右边缘往左量', () => {
    const text = new ICEText({
      text: 'שלום',
      width: 200,
      height: 40,
      editing: true,
      caretIndex: 4,
      direction: 'rtl',
      style: { textAlign: 'start', textBaseline: 'middle' },
    });
    (text.state as any).localOrigin = [100, 20];
    (text as any).textHeight = 20;
    const strokes: any[] = [];
    const ctx: any = makeRecordingCtx([]);
    ctx.moveTo = (x: number, y: number): void => strokes.push({ x, y });
    ctx.lineTo = (x: number, y: number): void => strokes.push({ x, y });
    (text as any).ctx = ctx;
    (text as any).renderCaret();

    // rtl + start（物理右对齐）：右边缘 100 − measure('שלום')=40 → 60
    expect(strokes[0].x).toBeCloseTo(60, 5);
  });
});

describe('文本缺陷回归 3：字体加载完成后重测', () => {
  it('loadFont() resolve 后把已挂载文本标脏重测', async () => {
    const ice = makeIce();
    const text: any = new ICEText({ text: '加载前', style: { fontFamily: 'MyFont' } });
    ice.addChild(text);
    text.dirty = false;
    expect(text.__paramsDirty).toBe(true); // 新组件本来就是「待量测」
    text.__paramsDirty = false; // 模拟「已经量测过」的稳态

    await ice.loadFont('MyFont', 'url(my.woff2)');

    expect((root as any).loadFont).toHaveBeenCalledWith('MyFont', 'url(my.woff2)');
    expect(text.__paramsDirty).toBe(true);
    expect(text.dirty).toBe(true);
    expect(ice.dirty).toBe(true);
  });
});

describe('文本缺陷回归 4：自动尺寸不再把「显式 10×10」当哨兵', () => {
  it('显式 width/height 时保持用户尺寸；未传时按量测自适应', () => {
    const pinned = new ICEText({ text: 'hello', width: 10, height: 10 });
    (pinned as any).ctx = makeRecordingCtx([]);
    (pinned as any).measureText();
    expect(pinned.state.width).toBe(10);
    expect(pinned.state.height).toBe(10);

    const auto = new ICEText({ text: 'hello' });
    (auto as any).ctx = makeRecordingCtx([]);
    (auto as any).measureText();
    expect(auto.state.width).toBeGreaterThan(10); // 5 字符 × 10px
  });

  it('setState 显式给尺寸后不再被自动量测改回去（布局管理器写入的尺寸同样生效）', () => {
    const text = new ICEText({ text: 'hello' });
    (text as any).ctx = makeRecordingCtx([]);
    text.setState({ width: 200, height: 80 });
    (text as any).measureText();
    expect(text.state.width).toBe(200);
    expect(text.state.height).toBe(80);
  });
});
