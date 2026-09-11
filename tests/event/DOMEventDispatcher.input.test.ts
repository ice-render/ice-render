/**
 * DOMEventDispatcher 输入归一化：pointer / touch / wheel 在派发器边界被统一成
 * canvas 内坐标 + 屏幕位移，并以「原生名 + 鼠标兼容名」双通道派发。
 *
 * 锁定契约：
 * - pointer/touch 的 down/move/up 必须同时以 mousedown/mousemove/mouseup 派发（既有组件零改动）
 * - offsetX/offsetY 一律是 canvas 内坐标（修掉全局监听下相对子元素、滚动后 rect 过期的问题）
 * - 触摸没有原生 movement 时，用「与上一次坐标的差」补算，触摸拖拽因此可用
 * - wheel 只发总线、不派发给上次选中的组件；非移动事件刷新 canvas 矩形，移动事件复用缓存
 */
import EventBus from '../../src/event/EventBus';
import DOMEventDispatcher from '../../src/event/DOMEventDispatcher';

const RECT = { left: 100, top: 50 };

function makeIce() {
  const evtBus = new EventBus();
  const comp: any = {
    state: { zIndex: 1, interactive: true, display: true },
    isControlPanel: false,
    containsPoint: () => true,
    trigger: jest.fn(),
  };
  const ice: any = {
    evtBus,
    childNodes: [comp],
    toolNodes: [],
    canvasBoundingClientRect: RECT,
    updateCanvasBoundingRect: jest.fn(() => RECT),
    screenToWorld: (x: number, y: number) => [x, y],
  };
  return { ice, evtBus, comp };
}

const globalRoot: any = global;

function names(calls: any[], name: string) {
  return calls.filter((c) => c[0] === name);
}

describe('DOMEventDispatcher 输入归一化与双通道派发', () => {
  afterEach(() => {
    delete globalRoot.PointerEvent;
  });

  it('pointerdown：组件同时收到 pointerdown 与兼容的 mousedown，坐标为 canvas 内坐标', () => {
    globalRoot.PointerEvent = function () {};
    const { ice, evtBus, comp } = makeIce();
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_POINTERDOWN', { type: 'pointerdown', clientX: 130, clientY: 90, pointerType: 'mouse' });

    expect(names(comp.trigger.mock.calls, 'pointerdown').length).toBe(1);
    const legacy = names(comp.trigger.mock.calls, 'mousedown');
    expect(legacy.length).toBe(1);
    const evt = legacy[0][1];
    expect(evt.offsetX).toBe(30);
    expect(evt.offsetY).toBe(40);
    expect(evt.pointerType).toBe('mouse');
  });

  it('触摸拖拽：touchmove 以 mousemove 派发，位移由坐标差补算', () => {
    const { ice, evtBus, comp } = makeIce();
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_TOUCHSTART', { type: 'touchstart', touches: [{ clientX: 150, clientY: 100 }] });
    evtBus.trigger('ICE_TOUCHMOVE', { type: 'touchmove', touches: [{ clientX: 170, clientY: 120 }] });

    const moves = names(comp.trigger.mock.calls, 'mousemove');
    expect(moves.length).toBe(1);
    const evt = moves[0][1];
    expect(evt.offsetX).toBe(70);
    expect(evt.offsetY).toBe(70);
    expect(evt.movementX).toBe(20);
    expect(evt.movementY).toBe(20);
    expect(evt.isTouchInput).toBe(true);
  });

  it('touchend：touches 为空时仍能取到坐标并派发 mouseup', () => {
    const { ice, evtBus, comp } = makeIce();
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_TOUCHEND', { type: 'touchend', touches: [], changedTouches: [{ clientX: 110, clientY: 60 }] });

    const ups = names(comp.trigger.mock.calls, 'mouseup');
    expect(ups.length).toBe(1);
    expect(ups[0][1].offsetX).toBe(10);
    expect(ups[0][1].offsetY).toBe(10);
  });

  it('鼠标的 mousedown/mousemove/mouseup 仍是单一通道（不重复派发）', () => {
    const { ice, evtBus, comp } = makeIce();
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 130, clientY: 90 });

    expect(names(comp.trigger.mock.calls, 'mousedown').length).toBe(1);
    expect(comp.trigger.mock.calls.length).toBe(1);
  });

  it('移动事件继承上一次命中结果，不重新做命中检测（高频事件不扫组件树）', () => {
    const { ice, evtBus, comp } = makeIce();
    new DOMEventDispatcher(ice).start();
    const spy = jest.spyOn(comp, 'containsPoint');

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 130, clientY: 90 });
    const afterDown = spy.mock.calls.length;
    evtBus.trigger('ICE_MOUSEMOVE', { type: 'mousemove', clientX: 131, clientY: 91, movementX: 1, movementY: 1 });
    evtBus.trigger('ICE_MOUSEMOVE', { type: 'mousemove', clientX: 132, clientY: 92, movementX: 1, movementY: 1 });

    expect(spy.mock.calls.length).toBe(afterDown);
    // 但 mousemove 仍然要派发给「上次命中」的组件，拖拽才成立
    expect(names(comp.trigger.mock.calls, 'mousemove').length).toBe(2);
  });

  it('wheel 只发总线、不派发给上次选中的组件（视口操作语义）', () => {
    const { ice, evtBus, comp } = makeIce();
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 130, clientY: 90 });
    const busWheel: any[] = [];
    evtBus.on('wheel', (e: any) => busWheel.push(e));

    evtBus.trigger('ICE_WHEEL', { type: 'wheel', clientX: 130, clientY: 90, deltaY: 100 });

    expect(busWheel.length).toBe(1);
    expect(names(comp.trigger.mock.calls, 'wheel').length).toBe(0);
  });

  it('非移动事件刷新 canvas 矩形；移动事件复用缓存（避免每次移动强制布局）', () => {
    const { ice, evtBus } = makeIce();
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 130, clientY: 90 });
    expect(ice.updateCanvasBoundingRect).toHaveBeenCalled();
    const before = ice.updateCanvasBoundingRect.mock.calls.length;

    evtBus.trigger('ICE_MOUSEMOVE', { type: 'mousemove', clientX: 131, clientY: 91, movementX: 1, movementY: 1 });
    expect(ice.updateCanvasBoundingRect.mock.calls.length).toBe(before);
  });

  it('scroll 后 rect 变化，命中检测按新 rect 换算（旧实现只在 init 取一次会整体偏移）', () => {
    const evtBus = new EventBus();
    const hit: any[] = [];
    const comp: any = {
      state: { zIndex: 1, interactive: true, display: true },
      isControlPanel: false,
      containsPoint: (x: number, y: number) => {
        hit.push([x, y]);
        return true;
      },
      trigger: jest.fn(),
    };
    const rects = [
      { left: 100, top: 50 },
      { left: 100, top: 20 },
    ];
    const ice: any = {
      evtBus,
      childNodes: [comp],
      toolNodes: [],
      canvasBoundingClientRect: rects[0],
      updateCanvasBoundingRect: jest.fn(() => rects.shift() || { left: 100, top: 20 }),
      screenToWorld: (x: number, y: number) => [x, y],
    };
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 130, clientY: 90 });
    // 第二次点击前页面滚动了 30px：canvas 内 y 应为 90-20=70
    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 130, clientY: 90 });

    expect(hit[0]).toEqual([30, 40]);
    expect(hit[1]).toEqual([30, 70]);
  });
});
