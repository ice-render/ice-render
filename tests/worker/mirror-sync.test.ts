/**
 * 跨线程镜像同步（阶段二 · 第一块）的**等价性**回归。
 *
 * 这一层要回答的问题只有一个：**主线程的树改了以后，镜像是不是"同一棵树"**。
 * 做法是把两侧的 `toJSONObject()` 拿出来逐字比 —— 序列化格式里带的是
 * `state`（已排除派生缓存）+ `type` + `childNodes`，正是"渲染需要的最小充分信息"。
 * 只要这份文档相同，镜像渲染出来的东西就与主线程一致（像素级对照另有 e2e：
 * `e2e/visual/worker-mirror.spec.ts`）。
 *
 * 覆盖的四类语义：
 * 1. **全量**：首次 `scene` 之后两侧文档一致；
 * 2. **增量**：`setState`/动画写值（`paramsDirty:false`）走 `ops`，且同组件的连续补丁**合并成一条**；
 * 3. **结构变更走全量**：增删子节点让桥重发 `scene`（v1 的明确边界）；
 * 4. **自愈**：镜像报 `missing` → 桥重排全量；坏 op 只计数、不污染镜像。
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
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICECircle from '../../src/graphic/shape/ICECircle';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';
import MirrorBridge from '../../src/worker/MirrorBridge';
import MirrorTarget from '../../src/worker/MirrorTarget';
import { notifyToolTarget } from '../../src/worker/mirror-hooks';

/** 最小可用的 ICE：与 `init()` 里那两行一致地装上序列化器（不启动任何 Manager）。 */
function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.serializer = new Serializer(ice);
  ice.deserializer = new Deserializer(ice);
  return ice;
}

/** 只比较"渲染需要的最小充分信息"：去掉两侧必然不同的文档元信息。 */
function treeDoc(ice: any): any {
  const doc: any = ice.toJSONObject();
  delete doc.createTime;
  // 这两个字段是"这一次写出"的时刻，两侧各写各的，必然差几毫秒 —— 与树本身无关
  delete doc.lastModifyTime;
  delete doc.lastModified;
  delete doc.version;
  delete doc.theme;
  return doc;
}

type Harness = {
  main: any;
  mirror: any;
  bridge: MirrorBridge;
  target: MirrorTarget;
  sent: any[];
  /** 把已发出的消息全部喂给镜像（模拟消息通道） */
  deliver: () => { applied: number };
  /** 主线程一侧的文档 vs 镜像一侧的文档 */
  expectSameTree: () => void;
};

function makeHarness(): Harness {
  const main = makeIce();
  const mirror = makeIce();
  const sent: any[] = [];
  const bridge = new MirrorBridge(main, { send: (msg) => sent.push(msg) });
  const target = new MirrorTarget(mirror);
  const deliver = () => {
    let applied = 0;
    for (const msg of sent.splice(0, sent.length)) {
      const result = target.applyCommand(msg);
      if (msg.t === 'scene' || msg.t === 'ops') applied++;
      // 注意 `[]` 是 truthy：必须判长度，否则空 missing 会被当成"缺组件"，触发一次白重发
      if (result && result.missing && result.missing.length) {
        bridge.handleEvent({ t: 'missing', v: 1, seq: msg.seq, ids: result.missing });
      }
    }
    return { applied };
  };
  const expectSameTree = () => {
    expect(treeDoc(mirror)).toEqual(treeDoc(main));
  };
  return { main, mirror, bridge, target, sent, deliver, expectSameTree };
}

/** 一棵有点结构的树：容器 + 形状，够覆盖"树序 / 嵌套 / 兄弟"。 */
function buildTree(ice: any) {
  const group = new ICEGroup({ left: 10, top: 20, width: 200, height: 120 });
  const rect = new ICERect({ left: 5, top: 5, width: 40, height: 30, radius: 4 });
  const circle = new ICECircle({ left: 60, top: 5, radius: 12 });
  ice.addChild(group);
  group.addChild(rect);
  group.addChild(circle);
  return { group, rect, circle };
}

