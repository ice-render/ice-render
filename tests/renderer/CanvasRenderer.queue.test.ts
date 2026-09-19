/**
 * CanvasRenderer 渲染队列缓存（性能优化）回归测试。
 *
 * 验证：
 *  - 结构变更（addChild / removeChild）后队列会重建并包含最新组件；
 *  - 结构未变时稳态刷新复用同一队列数组（不重新 flattenTree），降低每帧开销；
 *  - zIndex 发生变化时队列会重新排序，绘制顺序始终正确。
 *
 * 引擎目标：高性能 canvas 绘图引擎，需兼容 WEB 与各类小程序。
 */
// node 测试环境无 window，将跨平台 root 替换为桩，避免加载 DOM/Canvas 依赖。
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

// 部分图元（ICEPath 子类）构造时会 new Path2D()，node 环境需提供桩。
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  addPath() {}
  roundRect() {}
};

import EventBus from '../../src/event/EventBus';
import ICE from '../../src/ICE';
import ICEComponent from '../../src/graphic/ICEComponent';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';

function makeIce(): ICE {
  const ice = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.dirty = true;
  ice.renderer = new CanvasRenderer(ice);
  ice.renderer.start();
  return ice;
}

describe('CanvasRenderer 渲染队列缓存', () => {
  it('addChild 后队列重建并包含所有组件', () => {
    const ice = makeIce();
    const a = new ICEComponent({ width: 10, height: 10 });
    const b = new ICEComponent({ width: 10, height: 10 });
    ice.addChild(a);
    ice.addChild(b);

    (ice.renderer as any).refreshQueue();
    const q = (ice.renderer as any).componentQueue;
    expect(q.length).toBe(2);
    expect(q).toContain(a);
    expect(q).toContain(b);
    // 默认 zIndex 随构造顺序递增，队列按 zIndex 升序
    expect(q[0].state.zIndex).toBeLessThanOrEqual(q[1].state.zIndex);
  });

  it('结构未变时稳态刷新复用同一队列数组（不重新 flatten），zIndex 变化时才重排序', () => {
    const ice = makeIce();
    const a = new ICEComponent({ width: 10, height: 10 });
    const b = new ICEComponent({ width: 10, height: 10 });
    ice.addChild(a);
    ice.addChild(b);

    (ice.renderer as any).refreshQueue();
    const arrBefore = (ice.renderer as any).componentQueue;
    // 稳态再刷新：无结构变化、无 zIndex 变化，应命中缓存（同一数组引用）
    (ice.renderer as any).refreshQueue();
    expect((ice.renderer as any).componentQueue).toBe(arrBefore);

    // 改变 a 的 zIndex，应触发重排序（a 排到末尾）
    a.setState({ zIndex: 99999 });
    (ice.renderer as any).refreshQueue();
    const q2 = (ice.renderer as any).componentQueue;
    expect(q2[1]).toBe(a);
    expect(q2[0]).toBe(b);
  });

  /**
   * zIndex **数值**变了、但**次序**没变：不该整队重建。
   *
   * 这是"便宜的一类"：应用把一批子件的 zIndex 重写成同一组值、或动画把 zIndex 缓动
   * 但没跨过邻居 —— 检出的差异只是数值本身，排列没动。整队重建要重走整棵树、
   * 每个父容器各自排序（10000 组件实测 ~0.94ms/次），这里应该只是刷新快照。
   */
  it('★ zIndex 数值变但次序不变：复用同一队列数组（不重建）', () => {
    const ice = makeIce();
    // 默认值现在是 0（auto 层）→ 两个组件相等，必须显式给值才能造出"a 在下、b 在上"
    const a = new ICEComponent({ width: 10, height: 10, zIndex: 1 });
    const b = new ICEComponent({ width: 10, height: 10, zIndex: 2 });
    ice.addChild(a);
    ice.addChild(b);
    (ice.renderer as any).refreshQueue();
    const arrBefore = (ice.renderer as any).componentQueue;
    const zA = a.state.zIndex;
    const zB = b.state.zIndex;
    expect(zA).toBeLessThan(zB);

    // 把 a 抬高一点，但仍低于 b → 次序不变
    a.setState({ zIndex: (zA + zB) / 2 }, { paramsDirty: false });
    (ice.renderer as any).refreshQueue();

    expect((ice.renderer as any).componentQueue).toBe(arrBefore);
    expect((ice.renderer as any).componentQueue.indexOf(a)).toBeLessThan(
      (ice.renderer as any).componentQueue.indexOf(b)
    );
    // 快照被刷新：下一帧不该再"发现"一次差异
    expect((ice.renderer as any).__zOrderChanged()).toBe(false);
  });

  it('★ zIndex 跨过邻居（次序真变了）：照旧重建，且顺序正确', () => {
    const ice = makeIce();
    const a = new ICEComponent({ width: 10, height: 10 });
    const b = new ICEComponent({ width: 10, height: 10 });
    ice.addChild(a);
    ice.addChild(b);
    (ice.renderer as any).refreshQueue();
    const arrBefore = (ice.renderer as any).componentQueue;

    a.setState({ zIndex: b.state.zIndex + 10 }, { paramsDirty: false });
    (ice.renderer as any).refreshQueue();

    const q = (ice.renderer as any).componentQueue;
    expect(q).not.toBe(arrBefore);
    expect(q[0]).toBe(b);
    expect(q[1]).toBe(a);
  });

  /**
   * 上面两条只盖了"顶层兄弟"。这条盖**嵌套容器**：判据（`_level`/`_pid`）在深层是否同样成立，
   * 以及"父容器先于自己的子树"这条铁律在重排后有没有被破坏。
   */
  it('★ 嵌套容器内只改 zIndex 数值（未跨邻居）：不重建，父子次序不变', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 100, height: 100 });
    ice.addChild(group);
    const c1 = new ICEComponent({ width: 10, height: 10, zIndex: 1 });
    const c2 = new ICEComponent({ width: 10, height: 10, zIndex: 2 });
    group.addChild(c1);
    group.addChild(c2);
    (ice.renderer as any).refreshQueue();
    const arrBefore = (ice.renderer as any).componentQueue;
    expect(arrBefore[0]).toBe(group);
    expect(arrBefore[1]).toBe(c1);
    expect(arrBefore[2]).toBe(c2);

    // 抬高 c1，但仍低于 c2 → 组内次序不变
    c1.setState({ zIndex: (c1.state.zIndex + c2.state.zIndex) / 2 }, { paramsDirty: false });
    (ice.renderer as any).refreshQueue();

    expect((ice.renderer as any).componentQueue).toBe(arrBefore);
    expect((ice.renderer as any).__zOrderChanged()).toBe(false);
  });

  it('★ 嵌套容器内 zIndex 跨过邻居：重建，且父容器仍画在自己的子树之下', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 100, height: 100 });
    ice.addChild(group);
    const c1 = new ICEComponent({ width: 10, height: 10, zIndex: 1 });
    const c2 = new ICEComponent({ width: 10, height: 10, zIndex: 2 });
    group.addChild(c1);
    group.addChild(c2);
    (ice.renderer as any).refreshQueue();
    const arrBefore = (ice.renderer as any).componentQueue;

    c1.setState({ zIndex: c2.state.zIndex + 10 }, { paramsDirty: false });
    (ice.renderer as any).refreshQueue();

    const q = (ice.renderer as any).componentQueue;
    expect(q).not.toBe(arrBefore);
    expect(q[0]).toBe(group); // 父容器永远先于自己的子树（渲染顺序铁律）
    expect(q[1]).toBe(c2);
    expect(q[2]).toBe(c1);
  });

  it('★ 组件层与工具层是两条独立队列：组件 zIndex 再大也压不住工具层', () => {
    const ice = makeIce();
    const huge = new ICEComponent({ width: 10, height: 10 });
    // 甚至给到保留号段之上：两层不按 zIndex 交叉，组件层任何数字都改变不了先后
    huge.setState({ zIndex: 1e9 }, { paramsDirty: false });
    ice.addChild(huge);
    const tool = new ICEComponent({ width: 10, height: 10 });
    ice.addTool(tool);

    const q = (ice.renderer as any).getOrderedQueues();
    expect(q.components).toContain(huge);
    expect(q.components).not.toContain(tool);
    expect(q.tools).toContain(tool);
  });

  it('removeChild 后队列重建不再包含被移除组件', () => {
    const ice = makeIce();
    const a = new ICEComponent({ width: 10, height: 10 });
    const b = new ICEComponent({ width: 10, height: 10 });
    ice.addChild(a);
    ice.addChild(b);

    (ice.renderer as any).refreshQueue();
    ice.removeChild(a);
    (ice.renderer as any).refreshQueue();
    const q = (ice.renderer as any).componentQueue;
    expect(q.length).toBe(1);
    expect(q).toContain(b);
    expect(q).not.toContain(a);
  });

  it('ICEGroup 内 addChild 也会标记队列 dirty', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 50, height: 50 });
    ice.addChild(group); // group.ice 被注入
    (ice.renderer as any).refreshQueue();
    const before = (ice.renderer as any).componentQueue.length;

    const child = new ICEComponent({ width: 10, height: 10 });
    group.addChild(child); // group.ice 已存在，应触发 markQueueDirty
    (ice.renderer as any).refreshQueue();
    const after = (ice.renderer as any).componentQueue.length;
    expect(after).toBe(before + 1);
    expect((ice.renderer as any).componentQueue).toContain(child);
  });
});
