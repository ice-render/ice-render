import ICELinkSlot from '../../src/graphic/link/ICELinkSlot';
import ICERect from '../../src/graphic/shape/ICERect';

jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});

describe('ICELinkSlot 插槽位置', () => {
  it('切换宿主时**立刻**按新宿主定位（不能等新宿主下次重渲染）', () => {
    // 场景：钩子先掠过一个很大的泳道（宿主 A），再落到泳道里的任务上（宿主 B）。
    // 旧实现只在 setter 里订阅 B 的 AFTER_RENDER，却不立刻重算位置 —— 于是插槽
    // 继续挂在泳道边上，直到泳道下一次重渲染，用户看到的就是"插槽贴在大容器上、位置错乱"
    // （ice-entity-designer 的 bpmn-editor.html 实测）。
    const lane = new ICERect({ left: 0, top: 0, width: 600, height: 200 });
    const task = new ICERect({ left: 100, top: 60, width: 120, height: 80 });
    lane.getMinBoundingBox(true);
    task.getMinBoundingBox(true);

    const slot = new ICELinkSlot({ position: 'C', radius: 5 });
    slot.hostComponent = lane;
    expect([slot.state.left, slot.state.top]).toEqual([295, 95]); // 泳道中心 (300,100) - 半径 5

    // 只换宿主，不触发任何渲染事件
    slot.hostComponent = task;
    expect([slot.state.left, slot.state.top]).toEqual([155, 95]); // 任务中心 (160,100) - 半径 5
  });

  it('updatePosition 实时重算宿主矩阵，不读过期缓存', () => {
    const host = new ICERect({ left: 10, top: 10, width: 40, height: 30 });
    host.getMinBoundingBox(true); // 生成缓存（位于 left=10/top=10）
    host.setState({ left: 100, top: 100 }); // 移动但未渲染，缓存过期

    const slot = new ICELinkSlot({ position: 'T', radius: 5 });
    slot.hostComponent = host;
    (slot as any).updatePosition();

    // 宿主顶边中点在全局坐标 (120, 100)，减去半径 5 后为 (115, 95)
    expect(slot.state.left).toBeCloseTo(115, 5);
    expect(slot.state.top).toBeCloseTo(95, 5);
  });
});
