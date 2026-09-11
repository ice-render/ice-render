/**
 * 一致性修复：查找 / 事件契约 / 监听器生命周期。
 *
 * 契约：
 * - findComponent **只搜顶层**（已知限制，见下）；顶层优先
 * - flattenTree 的 _pid 用 props.id（旧实现取 node.id 恒为 undefined），同时兼容普通对象
 * - removeChild / removeTool 触发 AFTER_REMOVE（旧实现只触发 BEFORE_REMOVE，AFTER_REMOVE 是死代码）；
 *   且必须在 destory() 之前触发，否则 destory 的 purgeEvents 会让监听者收不到
 * - 反复切换面板目标 / 插槽宿主不累积监听（旧实现用 once + 箭头函数，无法 off）
 * - 插槽位置未变时不置脏（避免「有 linkable 组件就永不空闲」）
 * - destroy() 是 destory() 的拼写修正别名
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICE_EVENT_NAME_CONSTS from '../../src/consts/ICE_EVENT_NAME_CONSTS';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICELinkSlot from '../../src/graphic/link/ICELinkSlot';
import TransformControlPanel from '../../src/control-panel/transform-controls/TransformControlPanel';
import { flattenTree } from '../../src/util/data-util';

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  return ice;
}

function beforeRemoveCount(c: any): number {
  return ((c.listeners && c.listeners[ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE]) || []).length;
}

describe('findComponent 查找范围（记录当前行为与已知限制）', () => {
  /**
   * 查找范围：**先顶层（同 id 顶层优先），再深度优先递归子树**；工具层不参与查找。
   *
   * 递归是「连线连接嵌套子组件」能生效的前提。2026-09-11 之前只搜顶层，是因为放开递归会让
   * `dirty-rect-pixel` 富场景 step1 出现约 900 px 差异；后经定位，根因**不是**连线端点推导，
   * 而是**折线包围盒退化**（`ICEPolyLine` 的 `state.width ≈ 0` → 上屏快照盒退化 →
   * 局部重绘挑不中折线 → 擦除区域内的折线笔迹丢失）。该缺陷已修（`ICEComponent.__localBox` +
   * `ICEPolyLine.calcComponentParams`），像素回归恢复 100% 一致，故放开递归。
   */
  it('嵌套子组件可命中（递归查找）', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ width: 100, height: 100 });
    const nested: any = new ICERect({ width: 10, height: 10 });
    group.addChild(nested);
    ice.addChild(group);

    expect(ice.findComponent(nested.props.id)).toBe(nested);
  });

  it('多层嵌套也能命中', () => {
    const ice = makeIce();
    const outer: any = new ICEGroup({ width: 100, height: 100 });
    const inner: any = new ICEGroup({ width: 50, height: 50 });
    const deep: any = new ICERect({ width: 10, height: 10 });
    inner.addChild(deep);
    outer.addChild(inner);
    ice.addChild(outer);

    expect(ice.findComponent(deep.props.id)).toBe(deep);
  });

  it('工具层组件不参与查找（工具是 UI 覆盖层，不应成为连线端点）', () => {
    const ice = makeIce();
    const tool: any = new ICERect({ width: 10, height: 10 });
    ice.addTool(tool);
    expect(ice.findComponent(tool.props.id)).toBeUndefined();
  });

  it('顶层组件可命中', () => {
    const ice = makeIce();
    const top: any = new ICERect({ width: 10, height: 10 });
    ice.addChild(top);
    expect(ice.findComponent(top.props.id)).toBe(top);
  });

  it('顶层优先于同名嵌套（保持既有优先级）', () => {
    const ice = makeIce();
    const top: any = new ICERect({ width: 10, height: 10 });
    const group: any = new ICEGroup({ width: 100, height: 100 });
    const inner: any = new ICERect({ width: 10, height: 10, id: top.props.id });
    group.addChild(inner);
    ice.addChild(group);
    ice.addChild(top);

    expect(ice.findComponent(top.props.id)).toBe(top);
  });

  it('查不到时返回 undefined', () => {
    const ice = makeIce();
    expect(ice.findComponent('NOT_EXIST')).toBeUndefined();
  });
});

describe('flattenTree 父子关系', () => {
  it('真实组件形态：_pid 取 props.id（旧实现取 node.id 恒为 undefined）', () => {
    const parent: any = new ICEGroup({ width: 10, height: 10 });
    const child: any = new ICERect({ width: 5, height: 5 });
    parent.addChild(child);

    const flat = flattenTree([], [parent]);
    expect(flat[0]._pid).toBeNull();
    expect(flat[1]._pid).toBe(parent.props.id);
    expect(flat[1]._level).toBe(2);
  });

  it('兼容「普通对象 + 顶层 id」的用法', () => {
    const flat = flattenTree([], [{ id: 'p', childNodes: [{ id: 'c', childNodes: [] }] }]);
    expect(flat[1]._pid).toBe('p');
  });
});

