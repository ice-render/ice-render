/**
 * 容器移动时，后代的 AFTER_MOVE 必须被递归派发。
 *
 * 背景：`ICEPolyLine` 是「跟着宿主走」的组件 —— 它监听宿主（两端图元）的 AFTER_MOVE 重新路由折点。
 * 旧实现里 `setPosition()` 只派发**自己**的 AFTER_MOVE，于是拖动池/泳道这类容器时，
 * 内部的图元（监听者是自己的父容器？不是：图元的 left/top 是相对父容器的，容器移动不改它们的 state）
 * 会出现「方块跟着走了、挂在方块上的连线停在原地」。
 *
 * 线上表现（application：ice-entity-designer 的 BPMN 案例）：拖动「银行」池，池与泳道、
 * 池内的任务一起平移，但任务之间的顺序流折点不动，线从图元上脱开。
 *
 * 2026-09-12 修复：`setPosition()` 末尾递归派发 AFTER_MOVE（只派发事件、不改任何 state，
 * 订阅者自行按新的世界坐标重算）。
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICE_EVENT_NAME_CONSTS from '../../src/consts/ICE_EVENT_NAME_CONSTS';

const AFTER_MOVE = ICE_EVENT_NAME_CONSTS.AFTER_MOVE;
const BEFORE_MOVE = ICE_EVENT_NAME_CONSTS.BEFORE_MOVE;

describe('setPosition()：容器移动时递归派发 AFTER_MOVE', () => {
  it('子组件与孙组件都会收到 AFTER_MOVE（宿主连线的重路由依赖它）', () => {
    const pool: any = new ICEGroup({ left: 60, top: 60, width: 800, height: 320 });
    const lane: any = new ICEGroup({ left: 0, top: 32, width: 800, height: 150 });
    const task: any = new ICERect({ left: 100, top: 40, width: 120, height: 60 });
    pool.addChild(lane);
    lane.addChild(task);

    const onPool = jest.fn();
    const onLane = jest.fn();
    const onTask = jest.fn();
    pool.on(AFTER_MOVE, onPool, pool);
    lane.on(AFTER_MOVE, onLane, lane);
    task.on(AFTER_MOVE, onTask, task);

    pool.setPosition(pool.state.left + 50, pool.state.top + 30);

    expect(onPool).toHaveBeenCalledTimes(1);
    expect(onLane).toHaveBeenCalledTimes(1);
    expect(onTask).toHaveBeenCalledTimes(1);
    // 事件里带上容器的新位置，订阅者可据此换算（连线的 followComponent 也读这个载荷）
    expect(onTask.mock.calls[0][0].left).toBe(110);
    expect(onTask.mock.calls[0][0].top).toBe(90);
  });

  it('只派发事件、不改后代 state：子组件坐标仍相对父容器（嵌套语义不变）', () => {
    const pool: any = new ICEGroup({ left: 60, top: 60, width: 800, height: 320 });
    const lane: any = new ICEGroup({ left: 0, top: 32, width: 800, height: 150 });
    const task: any = new ICERect({ left: 100, top: 40, width: 120, height: 60 });
    pool.addChild(lane);
    lane.addChild(task);

    pool.setPosition(pool.state.left + 80, pool.state.top + 60);

    expect([lane.state.left, lane.state.top]).toEqual([0, 32]);
    expect([task.state.left, task.state.top]).toEqual([100, 40]);
    // 但世界坐标确实整体平移了：池 (140,120) + 泳道 (0,32) + 任务 (100,40)
    expect(task.getMinBoundingBox(true).tl).toEqual([240, 192]);
  });

  it('BEFORE_MOVE 不递归：只有被移动的组件自己收到（避免订阅者重复处理移动前状态）', () => {
    const pool: any = new ICEGroup({ left: 0, top: 0, width: 100, height: 100 });
    const child: any = new ICERect({ left: 10, top: 10, width: 20, height: 20 });
    pool.addChild(child);

    const onBefore = jest.fn();
    child.on(BEFORE_MOVE, onBefore, child);

    pool.setPosition(20, 20);

    expect(onBefore).not.toHaveBeenCalled();
  });

  it('叶子组件移动不受影响，且不会递归出错', () => {
    const rect: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    const handler = jest.fn();
    rect.on(AFTER_MOVE, handler, rect);

    expect(() => rect.setPosition(5, 5)).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
