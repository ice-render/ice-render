// 连接插槽的「就近吸附」契约（2026-09-13 改）。
//
// 旧实现：钩子碰到哪个可连接组件，就把该组件上的 **5 个插槽全部显示**（T/R/B/L/C），
// 松手时再从 5 个里挑"第一个与钩子盒相交的"来建立连接 —— 用户看到的与引擎挑的可能不是同一个，
// 而且每次都多画 4 个永远不会被选中的圆。
//
// 新契约：
// - 拖拽中**只显示离钩子最近的那一个插槽**（其它 4 个隐藏）——"只有很靠近的插槽才可能建立连接"；
// - 松手时只认这个"当前吸附插槽"：在吸附距离内就接到它上面，否则按未命中处理（断开）。
import ICELinkSlotManager from '../../src/graphic/link/ICELinkSlotManager';
import EventBus from '../../src/event/EventBus';
import ICEBoundingBox from '../../src/geometry/ICEBoundingBox';

const box = (cx: number, cy: number, r = 10) => ICEBoundingBox.fromDimension(cx - r, cy - r, r * 2, r * 2);

function makeSlot(position: string, center: [number, number]) {
  return {
    state: { display: false, position, radius: 10, style: { fillStyle: '#3ce92c' } },
    hostComponent: null as any,
    setState(patch: any) {
      Object.assign(this.state, patch);
      if (patch.style) this.state.style = { ...this.state.style, ...patch.style };
    },
    getMaxBoundingBox: () => box(center[0], center[1]),
    updatePosition() {},
  };
}

function makeHarness(hookCenter: [number, number]) {
  const evtBus = new EventBus();
  // 一个可连接的宿主组件，插槽分布在它的 T/R/B/L/C（这里直接用坐标摆好）
  const host: any = {
    state: { id: 'host-1', display: true, linkable: true, zIndex: 1 },
    isEffectivelyVisible: () => true,
    getMaxBoundingBox: () => box(100, 100, 60),
  };
  const slots = [
    makeSlot('T', [100, 40]),
    makeSlot('R', [160, 100]),
    makeSlot('B', [100, 160]),
    makeSlot('L', [40, 100]),
    makeSlot('C', [100, 100]),
  ];
  const ice: any = {
    evtBus,
    childNodes: [host],
    toolNodes: [],
    _linkSlots: slots,
  };
  const link: any = { state: { links: {} }, setState: (patch: any) => Object.assign(link.state, patch) };
  const hook: any = {
    state: { position: 'start', display: true },
    getMaxBoundingBox: () => box(hookCenter[0], hookCenter[1], 8),
    setState: (patch: any) => Object.assign(hook.state, patch),
    parentNode: { targetComponent: link },
  };
  const manager: any = new ICELinkSlotManager(ice);
  manager.start();
  return { ice, manager, hook, link, slots };
}

describe('连接插槽就近吸附', () => {
  it('拖拽中只显示离钩子最近的那一个插槽', () => {
    // 钩子靠近宿主的 R 插槽（160,100）
    const { manager, hook, slots } = makeHarness([158, 102]);

    manager.hookMouseMoveHandler({ target: hook });

    const visible = slots.filter((s) => s.state.display);
    expect(visible).toHaveLength(1);
    expect(visible[0].state.position).toBe('R');
    expect(visible[0].hostComponent.state.id).toBe('host-1');
  });

  it('松手时接到最近的那个插槽上（不再从 5 个里挑"第一个相交的"）', () => {
    const { manager, hook, link, slots } = makeHarness([102, 40]);

    manager.hookMouseMoveHandler({ target: hook });
    manager.hookMouseUpHandler({ target: hook });

    expect(link.state.links.start).toEqual({ id: 'host-1', position: 'T' });
    expect(slots.every((s) => !s.state.display)).toBe(true); // 松手后插槽全部隐藏
  });

  it('钩子离所有插槽都远时：不显示插槽，松手按未命中处理（断开）', () => {
    const { manager, hook, link, slots } = makeHarness([600, 600]);

    manager.hookMouseMoveHandler({ target: hook });
    expect(slots.every((s) => !s.state.display)).toBe(true);

    manager.hookMouseUpHandler({ target: hook });
    expect(link.state.links.start).toBeNull();
  });
});
