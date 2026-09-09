import TransformControlPanel from '../../src/control-panel/transform-controls/TransformControlPanel';
import ICE_EVENT_NAME_CONSTS from '../../src/consts/ICE_EVENT_NAME_CONSTS';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';

// node 环境无 window / Path2D，替换跨平台 root + 提供 Path2D 桩
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
};

describe('变换手柄坐标计算（回归：连续变换后手柄脱离图元）', () => {
  it('嵌套(缩放+旋转)组件选中后，面板贴合其全局包围盒', () => {
    const root = new ICEGroup({ width: 300, height: 200, transform: { scale: [1.3, 1.3], rotate: 45 } });
    const target = new ICERect({ left: 10, top: 10, width: 100, height: 50 });
    root.addChild(target);

    const panel = new TransformControlPanel({ width: 100, height: 100, transform: { rotate: 0 } });
    panel.targetComponent = target; // 触发 updatePanel

    const box = target.getLocalLeftTop(true);
    expect(Number.isFinite(panel.state.left)).toBe(true);
    expect(panel.state.left).toBeCloseTo(box.left, 1);
    expect(panel.state.top).toBeCloseTo(box.top, 1);
    expect(panel.state.width).toBeCloseTo(box.width, 1);
    expect(panel.state.height).toBeCloseTo(box.height, 1);
  });

  it('calcAbsoluteLinearMatrix 实时反映最新 rotate，而缓存 absoluteLinearMatrix 可能过期', () => {
    const rect = new ICERect({ width: 100, height: 50, transform: { rotate: 0 } });
    // 触发一次 compose，让缓存 absoluteLinearMatrix 反映 rotate=0
    rect.getRotateAngle(true);
    expect(rect.state.absoluteLinearMatrix[0]).toBeCloseTo(1, 6); // R(0)=[1,0,0,1,...]

    // 修改 rotate 但不渲染：缓存仍是旧值（这是连续变换漂移的根因）
    rect.setState({ transform: { rotate: 90 } });
    expect(rect.state.absoluteLinearMatrix[0]).toBeCloseTo(1, 6); // 缓存过期，仍是 R(0)

    // 实时重算才是新值 R(90)=[0,1,-1,0,...]
    const fresh = rect.calcAbsoluteLinearMatrix();
    expect(fresh[0]).toBeCloseTo(0, 6); // cos90
    expect(fresh[1]).toBeCloseTo(1, 6); // sin90
    expect(fresh[2]).toBeCloseTo(-1, 6);
  });

  it('旋转后 updatePanel 重新贴合目标（修复 resize→rotate→resize 漂移）', () => {
    const target = new ICERect({ left: 10, top: 10, width: 100, height: 50 });
    const panel = new TransformControlPanel({ width: 100, height: 100, transform: { rotate: 0 } });
    panel.targetComponent = target;

    // 模拟 RotateControl：设置面板旋转角后触发 AFTER_ROTATE
    panel.setState({ transform: { rotate: 30 } });
    panel.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE);

    // 目标被旋转到 30°，面板宽高应重新贴合其旋转后的包围盒
    expect(target.getRotateAngle(true)).toBeCloseTo(30, 1);
    const box = target.getLocalLeftTop(true);
    expect(panel.state.width).toBeCloseTo(box.width, 1);
    expect(panel.state.height).toBeCloseTo(box.height, 1);
  });

  it('toggleControlQuadrant 交换象限后 8 个手柄象限仍唯一（修复手柄消失）', () => {
    const panel = new TransformControlPanel({ width: 100, height: 100 });
    const handles = (panel as any).resizeControlInstanceCache;
    const quadrants = () => handles.map((h) => h.state.quadrant);

    // 初始 8 个象限唯一
    expect(new Set(quadrants()).size).toBe(8);

    // 拖拽 q=1 手柄跨到「相邻」象限 q=2（此前用对角映射会产出重复象限）
    const dragged = handles.find((h) => h.state.quadrant === 1);
    (panel as any).toggleControlQuadrant(dragged, 1, 2);

    const qs = quadrants();
    expect(new Set(qs).size).toBe(8); // 仍唯一，无重复
    expect(qs).toContain(1); // 原 q=2 手柄顶替到 q=1
    expect(qs).toContain(2); // 拖拽手柄变成 q=2
    expect(dragged.state.quadrant).toBe(2);
  });
});
