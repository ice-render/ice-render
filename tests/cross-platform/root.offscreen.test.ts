/**
 * root.createOffscreenCanvas / root.devicePixelRatio 平台抽象单测。
 */
import root from '../../src/cross-platform/root';

describe('root 离屏 canvas 平台抽象', () => {
  afterEach(() => {
    delete (global as any).document;
    delete (global as any).OffscreenCanvas;
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

  it('没有 document 但有 OffscreenCanvas：用 OffscreenCanvas（Web Worker 宿主）', () => {
    // worker 里既没有 document 也没有 window/global，只有 self（= globalThis）：
    // 这条分支就是"引擎作为库直接跑在 worker 里"的那条路
    const getContext = jest.fn().mockReturnValue({ offscreen: true });
    const FakeOffscreenCanvas = jest
      .fn()
      .mockImplementation((w: number, h: number) => ({ width: w, height: h, getContext }));
    (global as any).OffscreenCanvas = FakeOffscreenCanvas;

    const result = root.createOffscreenCanvas(320, 240);

    expect(FakeOffscreenCanvas).toHaveBeenCalledWith(320, 240);
    expect(result.canvas.width).toBe(320);
    expect(result.canvas.height).toBe(240);
    expect(result.ctx).toEqual({ offscreen: true });
  });

  it('document 优先于 OffscreenCanvas（主线程上要保住 lang/dir 的字形口径）', () => {
    const docCtx = { from: 'document' };
    const docCanvas: any = { width: 0, height: 0, getContext: () => docCtx };
    (global as any).document = { createElement: () => docCanvas };
    (global as any).OffscreenCanvas = jest.fn();

    const result = root.createOffscreenCanvas(10, 10);

    expect(result.ctx).toBe(docCtx);
    expect((global as any).OffscreenCanvas).not.toHaveBeenCalled();
  });

  it('两者都没有时抛出明确错误（headless 没有离屏 canvas）', () => {
    expect(() => root.createOffscreenCanvas(10, 10)).toThrow(/没有可用的离屏 canvas/);
  });

  it('取根是 globalThis：浏览器 / Web Worker / Node 三种宿主同一个入口', () => {
    // 改造前是 window → global 的双探测，worker 里两者都不存在、取到空对象，
    // 于是宿主必须先 `self.window = self` 伪造全局才跑得起来
    expect(root).toBe(globalThis);
  });

  it('devicePixelRatio 在 headless / 测试桩里兜底为 1', () => {
    expect(root.devicePixelRatio).toBe(1);
  });
});
