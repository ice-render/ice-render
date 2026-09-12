/**
 * 右键（contextmenu）回归。
 *
 * 背景：`ICE.init()` 在 canvas 上挂了一个 `oncontextmenu` 来禁用原生菜单，
 * 但它顺手调了 `stopPropagation()` —— 事件不再冒泡到 window，`DOMEventInterceptor`
 * 就收不到，组件永远拿不到 `contextmenu`（右键插旗 / 右键菜单直接失效）。
 *
 * 这里钉死两点：
 * - canvas 上的右键仍然禁用原生菜单（preventDefault）；
 * - 事件继续冒泡（不 stopPropagation）。
 */

function makeCanvasStub() {
  const listeners: Record<string, Array<(evt: any) => void>> = {};
  const canvas: any = {
    width: 400,
    height: 300,
    style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300 }),
    getContext: () => ({ measureText: () => ({ width: 10 }), save() {}, restore() {} }),
    addEventListener(name: string, handler: (evt: any) => void) {
      (listeners[name] = listeners[name] || []).push(handler);
    },
    removeEventListener(name: string, handler: (evt: any) => void) {
      listeners[name] = (listeners[name] || []).filter((item) => item !== handler);
    },
    dispatch(name: string, evt: any) {
      (listeners[name] || []).forEach((handler) => handler(evt));
    },
    parentNode: null,
  };
  return { canvas, listeners };
}

describe('canvas 右键事件', () => {
  it('禁用原生菜单但允许事件继续冒泡', () => {
    const { ICE } = require('../src/index');
    const { canvas } = makeCanvasStub();
    const ice = new ICE();
    ice.init(canvas);

    const evt: any = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };
    canvas.oncontextmenu(evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(evt.stopPropagation).not.toHaveBeenCalled();

    ice.destroy && ice.destroy();
  });
});
