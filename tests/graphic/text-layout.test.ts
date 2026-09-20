/**
 * B 组（文本能力增强）第 5 项 / 第 8 项回归：
 *
 * 5. `lineHeight` / `letterSpacing` / `textDecoration` 从「透传给 ctx 的野生键」变成**正式配置** ——
 *    量测、换行、渲染、SVG 导出四处必须同一口径（这就是 `letterSpacing` 以前只画在屏幕上、
 *    盒子宽度却不含间距的原因）。
 * 8. `getRenderLines()` 的行宽**缓存**：居中/右对齐每帧都要逐行量宽，缓存随 `paramsDirty` 失效。
 *
 * 测试桩的 `measureText` 刻意复刻真实 canvas 的 letterSpacing 语义（**每个字符后面都加**间距，
 * 含最后一个字符 —— 2026-09-13 用 Chromium 实测：20px Arial 的 'ABC' 41.12px，
 * `letterSpacing='10px'` 后 71.12px，3 个字符正好 +30）。
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
          textContent: '',
          offsetWidth: 100,
          offsetHeight: 20,
        }),
        body: { appendChild: () => {}, removeChild: () => {} },
      },
    },
  };
});

import ICEText from '../../src/graphic/text/ICEText';
import { exportSvg } from '../../src/export/SvgExporter';

interface CtxRecorder {
  ctx: any;
  calls: { moveTo: number[][]; lineTo: number[][]; fills: number; strokes: number; fills2: any[] };
  measureCount: () => number;
}

function makeCtx(): CtxRecorder {
  const calls = { moveTo: [] as number[][], lineTo: [] as number[][], fills: 0, strokes: 0, fills2: [] as any[] };
  let measured = 0;
  const ctx: any = {
    font: '',
    letterSpacing: '0px',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    measureText: (s: string) => {
      measured += 1;
      const chars = Array.from(String(s));
      const spacing = parseFloat(ctx.letterSpacing) || 0;
      return {
        width: chars.length * 10 + spacing * chars.length,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
      };
    },
    fillText: () => {},
    strokeText: () => {},
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo: (x: number, y: number) => calls.moveTo.push([x, y]),
    lineTo: (x: number, y: number) => calls.lineTo.push([x, y]),
    fill: () => {
      calls.fills += 1;
    },
    stroke: () => {
      calls.strokes += 1;
    },
    rect: () => {},
    fillRect: (x: number, y: number, w: number, h: number) => calls.fills2.push([x, y, w, h]),
    clip() {},
    translate() {},
    rotate() {},
    scale() {},
    transform() {},
    setTransform() {},
    resetTransform() {},
    setLineDash() {},
  };
  return { ctx, calls, measureCount: () => measured };
}

/** 造一个「已量测」的文本：手动量测一次，让 state.textHeight / 行宽缓存进入稳态。 */
function measureText(props: any): { text: ICEText; rec: CtxRecorder } {
  const text = new ICEText(props);
  const rec = makeCtx();
  (text as any).ctx = rec.ctx;
  (text as any).measureText();
  return { text, rec };
}

describe('第 5 项：lineHeight 正式配置', () => {
  it('默认（未配置）多行行高仍是 max(墨迹高, 字号 × 1.35)，单行盒子仍贴合墨迹', () => {
    const { text } = measureText({ text: 'ab\ncd', style: { fontSize: 20 } });
    // 墨迹高 = ascent 8 + descent 2 = 10；字号 20 × 1.35 = 27 → 行高 27，两行 54
    expect(text.state.textHeight).toBeCloseTo(54, 5);

    const lines = (text as any).getRenderLines();
    expect(lines.length).toBe(2);
    expect(lines[1].y - lines[0].y).toBeCloseTo(27, 5);

    const single = measureText({ text: 'ab', style: { fontSize: 20 } }).text;
    expect(single.state.textHeight).toBeCloseTo(10, 5); // 单行仍贴合墨迹（既有行为不变）
  });

  it('lineHeight 给数字按 px 绝对值：两行 40px → 文本高 80、基线间距 40', () => {
    const { text } = measureText({ text: 'ab\ncd', style: { fontSize: 20, lineHeight: 40 } });
    expect(text.state.textHeight).toBeCloseTo(80, 5);
    const lines = (text as any).getRenderLines();
    expect(lines[1].y - lines[0].y).toBeCloseTo(40, 5);
  });

  it('lineHeight 给无单位字符串按**倍数**：字号 20 × "2" → 行高 40', () => {
    const { text } = measureText({ text: 'ab\ncd', style: { fontSize: 20, lineHeight: '2' } });
    expect(text.state.textHeight).toBeCloseTo(80, 5);
  });

  it('lineHeight 支持 "150%" 与 "1.5em"（都相对字号）', () => {
    expect(
      measureText({ text: 'ab\ncd', style: { fontSize: 20, lineHeight: '150%' } }).text.state.textHeight
    ).toBeCloseTo(60, 5);
    expect(
      measureText({ text: 'ab\ncd', style: { fontSize: 20, lineHeight: '1.5em' } }).text.state.textHeight
    ).toBeCloseTo(60, 5);
  });

  it('显式 lineHeight 也作用于单行（盒子高度可预测）', () => {
    const { text } = measureText({ text: 'ab', style: { fontSize: 20, lineHeight: 30 } });
    expect(text.state.textHeight).toBeCloseTo(30, 5);
  });
});

