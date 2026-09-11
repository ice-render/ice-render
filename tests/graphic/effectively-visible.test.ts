/**
 * `display` 的继承语义单测。
 *
 * `state.display = false` 的约定是「整棵子树都不渲染」，但渲染队列是把树拉平后逐个入队的，
 * 只判组件自身会导致隐藏父容器后子组件照样被画、照样能点中。这里覆盖
 * `isEffectivelyVisible()` 沿父链的判断，以及命中检测对祖先 display 的响应。
 */
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICE from '../../src/ICE';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

describe('display 的继承语义（isEffectivelyVisible）', () => {
  it('顶层组件：只看自身 display', () => {
    const rect = new ICERect({ width: 10, height: 10 });
    expect(rect.isEffectivelyVisible()).toBe(true);
    rect.setState({ display: false });
    expect(rect.isEffectivelyVisible()).toBe(false);
  });

  it('父容器 display:false → 子组件最终不可见', () => {
    const group = new ICEGroup({ width: 100, height: 100 });
    const child = new ICERect({ width: 10, height: 10 });
    group.addChild(child);

    expect(child.isEffectivelyVisible()).toBe(true);
    group.setState({ display: false });
    expect(child.state.display).toBe(true); // 自身标记没有被动过
    expect(child.isEffectivelyVisible()).toBe(false); // 但最终不可见
  });

  it('深度 3 的祖先链：任意一层隐藏都使后代不可见，恢复后重新可见', () => {
    const g1 = new ICEGroup({ width: 100, height: 100 });
    const g2 = new ICEGroup({ width: 50, height: 50 });
    const leaf = new ICERect({ width: 10, height: 10 });
    g1.addChild(g2);
    g2.addChild(leaf);

    expect(leaf.isEffectivelyVisible()).toBe(true);
    g2.setState({ display: false });
    expect(leaf.isEffectivelyVisible()).toBe(false);
    g2.setState({ display: true });
    expect(leaf.isEffectivelyVisible()).toBe(true);
    g1.setState({ display: false });
    expect(leaf.isEffectivelyVisible()).toBe(false);
    g1.setState({ display: true });
    expect(leaf.isEffectivelyVisible()).toBe(true);
  });

  it('命中检测用最终可见性：被隐藏父容器下的子组件点不中', () => {
    const ice: any = new ICE();
    ice.childNodes = [];
    ice.toolNodes = [];
    ice.evtBus = { on: () => {}, off: () => {}, trigger: () => {} };

    const group = new ICEGroup({ left: 0, top: 0, width: 100, height: 100 });
    const child = new ICERect({ left: 10, top: 10, width: 40, height: 30 });
    group.addChild(child);
    ice.addChild(group);

    //containsPoint 走逆矩阵，需要矩阵已合成（真实使用中渲染每帧都会合成）
    child.getMinBoundingBox(true);
    // 单位视口下屏幕坐标 == 世界坐标
    expect(ice.hitTest(20, 20)).toBe(child);

    group.setState({ display: false });
    expect(ice.hitTest(20, 20)).toBeNull();

    group.setState({ display: true });
    expect(ice.hitTest(20, 20)).toBe(child);
  });
});

/**
 * `isEffectivelyVisible()` 在每帧会被调用 3~4 次/组件（裁剪判定、render 守卫、快照捕获、risky 扫描），
 * 而组件通常多层嵌套 —— 每次调用都沿父链走到底，实测这是 5000 图元场景约 15% 的每帧开销。
 *
 * 这里锚定「同一代内只走一次链」这个**可观测行为**（用计数访问器数走链次数），
 * 而不是锚定耗时（耗时断言在 CI 上不可靠）。
 */
function countWalks(component: any) {
  let walks = 0;
  let real = component.parentNode;
  Object.defineProperty(component, 'parentNode', {
    configurable: true,
    get() {
      walks++;
      return real;
    },
    set(v) {
      real = v;
    },
  });
  return () => walks;
}

describe('isEffectivelyVisible 的代际缓存（每帧只走一次父链）', () => {
  it('同一代内重复查询不再沿父链走', () => {
    const g1 = new ICEGroup({ width: 100, height: 100 });
    const g2 = new ICEGroup({ width: 50, height: 50 });
    const leaf = new ICERect({ width: 10, height: 10 });
    g1.addChild(g2);
    g2.addChild(leaf);

    const walks = countWalks(leaf);
    expect(leaf.isEffectivelyVisible()).toBe(true);
    const afterFirst = walks();
    expect(afterFirst).toBeGreaterThan(0); // 第一次必须真的走链

    leaf.isEffectivelyVisible();
    leaf.isEffectivelyVisible();
    leaf.isEffectivelyVisible();
    expect(walks()).toBe(afterFirst); // 同代内不再走
  });

  it('祖先 display 变化后必须失效并看到新值', () => {
    const g1 = new ICEGroup({ width: 100, height: 100 });
    const g2 = new ICEGroup({ width: 50, height: 50 });
    const leaf = new ICERect({ width: 10, height: 10 });
    g1.addChild(g2);
    g2.addChild(leaf);

    expect(leaf.isEffectivelyVisible()).toBe(true);
    const walks = countWalks(leaf);
    g1.setState({ display: false });
    expect(leaf.isEffectivelyVisible()).toBe(false); // 必须先失效再走链
    expect(walks()).toBeGreaterThan(0);
  });

  it('自身 display 变化后必须失效', () => {
    const leaf = new ICERect({ width: 10, height: 10 });
    expect(leaf.isEffectivelyVisible()).toBe(true);
    leaf.setState({ display: false });
    expect(leaf.isEffectivelyVisible()).toBe(false);
    leaf.setState({ display: true });
    expect(leaf.isEffectivelyVisible()).toBe(true);
  });

  it('挂到「隐藏父容器」下后必须失效（树结构变化）', () => {
    const leaf = new ICERect({ width: 10, height: 10 });
    const shown = new ICEGroup({ width: 10, height: 10 });
    const hidden = new ICEGroup({ width: 10, height: 10, display: false });
    shown.addChild(leaf);
    expect(leaf.isEffectivelyVisible()).toBe(true);

    hidden.addChild(leaf); // 换父：缓存必须失效
    expect(leaf.isEffectivelyVisible()).toBe(false);
  });

  it('与未缓存实现结果一致（嵌套三层 + 顶层 + 隐藏）', () => {
    const g1 = new ICEGroup({ width: 100, height: 100 });
    const g2 = new ICEGroup({ width: 50, height: 50 });
    const leaf = new ICERect({ width: 10, height: 10 });
    g1.addChild(g2);
    g2.addChild(leaf);
    const top = new ICERect({ width: 10, height: 10 });

    // 逐项对照：任一祖先隐藏都不可见，恢复后可见
    expect([leaf.isEffectivelyVisible(), top.isEffectivelyVisible()]).toEqual([true, true]);
    g2.setState({ display: false });
    expect(leaf.isEffectivelyVisible()).toBe(false);
    g2.setState({ display: true });
    expect(leaf.isEffectivelyVisible()).toBe(true);
    g1.setState({ display: false });
    expect(leaf.isEffectivelyVisible()).toBe(false);
    g1.setState({ display: true });
    expect(leaf.isEffectivelyVisible()).toBe(true);
    expect(top.isEffectivelyVisible()).toBe(true);
  });
});
