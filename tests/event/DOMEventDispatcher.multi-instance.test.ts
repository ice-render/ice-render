/**
 * 事件归属：同页多 ICE 实例（分层渲染 = 两张叠放的 canvas）时，**只有事件真正落在自己 canvas 上**
 * 的实例才处理它。
 *
 * 全局拦截器（DOMEventInterceptor）把原生输入事件广播给**所有**已注册总线；不做归属过滤时：
 * ① 点上层画布会同时驱动下层实例的命中检测（坐标还按各自 rect 算）→ 两层同时被选中；
 * ② 分层里"上层 `pointer-events: none`"就形同虚设 —— 下层会因为事件被广播而照样响应。
 * 规则：**按下的目标（press / wheel）是别的 canvas → 本实例忽略**；目标是自己的 canvas、
 * 自己 canvas 内的元素，或非 canvas（键盘 / 合成事件 / 页面 UI）→ 照旧处理。
 */
import DOMEventDispatcher from '../../src/event/DOMEventDispatcher';
import EventBus from '../../src/event/EventBus';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  // 声明 PointerEvent：走 pointer 输入通道（`ICE_POINTERDOWN`），与浏览器实际一致
  class PointerEvent {}
  return {
    __esModule: true,
    default: {
      createPath2D: () => new PolyfillPath2D(),
      PointerEvent,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  };
});
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
};

const TAG = (name: string, extra: any = {}) => ({ tagName: name.toUpperCase(), ...extra });

function makeIceWithCanvas() {
  const canvasEl: any = TAG('canvas', {
    width: 800,
    height: 600,
    style: {},
    contains: (node: any) => node === canvasEl || (node && node.__owner === canvasEl),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    hasPointerCapture: () => false,
  });
  const ice: any = {
    canvasEl,
    childNodes: [],
    toolNodes: [],
    screenToWorld: (x: number, y: number) => [x, y],
    evtBus: new EventBus(),
  };
  const dispatcher: any = new DOMEventDispatcher(ice);
  dispatcher.start();
  return { ice, dispatcher, canvasEl };
}

describe('多实例事件归属（分层渲染的前提）', () => {
  it('press 落在别人的 canvas 上 → 本实例完全不处理', () => {
    const { ice, dispatcher } = makeIceWithCanvas();
    const dispatchSpy = jest.spyOn(dispatcher, '__dispatch');
    const other = TAG('canvas');

    ice.evtBus.trigger('ICE_POINTERDOWN', { target: other, clientX: 10, clientY: 10, pointerId: 1 });

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('press 落在自己的 canvas 上 → 照旧处理', () => {
    const { ice, dispatcher, canvasEl } = makeIceWithCanvas();
    const dispatchSpy = jest.spyOn(dispatcher, '__dispatch');

    ice.evtBus.trigger('ICE_POINTERDOWN', { target: canvasEl, clientX: 10, clientY: 10, pointerId: 1 });

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('press 落在自己 canvas 内的元素上 → 也算自己的事件', () => {
    const { ice, dispatcher, canvasEl } = makeIceWithCanvas();
    const dispatchSpy = jest.spyOn(dispatcher, '__dispatch');
    const inner = TAG('div', { __owner: canvasEl });

    ice.evtBus.trigger('ICE_POINTERDOWN', { target: inner, clientX: 10, clientY: 10, pointerId: 1 });

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('键盘等非 canvas 目标的事件不受影响', () => {
    const { ice, dispatcher } = makeIceWithCanvas();
    const dispatchSpy = jest.spyOn(dispatcher, '__dispatch');

    ice.evtBus.trigger('ICE_KEYDOWN', { target: TAG('body'), key: 'ArrowLeft' });

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('滚轮同样按归属过滤（分层里上层滚动不该驱动下层）', () => {
    const { ice, dispatcher } = makeIceWithCanvas();
    const dispatchSpy = jest.spyOn(dispatcher, '__dispatch');

    ice.evtBus.trigger('ICE_WHEEL', { target: TAG('canvas'), deltaY: -1, clientX: 5, clientY: 5 });
    expect(dispatchSpy).not.toHaveBeenCalled();

    ice.evtBus.trigger('ICE_WHEEL', { target: (ice as any).canvasEl, deltaY: -1, clientX: 5, clientY: 5 });
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
