/**
 * DOMEventDispatcher 输入归一化：pointer / touch / wheel 在派发器边界被统一成
 * canvas 内坐标 + 屏幕位移，并以「原生名 + 鼠标兼容名」双通道派发。
 *
 * 锁定契约：
 * - pointer/touch 的 down/move/up 必须同时以 mousedown/mousemove/mouseup 派发（既有组件零改动）
 * - offsetX/offsetY 一律是 canvas 内坐标（修掉全局监听下相对子元素、滚动后 rect 过期的问题）
 * - 触摸没有原生 movement 时，用「与上一次坐标的差」补算，触摸拖拽因此可用
 * - wheel 只发总线、不派发给上次选中的组件
 * - **移动事件必须重读 canvas 矩形**：页面滚动 / 上方内容变高都会让缓存过期，
 *   过期期间命中检测整体偏移（悬停直接落空）。见下方「布局在两次 move 之间变化」用例。
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
  // 与真实 ICE 的契约一致：updateCanvasBoundingRect 刷新缓存，getInputRect 读取该缓存
  const ice: any = {
    evtBus,
    childNodes: [comp],
    toolNodes: [],
    canvasBoundingClientRect: RECT,
    updateCanvasBoundingRect: jest.fn(function () {
      return ice.canvasBoundingClientRect;
    }),
    refreshInputRect: jest.fn(function () {
      return ice.canvasBoundingClientRect;
    }),
    getInputRect: function () {
      return ice.canvasBoundingClientRect;
    },
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

  /**
   * 真实缺陷回归：图表创建之后，页面在画布**上方**插入内容（提示条 / 错误信息 / 广告位），
   * 画布被往下推，而缓存的内容盒只在非移动事件刷新 —— 于是之后每一次 mousemove 的
   * offsetX/offsetY 都偏移同样的距离，悬停、命中、拖拽全部错位，直到用户点一下或滚一格。
   */
  it('布局在两次 move 之间变化：移动事件重读 canvas 矩形，坐标不偏移', () => {
    const { ice, evtBus } = makeIce();
    new DOMEventDispatcher(ice).start();
    const seen: any[] = [];
    evtBus.on('mousemove', (evt: any) => seen.push(evt));

    evtBus.trigger('ICE_MOUSEMOVE', { type: 'mousemove', clientX: 130, clientY: 90 });
    expect(seen[0].offsetY).toBe(40); // 90 - 50

    // 画布上方插入内容：真实位置下移 26px。缓存若不复用，offset 会一直偏 26。
    ice.canvasBoundingClientRect = { left: 100, top: 76 };
    evtBus.trigger('ICE_MOUSEMOVE', { type: 'mousemove', clientX: 130, clientY: 116 });

    expect(ice.refreshInputRect).toHaveBeenCalled();
    expect(seen[1].offsetY).toBe(40); // 116 - 76，而不是 116 - 50 = 66
  });

  it('移动事件每次都刷新矩形（不是「一帧只刷新一次」的节流）', () => {
    const { ice, evtBus } = makeIce();
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEMOVE', { type: 'mousemove', clientX: 130, clientY: 90 });
    evtBus.trigger('ICE_MOUSEMOVE', { type: 'mousemove', clientX: 131, clientY: 91 });
    // 布局变化可能就发生在两次事件之间；任何节流都会让第二次事件用过期矩形
    expect((ice.refreshInputRect as jest.Mock).mock.calls.length).toBe(2);
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

  it('非移动事件走完整刷新；移动事件走轻量刷新（只重读 rect，不读 computedStyle）', () => {
    const { ice, evtBus } = makeIce();
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 130, clientY: 90 });
    expect(ice.updateCanvasBoundingRect).toHaveBeenCalled();
    const before = ice.updateCanvasBoundingRect.mock.calls.length;

    evtBus.trigger('ICE_MOUSEMOVE', { type: 'mousemove', clientX: 131, clientY: 91, movementX: 1, movementY: 1 });
    // 移动事件不走 updateCanvasBoundingRect（那是「重读 rect + 重算边框内边距」的完整路径）
    expect(ice.updateCanvasBoundingRect.mock.calls.length).toBe(before);
    expect(ice.refreshInputRect).toHaveBeenCalled();
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
      updateCanvasBoundingRect: jest.fn(function () {
        // 真实 ICE 会刷新自己的 rect 缓存；桩也必须写回，否则后续事件仍读到旧值
        ice.canvasBoundingClientRect = rects.shift() || { left: 100, top: 20 };
        return ice.canvasBoundingClientRect;
      }),
      getInputRect: function () {
        return ice.canvasBoundingClientRect;
      },
      screenToWorld: (x: number, y: number) => [x, y],
    };
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 130, clientY: 90 });
    // 第二次点击前页面滚动了 30px：canvas 内 y 应为 90-20=70
    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 130, clientY: 90 });

    expect(hit[0]).toEqual([30, 40]);
    expect(hit[1]).toEqual([30, 70]);
  });

  it('修饰键透传到事件对象（Shift 等比 / 角度吸附依赖它）', () => {
    globalRoot.PointerEvent = function () {};
    const { ice, evtBus, comp } = makeIce();
    new DOMEventDispatcher(ice).start();

    // 模拟真实 DOM 事件：修饰键挂在原型上且不可枚举，ICEEvent 的 for...in 拷贝带不过来
    class FakePointerEvent {
      type = 'pointerdown';
      clientX = 130;
      clientY = 90;
      pointerType = 'mouse';
      pointerId = 7;
      get shiftKey() {
        return true;
      }
      get altKey() {
        return true;
      }
      get ctrlKey() {
        return false;
      }
    }
    evtBus.trigger('ICE_POINTERDOWN', new FakePointerEvent());

    const passed = names(comp.trigger.mock.calls, 'pointerdown')[0];
    expect(passed).toBeTruthy();
    expect(passed[1].shiftKey).toBe(true);
    expect(passed[1].altKey).toBe(true);
    expect(passed[1].ctrlKey).toBe(false);
  });

  it('pointerdown 捕获指针、pointerup 释放（拖出画布不丢事件）', () => {
    globalRoot.PointerEvent = function () {};
    const { ice, evtBus } = makeIce();
    const captured: number[] = [];
    const released: number[] = [];
    ice.canvasEl = {
      setPointerCapture: (id: number) => captured.push(id),
      releasePointerCapture: (id: number) => released.push(id),
      hasPointerCapture: () => true,
    };
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_POINTERDOWN', { type: 'pointerdown', clientX: 130, clientY: 90, pointerId: 7 });
    expect(captured).toEqual([7]);

    evtBus.trigger('ICE_POINTERUP', { type: 'pointerup', clientX: 140, clientY: 95, pointerId: 7 });
    expect(released).toEqual([7]);
  });

  it('无 canvasEl 或运行时无指针捕获能力时不报错', () => {
    globalRoot.PointerEvent = function () {};
    const { ice, evtBus } = makeIce();
    new DOMEventDispatcher(ice).start();
    expect(() =>
      evtBus.trigger('ICE_POINTERDOWN', { type: 'pointerdown', clientX: 130, clientY: 90, pointerId: 7 })
    ).not.toThrow();
  });

  it('按下目标不在画布内时不捕获指针（否则工具栏按钮的 click 会被吃掉）', () => {
    globalRoot.PointerEvent = function () {};
    const { ice, evtBus } = makeIce();
    const captured: number[] = [];
    const canvasEl: any = {
      setPointerCapture: (id: number) => captured.push(id),
      releasePointerCapture: () => {},
      hasPointerCapture: () => true,
      contains: () => false, // 画布外的 DOM 元素
    };
    ice.canvasEl = canvasEl;
    new DOMEventDispatcher(ice).start();

    // 监听器挂在 window 上，画布外的按钮点击也会走到这里 —— 不能捕获
    evtBus.trigger('ICE_POINTERDOWN', {
      type: 'pointerdown',
      clientX: 10,
      clientY: 10,
      pointerId: 3,
      target: { tagName: 'BUTTON' },
    });
    expect(captured).toEqual([]);

    // 按下目标就是画布时照常捕获
    evtBus.trigger('ICE_POINTERDOWN', {
      type: 'pointerdown',
      clientX: 130,
      clientY: 90,
      pointerId: 4,
      target: canvasEl,
    });
    expect(captured).toEqual([4]);
  });
});
