/**
 * 控制面板的选中门控（2026-09-13 修）。
 *
 * 背景：`ICEControlPanelManager.mouseDownHandler` 原来用**同一个** `transformable` 决定
 * 「要不要给这个组件控制面板」。但线条型组件的面板是 **LineControlPanel（两端端点手柄）**，
 * 它的语义是「拖动端点改变连接关系」，跟「旋转 / 缩放手柄」完全是两回事。
 *
 * 于是下游踩坑：应用层为了「记法不可变换」（不给旋转/缩放手柄）把连线设成 `transformable: false`，
 * 连带把端点手柄也关掉了 —— 用户点连线时看不到 hook、也没法把线拖到别的组件上
 * （ice-entity-designer 的 8 个域包全是这个症状）。
 *
 * 现在的契约：
 * - 非线条组件：仍然只看 `transformable`（行为不变）；
 * - 线条组件：端点手柄只看 `linkEditable`（默认开），`transformable: false` 不再影响它。
 */
import ICEControlPanelManager from '../../src/control-panel/ICEControlPanelManager';
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
import ICERect from '../../src/graphic/shape/ICERect';
import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';

jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});

function makeManager() {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.addTool = (tool: any) => {
    ice.toolNodes.push(tool);
    return tool;
  };
  // 排他插件工具：测试里不装插件，恒为"没命中"
  ice.setSelection = () => false;
  const manager: any = new ICEControlPanelManager(ice);
  return { ice, manager };
}

function click(manager: any, ice: any, component: any) {
  // 引擎的门控会读 component.ice（"这个组件属于某个 ICE 实例"），单测里手动挂上
  component.ice = ice;
  manager.mouseDownHandler({ target: component, param: { component } });
}

describe('控制面板选中门控：线条端点手柄 ≠ 变换手柄', () => {
  it('不可变换的连线（transformable:false）被选中时，端点手柄面板仍然启用', () => {
    const { ice, manager } = makeManager();
    const line: any = new ICEPolyLine({
      points: [
        [0, 0],
        [10, 10],
      ],
      transformable: false, // 应用层"记法不可变换"的写法
    });

    click(manager, ice, line);

    expect(manager.lineControlPanel.targetComponent).toBe(line);
    expect(manager.lineControlPanel.state.display).toBe(true);
  });

  it('连线显式写 linkEditable:false 时，端点手柄面板不启用（新的显式关闭开关）', () => {
    const { ice, manager } = makeManager();
    const line: any = new ICEPolyLine({
      points: [
        [0, 0],
        [10, 10],
      ],
      linkEditable: false,
    });

    click(manager, ice, line);

    expect(manager.lineControlPanel.state.display).toBe(false);
  });

  it('非线条组件维持原语义：transformable:false 就不给变换面板', () => {
    const { ice, manager } = makeManager();
    const rect: any = new ICERect({ left: 10, top: 10, width: 40, height: 30, transformable: false });

    click(manager, ice, rect);

    expect(manager.transformControlPanel.state.display).toBe(false);
    expect(manager.lineControlPanel.state.display).toBe(false);
  });

  it('可变换的普通组件仍然拿到变换面板（无回归）', () => {
    const { ice, manager } = makeManager();
    const rect: any = new ICERect({ left: 10, top: 10, width: 40, height: 30 });

    click(manager, ice, rect);

    expect(manager.transformControlPanel.targetComponent).toBe(rect);
    expect(manager.transformControlPanel.state.display).toBe(true);
  });
});