describe('AFTER_REMOVE 事件契约', () => {
  it('removeChild 在组件级与总线级都触发 AFTER_REMOVE，且组件级监听能收到', () => {
    const ice = makeIce();
    const comp: any = new ICERect({ width: 10, height: 10 });
    ice.addChild(comp);

    const onComp = jest.fn();
    const onBus = jest.fn();
    comp.on(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE, onComp);
    ice.evtBus.on(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE, onBus);

    ice.removeChild(comp);

    expect(onComp).toHaveBeenCalledTimes(1);
    expect(onBus).toHaveBeenCalledTimes(1);
    expect(ice.childNodes).not.toContain(comp);
  });

  it('removeTool 同样触发 AFTER_REMOVE', () => {
    const ice = makeIce();
    const tool: any = new ICERect({ width: 10, height: 10 });
    ice.addTool(tool);

    const onTool = jest.fn();
    tool.on(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE, onTool);
    ice.removeTool(tool);

    expect(onTool).toHaveBeenCalledTimes(1);
    expect(ice.toolNodes).not.toContain(tool);
  });

  it('ICEGroup.removeChild 同样触发 AFTER_REMOVE', () => {
    const group: any = new ICEGroup({ width: 100, height: 100 });
    const child: any = new ICERect({ width: 10, height: 10 });
    group.addChild(child);

    const onChild = jest.fn();
    child.on(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE, onChild);
    group.removeChild(child);

    expect(onChild).toHaveBeenCalledTimes(1);
    expect(group.childNodes).not.toContain(child);
  });

  it('移除后组件已与引擎解绑（destory 仍在 AFTER_REMOVE 之后执行）', () => {
    const ice = makeIce();
    const comp: any = new ICERect({ width: 10, height: 10 });
    ice.addChild(comp);
    let iceAtAfterRemove: any = 'unset';
    comp.on(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE, () => {
      iceAtAfterRemove = comp.ice;
    });

    ice.removeChild(comp);

    expect(iceAtAfterRemove).toBe(ice); // 触发时还没被 destory 清空
    expect(comp.ice).toBeNull(); // 结束后已解绑
  });
});

describe('监听器不累积', () => {
  it('反复设置 TransformControlPanel.targetComponent 不累积 BEFORE_REMOVE 监听，切换时摘除旧的', () => {
    const panel: any = new TransformControlPanel({});
    const c1: any = new ICERect({ width: 10, height: 10 });
    const c2: any = new ICERect({ width: 10, height: 10 });

    panel.targetComponent = c1;
    panel.targetComponent = c1; // 重复设置同一个
    panel.targetComponent = c2;

    expect(beforeRemoveCount(c1)).toBe(0); // 切走后已摘除
    expect(beforeRemoveCount(c2)).toBe(1); // 只注册一次
  });

  it('反复切换 ICELinkSlot.hostComponent 不累积监听', () => {
    const slot: any = new ICELinkSlot({ position: 'T', radius: 6 });
    const h1: any = new ICERect({ width: 40, height: 20 });
    const h2: any = new ICERect({ width: 40, height: 20 });

    slot.hostComponent = h1;
    slot.hostComponent = h2;

    expect(beforeRemoveCount(h1)).toBe(0);
    expect(beforeRemoveCount(h2)).toBe(1);
    expect(h2.listeners[ICE_EVENT_NAME_CONSTS.AFTER_RENDER].length).toBe(1);
  });

  it('宿主被移除时插槽自动隐藏并解除绑定（稳定回调生效）', () => {
    const slot: any = new ICELinkSlot({ position: 'T', radius: 6 });
    const host: any = new ICERect({ width: 40, height: 20 });
    slot.hostComponent = host;
    expect(slot.state.display).toBe(true);

    host.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE);

    expect(slot.hostComponent).toBeNull();
    expect(slot.state.display).toBe(false);
  });
});

describe('插槽位置未变不置脏', () => {
  it('连续 updatePosition 只在位置真正变化时 setState', () => {
    const slot: any = new ICELinkSlot({ position: 'T', radius: 6 });
    const host: any = new ICERect({ left: 0, top: 0, width: 40, height: 20 });
    slot.hostComponent = host;

    const spy = jest.spyOn(slot, 'setState');
    slot.updatePosition(); // 第一次：从默认位置变为计算结果 → 置脏
    const afterFirst = spy.mock.calls.length;
    slot.updatePosition(); // 位置未变 → 不应再置脏
    slot.updatePosition();
    expect(spy.mock.calls.length).toBe(afterFirst);

    // 宿主移动后应重新置脏（必须走 setState：refresh 会重算矩阵，直接改缓存会被覆盖）
    host.setState({ left: 50, top: 50 });
    slot.updatePosition();
    expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
  });
});

describe('destroy 拼写别名', () => {
  it('destroy() 与 destory() 等价', () => {
    const ice = makeIce();
    const comp: any = new ICERect({ width: 10, height: 10 });
    ice.addChild(comp);
    expect(typeof comp.destroy).toBe('function');
    expect(typeof comp.destory).toBe('function');

    comp.destroy();
    expect(comp.ice).toBeNull();
    expect(comp.parentNode).toBeNull();
  });
});
