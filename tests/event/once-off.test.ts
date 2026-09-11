/**
 * `once()` 注册的监听必须能被 `off()` **提前摘除**。
 *
 * 旧实现：`once` 内部把 `fn` 包成 `callback` 再 `on`，而 `off` 只比较 `item.callback === fn`
 * → 外部拿原始 `fn` 去 off **永远匹配不到**，监听只能等自己触发一次才消失。
 *
 * 这直接造成「组件已销毁，但悬挂在总线上的 once 监听仍会在事件到来时操作已销毁对象」
 * —— 应用层（ice-entity-designer）批量 undo/redo 增删连线时就会命中：
 * `ICEPolyLine` 的 ROUND_FINISH 监听在组件 destory 后触发 `syncConnections`，
 * 写 `this.ice.dirty` 时抛 `Cannot set properties of null (setting 'dirty')`。
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import ICERect from '../../src/graphic/shape/ICERect';
import ICE_EVENT_NAME_CONSTS from '../../src/consts/ICE_EVENT_NAME_CONSTS';

const EVT = ICE_EVENT_NAME_CONSTS.AFTER_MOVE;

describe('once() / off() 契约', () => {
  it('once 注册的监听可被 off 提前摘除（旧实现匹配不到包装函数）', () => {
    const target: any = new ICERect({ width: 10, height: 10 });
    const handler = jest.fn();

    target.once(EVT, handler, target);
    target.off(EVT, handler, target);
    target.trigger(EVT);

    expect(handler).not.toHaveBeenCalled();
  });

  it('未 off 时 once 仍然只触发一次并自摘', () => {
    const target: any = new ICERect({ width: 10, height: 10 });
    const handler = jest.fn();

    target.once(EVT, handler, target);
    target.trigger(EVT);
    target.trigger(EVT);
    target.trigger(EVT);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('scope 不同则不会误删（off 仍要求 scope 一致）', () => {
    const target: any = new ICERect({ width: 10, height: 10 });
    const handler = jest.fn();
    const otherScope = {};

    target.once(EVT, handler, target);
    target.off(EVT, handler, otherScope); // scope 不匹配 → 不应摘除
    target.trigger(EVT);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('on 注册的普通监听不受影响', () => {
    const target: any = new ICERect({ width: 10, height: 10 });
    const handler = jest.fn();

    target.on(EVT, handler, target);
    target.trigger(EVT);
    target.trigger(EVT);

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
