/**
 * 命中检测的「廉价包围盒预筛」契约。
 *
 * 命中的第一道筛子用渲染快照的世界盒（含 paint pad）做 O(1) 拒绝，
 * 只有落在盒内（含 1px 容差）的组件才继续做矩阵反变换 + 形状判定。
 *
 * 必须锁定的正确性底线：
 * - 点在盒内 → containsPoint 照常调用，预筛绝不误杀
 * - 组件未上屏（无快照）→ 不预筛，退化为原有行为
 * - 未挂渲染器（旧用法）→ 不预筛，行为完全不变
 * - DOMEventDispatcher 与 ICE.hitTest 采用同一策略
 */
import EventBus from '../../src/event/EventBus';
import DOMEventDispatcher from '../../src/event/DOMEventDispatcher';
import ICE from '../../src/ICE';
import { HIT_BOX_TOLERANCE } from '../../src/renderer/dirty-rect-util';

const RECT = { left: 0, top: 0 };

/** 造一个组件：__box 为渲染快照盒（[minX,minY,maxX,maxY]），containsPoint 可被观察。 */
function makeComp(box: number[] | null, zIndex = 1, hit = true) {
  const comp: any = {
    state: { zIndex, interactive: true, display: true, left: 0, top: 0, width: 10, height: 10 },
    isControlPanel: false,
    __box: box,
    containsPoint: jest.fn(() => hit),
    trigger: jest.fn(),
  };
  return comp;
}

function makeIceWithRenderer(comps: any[]) {
  const evtBus = new EventBus();
  const renderer = {
    getWorldBox: (c: any) => c.__box || null,
  };
  const ice: any = {
    evtBus,
    childNodes: comps,
    toolNodes: [],
    renderer,
    canvasBoundingClientRect: RECT,
    updateCanvasBoundingRect: () => RECT,
    screenToWorld: (x: number, y: number) => [x, y],
  };
  return { ice, evtBus, renderer };
}

describe('DOMEventDispatcher 命中预筛', () => {
  it('远离命中点的组件被预筛挡掉，不做 containsPoint', () => {
    const near = makeComp([0, 0, 50, 50], 1);
    const far = makeComp([5000, 5000, 5100, 5100], 2);
    const { ice, evtBus } = makeIceWithRenderer([near, far]);
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 10, clientY: 10 });

    expect(near.containsPoint).toHaveBeenCalled();
    expect(far.containsPoint).not.toHaveBeenCalled();
  });

  it('点落在盒内时 containsPoint 照常调用（预筛不误杀）', () => {
    const a = makeComp([0, 0, 100, 100], 1);
    const { ice, evtBus } = makeIceWithRenderer([a]);
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 50, clientY: 50 });

    expect(a.containsPoint).toHaveBeenCalledWith(50, 50);
    expect((a.trigger as jest.Mock).mock.calls.some((c) => c[0] === 'mousedown')).toBe(true);
  });

  it('盒外 1px 容差内仍然照常判定', () => {
    const a = makeComp([0, 0, 50, 50], 1);
    const { ice, evtBus } = makeIceWithRenderer([a]);
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 50 + HIT_BOX_TOLERANCE, clientY: 25 });
    expect(a.containsPoint).toHaveBeenCalled();
  });

  it('超出容差即被预筛挡掉', () => {
    const a = makeComp([0, 0, 50, 50], 1);
    const { ice, evtBus } = makeIceWithRenderer([a]);
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 50 + HIT_BOX_TOLERANCE + 1, clientY: 25 });
    expect(a.containsPoint).not.toHaveBeenCalled();
  });

  it('组件未上屏（无快照）时不预筛，退化为原有行为', () => {
    const neverRendered = makeComp(null, 1);
    const { ice, evtBus } = makeIceWithRenderer([neverRendered]);
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 9999, clientY: 9999 });

    expect(neverRendered.containsPoint).toHaveBeenCalled();
  });

  it('未挂渲染器（旧用法）时完全不预筛，行为不变', () => {
    const a = makeComp([5000, 5000, 5100, 5100], 1);
    const evtBus = new EventBus();
    const ice: any = {
      evtBus,
      childNodes: [a],
      toolNodes: [],
      canvasBoundingClientRect: RECT,
      updateCanvasBoundingRect: () => RECT,
      screenToWorld: (x: number, y: number) => [x, y],
    };
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 1, clientY: 1 });

    expect(a.containsPoint).toHaveBeenCalled();
  });

  it('非交互 / 已隐藏的组件直接跳过（与既有语义一致）', () => {
    const hidden = makeComp([0, 0, 100, 100], 1);
    hidden.state.display = false;
    const nonInteractive = makeComp([0, 0, 100, 100], 2);
    nonInteractive.state.interactive = false;
    const { ice, evtBus } = makeIceWithRenderer([hidden, nonInteractive]);
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 50, clientY: 50 });

    expect(hidden.containsPoint).not.toHaveBeenCalled();
    expect(nonInteractive.containsPoint).not.toHaveBeenCalled();
  });

  it('取最上层命中，且预筛不改变命中结果', () => {
    const bottom = makeComp([0, 0, 100, 100], 1);
    const top = makeComp([0, 0, 100, 100], 9);
    const { ice, evtBus } = makeIceWithRenderer([bottom, top]);
    new DOMEventDispatcher(ice).start();

    evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 50, clientY: 50 });

    expect(top.trigger).toHaveBeenCalled();
    expect(bottom.trigger).not.toHaveBeenCalled();
  });
});

describe('ICE.hitTest 命中预筛', () => {
  it('屏外组件被预筛挡掉，屏内组件正常命中', () => {
    const near = makeComp([0, 0, 100, 100], 1);
    const far = makeComp([5000, 5000, 5100, 5100], 2);
    const ice: any = new ICE();
    ice.childNodes = [near, far];
    ice.toolNodes = [];
    ice.renderer = { getWorldBox: (c: any) => c.__box || null };

    const found = ice.hitTest(50, 50);

    expect(found).toBe(near);
    expect(near.containsPoint).toHaveBeenCalledWith(50, 50);
    expect(far.containsPoint).not.toHaveBeenCalled();
  });

  it('未上屏组件在 hitTest 中不被预筛（无快照时仍可命中）', () => {
    const neverRendered = makeComp(null, 1);
    const ice: any = new ICE();
    ice.childNodes = [neverRendered];
    ice.toolNodes = [];
    ice.renderer = { getWorldBox: () => null };

    expect(ice.hitTest(1234, 5678)).toBe(neverRendered);
  });
});
