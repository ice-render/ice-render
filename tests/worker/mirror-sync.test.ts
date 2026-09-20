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
import { notifyToolTarget, isMirroredComponent } from '../../src/worker/mirror-hooks';
import { MIRROR_PROTOCOL_VERSION } from '../../src/worker/mirror-protocol';

/**
 * 复合组件：内部子件（这里用矩形代指"底 / 标题 / 角标"）按 state 派生，**不进文档**
 * —— 与 IED 的 `FlowNode` 同类（真实应用里正是它暴露了下面两条语义）。
 */
class DerivedCard extends ICEGroup {
  /** 稳定的类型标识（下游打包会 mangle 类名，注册表按它还原组件） */
  public static readonly typeId = 'test:DerivedCard';

  public deco: any = null;
  /** 应用层补丁入口被调用的记录（断言"镜像侧重放走的是这个入口"） */
  public appliedPatches: any[] = [];

  constructor(props: any = {}) {
    super({ left: 0, top: 0, width: 100, height: 40, ...props });
    this.deco = new ICERect({ left: 0, top: 0, width: 100, height: 40 });
    this.addChild(this.deco);
  }

  public hasDerivedChildren(): boolean {
    return true;
  }

  /** 应用层派生入口：改 state 之外还要重算派生部件（IED 的 16 个组件都是这个形态） */
  public applyPatch(patch: Record<string, any> = {}): void {
    this.appliedPatches.push(patch);
    this.setState(patch);
  }
}

/**
 * "既是复合组件、又是容器"：`deco` 是派生件，其它子节点是**真实子节点**（进文档）
 * —— 与 IED 的池 / 泳道同类，序列化靠 `getSerializableChildren()` 声明。
 */
class CompositeContainer extends ICEGroup {
  public static readonly typeId = 'test:CompositeContainer';

  public deco: any = null;

  constructor(props: any = {}) {
    super({ left: 0, top: 0, width: 300, height: 200, ...props });
    this.deco = new ICERect({ left: 0, top: 0, width: 300, height: 200 });
    this.addChild(this.deco);
  }

  public hasDerivedChildren(): boolean {
    return true;
  }

  public getSerializableChildren(): any[] {
    return this.childNodes.filter((child: any) => child !== this.deco);
  }
}

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

