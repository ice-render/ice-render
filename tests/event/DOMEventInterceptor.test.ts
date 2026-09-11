/**
 * DOMEventInterceptor：全局监听只绑定一套、start 幂等、stop 可解绑、总线运行期增删都能生效。
 *
 * 背景：旧实现每次 init 都会对「全部」事件总线重复 addEventListener，且从不 removeEventListener，
 * 多实例 / React StrictMode 双挂载会不断叠加全局监听并泄漏。本测试锁定修复后的行为。
 *
 * 输入通道：运行时支持 PointerEvent 时只监听 pointer* + 无 pointer 等价物的鼠标事件；
 * 否则回退 mouse* + touch*。两条通道都必须绑定 wheel 与键盘。
 */
import DOMEventInterceptor from '../../src/event/DOMEventInterceptor';
import { buildDomEventList } from '../../src/consts/DOM_EVENT_MAPPING_CONSTS';

const globalRoot: any = global;

describe('DOMEventInterceptor 全局监听生命周期', () => {
  beforeEach(() => {
    globalRoot.addEventListener = jest.fn();
    globalRoot.removeEventListener = jest.fn();
    DOMEventInterceptor.evtBuses.length = 0;
    DOMEventInterceptor.__handlers = null;
    delete globalRoot.PointerEvent;
  });

  afterEach(() => {
    DOMEventInterceptor.evtBuses.length = 0;
    DOMEventInterceptor.__handlers = null;
    delete globalRoot.addEventListener;
    delete globalRoot.removeEventListener;
    delete globalRoot.PointerEvent;
  });

  it('start 幂等：重复调用不会重复绑定监听', () => {
    const expected = buildDomEventList(false).length;
    DOMEventInterceptor.start();
    expect(globalRoot.addEventListener.mock.calls.length).toBe(expected);
    DOMEventInterceptor.start();
    DOMEventInterceptor.start();
    expect(globalRoot.addEventListener.mock.calls.length).toBe(expected);
  });

  it('无 PointerEvent 时回退 mouse + touch 通道（并包含 wheel 与键盘）', () => {
    DOMEventInterceptor.start();
    const names = globalRoot.addEventListener.mock.calls.map((c: any[]) => c[0]);
    expect(names).toEqual(expect.arrayContaining(['mousedown', 'mousemove', 'mouseup', 'click']));
    expect(names).toEqual(expect.arrayContaining(['touchstart', 'touchmove', 'touchend', 'touchcancel']));
    expect(names).toContain('wheel');
    expect(names).toEqual(expect.arrayContaining(['keydown', 'keyup']));
    // 触摸通道下不应监听 pointer*
    expect(names).not.toContain('pointerdown');
    expect(DOMEventInterceptor.__hasPointerEvent).toBe(false);
  });

  it('有 PointerEvent 时走 pointer 通道，并保留无 pointer 等价物的鼠标事件', () => {
    globalRoot.PointerEvent = function () {};
    DOMEventInterceptor.start();
    const names = globalRoot.addEventListener.mock.calls.map((c: any[]) => c[0]);
    expect(names).toEqual(expect.arrayContaining(['pointerdown', 'pointermove', 'pointerup', 'pointercancel']));
    expect(names).toEqual(expect.arrayContaining(['click', 'dblclick', 'contextmenu']));
    expect(names).toContain('wheel');
    expect(names).toEqual(expect.arrayContaining(['keydown', 'keyup']));
    // pointer 通道下不应再监听 mousedown/mousemove/mouseup，避免与 pointer 兼容事件双重触发
    expect(names).not.toContain('mousedown');
    expect(names).not.toContain('mousemove');
    expect(names).not.toContain('mouseup');
    expect(DOMEventInterceptor.__hasPointerEvent).toBe(true);
  });

  it('wheel / touchmove 以 passive:false 绑定（应用层需要能 preventDefault）', () => {
    DOMEventInterceptor.start();
    const wheelCall = globalRoot.addEventListener.mock.calls.filter((c: any[]) => c[0] === 'wheel')[0];
    const touchMoveCall = globalRoot.addEventListener.mock.calls.filter((c: any[]) => c[0] === 'touchmove')[0];
    expect(wheelCall[2]).toEqual({ passive: false });
    expect(touchMoveCall[2]).toEqual({ passive: false });
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

  it('触摸事件转发为 ICE_TOUCH* 内部事件名', () => {
    const bus = { trigger: jest.fn() };
    DOMEventInterceptor.registerEvtBus(bus);
    DOMEventInterceptor.start();

    const handler = globalRoot.addEventListener.mock.calls.filter((c: any[]) => c[0] === 'touchstart')[0][1];
    handler({ type: 'touchstart' });
    expect(bus.trigger).toHaveBeenCalledWith('ICE_TOUCHSTART', expect.anything());
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
    const bound = globalRoot.addEventListener.mock.calls.length;

    DOMEventInterceptor.delEvtBus(bus);

    expect(globalRoot.removeEventListener.mock.calls.length).toBe(bound);
    expect(DOMEventInterceptor.__handlers).toBeNull();
  });

  it('stop 解绑全部监听并清空句柄', () => {
    DOMEventInterceptor.registerEvtBus({ trigger: jest.fn() });
    DOMEventInterceptor.start();
    const bound = globalRoot.addEventListener.mock.calls.length;

    DOMEventInterceptor.stop();

    expect(globalRoot.removeEventListener.mock.calls.length).toBe(bound);
    expect(DOMEventInterceptor.__handlers).toBeNull();
  });

  it('重复注册同一个总线不会产生重复条目', () => {
    const bus = { trigger: jest.fn() };
    DOMEventInterceptor.registerEvtBus(bus);
    DOMEventInterceptor.registerEvtBus(bus);
    expect(DOMEventInterceptor.evtBuses.length).toBe(1);
  });
});
