/**
 * 引擎侧的 i18n 原语（排版职责）：
 * - `wordBreak`：拉丁词不被硬拆、CJK 逐字断 + 禁则（`break-all` 保留旧行为）；
 * - `direction` / `textAlign: 'start' | 'end'`：RTL 文案的基线方向与「阅读起点」对齐，并落到 `ctx.direction`；
 * - 渲染结束把 `direction` 归位（组件渲染自包含铁律）；
 * - SVG 导出口径与画布一致（含 RTL 下 `text-anchor` 语义翻转）。
 *
 * 词条本身归应用层 —— 这里只测「字体之外」的排版行为，不涉及任何文案表。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return {
    __esModule: true,
    default: {
      createPath2D: () => new Path2DRecorder(),
      document: {
        getElementById: () => null,
        createElement: () => ({
          style: {},
          setAttribute: () => {},
          innerHTML: '',
          offsetWidth: 100,
          offsetHeight: 20,
        }),
        body: { appendChild: () => {} },
      },
    },
  };
});

import ICEText from '../../src/graphic/text/ICEText';
import { exportSvg } from '../../src/export/SvgExporter';

/** 每字符 10px 的确定性 ctx 桩（grapheme 数 × 10）。 */
function makeCtx(extra: Record<string, any> = {}): any {
  return {
    font: '',
    textAlign: 'left',
    measureText: (s: string) => ({
      width: Array.from(s).length * 10,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    fillText: () => {},
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
    ...extra,
  };
}

function makeText(props: any = {}): ICEText {
  const text = new ICEText({
    text: 'hello world',
    width: 100,
    height: 40,
    fill: true,
    stroke: false,
    wrap: true,
    ...props,
  });
  (text.state as any).localOrigin = [100, 20];
  (text as any).ctx = makeCtx();
  return text;
}

describe('ICEText · wordBreak 断行策略', () => {
  it('normal（默认）：拉丁词整词换行', () => {
    const text = makeText({ text: 'hello world', width: 70 });
    (text as any).measureText();
    expect((text.state as any).lines).toEqual(['hello', 'world']);
  });

  it('normal：CJK 逐字断', () => {
    const text = makeText({ text: '中文测试', width: 20 });
    (text as any).measureText();
    expect((text.state as any).lines).toEqual(['中文', '测试']);
  });

  it('break-all：保留旧的逐 grapheme 贪心', () => {
    const text = makeText({ text: 'hello world', width: 70, wordBreak: 'break-all' });
    (text as any).measureText();
    expect((text.state as any).lines).toEqual(['hello w', 'orld']);
  });
});

describe('ICEText · direction 与 start/end 对齐', () => {
  it('rtl + textAlign:start → 物理右对齐（阅读起点在右）', () => {
    const text = makeText({
      text: 'שלום',
      wrap: false,
      width: 200,
      direction: 'rtl',
      style: { textAlign: 'start', textBaseline: 'middle' },
    });
    const line = (text as any).getRenderLines()[0];
    // localOrigin[0]=100、行宽 4×10=40、paddingRight=0 → x = 100 - 40
    expect(line.x).toBe(60);
  });

  it('rtl + textAlign:end → 物理左对齐', () => {
    const text = makeText({
      text: 'שלום',
      wrap: false,
      width: 200,
      direction: 'rtl',
      style: { textAlign: 'end', textBaseline: 'middle' },
    });
    expect((text as any).getRenderLines()[0].x).toBe(-100); // -localOrigin[0] + paddingLeft
  });

  it('auto：LTR 文本的 start 仍是左对齐（行为与旧版一致）', () => {
    const text = makeText({
      text: 'hello',
      wrap: false,
      width: 200,
      direction: 'auto',
      style: { textAlign: 'start', textBaseline: 'middle' },
    });
    expect((text as any).getRenderLines()[0].x).toBe(-100);
  });

  it('把解析后的方向写进 ctx.direction，并在渲染结束后归位', () => {
    const text = makeText({
      text: 'שלום',
      wrap: false,
      direction: 'auto',
      style: { textAlign: 'start' },
    });
    const ctx = makeCtx({ direction: 'inherit' });
    (text as any).ctx = ctx;

    (text as any).applyStyleToCtx();
    expect(ctx.direction).toBe('rtl'); // auto → 按首个强方向字符解析

    (text as any).__resetLeakyCtxState();
    expect(ctx.direction).toBe('inherit'); // 归位：不把方向漏给后面的组件
  });

  it('运行时不支持 direction 时跳过（不读、不写、不崩）', () => {
    const text = makeText({ text: 'שלום', wrap: false, direction: 'rtl' });
    const ctx = makeCtx(); // 没有 direction 属性：模拟不支持该成员的运行时（老浏览器 / 测试桩）
    (text as any).ctx = ctx;

    expect(() => (text as any).applyStyleToCtx()).not.toThrow();
    expect('direction' in ctx).toBe(false);
  });
});

describe('ICEText · SVG 导出的方向口径', () => {
  it('RTL 文本带 direction 属性，且 text-anchor 按物理对齐映射', () => {
    const text = makeText({
      text: 'שלום',
      wrap: false,
      width: 200,
      direction: 'rtl',
      style: { textAlign: 'start', textBaseline: 'middle' },
    });
    const svg = exportSvg(text);
    expect(svg).toContain('direction="rtl"');
    // 物理右对齐：RTL 下 SVG 的锚点语义翻转，start 才是右边
    expect(svg).toContain('text-anchor="start"');
  });

  it('LTR 文本不写 direction，左对齐用默认锚点', () => {
    const text = makeText({ text: 'hello', wrap: false, width: 200 });
    const svg = exportSvg(text);
    expect(svg).not.toContain('direction="rtl"');
    expect(svg).toContain('text-anchor="start"');
  });
});