/** 两侧各注册一次夹具类型（镜像树是反序列化出来的 —— 没注册的类型会被整棵跳过）。 */
function registerFixtures(h: Harness): void {
  h.main.registerType(DerivedCard.typeId, DerivedCard);
  h.main.registerType(CompositeContainer.typeId, CompositeContainer);
  h.mirror.registerType(DerivedCard.typeId, DerivedCard);
  h.mirror.registerType(CompositeContainer.typeId, CompositeContainer);
}

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
        bridge.handleEvent({ t: 'missing', v: MIRROR_PROTOCOL_VERSION, seq: msg.seq, ids: result.missing });
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

  it('结构增量：加子节点发 add op（不再重发整份文档），应用后两侧一致', () => {
    const h = makeHarness();
    const { group } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();
    h.sent.length = 0;

    const extra = new ICERect({ left: 90, top: 5, width: 20, height: 20 });
    group.addChild(extra);
    h.bridge.flush();

    // 结构增量：一条 add op 就够（老行为是整份 scene：200 节点场景 473KB + worker 冷启动全量重绘）
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('ops');
    expect(h.sent[0].ops[0][0]).toBe('add');
    h.deliver();

    h.expectSameTree();
    expect(h.target.has(extra.props.id)).toBe(true);
  });

  it('结构增量：删子节点发 remove op（不再重发整份文档），应用后两侧一致', () => {
    const h = makeHarness();
    const { group, circle } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();
    h.sent.length = 0;

    group.removeChild(circle);
    h.bridge.flush();

    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('ops');
    expect(h.sent[0].ops[0][0]).toBe('remove');
    h.deliver();

    h.expectSameTree();
    expect(h.target.has(circle.props.id)).toBe(false);
  });

  it('退回全量：宿主显式要求（resyncOnStructureChange）时结构变更仍走 scene', () => {
    const main = makeIce();
    const mirror = makeIce();
    const sent: any[] = [];
    const bridge = new MirrorBridge(main, { send: (msg) => sent.push(msg), resyncOnStructureChange: true });
    const target = new MirrorTarget(mirror);
    const group = new ICEGroup({ left: 10, top: 20, width: 200, height: 120 });
    main.addChild(group);
    bridge.flush();
    for (const msg of sent.splice(0, sent.length)) target.applyCommand(msg);

    const extra = new ICERect({ left: 90, top: 5, width: 20, height: 20 });
    group.addChild(extra);
    bridge.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].t).toBe('scene');
  });

  it('退回全量：子组件拿不到可寻址的 id 时（应用自造对象）仍走 scene', () => {
    const h = makeHarness();
    const { group } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();
    h.sent.length = 0;

    // 没有 props.id / state.id 的组件在镜像里无法寻址 —— 宁可重发整份文档，也不能让结构错位
    const anonymous: any = new ICERect({ left: 90, top: 5, width: 20, height: 20 });
    delete anonymous.props.id;
    delete anonymous.state.id;
    group.addChild(anonymous);
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('scene');
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

    h.bridge.handleEvent({ t: 'missing', v: MIRROR_PROTOCOL_VERSION, seq: 1, ids: ['ICE_not_exist'] });
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('scene');
    h.deliver();
    h.expectSameTree();
    expect(h.target.has(rect.props.id)).toBe(true);
  });

  it('派生部件不进文档 → 对它的状态写入不产生 op（否则每批补丁都换来一次 missing → 全量重同步）', () => {
    const h = makeHarness();
    registerFixtures(h);
    const card = new DerivedCard();
    h.main.addChild(card);
    h.bridge.flush();
    h.deliver();
    h.expectSameTree();

    // 镜像树里根本没有这个派生件（它由容器的构造函数按 state 重建）
    expect(h.target.has(card.deco.props.id)).toBe(false);
    expect(isMirroredComponent(card.deco)).toBe(false);
    expect(isMirroredComponent(card)).toBe(true);

    h.sent.length = 0;
    card.deco.setState({ left: 7 });
    h.bridge.flush();
    // 不发 op：镜像里没有这个 id，发过去只会让 worker 回 missing（真实应用里这会变成
    // "每改一次节点就重发整份文档"的风暴，实测 200 节点场景 473KB/次）
    expect(h.sent).toHaveLength(0);
    expect(h.bridge.skippedDerived).toBe(1);
    // 但容器自己的补丁照发（派生件的重建由它带出来）
    card.setState({ left: 11 });
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('ops');
    expect(h.sent[0].ops).toEqual([['state', card.props.id, { left: 11 }]]);
  });

  it('派生子树内部的结构变更不触发全量重同步（容器重建自己不该重发整份文档）', () => {
    const h = makeHarness();
    registerFixtures(h);
    const card = new DerivedCard();
    h.main.addChild(card);
    h.bridge.flush();
    h.deliver();
    h.sent.length = 0;

    const extra = new ICERect({ left: 1, top: 1, width: 8, height: 8 });
    card.addChild(extra);
    h.bridge.flush();
    expect(h.sent.map((m) => m.t)).not.toContain('scene');

    card.removeChild(extra);
    h.bridge.flush();
    expect(h.sent.map((m) => m.t)).not.toContain('scene');
  });

  it('复合容器的真实子节点：增删走结构增量（派生子件判定不能把它误判成内部重建）', () => {
    const h = makeHarness();
    registerFixtures(h);
    const pool = new CompositeContainer();
    h.main.addChild(pool);
    h.bridge.flush();
    h.deliver();
    h.expectSameTree();
    // 派生件不进文档；真实子节点进文档
    expect(isMirroredComponent(pool.deco)).toBe(false);
    const lane = new ICERect({ left: 10, top: 10, width: 100, height: 40 });
    pool.addChild(lane);
    expect(isMirroredComponent(lane)).toBe(true);

    h.sent.length = 0;
    h.bridge.flush();
    expect(h.sent[0].t).toBe('ops');
    expect(h.sent[0].ops[0][0]).toBe('add');
    h.deliver();
    h.expectSameTree();
    expect(h.target.has(lane.props.id)).toBe(true);

    // 删除同样走增量：判定发生在**摘除之前**（摘除后再问"它是不是真实子节点"就分辨不出来了）
    h.sent.length = 0;
    pool.removeChild(lane);
    h.bridge.flush();
    expect(h.sent[0].t).toBe('ops');
    expect(h.sent[0].ops[0][0]).toBe('remove');
    h.deliver();
    h.expectSameTree();
    expect(h.target.has(lane.props.id)).toBe(false);
  });

  it('add 必须排在该组件自己的状态补丁之前（预设重写会顺手写 state：顺序反了就是 missing → 全量重同步）', () => {
    // 真实来源：`ICE.addChild()` 会先 `component.__reapplyPreset(theme)`（写 style），
    // 再通知镜像钩子 —— 于是同一批里"未知 id 的 state 补丁"排在"add"前面，
    // worker 只能报 missing（实测：IED 新建一个节点就触发一次全量重同步）。
    class PresetComponent extends ICERect {
      public __reapplyPreset(): void {
        this.setState({ style: { fillStyle: '#123456' } });
      }
    }
    const h = makeHarness();
    // 应用自定义图元要在**两侧**都注册（worker 那台 ICE 没有 Designer 帮忙注册；镜像按 typeId 反查）
    h.main.registerType('test:PresetComponent', PresetComponent);
    h.mirror.registerType('test:PresetComponent', PresetComponent);
    const { group } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();
    h.sent.length = 0;

    const extra = new PresetComponent({ left: 70, top: 4, width: 20, height: 20 });
    h.main.addChild(extra); // 走 ICE.addChild：它会先 __reapplyPreset（写 state）再通知钩子
    h.bridge.flush();

    expect(h.sent[0].ops.map((op: any) => op[0])).toEqual(['add', 'state']);
    h.deliver();
    h.expectSameTree();
    expect(h.target.get(extra.props.id).state.style.fillStyle).toBe('#123456');
  });

  it('结构增量的顺序与状态补丁一致：先 add 再写 state，worker 两边结果相同', () => {
    const h = makeHarness();
    const { group } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();
    h.sent.length = 0;

    const extra = new ICERect({ left: 90, top: 5, width: 20, height: 20 });
    group.addChild(extra);
    extra.setState({ left: 123 });
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    // 同一条 ops 消息里：add 在前、state 在后（顺序反了就是"先写状态、再挂一个旧状态的组件"）
    expect(h.sent[0].ops.map((op: any) => op[0])).toEqual(['add', 'state']);
    h.deliver();
    h.expectSameTree();
    expect(h.target.get(extra.props.id).state.left).toBe(123);
  });

  it('镜像侧用应用层自己的补丁入口重放（applyPatch 有实现走它，没有则退回 setState）', () => {
    const h = makeHarness();
    registerFixtures(h);
    const card = new DerivedCard();
    h.main.addChild(card);
    h.bridge.flush();
    h.deliver();

    h.sent.length = 0;
    card.setState({ left: 42 });
    h.bridge.flush();
    h.deliver();
    const mirrored: any = h.target.get(card.props.id);
    // 镜像里那个组件也必须走 applyPatch：否则应用层派生（重建内部部件 / 连线重路由 / 规范化样式）
    // 只发生在主线程，两边画面分叉（真实症状：worker 里连线不跟手、标题还是旧的）
    expect(mirrored.appliedPatches).toEqual([{ left: 42 }]);
    expect(mirrored.state.left).toBe(42);
    // 主线程自己只走了一次（镜像侧那次发生在 worker 那台 ICE 上，不影响主线程）
    expect(card.appliedPatches).toEqual([]);

    // 没有 applyPatch 的组件（老代码 / 第三方）退回 setState，语义与主线程裸 setState 一致
    mirrored.applyPatch = undefined;
    h.target.applyOps([['state', card.props.id, { left: 43 }]]);
    expect(mirrored.state.left).toBe(43);
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

  it('视口：setViewport 推给镜像，worker 侧用的是同一个视口', () => {
    const h = makeHarness();
    buildTree(h.main);
    h.bridge.flush();
    h.deliver();

    h.main.setViewport(0.62, 40, 10);
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].t).toBe('viewport');
    expect([h.sent[0].scale, h.sent[0].tx, h.sent[0].ty]).toEqual([0.62, 40, 10]);
    h.deliver();

    expect(h.mirror.viewport).toEqual({ scale: 0.62, tx: 40, ty: 10 });
    // 同值重复设置不发消息（引擎自己也把"视口没变"当成无变化）
    h.main.setViewport(0.62, 40, 10);
    expect(h.bridge.flush()).toBe(0);
  });

  it('视口是"现状"：一帧里连缩多次只发最后一次，且全量重同步后要补发', () => {
    const h = makeHarness();
    const { group, rect } = buildTree(h.main);
    h.bridge.flush();
    h.deliver();

    h.main.setViewport(0.8, 10, 5);
    h.main.setViewport(0.6, 20, 8);
    expect(h.bridge.pendingViewport).toEqual({ scale: 0.6, tx: 20, ty: 8 });
    h.bridge.flush();
    expect(h.sent).toHaveLength(1);
    h.deliver();
    expect(h.mirror.viewport.scale).toBeCloseTo(0.6, 6);

    // 显式要一次全量场景（新树视口回到默认）→ 同一条 flush 里补发视口与选择
    notifyToolTarget(h.main, rect);
    h.bridge.markSceneNeeded();
    h.bridge.flush();
    expect(h.sent.map((m) => m.t)).toEqual(['scene', 'selection', 'viewport']);
    h.deliver();
    expect(h.mirror.viewport.scale).toBeCloseTo(0.6, 6);
    expect(h.mirror.selectionList.map((c: any) => c.props.id)).toEqual([rect.props.id]);
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

    // 全量重建 → pendingScene；此时选择虽然"没变"，也必须跟着重建后的树补一次
    h.bridge.markSceneNeeded();
    h.bridge.flush();
    // 顺序固定：scene → selection
    expect(h.sent.map((m) => m.t)).toEqual(['scene', 'selection']);
    expect(h.sent[1].ids).toEqual([rect.props.id]);
    h.deliver();
    // 重建后的镜像树上，选择仍然在（手柄不会消失）
    expect(h.mirror.selectionList.map((c: any) => c.props.id)).toEqual([rect.props.id]);
  });
});
