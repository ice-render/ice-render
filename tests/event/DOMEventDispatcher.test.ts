import DOMEventDispatcher from '../../src/event/DOMEventDispatcher';
import TransformControlPanel from '../../src/control-panel/transform-controls/TransformControlPanel';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';

// node 环境无 window / Path2D
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

describe('命中检测（N 层嵌套下的选中）', () => {
  it('父容器被面板覆盖时，点击子组件仍命中子组件', () => {
    const parent = new ICEGroup({ left: 100, top: 100, width: 200, height: 150 });
    const child = new ICERect({ left: 50, top: 50, width: 50, height: 30 });
    parent.addChild(child);
    // 面板覆盖父容器包围盒（等价于选中父容器后显示的控制面板）
    const panel = new TransformControlPanel({ left: 100, top: 100, width: 200, height: 150 });

    // 预计算 composedMatrix，保证 containsPoint 可用
    parent.getMinBoundingBox(true);
    child.getMinBoundingBox(true);
    panel.getMinBoundingBox(true);

    const ice: any = { childNodes: [parent], toolNodes: [panel], screenToWorld: (x: number, y: number) => [x, y] };
    const dispatcher = new DOMEventDispatcher(ice);

    // 子组件全局位置约 (150,150)-(200,180)，取内部点 (175,165)
    const target = (dispatcher as any).findTargetComponent({ offsetX: 175, offsetY: 165 });
    expect(target).toBe(child);
  });

  it('点击父容器空白处（非子组件），命中父容器', () => {
    const parent = new ICEGroup({ left: 100, top: 100, width: 200, height: 150 });
    const child = new ICERect({ left: 50, top: 50, width: 50, height: 30 });
    parent.addChild(child);
    const panel = new TransformControlPanel({ left: 100, top: 100, width: 200, height: 150 });

    parent.getMinBoundingBox(true);
    child.getMinBoundingBox(true);
    panel.getMinBoundingBox(true);

    const ice: any = { childNodes: [parent], toolNodes: [panel], screenToWorld: (x: number, y: number) => [x, y] };
    const dispatcher = new DOMEventDispatcher(ice);

    // 父容器内、子组件外的点 (100+10, 100+10) = (110,110)
    const target = (dispatcher as any).findTargetComponent({ offsetX: 110, offsetY: 110 });
    expect(target).toBe(parent);
  });
});
