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

  it('Canvas 分支多行高度 = 单行字形高度 * 行数', () => {
    const text = new ICEText({ text: 'a\nb', style: { fontSize: 20 } });
    text.ctx = {
      font: '',
      measureText: () => ({ width: 10, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2 }),
    };

    (text as any).measureText();

    expect(text.state.textHeight).toBe(18);
    expect(text.state.height).toBe(18);
  });
});
