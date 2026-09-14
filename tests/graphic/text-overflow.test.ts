/**
 * 文本溢出：**放不下就截断，绝不压字形**。
 *
 * 事故（smart-water 顶部 Message 实测）：`ICEText.doRender()` 把组件宽度当作
 * `ctx.fillText(text, x, y, maxWidth)` 的第四个参数传下去 —— canvas 对 `maxWidth` 的语义是
 * **把字形横向压扁**（不是截断）。于是「报警：生化池溶解氧偏低…」被挤成一团、还溢出面板，
 * 看起来像字体坏了。
 *
 * 现在的口径：文本放不下盒子时按 grapheme 回退 + 省略号（默认 `textOverflow: 'ellipsis'`），
 * 需要「允许溢出」的调用方显式写 `textOverflow: 'clip'`。
 *
 * 桩的 measure：每字符 10px（含尾随字间距，与真实 canvas 的 letterSpacing 语义一致）。
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return {
    __esModule: true,
    default: {
      createPath2D: () => new PolyfillPath2D(),
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

interface DrawCall {
  text: string;
  x: number;
  y: number;
  /** fillText / strokeText 实际收到几个参数 —— 4 个就是传了 maxWidth（会压字形） */
  argCount: number;
}

function makeCtx() {
  const fills: DrawCall[] = [];
  const strokes: DrawCall[] = [];
  const ctx: any = {
    font: '',
    letterSpacing: '0px',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    measureText: (s: string) => {
      const chars = Array.from(String(s));
      const spacing = parseFloat(ctx.letterSpacing) || 0;
      return {
        width: chars.length * 10 + spacing * chars.length,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
      };
    },
    fillText: (t: string, x: number, y: number, ...rest: any[]) =>
      fills.push({ text: t, x, y, argCount: 3 + rest.length }),
    strokeText: (t: string, x: number, y: number, ...rest: any[]) =>
      strokes.push({ text: t, x, y, argCount: 3 + rest.length }),
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
    rotate() {},
    scale() {},
    transform() {},
    setTransform() {},
    resetTransform() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    setLineDash() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  return { ctx, fills, strokes };
}

function render(props: any) {
  const text = new ICEText(props);
  const rec = makeCtx();
  (text as any).ctx = rec.ctx;
  (text as any).measureText();
  (text as any).doRender();
  return { text, ...rec };
}

describe('文本溢出：截断而不是压字形', () => {
  it('不再把宽度当 maxWidth 传给 fillText / strokeText（那会让 canvas 横向压扁字形）', () => {
    const { fills, strokes } = render({
      text: 'abcdefgh',
      width: 50,
      height: 20,
      fill: true,
      stroke: true,
      style: { fontSize: 10 },
    });
    expect(fills[0].argCount).toBe(3);
    expect(strokes[0].argCount).toBe(3);
  });

  it('单行放不下 → 按盒子宽度截断并追加省略号（总宽不超过盒子）', () => {
    // 盒宽 50、每字符 10px → 最多 5 个字符位；'abcd' + '…' 正好 50
    const { fills } = render({
      text: 'abcdefgh',
      width: 50,
      height: 20,
      fill: true,
      stroke: false,
      style: { fontSize: 10 },
    });
    expect(fills.map((c) => c.text)).toEqual(['abcd…']);
  });

  it('放得下就一个字都不动', () => {
    const { fills } = render({
      text: 'abcd',
      width: 50,
      height: 20,
      fill: true,
      stroke: false,
      style: { fontSize: 10 },
    });
    expect(fills.map((c) => c.text)).toEqual(['abcd']);
  });

  it("textOverflow: 'clip' → 不截断（允许溢出，交给调用方自己裁）", () => {
    const { fills } = render({
      text: 'abcdefgh',
      width: 50,
      height: 20,
      fill: true,
      stroke: false,
      textOverflow: 'clip',
      style: { fontSize: 10 },
    });
    expect(fills.map((c) => c.text)).toEqual(['abcdefgh']);
  });

  it('多行文本（\\n）逐行截断，放得下的行不变', () => {
    const { fills } = render({
      text: 'ab\nabcdefgh',
      width: 50,
      height: 40,
      fill: true,
      stroke: false,
      style: { fontSize: 10 },
    });
    expect(fills.map((c) => c.text)).toEqual(['ab', 'abcd…']);
  });

  it('省略号可以自定义（ellipsis）', () => {
    const narrow = render({
      text: 'abcdefgh',
      width: 50,
      height: 20,
      fill: true,
      stroke: false,
      ellipsis: '...',
      style: { fontSize: 10 },
    });
    expect(narrow.fills[0].text.endsWith('...')).toBe(true);
    expect(Array.from(narrow.fills[0].text).length * 10).toBeLessThanOrEqual(50);
  });

  it('按 grapheme 回退：emoji / 组合字符不会被切成半个', () => {
    // '👍' 是 1 个 grapheme、但 String.length 是 2 —— 逐 code unit 回退会切出半个代理对
    const { fills } = render({
      text: '👍👍👍',
      width: 20,
      height: 20,
      fill: true,
      stroke: false,
      style: { fontSize: 10 },
    });
    expect(fills[0].text).toBe('👍…');
  });

  it('自动宽度（调用方没给 width）不截断、也不额外量测', () => {
    const { text, fills } = render({
      text: 'abcdefgh',
      fill: true,
      stroke: false,
      style: { fontSize: 10 },
    });
    expect(fills.map((c) => c.text)).toEqual(['abcdefgh']);
    expect(text.state.lines).toBeFalsy();
  });

  it('wrap 的既有行为不回退：换行 + maxLines 省略号照旧', () => {
    const { fills } = render({
      text: 'aaa bbb ccc ddd',
      width: 70,
      height: 40,
      fill: true,
      stroke: false,
      wrap: true,
      maxLines: 2,
      style: { fontSize: 10 },
    });
    const drawn = fills.map((c) => c.text);
    expect(drawn.length).toBeLessThanOrEqual(2);
    expect(drawn[drawn.length - 1].endsWith('…')).toBe(true);
  });

  it('编辑态不截断（caret / 选区按原始文本算，截断会让光标错位）', () => {
    const { text } = render({
      text: 'abcdefgh',
      width: 50,
      height: 20,
      fill: true,
      stroke: false,
      editing: true,
      style: { fontSize: 10 },
    });
    expect((text as any).getRenderLines().map((l: any) => l.text)).toEqual(['abcdefgh']);
  });

  it('SVG 导出同口径：导出的也是截断后的文本（画布与 SVG 共用 getRenderLines）', () => {
    const { text } = render({
      text: 'abcdefgh',
      width: 50,
      height: 20,
      fill: true,
      stroke: false,
      style: { fontSize: 10 },
    });
    const svg = exportSvg(text);
    expect(svg).toContain('abcd…');
    expect(svg).not.toContain('>abcdefgh<');
  });

  it('同一段文本截两次互不影响（grapheme 缓存不能被就地改坏）', () => {
    // 回归：`splitGraphemes` 曾把缓存数组直接交出去，而截断逻辑用 pop() 就地回退 ——
    // 先用 4 字符宽的省略号截 `abcdefgh`，再用默认 `…` 截同一段文本，第二次会少截几个字。
    const first = render({
      text: 'abcdefgh',
      width: 50,
      height: 20,
      fill: true,
      stroke: false,
      ellipsis: '...',
      style: { fontSize: 10 },
    });
    expect(first.fills[0].text).toBe('ab...');

    const second = render({
      text: 'abcdefgh',
      width: 50,
      height: 20,
      fill: true,
      stroke: false,
      style: { fontSize: 10 },
    });
    expect(second.fills[0].text).toBe('abcd…');
  });
});
