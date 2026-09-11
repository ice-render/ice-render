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