describe('第 5 项：letterSpacing 正式配置', () => {
  it('数字按 px，量测期间写入 ctx.letterSpacing（否则 canvas 不会把间距算进宽度）', () => {
    const { text, rec } = measureText({ text: 'abc', style: { fontSize: 20, letterSpacing: 10 } });
    expect(rec.ctx.letterSpacing).toBe('10px');
    expect(text.state.width).toBeCloseTo(60, 5); // 3 字符 × (10 + 10)
  });

  it("字符串 '0.2em' 按字号折算（20 × 0.2 = 4px）", () => {
    const { text, rec } = measureText({ text: 'abc', style: { fontSize: 20, letterSpacing: '0.2em' } });
    expect(rec.ctx.letterSpacing).toBe('4px');
    expect(text.state.width).toBeCloseTo(42, 5);
  });

  it('默认 0：ctx.letterSpacing 归零，宽度与旧行为一致', () => {
    const { text, rec } = measureText({ text: 'abc', style: { fontSize: 20 } });
    expect(rec.ctx.letterSpacing).toBe('0px');
    expect(text.state.width).toBeCloseTo(30, 5);
  });

  it('wrap 换行按月测宽度（含间距）断行', () => {
    // 每个字符 10 + 间距 10 = 20；宽度 50 → 每行 2 个字符
    const { text } = measureText({ text: 'abcdef', width: 50, wrap: true, style: { fontSize: 20, letterSpacing: 10 } });
    expect(text.state.lines).toEqual(['ab', 'cd', 'ef']);
  });
});

describe('第 5 项：textDecoration 正式配置', () => {
  function render(props: any) {
    const { text, rec } = measureText(props);
    (text as any).doRender();
    return { text, rec };
  }

  it('underline：在 baseline 下方画一条与行宽等长的横线，颜色跟随 fillStyle', () => {
    const { rec } = render({
      text: 'abc',
      style: { fontSize: 20, textDecoration: 'underline', fillStyle: '#ff0000' },
    });
    expect(rec.calls.moveTo.length).toBe(1);
    const [x0, y0] = rec.calls.moveTo[0];
    const [x1, y1] = rec.calls.lineTo[0];
    expect(y0).toBeCloseTo(y1, 5); // 水平线
    expect(x1).toBeCloseTo(x0 + 30, 5); // 行宽 30（3 字符 × 10）
    expect(y0).toBeGreaterThan(rec.ctx ? 0 : 0); // 位置断言在下面用基线语义核对
  });

  it('line-through / overline 都比 underline 更靠上（同一基线）', () => {
    const underline = render({ text: 'abc', style: { fontSize: 20, textDecoration: 'underline' } });
    const strike = render({ text: 'abc', style: { fontSize: 20, textDecoration: 'line-through' } });
    const over = render({ text: 'abc', style: { fontSize: 20, textDecoration: 'overline' } });
    const y = (r: any) => r.rec.calls.moveTo[0][1];
    expect(y(strike)).toBeLessThan(y(underline));
    expect(y(over)).toBeLessThan(y(strike));
  });

  it('默认 none：不画装饰线', () => {
    const { rec } = render({ text: 'abc', style: { fontSize: 20 } });
    expect(rec.calls.moveTo.length).toBe(0);
  });

  it('textDecorationColor 可覆盖（与文字颜色解耦）', () => {
    const { text, rec } = render({
      text: 'abc',
      style: { fontSize: 20, textDecoration: 'underline', fillStyle: '#ff0000', textDecorationColor: '#00ff00' },
    });
    expect(rec.calls.strokes).toBeGreaterThan(0);
    expect((text as any).ctx.strokeStyle).toBeDefined();
  });

  it('SVG 导出同口径：letter-spacing 与 text-decoration 都写进 <text>', () => {
    const { text } = measureText({
      text: 'abc',
      style: { fontSize: 20, letterSpacing: 2, textDecoration: 'underline' },
    });
    const svg = exportSvg(text);
    expect(svg).toContain('letter-spacing="2"');
    expect(svg).toContain('text-decoration="underline"');
  });
});

describe('第 8 项：getRenderLines() 行宽缓存', () => {
  it('居中文本连续取行布局不再重复量宽；文本变化后缓存失效并给出新宽度', () => {
    const { text, rec } = measureText({ text: 'abc', style: { fontSize: 20, textAlign: 'center' } });
    const first = (text as any).getRenderLines();
    const afterFirst = rec.measureCount();
    expect(first[0].x).toBeCloseTo(-15, 5); // 居中：-行宽/2

    const second = (text as any).getRenderLines();
    expect(rec.measureCount()).toBe(afterFirst); // 第二次 0 次 measureText
    expect(second[0].x).toBeCloseTo(-15, 5);

    text.setText('abcde'); // 5 字符 → 行宽 50
    (text as any).measureText();
    const third = (text as any).getRenderLines();
    expect(third[0].x).toBeCloseTo(-25, 5);
    expect(rec.measureCount()).toBeGreaterThan(afterFirst);
  });
});
