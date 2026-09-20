/**
 * **按需派发**（2026-09-20）：没人听的事件名，派发器整段早退。
 *
 * 背景：一次原生指针输入会被派发**两个名字** —— 原生名（`pointermove`）+ 兼容名（`mousemove`，
 * 见 `DOMEventDispatcher` 的"兼容名派发"）。而这两个名字通常只有一个有人听：
 * **引擎自己的默认处理器挂在鼠标名上**（`mousedown/mousemove/mouseup`，见 `ICEComponent` 构造期），
 * 应用要么用鼠标名（老代码）、要么用指针名（新代码）。没人听的那一次，
 * "祖先链数组 + 每层 `trigger` + 总线触发"全是白跑 —— 指针移动是每帧级高频。
 *
 * 判据来自 `event/listened-event-names.ts` 的**单向登记表**（只增不减）：
 * 宁可某名字曾经被用过之后多一次空派发，也不能因为漏摘登记而"有人听却不派发"。
 */
import EventBus from '../../src/event/EventBus';
import DOMEventDispatcher from '../../src/event/DOMEventDispatcher';
import ICEComponent from '../../src/graphic/ICEComponent';
import ICERect from '../../src/graphic/shape/ICERect';
import {
  __resetListenedEventNames,
  isEventNameListened,
  markEventNameListened,
} from '../../src/event/listened-event-names';

const RECT = { left: 0, top: 0 };

// 声明 PointerEvent：让派发器订阅指针通道（`ICE_POINTER*`）—— 与浏览器实际一致。
// 不声明的话 `buildDomEventList(false)` 只订阅 mouse/touch 那一套，触发 `ICE_POINTERDOWN` 无人响应。
(global as any).PointerEvent = (global as any).PointerEvent || function () {};

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
    updateCanvasBoundingRect: () => RECT,
    refreshInputRect: () => RECT,
    getInputRect: () => RECT,
    screenToWorld: (x: number, y: number) => [x, y],
  };
  const dispatcher: any = new DOMEventDispatcher(ice);
  dispatcher.start();
  return { ice, evtBus, comp, dispatcher };
}

const names = (calls: any[], name: string) => calls.filter((c) => c[0] === name);

beforeEach(() => {
  // 登记表是模块级的：用例之间要隔离，否则"没人听"的用例会被前一个用例污染
  __resetListenedEventNames();
});

describe('按需派发：没人听的事件名不派发', () => {
  it('没人听 → 组件与总线都不被打扰（连祖先链都不走）', () => {
    const { evtBus, comp } = makeIce();
    const busCalls: any[] = [];
    evtBus.trigger = jest.fn((...args: any[]) => {
      busCalls.push(args);
      return true;
    }) as any;

    expect(isEventNameListened('pointerdown')).toBe(false);
    evtBus.trigger('ICE_POINTERDOWN', { type: 'pointerdown', clientX: 10, clientY: 10, pointerId: 1 });

    expect(comp.trigger).not.toHaveBeenCalled();
    // 总线也没有为这个名字触发过（只有拦截器自己的 ICE_POINTERDOWN 那一次）
    expect(busCalls.filter((c) => c[0] === 'pointerdown').length).toBe(0);
  });

  it('登记之后（有人听）→ 照旧派发，名字与顺序不变', () => {
    const { evtBus, comp } = makeIce();
    markEventNameListened('pointerdown');

    expect(isEventNameListened('pointerdown')).toBe(true);
    evtBus.trigger('ICE_POINTERDOWN', { type: 'pointerdown', clientX: 10, clientY: 10, pointerId: 1 });

    expect(names(comp.trigger.mock.calls, 'pointerdown').length).toBe(1);
  });

  it('真实组件：引擎只在需要时登记名字 —— 指针名只有应用显式订阅才进来', () => {
    const rect = new ICERect({ id: 'r', width: 10, height: 10 });

    // 构造期默认处理器：按下与键盘是常驻的；`mousemove/mouseup` 由 `mouseDownEvtHandler`
    // 在**拖拽真正开始时**才登记 —— 也就是说"没人需要就不派发"对它们同样成立。
    ['mousedown', 'keydown', 'keyup'].forEach((name) => {
      expect(isEventNameListened(name)).toBe(true);
    });
    expect(isEventNameListened('mousemove')).toBe(false); // 还没开始拖拽
    // 而指针名没人听 → 「每次指针事件都多派发一次」的那一半可以被省掉
    expect(isEventNameListened('pointermove')).toBe(false);

    // 应用改用指针名时：登记进来，派发恢复
    rect.on('pointermove', () => {});
    expect(isEventNameListened('pointermove')).toBe(true);
  });

  it('单向登记：`off` 之后名字仍留在表里（宁可多一次空派发，也不漏派发）', () => {
    const rect = new ICERect({ id: 'r', width: 10, height: 10 });
    const handler = () => {};
    rect.on('pointerup', handler);
    expect(isEventNameListened('pointerup')).toBe(true);

    rect.off('pointerup', handler);
    expect(isEventNameListened('pointerup')).toBe(true); // 刻意不清 —— 见文件头说明
  });

  it('组件基类的 `on` 也走同一条登记路径（不是只有具体图元）', () => {
    const rect = new ICERect({ id: 'r', width: 10, height: 10 });
    expect(rect).toBeInstanceOf(ICEComponent);
    rect.addEventListener('dblclick', () => {});
    expect(isEventNameListened('dblclick')).toBe(true);
  });
});
