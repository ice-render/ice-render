import ICEText from '../../src/graphic/text/ICEText';

// 与 text-measure.test.ts 一致的 root mock：createElement 返回的 div 带 offsetWidth/Height，
// 让 ICEText.measureText 走 DOM 分支拿到确定尺寸，避免依赖真实 canvas。
jest.mock('../../src/cross-platform/root', () => ({
  __esModule: true,
  default: {
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
}));

/**
 * 回归测试：ICEText.doRender 的水平对齐（textAlign）。
 * 旧实现 right/center 直接把文字起点放在 box 左/中/右缘，导致 right 溢出、center 偏右；
 * 修复后按各行真实文字宽度计算起点，实现真正的 flush-right / 水平居中。
 */
describe('ICEText 水平对齐 (textAlign)', () => {
  function renderCaptureX(align: string): number {
    const calls: Array<{ x: number; y: number; ctxAlign: string }> = [];
    const text = new ICEText({
      text: 'hello',
      width: 200,
      height: 40,
      fill: true,
      stroke: false,
      style: { textAlign: align, textBaseline: 'middle' },
    });
    // 直接给定 origin-centered 的 localOrigin，使对齐公式可预测：
    // localOrigin = [width/2, height/2] = [100, 20]
    (text.state as any).localOrigin = [100, 20];
    // mock ctx：捕获 fillText 起点，并提供 __measureFn 所需的 measureText
    const ctx: any = {
      // 真实 canvas 会被 applyStyleToCtx 写进 style.textAlign；这里先按「已被写成 style 值」
      // 预置，用来复现「canvas 二次对齐」的场景。
      textAlign: align,
      font: '',
      measureText: (s: string) => ({ width: 50 }),
      fillText: function (t: string, x: number, y: number) {
        calls.push({ x, y, ctxAlign: this.textAlign });
      },
      strokeText: () => {},
      // 下方为 super.doRender / applyWorldTransform 所需的无副作用占位
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
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    };
    (text as any).ctx = ctx;
    (text as any).doRender();
    expect(calls.length).toBeGreaterThan(0);
    // 手工计算 x 的前提是 ctx 按「文字左边缘」锚定；否则 canvas 会再对齐一次
    expect(calls[0].ctxAlign).toBe('left');
    return calls[0].x;
  }

  it('right：文字右缘贴 box 右内边距（flush-right），不向右溢出', () => {
    // localOrigin[0]=100, lineWidth=50, padR=0 → x = 100 - 50 = 50
    expect(renderCaptureX('right')).toBe(50);
  });

  it('center：文字水平居中（x = -lineWidth/2）', () => {
    // localOrigin 无关；x = -50 / 2 = -25
    expect(renderCaptureX('center')).toBe(-25);
  });

  it('left（默认）：文字左缘贴 box 左内边距', () => {
    // x = -localOrigin[0] + padL = -100
    expect(renderCaptureX('left')).toBe(-100);
  });
});
