/**
 * 跨实例迁移原语 `ice.moveComponentTo(component, targetIce, targetParent?)`（18 §3.1 的 ②-2 切片）。
 *
 * 用途：分层渲染里"拖拽期间把元素提升到动画层、松手放回"（Konva 的 drag-layer 模式），
 * 以及"把选中的东西挪到另一张画布"这类交互。
 *
 * 契约（本文即规格）：
 * 1. **保持世界坐标**：迁移前后组件 origin 的绝对（canvas/世界）坐标不变 —— 两边的祖先矩阵可能不同
 *    （旋转/缩放的容器），所以必须做矩阵换算，而不是照抄 left/top；
 * 2. **不销毁**：与 `removeChild` 不同，迁移**不清事件**（组件自己的 mousedown/dblclick 等监听照旧有效）；
 * 3. **子树整体迁移**：ice/ctx/evtBus 递归切换到目标实例（否则后代会把事件发到旧实例）；
 * 4. **目标实例接管**：动画注册（AnimationManager）与选中态都跟着走 —— 旧实例必须摘掉，
 *    否则旧实例每帧还会 setState 到一个已经不在它树里的组件；
 * 5. 目标父级必须属于目标实例；同实例迁移返回 false（那是 `adoptChild` / `addChild` 的活）。
 */
import ICE from '../src/ICE';
import EventBus from '../src/event/EventBus';
import AnimationManager from '../src/animation/AnimationManager';
import ICEGroup from '../src/graphic/container/ICEGroup';
import ICERect from '../src/graphic/shape/ICERect';

/** 造一个"可用的 ICE"：不走 init()（node 里没有真 canvas），但补齐 addChild/迁移依赖的字段。 */
function makeIce() {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.__childSet = new WeakSet();
  ice.toolNodes = [];
  ice.ctx = null;
  ice.renderer = { markQueueDirty: jest.fn() };
  ice.animationManager = new AnimationManager(ice);
  ice.selectionList = [];
  return ice;
}

/** 刷新祖先链上的矩阵/原点，保证 calcAbsoluteOrigin() 拿到的是新鲜值。 */
function refresh(...components: any[]) {
  for (const c of components) {
    c.composeMatrix ? c.composeMatrix() : null;
  }
}

describe('跨实例迁移：基本语义', () => {
  it('迁移后归属、世界坐标、实例引用都正确（且不销毁）', () => {
    const a = makeIce();
    const b = makeIce();
    const rect: any = new ICERect({ left: 30, top: 40, width: 20, height: 10 });
    a.addChild(rect);
    refresh(rect);

    const worldBefore = { ...rect.calcAbsoluteOrigin() };
    const customListener = jest.fn();
    rect.on('custom-event', customListener);

    expect(a.moveComponentTo(rect, b)).toBe(true);

    expect(rect.ice).toBe(b);
    expect(rect.evtBus).toBe(b.evtBus);
    expect(a.childNodes).not.toContain(rect);
    expect(b.childNodes).toContain(rect);
    refresh(rect);
    expect(rect.calcAbsoluteOrigin()[0]).toBeCloseTo(worldBefore.x ?? worldBefore[0], 5);
    expect(rect.calcAbsoluteOrigin()[1]).toBeCloseTo(worldBefore.y ?? worldBefore[1], 5);

    // 不销毁：组件自己的监听器还在
    rect.trigger('custom-event');
    expect(customListener).toHaveBeenCalledTimes(1);
  });

  it('世界坐标换算：从带旋转/缩放的容器里迁到另一实例的根，位置不跳', () => {
    const a = makeIce();
    const b = makeIce();
    const group: any = new ICEGroup({
      left: 100,
      top: 50,
      width: 200,
      height: 200,
      transform: { translate: [0, 0], scale: [2, 2], skew: [0, 0], rotate: 30 },
    });
    const rect: any = new ICERect({ left: 20, top: 10, width: 20, height: 10 });
    group.addChild(rect);
    a.addChild(group);
    refresh(group, rect);

    const before = { ...rect.calcAbsoluteOrigin() };
    expect(a.moveComponentTo(rect, b)).toBe(true);
    refresh(rect);
    const after = rect.calcAbsoluteOrigin();

    expect(after[0]).toBeCloseTo(before[0], 4);
    expect(after[1]).toBeCloseTo(before[1], 4);
    // 换算的确发生了：新父级（根）没有变换，left/top 不再等于原来的 (20,10)
    expect([rect.state.left, rect.state.top]).not.toEqual([20, 10]);
  });

  it('指定目标父级：挂在那个容器下，世界坐标仍不变', () => {
    const a = makeIce();
    const b = makeIce();
    const targetGroup: any = new ICEGroup({ left: 300, top: 200, width: 100, height: 100 });
    b.addChild(targetGroup);
    const rect: any = new ICERect({ left: 30, top: 40, width: 20, height: 10 });
    a.addChild(rect);
    refresh(targetGroup, rect);

    const before = { ...rect.calcAbsoluteOrigin() };
    expect(a.moveComponentTo(rect, b, targetGroup)).toBe(true);
    expect(rect.parentNode).toBe(targetGroup);
    refresh(targetGroup, rect);
    expect(rect.calcAbsoluteOrigin()[0]).toBeCloseTo(before[0], 5);
    expect(rect.calcAbsoluteOrigin()[1]).toBeCloseTo(before[1], 5);
  });

  it('子树整体迁移：后代的 ice/evtBus 也切到目标实例', () => {
    const a = makeIce();
    const b = makeIce();
    const outer: any = new ICEGroup({ left: 10, top: 10, width: 100, height: 100 });
    const inner: any = new ICEGroup({ left: 5, top: 5, width: 50, height: 50 });
    const leaf: any = new ICERect({ left: 1, top: 1, width: 10, height: 10 });
    inner.addChild(leaf);
    outer.addChild(inner);
    a.addChild(outer);
    refresh(outer, inner, leaf);

    expect(a.moveComponentTo(outer, b)).toBe(true);
    expect(outer.ice).toBe(b);
    expect(inner.ice).toBe(b);
    expect(leaf.ice).toBe(b);
    expect(leaf.evtBus).toBe(b.evtBus);
  });
});

