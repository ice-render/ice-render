/**
 * 布局响应式重排单测：**子项尺寸变化**驱动的重排。
 *
 * 旧实现只在 `setLayout()` / `addChild()` 时排一次；改了子项宽高后，兄弟节点会停在老位置。
 * 现在 `setState({width/height})` 会向父容器请求重排，并**合并到下一帧**只排一次
 *（逐个 setState 立刻重排会退化成 O(n²)，因为布局本身又会对子项 setState 位置）。
 */
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEBoxLayout from '../../src/layout/ICEBoxLayout';
import ICELayoutManager from '../../src/layout/ICELayoutManager';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

function makeCtx() {
  const noop = () => {};
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    rect: noop,
    arcTo: noop,
    fill: noop,
    stroke: noop,
    setTransform: noop,
    setLineDash: noop,
    save: noop,
    restore: noop,
  };
}

describe('布局响应式重排', () => {
  it('子项改宽后，兄弟节点在下一帧重排到新位置', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const a = new ICERect({ width: 100, height: 40 });
    const b = new ICERect({ width: 80, height: 40 });
    group.addChild(a);
    group.addChild(b);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(b.state.left).toBe(110);

    a.setState({ width: 150 });
    // 只是「请求」重排，还没排（合并到下一帧）
    expect(b.state.left).toBe(110);

    group.renderTo(makeCtx());
    expect(b.state.left).toBe(160); // 150 + gap10
  });

  it('一帧内多次请求只重排一次；没有新请求就不再重排', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const a = new ICERect({ width: 100, height: 40 });
    const b = new ICERect({ width: 80, height: 40 });
    group.addChild(a);
    group.addChild(b);
    const layout = new ICEBoxLayout({ axis: 'x', gap: 10 });
    group.setLayout(layout);
    const spy = jest.spyOn(layout, 'layoutContainer');

    a.setState({ width: 150 });
    b.setState({ width: 90 });
    expect(spy).toHaveBeenCalledTimes(0); // 还没到下一帧

    group.renderTo(makeCtx());
    expect(spy).toHaveBeenCalledTimes(1); // 两次请求合并成一次

    group.renderTo(makeCtx());
    expect(spy).toHaveBeenCalledTimes(1); // 没有新请求 → 不重复重排
  });

  it('布局过程中子项位置变化不会自激（不产生无限重排）', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const a = new ICERect({ width: 100, height: 40 });
    group.addChild(a);
    const layout = new ICEBoxLayout({ axis: 'x', gap: 10 });
    group.setLayout(layout);
    const spy = jest.spyOn(layout, 'layoutContainer');

    a.setState({ height: 60 }); // 触发请求
    group.renderTo(makeCtx());
    group.renderTo(makeCtx());
    group.renderTo(makeCtx());
    // 布局本身会 setState 子项位置 → 若被当成新请求，这里会每帧都排
    expect(spy).toHaveBeenCalledTimes(1);
    expect((group as any).__layoutRequested).toBe(false);
  });

  it('没有布局策略时 requestLayout 是空操作，不会置脏', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const a = new ICERect({ width: 10, height: 10 });
    group.addChild(a);
    expect((group as any).__layoutRequested).toBe(false);
    a.setState({ width: 20 });
    expect((group as any).__layoutRequested).toBe(false);
  });

  it('getPreferredSize 转发布局策略（未设置布局时为 [0,0]）', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    expect(group.getPreferredSize()).toEqual([0, 0]);

    class FakeLayout extends ICELayoutManager {
      layoutContainer(): void {}
      getPreferredSize(): [number, number] {
        return [123, 45];
      }
    }
    group.setLayout(new FakeLayout());
    expect(group.getPreferredSize()).toEqual([123, 45]);
  });

  it('容器型子组件（ICEGroup）改尺寸同样触发重排', () => {
    // 回归点：ICEGroup.setState 是独立实现（自己 merge、不调 super.setState），
    // 曾因此漏掉「尺寸变化 → 请求父容器重排」，于是只有非容器子组件能触发重排。
    const outer = new ICEGroup({ width: 400, height: 300 });
    const boxA = new ICEGroup({ width: 100, height: 40 });
    const boxB = new ICERect({ width: 80, height: 40 });
    outer.addChild(boxA);
    outer.addChild(boxB);
    outer.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(boxB.state.left).toBe(110);

    boxA.setState({ width: 150 });
    outer.renderTo(makeCtx());
    expect(boxB.state.left).toBe(160);
  });
});
