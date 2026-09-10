/**
 * DOMEventInterceptor：全局监听只绑定一套、start 幂等、stop 可解绑、总线运行期增删都能生效。
 *
 * 背景：旧实现每次 init 都会对「全部」事件总线重复 addEventListener，且从不 removeEventListener，
 * 多实例 / React StrictMode 双挂载会不断叠加全局监听并泄漏。本测试锁定修复后的行为。
 */
import DOMEventInterceptor from '../../src/event/DOMEventInterceptor';

const globalRoot: any = global;

describe('DOMEventInterceptor 全局监听生命周期', () => {
  beforeEach(() => {
    globalRoot.addEventListener = jest.fn();
    globalRoot.removeEventListener = jest.fn();
    DOMEventInterceptor.evtBuses.length = 0;
    DOMEventInterceptor.__handlers = null;
  });

  afterEach(() => {
    DOMEventInterceptor.evtBuses.length = 0;
    DOMEventInterceptor.__handlers = null;
    delete globalRoot.addEventListener;
    delete globalRoot.removeEventListener;
  });

  it('start 幂等：重复调用不会重复绑定监听（6 鼠标 + 2 键盘 = 8）', () => {
    DOMEventInterceptor.start();
    expect(globalRoot.addEventListener.mock.calls.length).toBe(8);
    DOMEventInterceptor.start();
    DOMEventInterceptor.start();
    expect(globalRoot.addEventListener.mock.calls.length).toBe(8);
  });

  it('事件转发给所有总线，且运行期新增的总线无需重新 start 也能收到', () => {
    const busA = { trigger: jest.fn() };
    const busB = { trigger: jest.fn() };
    DOMEventInterceptor.registerEvtBus(busA);
    DOMEventInterceptor.start();

    const mousedownHandler = globalRoot.addEventListener.mock.calls.filter((c: any[]) => c[0] === 'mousedown')[0][1];
    mousedownHandler({ type: 'mousedown' });
    expect(busA.trigger).toHaveBeenCalledWith('ICE_MOUSEDOWN', expect.anything());

    DOMEventInterceptor.registerEvtBus(busB);
    mousedownHandler({ type: 'mousedown' });
    expect(busB.trigger).toHaveBeenCalledWith('ICE_MOUSEDOWN', expect.anything());
  });

  it('注销其中一个总线后，其余总线不受影响', () => {
    const busA = { trigger: jest.fn() };
    const busB = { trigger: jest.fn() };
    DOMEventInterceptor.registerEvtBus(busA);
    DOMEventInterceptor.registerEvtBus(busB);
    DOMEventInterceptor.start();

    DOMEventInterceptor.delEvtBus(busA);

    const handler = globalRoot.addEventListener.mock.calls.filter((c: any[]) => c[0] === 'keydown')[0][1];
    handler({ type: 'keydown' });
    expect(busA.trigger).not.toHaveBeenCalled();
    expect(busB.trigger).toHaveBeenCalledWith('ICE_KEYDOWN', expect.anything());
  });

  it('注销最后一个总线时自动解绑全局监听', () => {
    const bus = { trigger: jest.fn() };
    DOMEventInterceptor.registerEvtBus(bus);
    DOMEventInterceptor.start();

    DOMEventInterceptor.delEvtBus(bus);

    expect(globalRoot.removeEventListener.mock.calls.length).toBe(8);
    expect(DOMEventInterceptor.__handlers).toBeNull();
  });

  it('stop 解绑全部监听并清空句柄', () => {
    DOMEventInterceptor.registerEvtBus({ trigger: jest.fn() });
    DOMEventInterceptor.start();

    DOMEventInterceptor.stop();

    expect(globalRoot.removeEventListener.mock.calls.length).toBe(8);
    expect(DOMEventInterceptor.__handlers).toBeNull();
  });

  it('重复注册同一个总线不会产生重复条目', () => {
    const bus = { trigger: jest.fn() };
    DOMEventInterceptor.registerEvtBus(bus);
    DOMEventInterceptor.registerEvtBus(bus);
    expect(DOMEventInterceptor.evtBuses.length).toBe(1);
  });
});