describe('跨实例迁移：接管与防御', () => {
  it('动画注册随组件迁移（旧实例摘除，新实例接管）', () => {
    const a = makeIce();
    const b = makeIce();
    const rect: any = new ICERect({
      left: 0,
      top: 0,
      width: 10,
      height: 10,
      animations: { left: { from: 0, to: 50, duration: 100, loop: true } },
    });
    a.addChild(rect);
    const id = rect.props.id;
    expect((a.animationManager as any).animationMap.has(id)).toBe(true);

    expect(a.moveComponentTo(rect, b)).toBe(true);

    expect((a.animationManager as any).animationMap.has(id)).toBe(false);
    expect((b.animationManager as any).animationMap.has(id)).toBe(true);
  });

  it('选中态跟着走：旧实例移除，目标实例接管', () => {
    const a = makeIce();
    const b = makeIce();
    const rect: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    a.addChild(rect);
    a.selectionList = [rect];

    expect(a.moveComponentTo(rect, b)).toBe(true);
    expect(a.selectionList).not.toContain(rect);
    expect(b.selectionList).toContain(rect);
  });

  it('防御：目标父级不属于目标实例 → 拒绝且不改动任何状态', () => {
    const a = makeIce();
    const b = makeIce();
    const foreign: any = new ICEGroup({ left: 0, top: 0, width: 10, height: 10 });
    a.addChild(foreign); // foreign 属于 a
    const rect: any = new ICERect({ left: 5, top: 5, width: 10, height: 10 });
    a.addChild(rect);

    expect(a.moveComponentTo(rect, b, foreign)).toBe(false);
    expect(rect.ice).toBe(a);
    expect(a.childNodes).toContain(rect);
    expect(b.childNodes).not.toContain(rect);
  });

  it('防御：同实例迁移 / 组件不属于本实例 / 目标非法 → 一律 false', () => {
    const a = makeIce();
    const b = makeIce();
    const mine: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    const other: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    a.addChild(mine);
    b.addChild(other);

    expect(a.moveComponentTo(mine, a)).toBe(false); // 同实例
    expect(a.moveComponentTo(other, a)).toBe(false); // 不在本实例里
    expect(a.moveComponentTo(mine, null as any)).toBe(false); // 目标非法
    expect(a.moveComponentTo(null as any, b)).toBe(false); // 组件非法
  });

  it('渲染队列被标记（两层都要重建队列）', () => {
    const a = makeIce();
    const b = makeIce();
    const rect: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    a.addChild(rect);
    (a.renderer.markQueueDirty as any).mockClear();
    (b.renderer.markQueueDirty as any).mockClear();

    a.moveComponentTo(rect, b);
    expect(a.renderer.markQueueDirty).toHaveBeenCalled();
    expect(b.renderer.markQueueDirty).toHaveBeenCalled();
  });
});
