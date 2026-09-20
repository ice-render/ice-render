/**
 * 控制面板手柄尺寸**可配置**（原本是写死的私有字段，只有 `//TODO:改成可配置参数`）。
 *
 * 判据分三层，缺一层都可能"看着配上了、其实没生效"：
 * 1. **默认值不变**：不传 options 时，与历史行为逐像素一致（16 / 8 / 60 / 16）；
 * 2. **真的落到手柄上**：配了尺寸之后，`ResizeControl` 的宽高、`RotateControl` 的半径与
 *    偏移、`ICELinkHook` 的边长都跟着变 —— 只断言面板上的字段等于配置值是不够的，
 *    手柄是**构造期**按那个字段建的，字面量抄错一处就静默失效；
 * 3. **非法值退回默认**：0 / 负数 / NaN / 非数字一律退回，避免画出一个看不见也点不中的手柄。
 */
import ICE from '../../src/ICE';
import root from '../../src/cross-platform/root';
import TransformControlPanel from '../../src/control-panel/transform-controls/TransformControlPanel';
import LineControlPanel from '../../src/control-panel/link-controls/LineControlPanel';

jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder(), requestFrame: () => 0 } };
});
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
};

function makeCanvas() {
  const noop = () => {};
  const ctx: any = {
    setTransform: noop,
    clearRect: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    rect: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    clip: noop,
    setLineDash: noop,
    drawImage: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  };
  return {
    width: 800,
    height: 600,
    style: {},
    oncontextmenu: null,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  } as any;
}

const originalRequestFrame = root.requestFrame;
beforeEach(() => {
  root.requestFrame = () => 0; // 阻止真实 rAF 循环
});
afterEach(() => {
  root.requestFrame = originalRequestFrame;
});

describe('控制面板手柄尺寸可配置', () => {
  it('不传 options：默认值与历史行为一致（16 / 8 / 60 / 16）', () => {
    const panel: any = new TransformControlPanel({ left: 0, top: 0, width: 100, height: 100 });
    expect(panel.resizeControlSize).toBe(16);
    expect(panel.rotateControlSize).toBe(8);
    expect(panel.rotateControlOffsetY).toBe(60);
    expect(panel.resizeControlInstanceCache[0].state.width).toBe(16);
    expect(panel.resizeControlInstanceCache[0].state.height).toBe(16);
    expect(panel.rotateControlInstance.state.radius).toBe(8);
    expect(panel.rotateControlInstance.state.top).toBe(-60);

    const line: any = new LineControlPanel({ left: 0, top: 0, width: 100, height: 100 });
    expect(line.controlSize).toBe(16);
    expect(line.startControl.state.width).toBe(16);
    expect(line.endControl.state.width).toBe(16);
  });

  it('构造时传尺寸：手柄按配置的尺寸建出来（不只是字段被赋值）', () => {
    const panel: any = new TransformControlPanel({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      resizeControlSize: 22,
      rotateControlSize: 10,
      rotateControlOffsetY: 72,
    });
    expect(panel.resizeControlInstanceCache[0].state.width).toBe(22);
    expect(panel.resizeControlInstanceCache[0].state.height).toBe(22);
    expect(panel.rotateControlInstance.state.radius).toBe(10);
    expect(panel.rotateControlInstance.state.top).toBe(-72);
    // 旋转手柄水平居中：left = 面板宽/2 − 手柄半径
    expect(panel.rotateControlInstance.state.left).toBe(50 - 10);

    const line: any = new LineControlPanel({ left: 0, top: 0, width: 100, height: 100, controlSize: 24 });
    expect(line.startControl.state.width).toBe(24);
    expect(line.startControl.state.left).toBe(-12); // 以中心定位 → 半个边长
    expect(line.endControl.state.width).toBe(24);
    expect(line.endControl.state.left).toBe(100 - 12);
  });

  it('ICE.init 的 controlPanel 选项透传到两个面板', () => {
    const ice: any = new ICE().init(makeCanvas(), {
      controlPanel: {
        resizeControlSize: 20,
        rotateControlSize: 12,
        rotateControlOffsetY: 80,
        lineControlSize: 18,
      },
    });

    const transform: any = ice.controlPanelManager.transformControlPanel;
    const line: any = ice.controlPanelManager.lineControlPanel;
    expect(transform.resizeControlInstanceCache[0].state.width).toBe(20);
    expect(transform.rotateControlInstance.state.top).toBe(-80);
    expect(line.endControl.state.width).toBe(18);
    ice.destroy();
  });

  it('非法值（0 / 负数 / NaN / 非数字）一律退回默认，不画畸形手柄', () => {
    const panel: any = new TransformControlPanel({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      resizeControlSize: 0,
      rotateControlSize: -3,
      rotateControlOffsetY: Number.NaN,
    });
    expect(panel.resizeControlSize).toBe(16);
    expect(panel.rotateControlSize).toBe(8);
    expect(panel.rotateControlOffsetY).toBe(60);
    expect(panel.resizeControlInstanceCache[0].state.width).toBe(16);

    const line: any = new LineControlPanel({ left: 0, top: 0, width: 100, height: 100, controlSize: 'big' });
    expect(line.controlSize).toBe(16);
    expect(line.startControl.state.width).toBe(16);
  });
});