describe('MirrorBridge ↔ MirrorTarget 等价性', () => {
  it('全量：首次 scene 之后两侧文档逐字一致，且 id 索引建得起来', () => {
    const h = makeHarness();
    const { group, rect, circle } = buildTree(h.main);

    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('scene');
    h.deliver();

    h.expectSameTree();
    expect(h.target.size).toBe(3);
    expect(h.target.has(rect.props.id)).toBe(true);
    expect(h.target.has(group.props.id)).toBe(true);
    expect(h.target.has(circle.props.id)).toBe(true);
    // 镜像里的组件是**另一批对象**（不是同一个引用）
    expect(h.target.get(rect.props.id)).not.toBe(rect);
  });

  it('增量：setState 走 ops，应用后两侧一致（含嵌套 style 深合并）', () => {
    const h = makeHarness();
    const { rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();

    rect.setState({ left: 123, style: { fillStyle: '#ff0000' } });
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('ops');
    expect(h.sent[0].ops).toEqual([['state', rect.props.id, { left: 123, style: { fillStyle: '#ff0000' } }]]);
    h.deliver();

    h.expectSameTree();
    const mirrored = h.target.get(rect.props.id);
    expect(mirrored.state.left).toBe(123);
    expect(mirrored.state.style.fillStyle).toBe('#ff0000');
    // 深合并：没提到的其它 style 键不能被抹掉
    expect(mirrored.state.style.lineWidth).toBe(rect.state.style.lineWidth);
  });

  it('合并：同一组件的连续补丁只发一条 op，且与逐次 setState 等价', () => {
    const h = makeHarness();
    const { rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();

    // 动画写值通道的真实形态：一帧里对同一个组件写多次，且带 paramsDirty:false
    rect.setState({ left: 1 }, { paramsDirty: false });
    rect.setState({ top: 2 }, { paramsDirty: false });
    rect.setState({ style: { lineWidth: 3 } }, { paramsDirty: false });

    expect(h.bridge.pendingOps).toBe(1);
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].ops).toHaveLength(1);
    expect(h.sent[0].ops[0][2]).toEqual({ left: 1, top: 2, style: { lineWidth: 3 } });
    h.deliver();

    h.expectSameTree();
    expect(h.target.get(rect.props.id).state.left).toBe(1);
    expect(h.target.get(rect.props.id).state.top).toBe(2);
  });

  it('结构变更走全量重同步（v1 边界）：增删子节点之后发的是 scene，不是 ops', () => {
    const h = makeHarness();
    const { group } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();

    const extra = new ICERect({ left: 90, top: 5, width: 20, height: 20 });
    group.addChild(extra);
    // 结构变更之后再叠一次状态变更：两者要在同一批里被 scene 覆盖
    extra.setState({ left: 95 });
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('scene');
    h.deliver();

    h.expectSameTree();
    expect(h.target.size).toBe(4);
    expect(h.target.has(extra.props.id)).toBe(true);

    // 删除同理
    group.removeChild(extra);
    h.bridge.flush();
    expect(h.sent[0].t).toBe('scene');
    h.deliver();
    h.expectSameTree();
    expect(h.target.has(extra.props.id)).toBe(false);
  });

  it('自愈：镜像报 missing → 桥重排全量，下一批发 scene', () => {
    const h = makeHarness();
    const { rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();

    // 模拟"镜像里没有这个组件"（比如 worker 侧类型没注册被跳过）
    const result = h.target.applyOps([['state', 'ICE_not_exist', { left: 1 }]]);
    expect(result.missing).toEqual(['ICE_not_exist']);
    expect(result.applied).toBe(0);

    h.bridge.handleEvent({ t: 'missing', v: 1, seq: 1, ids: ['ICE_not_exist'] });
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('scene');
    h.deliver();
    h.expectSameTree();
    expect(h.target.has(rect.props.id)).toBe(true);
  });

  it('坏 op 只计数、不改镜像（协议坏数据不能悄悄改树）', () => {
    const h = makeHarness();
    const { rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();
    const before: any = JSON.stringify(treeDoc(h.mirror));

    const result = h.target.applyOps([['add', 'x', 0, {}] as any, ['state', '', {}] as any, null as any]);
    expect(result.invalid).toBe(3);
    expect(result.applied).toBe(0);
    expect(JSON.stringify(treeDoc(h.mirror))).toBe(before);
    expect(h.target.has(rect.props.id)).toBe(true);
  });

  it('不可克隆的值在桥上被丢掉并记录路径（否则 postMessage 会直接抛 DataCloneError）', () => {
    const h = makeHarness();
    const { rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();

    class HostObject {}
    rect.setState({ left: 7, style: { fillStyle: new HostObject() as any } });
    h.bridge.flush();

    const ops = h.sent[0].ops;
    expect(ops[0][2]).toEqual({ left: 7, style: {} });
    expect(h.bridge.dropped.some((p) => p.indexOf('HostObject') >= 0)).toBe(true);
    h.deliver();
    // 镜像侧：left 变了、宿主对象没过去（但树仍然一致 —— 主线程自己的 state 也留着那个对象，
    // 所以这里只比对"镜像拿到的那部分"）
    expect(h.target.get(rect.props.id).state.left).toBe(7);
  });

  it('detach 之后钩子立刻失效（引擎回到零成本）', () => {
    const h = makeHarness();
    const { rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();
    h.bridge.detach();

    rect.setState({ left: 999 });
    expect(h.bridge.pendingOps).toBe(0);
    h.bridge.flush();
    expect(h.sent).toHaveLength(0);
  });

  it('工具层"显示给谁"推给镜像，worker 侧用同一套机制选中同一个组件', () => {
    const h = makeHarness();
    const { rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();

    // 真实路径是 `ICEControlPanelManager.applySelection()` 里调这个钩子（管理器接线由
    // tests/worker/mirror-tools.test.ts 与 e2e 覆盖；这里只钉桥的协议语义）
    notifyToolTarget(h.main, rect);
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('selection');
    expect(h.sent[0].ids).toEqual([rect.props.id]);
    h.deliver();

    expect(h.mirror.selectionList.map((c: any) => c.props.id)).toEqual([rect.props.id]);
    // 镜像里选中项是**另一批对象**（同一棵树的两份）
    expect(h.mirror.selectionList[0]).not.toBe(rect);
  });

  it('隐藏面板也会镜像（点空白处引擎只隐藏、不清空选中列表）', () => {
    const h = makeHarness();
    const { rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();
    notifyToolTarget(h.main, rect);
    h.bridge.flush();
    h.deliver();

    notifyToolTarget(h.main, null);
    h.bridge.flush();
    expect(h.sent[0].t).toBe('selection');
    expect(h.sent[0].ids).toEqual([]);
  });

  it('工具目标是状态不是事件流：一帧里连点多次只发最后一次', () => {
    const h = makeHarness();
    const { rect, circle, group } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();

    notifyToolTarget(h.main, rect);
    notifyToolTarget(h.main, circle);
    notifyToolTarget(h.main, group);
    expect(h.bridge.pendingSelection).toEqual([group.props.id]);
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].ids).toEqual([group.props.id]);
  });

  it('全量场景重建了整棵树：选择在同一条 flush 里补发（否则"结构一变手柄就没了"）', () => {
    const h = makeHarness();
    const { group, rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();
    notifyToolTarget(h.main, rect);
    h.bridge.flush();
    h.deliver();
    expect(h.mirror.selectionList.map((c: any) => c.props.id)).toEqual([rect.props.id]);

    // 结构变更 → pendingScene；此时选择虽然"没变"，也必须跟着重建后的树补一次
    group.addChild(new ICECircle({ left: 1, top: 1, radius: 5 }));
    h.bridge.flush();
    // 顺序固定：scene → selection
    expect(h.sent.map((m) => m.t)).toEqual(['scene', 'selection']);
    expect(h.sent[1].ids).toEqual([rect.props.id]);
    h.deliver();
    // 重建后的镜像树上，选择仍然在（手柄不会消失）
    expect(h.mirror.selectionList.map((c: any) => c.props.id)).toEqual([rect.props.id]);
  });
});
