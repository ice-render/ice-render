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
});
