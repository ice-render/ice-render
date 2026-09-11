/**
 * 连接钩子碰撞检测单测。
 *
 * 覆盖两处曾经的问题：
 * 1. 只遍历顶层 `childNodes` → 嵌套组件（如卡片里的实体）永远连不上；
 * 2. 命中后从不重置 `collision` → 钩子离开组件后插槽仍粘在原处不消失。
 * 另外确认命中语义与点击一致：z 序最高者胜出（否则父容器会一直盖住子组件）。
 */
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICE from '../../src/ICE';
import ICELinkSlotManager from '../../src/graphic/link/ICELinkSlotManager';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

function makeIce(children: any[]) {
  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice._linkSlots = [];
  ice.evtBus = { on: () => {}, off: () => {}, trigger: () => {} };
  children.forEach((c) => ice.addChild(c));
  // ICE.init 才会创建 manager；单测直接构造（构造函数只记录 ice，不挂监听）
  ice.linkSlotManager = new ICELinkSlotManager(ice);
  return ice;
}

/** 假连接钩子：只提供碰撞检测需要的最小接口 */
function makeHook(boxSource: any) {
  return {
    getMaxBoundingBox: () => boxSource.getMaxBoundingBox(),
    setState: () => {},
  };
}

describe('ICELinkSlotManager 碰撞检测', () => {
  it('嵌套子组件可以作为连接目标（旧实现只看顶层，连不上）', () => {
    // 先建父容器再建子组件：子组件 zIndex 更高 → 渲染时画在父容器之上，
    // 因此「视觉最上层优先」应当命中子组件（这正是「卡片里的实体」的常见构造顺序）
    const group = new ICEGroup({ left: 0, top: 0, width: 200, height: 200 });
    const nested = new ICERect({ left: 40, top: 40, width: 20, height: 20 });
    group.addChild(nested);
    const ice = makeIce([group]);
    // 先合成矩阵（真实使用中渲染每帧都会合成）
    nested.getMinBoundingBox(true);

    const manager: any = ice.linkSlotManager;
    manager.hookMouseMoveHandler({ target: makeHook(nested) } as any);
    expect(manager.collision).toBe(nested);
  });

  it('钩子离开后 collision 归零（旧实现会一直粘在最后一次命中的组件上）', () => {
    const group = new ICEGroup({ left: 0, top: 0, width: 200, height: 200 });
    const nested = new ICERect({ left: 40, top: 40, width: 20, height: 20 });
    group.addChild(nested);
    // 远处一个组件，用来模拟「钩子移到空处」
    const far = new ICERect({ left: 900, top: 900, width: 20, height: 20 });
    const ice = makeIce([group, far]);
    nested.getMinBoundingBox(true);
    far.getMinBoundingBox(true);

    const manager: any = ice.linkSlotManager;

    // 1) 碰到 nested → 命中 nested
    manager.hookMouseMoveHandler({ target: makeHook(nested) } as any);
    expect(manager.collision).toBe(nested);

    // 2) 钩子移到另一个组件上 → 必须改判到它，而不是粘在 nested 上
    manager.hookMouseMoveHandler({ target: makeHook(far) } as any);
    expect(manager.collision).toBe(far);

    // 3) 钩子移到「没有任何可连接组件」的空处 → 归零
    //（旧实现从不重置 collision，这一步仍会保留上一步的 far）
    far.setState({ linkable: false });
    manager.hookMouseMoveHandler({ target: makeHook(far) } as any);
    expect(manager.collision).toBeNull();
  });

  it('z 序最高者胜出（与渲染/点击语义一致）', () => {
    // 显式造出「父 zIndex 更高」的情形：此时父容器在视觉上盖住子组件，
    // 命中父容器才是正确的（渲染顺序也是按全局 zIndex 排序的）
    const group = new ICEGroup({ left: 0, top: 0, width: 200, height: 200, zIndex: 9 });
    const child = new ICERect({ left: 40, top: 40, width: 20, height: 20, zIndex: 5 });
    group.addChild(child);
    const ice = makeIce([group]);
    child.getMinBoundingBox(true);

    const manager: any = ice.linkSlotManager;
    // 钩子的盒取子组件的盒 → 父子都相交，应命中 z 序更高的 child
    manager.hookMouseMoveHandler({ target: makeHook(child) } as any);
    expect(manager.collision).toBe(group);
  });

  it('不可见（祖先 display:false）的组件不作为连接目标', () => {
    const group = new ICEGroup({ left: 0, top: 0, width: 200, height: 200 });
    const nested = new ICERect({ left: 40, top: 40, width: 20, height: 20 });
    group.addChild(nested);
    const ice = makeIce([group]);
    nested.getMinBoundingBox(true);

    const manager: any = ice.linkSlotManager;
    group.setState({ display: false });
    manager.hookMouseMoveHandler({ target: makeHook(nested) } as any);
    // 组自身也不可见 → 都不该命中
    expect(manager.collision).toBeNull();
  });
});
