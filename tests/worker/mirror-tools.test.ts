/**
 * 「工具层显示给谁」这条镜像链路：`ICEControlPanelManager.applySelection()` → 桥 → worker。
 *
 * 为什么值得单独一个文件：控制面板**不是插件注册的**，是 `ICEControlPanelManager` 在 mousedown 时
 * 直接挂上去的（见 `mouseDownHandler` 的长注释）。所以"在别处选中一个组件"（worker 镜像按主线程
 * 推来的 id 选中）本来没有入口 —— 2026-09-20 把这套判定抽成了公开的 `applySelection()`，
 * 主线程点选、点空白隐藏、镜像同步三条路径现在共用它。这个文件钉的就是"抽出来的那条路径还在报信"。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});
global.Path2D = class {
  rect() {}
  roundRect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
} as any;

import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICEControlPanelManager from '../../src/control-panel/ICEControlPanelManager';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';
import MirrorBridge from '../../src/worker/MirrorBridge';

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.serializer = new Serializer(ice);
  ice.deserializer = new Deserializer(ice);
  ice.renderer = { markQueueDirty: () => {} };
  return ice;
}

function setup() {
  const ice = makeIce();
  const manager = new ICEControlPanelManager(ice);
  ice.controlPanelManager = manager;
  const sent: any[] = [];
  const bridge = new MirrorBridge(ice, { send: (msg) => sent.push(msg) });
  const rect = new ICERect({ left: 0, top: 0, width: 40, height: 30, interactive: true, transformable: true });
  ice.addChild(rect);
  bridge.flush(); // 首帧全量
  sent.length = 0;
  return { ice, manager, bridge, sent, rect };
}

describe('控制面板目标 → 镜像', () => {
  it('applySelection(rect)：显示面板，并把目标 id 排进协议', () => {
    const { manager, bridge, sent, rect } = setup();
    manager.applySelection(rect);
    expect(manager.transformControlPanel.state.display).toBe(true);
    expect(manager.transformControlPanel.targetComponent).toBe(rect);

    bridge.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].t).toBe('selection');
    expect(sent[0].ids).toEqual([rect.props.id]);
  });

  it('applySelection(null)：隐藏面板，并推一条空目标（点空白处只隐藏、不清空选中列表）', () => {
    const { manager, bridge, sent, rect } = setup();
    manager.applySelection(rect);
    bridge.flush();
    sent.length = 0;

    manager.applySelection(null);
    expect(manager.transformControlPanel.state.display).toBe(false);

    bridge.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].t).toBe('selection');
    expect(sent[0].ids).toEqual([]);
  });

  it('不可变换的组件：不显示面板，也不把目标推过去', () => {
    const { ice, manager, bridge, sent } = setup();
    const fixed = new ICERect({ left: 0, top: 0, width: 10, height: 10, interactive: true, transformable: false });
    ice.addChild(fixed);
    bridge.flush();
    sent.length = 0;

    manager.applySelection(fixed);
    expect(manager.transformControlPanel.state.display).toBe(false);
    bridge.flush();
    expect(sent[0].ids).toEqual([]);
  });

  it('连线型组件走端点面板（linkEditable 门控），同样是同一个通知出口', () => {
    const { ice, manager, bridge, sent } = setup();
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [50, 50],
      ],
      interactive: true,
      transformable: false,
      linkEditable: true,
    });
    ice.addChild(line);
    bridge.flush();
    sent.length = 0;

    manager.applySelection(line);
    expect(manager.lineControlPanel.state.display).toBe(true);
    bridge.flush();
    expect(sent[0].t).toBe('selection');
    expect(sent[0].ids).toEqual([line.props.id]);
  });
});
