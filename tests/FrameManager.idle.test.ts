/**
 * 空闲停帧（④-1）：没有"帧需求"时停掉 rAF，有人需要时再唤醒。
 *
 * 背景：`FrameManager` 之前是**无条件续帧**的全局单例 —— 页面静止、没有动画、没有脏组件时，
 * 每帧仍会派发 `ICE_FRAME_EVENT`（每个实例的渲染器/动画管理器都要判一次"没事可做"），
 * 纯耗电。现在：每个总线的**宿主**（ICE 实例）自己回答"这一帧还需要吗"。
 */
jest.mock('../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../src/cross-platform/Path2DRecorder').default;
  return {
    __esModule: true,
    default: {
      createPath2D: () => new Path2DRecorder(),
      requestFrame: jest.fn(),
    },
  };
});

import root from '../src/cross-platform/root';
import FrameManager from '../src/FrameManager';

/** 造一个"总线 + 宿主"：宿主用 `needsFrame` 回答这一帧还要不要继续。 */
function makeBus(needsFrame: () => boolean) {
  const frames: string[] = [];
  const bus = { trigger: (name: string) => frames.push(name) };
  const host = { needsFrame };
  return { bus, host, frames };
}

/** 手动"跑一帧"：取出 root.requestFrame 注册的回调并调用（不依赖真实 rAF）。 */
function runOneFrame(): void {
  const calls = (root.requestFrame as jest.Mock).mock.calls;
  const last = calls[calls.length - 1];
  if (last) {
    last[0]();
  }
}

describe('FrameManager 空闲停帧', () => {
  beforeEach(() => {
    (root.requestFrame as jest.Mock).mockClear();
    FrameManager.evtBuses.length = 0;
    (FrameManager as any).hosts.length = 0;
    FrameManager.stopped = true; // 让 wake() 真的会续帧
  });

  it('有帧需求时持续续帧；需求消失后停帧（不再续）', () => {
    const { bus, host, frames } = makeBus(() => true);
    FrameManager.registerEvtBus(bus, host);
    FrameManager.start();
    expect(root.requestFrame).toHaveBeenCalledTimes(1);

    runOneFrame();
    expect(frames.length).toBe(1);
    expect(root.requestFrame).toHaveBeenCalledTimes(2); // 还需要 → 续帧

    (host as any).needsFrame = () => false;
    runOneFrame();
    expect(frames.length).toBe(2);
    expect(root.requestFrame).toHaveBeenCalledTimes(2); // 空闲 → 停帧，不再续
    expect(FrameManager.stopped).toBe(true);
  });

  it('停帧后再有需求：wake() 让循环重新跑起来', () => {
    const { bus, host } = makeBus(() => false);
    FrameManager.registerEvtBus(bus, host);
    FrameManager.start();
    runOneFrame();
    expect(FrameManager.stopped).toBe(true);

    FrameManager.wake();
    expect(FrameManager.stopped).toBe(false);
    expect(root.requestFrame).toHaveBeenCalledTimes(2);
    runOneFrame();
    // 仍然没有需求 → 又停下
    expect(FrameManager.stopped).toBe(true);
    expect(root.requestFrame).toHaveBeenCalledTimes(2);
  });

  it('wake() 在循环已经跑着时是空操作（不重复注册回调）', () => {
    const { bus, host } = makeBus(() => true);
    FrameManager.registerEvtBus(bus, host);
    FrameManager.start();
    expect(root.requestFrame).toHaveBeenCalledTimes(1);
    FrameManager.wake();
    FrameManager.wake();
    expect(root.requestFrame).toHaveBeenCalledTimes(1);
  });

  it('兼容旧注册方式（不带宿主）：永远认为"需要帧"', () => {
    const bus = { trigger: jest.fn() };
    FrameManager.registerEvtBus(bus);
    FrameManager.start();
    runOneFrame();
    runOneFrame();
    expect(bus.trigger).toHaveBeenCalledTimes(2);
    expect(root.requestFrame).toHaveBeenCalledTimes(3); // 一直续帧
  });

  it('多个总线：只要有一个需要帧就继续跑', () => {
    const idle = makeBus(() => false);
    const busy = makeBus(() => true);
    FrameManager.registerEvtBus(idle.bus, idle.host);
    FrameManager.registerEvtBus(busy.bus, busy.host);
    FrameManager.start();
    runOneFrame();
    expect(FrameManager.stopped).toBe(false);
    expect(root.requestFrame).toHaveBeenCalledTimes(2);
  });

  it('注销总线时一并摘掉宿主（不会留着"孤儿宿主"继续要帧）', () => {
    const { bus, host } = makeBus(() => true);
    FrameManager.registerEvtBus(bus, host);
    FrameManager.delEvtBus(bus);
    expect(FrameManager.evtBuses.length).toBe(0);
    FrameManager.start();
    runOneFrame();
    expect(FrameManager.stopped).toBe(true); // 没有任何总线 → 首帧后即停
  });
});
