// 拖拽归属（drag owner）：按下谁，移动/抬起就归谁。
//
// 背景（2026-09-13 修）：派发器对「抬起」事件会按当前位置重新命中检测，于是"拖着 A 移到 B 上再松手"时，
// 抬起事件被派发给 B，A 收不到 mouseup —— 对连线端点手柄（ICELinkHook）是致命的：
// 它的 mouseup → HOOK_MOUSEUP → ICELinkSlotManager 才去把连线改接到落点插槽上，
// 收不到 mouseup 就等于"拖得动、放不下"（实测：端点手柄与插槽都能显示，但松手后 links 不变）。
//
// 契约：
// - 按下时记住 drag owner；
// - 抬起时先把抬起事件派发给 drag owner（组件级），再按老规矩派发给命中组件；
// - 总线上的抬起事件仍然只触发一次（应用层不会收到两个 mouseup）。
import EventBus from '../../src/event/EventBus';
import DOMEventDispatcher from '../../src/event/DOMEventDispatcher';

const RECT = { left: 0, top: 0 };

function makeIce() {
  const evtBus = new EventBus();
  const hook: any = {
    state: { zIndex: 2, interactive: true, display: true },
    isControlPanel: false,
    containsPoint: () => false,
    trigger: jest.fn(),
  };
  const other: any = {
    state: { zIndex: 1, interactive: true, display: true },
    isControlPanel: false,
    containsPoint: () => false,
    trigger: jest.fn(),
  };
  const ice: any = {
    evtBus,
    childNodes: [other, hook],
    toolNodes: [],
    canvasBoundingClientRect: RECT,
    updateCanvasBoundingRect: () => RECT,
    refreshInputRect: () => RECT,
    getInputRect: () => RECT,
    screenToWorld: (x: number, y: number) => [x, y],
  };
  return { ice, evtBus, hook, other };
}

const globalRoot: any = global;

function dispatch(ice: any, iceEvtName: string, payload: any) {
  ice.evtBus.trigger(iceEvtName, {
    offsetX: payload.x,
    offsetY: payload.y,
    movementX: payload.movementX || 0,
    movementY: payload.movementY || 0,
  });
}

describe('拖拽归属：抬起事件必须回到按下的组件', () => {
  beforeEach(() => {
    globalRoot.PointerEvent = function () {};
  });
  afterEach(() => {
    delete globalRoot.PointerEvent;
  });

  it('在 A 上按下、移到 B 上松手：A 仍然收到 mouseup（并同时以指针名派发）', () => {
    const { ice, hook, other } = makeIce();
    hook.containsPoint = () => true;
    new DOMEventDispatcher(ice).start();

    dispatch(ice, 'ICE_POINTERDOWN', { x: 10, y: 10 });

    hook.containsPoint = () => false;
    other.containsPoint = () => true;
    dispatch(ice, 'ICE_POINTERMOVE', { x: 200, y: 200, movementX: 190, movementY: 190 });
    dispatch(ice, 'ICE_POINTERUP', { x: 200, y: 200 });

    const hookEvents = hook.trigger.mock.calls.map((c: any[]) => c[0]);
    expect(hookEvents).toContain('mouseup');
    expect(hookEvents).toContain('pointerup');
    expect(hookEvents).toContain('mousemove');
  });

  it('总线上的抬起事件只触发一次（应用层不会收到两个 mouseup）', () => {
    const { ice, hook, other } = makeIce();
    hook.containsPoint = () => true;
    new DOMEventDispatcher(ice).start();
    let busMouseUps = 0;
    ice.evtBus.on('mouseup', () => {
      busMouseUps++;
    });

    dispatch(ice, 'ICE_POINTERDOWN', { x: 10, y: 10 });
    hook.containsPoint = () => false;
    other.containsPoint = () => true;
    dispatch(ice, 'ICE_POINTERUP', { x: 200, y: 200 });

    expect(busMouseUps).toBe(1);
  });

  it('没有按下过（空白处松手）时不额外派发，行为与从前一致', () => {
    const { ice, hook, other } = makeIce();
    other.containsPoint = () => true;
    new DOMEventDispatcher(ice).start();

    dispatch(ice, 'ICE_POINTERUP', { x: 200, y: 200 });

    expect(hook.trigger).not.toHaveBeenCalled();
    expect(other.trigger.mock.calls.map((c: any[]) => c[0])).toContain('mouseup');
  });
});
