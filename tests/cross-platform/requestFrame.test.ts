/**
 * `root.requestFrame` 的运行时兜底契约。
 *
 * 背景：`root.requestFrame` 直接取 `requestAnimationFrame` 一族，都没有时是 `undefined`；
 * 而 `FrameManager.start()` 无条件调用它 → 在 Node / headless（无 rAF）环境**启动即抛错**，
 * 引擎在那里根本跑不起来（这是 headless 出图的两个阻塞点之一，另一个「文本量测依赖 DOM」
 * 已由 `ICEText` 的「canvas 优先量测 + DOM 降级」解决）。
 *
 * 本用例在 jest 的 node 环境（天然没有 rAF）下验证兜底生效、帧循环可用且能被 stop() 停下。
 */
import root from '../../src/cross-platform/root';
import FrameManager from '../../src/FrameManager';
import ICE_EVENT_NAME_CONSTS from '../../src/consts/ICE_EVENT_NAME_CONSTS';

describe('root.requestFrame 兜底（无 rAF 的运行时）', () => {
  afterEach(() => {
    FrameManager.stop();
    jest.useRealTimers();
  });

  it('node 环境下有兜底实现，且 FrameManager.start() 不抛错', () => {
    expect(typeof (global as any).requestAnimationFrame).toBe('undefined');
    expect(typeof root.requestFrame).toBe('function');
    expect(() => FrameManager.start()).not.toThrow();
  });

  it('兜底用定时器驱动回调（而不是同步立即调用）', () => {
    jest.useFakeTimers();
    const cb = jest.fn();
    root.requestFrame(cb);
    expect(cb).not.toHaveBeenCalled();
    jest.advanceTimersByTime(20);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('帧循环能持续触发 ICE_FRAME_EVENT，stop() 之后停止', () => {
    jest.useFakeTimers();
    const bus: any = { trigger: jest.fn() };
    FrameManager.registerEvtBus(bus);

    FrameManager.start();
    jest.advanceTimersByTime(100);
    const fired = bus.trigger.mock.calls.length;
    expect(fired).toBeGreaterThan(0);
    expect(bus.trigger).toHaveBeenLastCalledWith(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT);

    FrameManager.stop();
    jest.advanceTimersByTime(200);
    expect(bus.trigger.mock.calls.length).toBe(fired); // 停帧后不再增加

    FrameManager.delEvtBus(bus);
  });
});
