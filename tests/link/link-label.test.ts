import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
};

describe('连线标签定位', () => {
  it('2 点直线：标签在端点中点', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      label: 'x',
    });
    expect((line as any).getLabelPosition()).toEqual([50, 25]);
  });

  it('多点折线：标签在中间顶点', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 0],
        [100, 50],
      ],
      label: 'x',
    });
    // 3 点，中间顶点 points[1] = [100,0]，left/top = points[0] = [0,0]
    expect((line as any).getLabelPosition()).toEqual([100, 0]);
  });

  it('label 非空不影响折线顶点', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      label: 'one-to-many',
    });
    expect(line.state.points.length).toBe(2);
    expect(line.state.label).toBe('one-to-many');
  });
});

describe('连线虚线', () => {
  it("lineType 'dashed' 自动转成 lineDash", () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      lineType: 'dashed',
      lineWidth: 2,
    });
    expect(Array.isArray(line.state.lineDash)).toBe(true);
    expect(line.state.lineDash.length).toBeGreaterThan(0);
  });

  it('lineDash 可显式指定', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      lineDash: [20, 10],
    });
    expect(line.state.lineDash).toEqual([20, 10]);
  });

  it('默认 solid：lineDash 为空', () => {
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
    });
    expect(line.state.lineDash).toEqual([]);
  });
});

/**
 * 标签背景框的「量宽时机」回归。
 *
 * 历史缺陷：`drawLabel()` 先 `ctx.measureText(label)` 再设 `ctx.font`。canvas 的 `font` 是
 * **跨调用遗留状态**，于是量到的宽度来自「上一次绘制留下的字体」，背景框与实际字形不符
 * （框过宽或过窄）。修法是把 `ctx.font` 提到 `measureText` 之前。
 *
 * 这里用「宽度随 font 变化」的 ctx 桩把顺序钉死：若 font 未先设好，量出的宽度会明显不同。
 */
describe('连线标签背景框（measureText 时机回归）', () => {
  /** ctx 桩：每字符宽度 = font 里的 px 数，因此「用了哪个字体」可从宽度反推 */
  function recordingCtx(initialFont = '') {
    const events: string[] = [];
    const ctx: any = {
      font: initialFont, // 上一次绘制遗留的字体（模拟真实 ctx 的粘滞状态）
      textAlign: '',
      textBaseline: '',
      fillStyle: '',
      save() {
        events.push('save');
      },
      restore() {
        events.push('restore');
      },
      measureText(text: string) {
        const px = /(\d+)px/.exec(ctx.font);
        events.push(`measureText@${ctx.font}`);
        return { width: px ? Number(px[1]) * text.length : -1 };
      },
      fillRect(_x: number, _y: number, w: number) {
        events.push(`fillRect:w=${w}`);
      },
      fillText(text: string) {
        events.push(`fillText:${text}`);
      },
    };
    return { ctx, events };
  }

  it('先设 font 再 measureText（用遗留字体会量错宽度）', () => {
    const { ctx, events } = recordingCtx('40px 某遗留字体');
    const line: any = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      label: 'abcdef',
      labelStyle: { fontSize: 20 },
    });
    line.ctx = ctx;

    (line as any).drawLabel();

    // 断言之 1：顺序 —— 设置目标字体必须早于量宽
    const setFontIdx = events.findIndex((e) => e === 'measureText@20px Arial');
    expect(setFontIdx).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('measureText@40px 某遗留字体')).toBe(-1);

    // 断言之 2：宽度按 20px × 6 字符 = 120，加左右各 4 padding = 128
    expect(events).toContain('fillRect:w=128');
    expect(events).toContain('fillText:abcdef');

    // save/restore 成对，字体污染不外泄
    expect(events[0]).toBe('save');
    expect(events[events.length - 1]).toBe('restore');
  });

  it('ctx 无 measureText 时退化为 label.length × fontSize', () => {
    const fillRects: number[] = [];
    const ctx: any = {
      font: '',
      save() {},
      restore() {},
      fillStyle: '',
      fillRect(_x: number, _y: number, w: number) {
        fillRects.push(w);
      },
      fillText() {},
    };
    const line: any = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 50],
      ],
      label: 'abcd',
      labelStyle: { fontSize: 10 },
    });
    line.ctx = ctx;

    (line as any).drawLabel();

    // 4 × 10 + 2 × 4 = 48
    expect(fillRects).toEqual([48]);
  });
});
