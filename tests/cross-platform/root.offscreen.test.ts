/**
 * root.createOffscreenCanvas / root.devicePixelRatio 平台抽象单测。
 */
import root from '../../src/cross-platform/root';

describe('root 离屏 canvas 平台抽象', () => {
  afterEach(() => {
    delete (global as any).document;
    delete (global as any).wx;
  });

  it('浏览器环境用 document.createElement 创建离屏 canvas 与 2d ctx', () => {
    const getContext = jest.fn().mockReturnValue({ offscreen: true });
    const canvas: any = { width: 0, height: 0, getContext };
    const createElement = jest.fn().mockReturnValue(canvas);
    (global as any).document = { createElement };

    const result = root.createOffscreenCanvas(320, 240);

    expect(createElement).toHaveBeenCalledWith('canvas');
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
    expect(result.canvas).toBe(canvas);
    expect(result.ctx).toEqual({ offscreen: true });
  });

  it('小程序环境走 wx.createOffscreenCanvas({type:2d})', () => {
    const getContext = jest.fn().mockReturnValue({ offscreen: true });
    const canvas: any = { width: 0, height: 0, getContext };
    const createOffscreenCanvas = jest.fn().mockReturnValue(canvas);
    (global as any).wx = { createOffscreenCanvas };

    const result = root.createOffscreenCanvas(100, 200);

    expect(createOffscreenCanvas).toHaveBeenCalledWith({ type: '2d', width: 100, height: 200 });
    expect(result.canvas).toBe(canvas);
    expect(result.ctx).toEqual({ offscreen: true });
  });

  it('无 document / wx 时抛出明确错误', () => {
    expect(() => root.createOffscreenCanvas(10, 10)).toThrow(/没有可用的离屏 canvas/);
  });

  it('devicePixelRatio 在无 wx 环境兜底为 1', () => {
    expect(root.devicePixelRatio).toBe(1);
  });
});
