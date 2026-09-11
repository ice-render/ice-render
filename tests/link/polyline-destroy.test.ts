/**
 * 连线（ICEPolyLine）生命周期回归：**销毁后不得再被 ICE 总线事件驱动**。
 *
 * 场景（应用层 ice-entity-designer 的 undo/redo 批量增删连线时必现）：
 * 1. 新增连线 → `afterAddHandler` 在 **ICE 总线**上注册 `once(ROUND_FINISH, syncConnections)`；
 * 2. 同一 tick 内又被删除 → `destory()`（`this.ice` / `this.evtBus` 置空）；
 * 3. 该监听不在组件自己的 listeners 里，`purgeEvents()` 清不掉 → 下一轮渲染完成（ROUND_FINISH）
 *    仍会触发它 → `syncConnections()` 里 `this.ice.dirty = true` 抛
 *    `Cannot set properties of null (setting 'dirty')`。
 *
 * 修复：`destory()` 显式 off + `syncConnections()` 在未挂载/已销毁时直接返回。
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICE_EVENT_NAME_CONSTS from '../../src/consts/ICE_EVENT_NAME_CONSTS';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  return ice;
}

describe('ICEPolyLine 销毁后的事件驱动', () => {
  it('销毁后 ROUND_FINISH 不再触发 syncConnections，也不抛错', () => {
    const ice = makeIce();
    const spy = jest.spyOn(ICEPolyLine.prototype as any, 'syncConnections');
    const host: any = new ICERect({ width: 40, height: 30 });
    ice.addChild(host);

    // ① 活着时：ROUND_FINISH 触发一次，once 自摘
    const alive: any = new ICEPolyLine({
      points: [
        [0, 0],
        [50, 50],
      ],
      links: { start: { id: host.props.id, position: 'R' } },
    });
    ice.addChild(alive);
    ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH);
    expect(spy).toHaveBeenCalledTimes(1);

    // ② 新增后立刻删除（模拟 undo/redo 批量增删）
    spy.mockClear();
    const doomed: any = new ICEPolyLine({
      points: [
        [0, 0],
        [50, 50],
      ],
      links: { start: { id: host.props.id, position: 'R' } },
    });
    ice.addChild(doomed);
    ice.removeChild(doomed);
    expect(doomed.ice).toBeNull(); // destory() 已执行

    expect(() => ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH)).not.toThrow();
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it('未挂载时 setState({links}) 不再抛错（挂载后由 ROUND_FINISH 完成首次同步）', () => {
    const line: any = new ICEPolyLine({
      points: [
        [0, 0],
        [10, 10],
      ],
    });
    expect(() => line.setState({ links: { start: { id: 'not-mounted', position: 'R' } } })).not.toThrow();

    // 挂载并让 ROUND_FINISH 走一遍：宿主存在时连接建立、且不抛错
    const ice = makeIce();
    const host: any = new ICERect({ width: 40, height: 30 });
    ice.addChild(host);
    line.setState({ links: { start: { id: host.props.id, position: 'R' } } });
    ice.addChild(line);
    expect(() => ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH)).not.toThrow();
    expect(line.state.draggable).toBe(false); // createLink 生效的标志
  });

  it('销毁后从 ICE 总线的 ROUND_FINISH 监听中摘除（不留悬挂引用）', () => {
    const ice = makeIce();
    const host: any = new ICERect({ width: 40, height: 30 });
    ice.addChild(host);

    const line: any = new ICEPolyLine({
      points: [
        [0, 0],
        [50, 50],
      ],
      links: { start: { id: host.props.id, position: 'R' } },
    });
    ice.addChild(line);
    const listeners = ice.evtBus.listeners[ICE_EVENT_NAME_CONSTS.ROUND_FINISH] || [];
    expect(listeners.length).toBe(1);

    ice.removeChild(line);
    const after = ice.evtBus.listeners[ICE_EVENT_NAME_CONSTS.ROUND_FINISH] || [];
    expect(after.length).toBe(0);
  });
});
