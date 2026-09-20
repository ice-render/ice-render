import ICEText from '../../src/graphic/text/ICEText';

jest.mock('../../src/cross-platform/root', () => ({
  __esModule: true,
  default: {
    document: {
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
    },
  },
}));

describe('ICEText.measureText 尺寸计算', () => {
  it('默认宽高自动量测，且不修改 props（保持不可变）', () => {
    const text = new ICEText({ text: 'hello' });
    expect(text.props.width).toBe(10);
    expect(text.props.height).toBe(10);
    expect(text.state.width).toBe(100);
    expect(text.state.height).toBe(20);
  });

  it('显式传入宽高时保留用户值', () => {
    const text = new ICEText({ text: 'hello', width: 820, height: 40 });
    expect(text.props.width).toBe(820);
    expect(text.props.height).toBe(40);
    expect(text.state.width).toBe(820);
    expect(text.state.height).toBe(40);
  });

  it('Canvas 分支用真实字形边界计算尺寸与 padding', () => {
    const text = new ICEText({
      text: 'hello',
      style: { fontSize: 20, paddingTop: 5, paddingBottom: 6, paddingLeft: 3, paddingRight: 4 },
    });
    text.ctx = {
      font: '',
      measureText: (s: string) => ({ width: 12, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 3 }),
    };

    const result = (text as any).measureText();

    expect(result.width).toBe(12 + 3 + 4);
    expect(result.height).toBe(11 + 5 + 6);
    expect(text.state.width).toBe(19);
    expect(text.state.height).toBe(22);
    expect(text.state.textHeight).toBe(11);
  });

  it('Canvas 分支多行高度 = 行距 * 行数（行距不小于字号 × 1.35）', () => {
    const text = new ICEText({ text: 'a\nb', style: { fontSize: 20 } });
    text.ctx = {
      font: '',
      measureText: () => ({ width: 10, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2 }),
    };

    (text as any).measureText();

    // 字形墨迹高 9，但字号 20 → 行距取 27，两行盒子 54
    expect(text.state.textHeight).toBeCloseTo(2 * 20 * 1.35, 4);
    expect(text.state.height).toBeCloseTo(2 * 20 * 1.35, 4);
  });

  /**
   * 量测必须与「ctx 当前处于什么渲染状态」无关。
   *
   * 真机（Chromium）事实：`actualBoundingBoxAscent/Descent` 是**相对当前 `textBaseline`** 报告的 ——
   * `bottom` 基线（引擎默认）下 `rotated` 在 18px Arial 上给出 ascent 16.916 / descent **-3.820**，
   * 而 `alphabetic` 下是 12.885 / 0.211。引擎按「上=ascent、下=descent」拼盒高，负 descent 会被丢掉
   * → 盒高按 16.916 算（正确 13.096）。这个差异**取决于量测发生在哪一帧、在哪个通道**
   *（主画布 / 缓存位图 ctx），于是「同一个组件的世界高度随缓存开关变化」——
   * 症状是缩放视图下开缓存与关缓存的渲染对不上，根因却是文本度量被渲染状态污染。
   *
   * 这里用「按 textBaseline 返回不同度量」的桩 ctx 模拟该行为：无论当前基线是什么，
   * 引擎都必须按 `alphabetic` 的口径量、并在量完把 ctx 原样还原。
   */
  it('量测期间把 ctx 归到 alphabetic 基线，量完原样还原（不受渲染状态污染）', () => {
    const metricAt = (baseline: string) => {
      // 模拟 Chromium：相对当前基线报告，bottom 会把整条盒上移一行高
      const shift = baseline === 'alphabetic' ? 0 : 4;
      return { width: 12, actualBoundingBoxAscent: 12.885 + shift, actualBoundingBoxDescent: 0.211 - shift };
    };
    const seenBaselines: string[] = [];
    let restored: any = null;
    const text = new ICEText({ text: 'rotated', style: { fontSize: 18 } });
    text.ctx = {
      font: '',
      textBaseline: 'bottom',
      getTransform: () => ({ a: 0.57, b: 0.82, c: -0.82, d: 0.57, e: 30, f: 40 }),
      setTransform: (m: any) => {
        restored = m && typeof m === 'object' && 'a' in m ? [m.a, m.e, m.f] : m;
      },
      measureText: function (s: string) {
        seenBaselines.push(this.textBaseline);
        return metricAt(this.textBaseline);
      },
    };

    (text as any).measureText();

    // 量的时候基线必须是 alphabetic（否则盒高会多出 4px）
    expect(seenBaselines.every((b) => b === 'alphabetic')).toBe(true);
    expect(text.state.textHeight).toBeCloseTo(12.885 + 0.211, 4);
    // 量完还原：基线与 CTM 都要回到调用前的样子（调用方可能正处在渲染中途）
    expect((text.ctx as any).textBaseline).toBe('bottom');
    expect(restored).toEqual([0.57, 30, 40]);
  });
});
