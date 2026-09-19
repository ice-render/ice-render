/**
 * **zIndex 的三个契约**（2026-09-19 确立）：
 *
 * 1. **默认值是进程级计数器，但显式写过 zIndex 之后计数器必须跟上去** —— 否则会出现
 *    "打开一份元件比较多的文档，新建的图元画到最下面"这种跨会话倒挂（实测：文档里 198~200，
 *    新会话新建的是 4）；
 * 2. **四个 z 序操作 API**（`bringToFront` / `sendToBack` / `moveUp` / `moveDown`）只在
 *    **同一个父容器内**生效 —— 与渲染顺序铁律"zIndex 只在兄弟之间比较"同源；
 * 3. **存盘时把 zIndex 归一化**成绘制次序里的序号，文档里不再留计数器留下的天文数字，
 *    且往返之后绘制次序**逐项不变**。
 *
 * ⚠️ 第 2 条最容易写错的是"平手"：zIndex 相等时次序由**插入顺序**决定（稳定排序），
 * 所以"只把自己那个数加一"根本挪不动位置 —— 实现是把同层重编号成 0..n-1，测试也就按这个口径验。
 */
import ICE from '../../src/ICE';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import EventBus from '../../src/event/EventBus';
import ICEControlPanelManager from '../../src/control-panel/ICEControlPanelManager';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

function makeIce() {
  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.evtBus = new EventBus();
  return ice;
}

describe('默认 zIndex 与计数器的同步', () => {
  it('构造期显式传 zIndex → 之后新建的组件默认值更大（不会被压到下面）', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ left: 0, top: 0, width: 100, height: 100 });
    ice.addChild(group);

    const huge: any = new ICERect({ left: 0, top: 0, width: 10, height: 10, zIndex: 5000 });
    group.addChild(huge);
    const fresh: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    group.addChild(fresh);

    expect(huge.state.zIndex).toBe(5000);
    expect(fresh.state.zIndex).toBeGreaterThan(5000);
  });

  it('setState 显式写 zIndex → 之后新建的组件同样更大', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ left: 0, top: 0, width: 100, height: 100 });
    ice.addChild(group);
    const raised: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    group.addChild(raised);

    raised.setState({ zIndex: 99 });
    const fresh: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });

    expect(fresh.state.zIndex).toBeGreaterThan(99);
  });

  it('★ 跨会话倒挂：打开一份 zIndex 很大的文档后新建，画在**最上层**', () => {
    // 会话 A：元件造得多，最后只留 3 个 → 它们的 zIndex 已被计数器顶高
    const iceA = makeIce();
    const groupA: any = new ICEGroup({ left: 0, top: 0, width: 300, height: 300 });
    iceA.addChild(groupA);
    const made: any[] = [];
    for (let i = 0; i < 200; i++) {
      const c: any = new ICERect({ left: i, top: 0, width: 10, height: 10 });
      groupA.addChild(c);
      made.push(c);
    }
    made.slice(0, 197).forEach((c) => groupA.removeChild(c));
    const stored = new Serializer(iceA).toJSONObject();
    const loadedZs = groupA.childNodes.map((c: any) => c.state.zIndex);
    expect(Math.max(...loadedZs)).toBeGreaterThan(100);

    // 会话 B：反序列化这份文档，再新建一个组件
    const iceB = makeIce();
    new Deserializer(iceB).fromJSONObject(stored);
    const groupB: any = iceB.childNodes[0];
    const fresh: any = new ICERect({ left: 5, top: 5, width: 20, height: 20 });
    groupB.addChild(fresh);

    const ids = groupB.childNodes.map((c: any) => c.state.id);
    const paintOrder = groupB.childNodes
      .slice()
      .sort((a: any, b: any) => (a.state.zIndex || 0) - (b.state.zIndex || 0))
      .map((c: any) => c.state.id);
    expect(paintOrder[paintOrder.length - 1]).toBe(fresh.state.id);
    expect(ids).toContain(fresh.state.id);
  });

  it('★ 工具层的 1e7 号段不参与计数器：建完控制面板，普通组件默认值仍是小数字', () => {
    const ice = makeIce();
    const before = new ICERect({ left: 0, top: 0, width: 10, height: 10 });

    new ICEControlPanelManager(ice); // 面板与手柄用的是 bigZIndexNum(1e7) 起步的号段

    const after = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    // 修复前：after.state.zIndex ≈ 10001003（被工具层号段顶上去）
    // 面板自身会创建十几个子组件（手柄），所以计数器会往前挪一点 —— 但只能是"十几个"这个量级。
    // ⚠️ 不能断言绝对值：本文件前面的用例会显式写 zIndex=5000，计数器本来就已经被抬到那儿了。
    expect(after.state.zIndex - before.state.zIndex).toBeLessThan(100);
    expect(after.state.zIndex).toBeGreaterThan(before.state.zIndex);
  });
});

describe('z 序操作 API（只在同一父容器内）', () => {
  function three(): { ice: any; group: any; a: any; b: any; c: any } {
    const ice = makeIce();
    const group: any = new ICEGroup({ left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const a: any = new ICERect({ id: 'a', left: 0, top: 0, width: 10, height: 10 });
    const b: any = new ICERect({ id: 'b', left: 20, top: 0, width: 10, height: 10 });
    const c: any = new ICERect({ id: 'c', left: 40, top: 0, width: 10, height: 10 });
    [a, b, c].forEach((item) => group.addChild(item));
    return { ice, group, a, b, c };
  }

  /** 该容器里当前的绘制次序（按 zIndex 升序，稳定 —— 与渲染器的展平口径一致）。 */
  const paint = (group: any) =>
    group.childNodes
      .slice()
      .sort((x: any, y: any) => (x.state.zIndex || 0) - (y.state.zIndex || 0))
      .map((x: any) => x.state.id);

  it('bringToFront / sendToBack 挪到两端，并返回 this（可链式）', () => {
    const { a, group } = three();
    expect(paint(group)).toEqual(['a', 'b', 'c']);

    expect(a.bringToFront()).toBe(a);
    expect(paint(group)).toEqual(['b', 'c', 'a']);

    expect(a.sendToBack()).toBe(a);
    expect(paint(group)).toEqual(['a', 'b', 'c']);
  });

  it('moveUp / moveDown 逐位移，到边界时不动', () => {
    const { a, b, c, group } = three();
    expect(a.moveUp()).toBe(a);
    expect(paint(group)).toEqual(['b', 'a', 'c']);
    a.moveUp();
    expect(paint(group)).toEqual(['b', 'c', 'a']);
    a.moveUp(); // 已在最上
    expect(paint(group)).toEqual(['b', 'c', 'a']);

    // 此刻次序（自下而上）是 ['b','c','a']：c 在中间，下移一位 → 与 b 换位
    c.moveDown();
    expect(paint(group)).toEqual(['c', 'b', 'a']);
    c.moveDown(); // 已在最下
    expect(paint(group)).toEqual(['c', 'b', 'a']);
    // 换个方向再验一次：b 往上挪（往"更上层"挪 = 绘制次序里更靠后）
    b.moveUp();
    expect(paint(group)).toEqual(['c', 'a', 'b']);
  });

  it('★ 平手（zIndex 全相等）也挪得动 —— 靠重编号，不是加减一', () => {
    const { a, b, c, group } = three();
    // 手动把所有兄弟压成同一个 zIndex：此时次序完全由插入顺序决定
    [a, b, c].forEach((item) => item.setState({ zIndex: 0 }));
    expect(paint(group)).toEqual(['a', 'b', 'c']);

    a.bringToFront(); // 若实现只是"把自己的数加一"，这里会纹丝不动
    expect(paint(group)).toEqual(['b', 'c', 'a']);
    c.sendToBack();
    expect(paint(group)).toEqual(['c', 'b', 'a']);
    // 重编号之后同层 zIndex 是 0..n-1（无重复、无空洞）
    expect(group.childNodes.map((x: any) => x.state.zIndex).sort()).toEqual([0, 1, 2]);
  });

  it('作用域只在本层：不动别的容器，也不动父容器在祖父里的次序', () => {
    const ice = makeIce();
    const outer: any = new ICEGroup({ id: 'g1', left: 0, top: 0, width: 400, height: 400 });
    const other: any = new ICEGroup({ id: 'g2', left: 0, top: 0, width: 400, height: 400 });
    ice.addChild(outer);
    ice.addChild(other);
    const a: any = new ICERect({ id: 'a', left: 0, top: 0, width: 10, height: 10 });
    const b: any = new ICERect({ id: 'b', left: 20, top: 0, width: 10, height: 10 });
    outer.addChild(a);
    outer.addChild(b);
    const outsider: any = new ICERect({ id: 'x', left: 0, top: 0, width: 10, height: 10 });
    other.addChild(outsider);

    const outsiderZ = outsider.state.zIndex;
    const outerRootZ = outer.state.zIndex;
    a.bringToFront();

    expect(outsider.state.zIndex).toBe(outsiderZ); // 别的容器没被动
    expect(outer.state.zIndex).toBe(outerRootZ); // 父容器在根层的次序也没动
    // 注意：重编号改的是 **zIndex**，childNodes 数组本身保持插入顺序（调用方按 childNodes[0]
    // 取"第一个子节点"是既有语义）—— 所以这里断言的是**绘制次序**，不是数组顺序
    const outerPaint = outer.childNodes
      .slice()
      .sort((x: any, y: any) => (x.state.zIndex || 0) - (y.state.zIndex || 0))
      .map((x: any) => x.state.id);
    expect(outerPaint).toEqual(['b', 'a']);
    expect(outer.childNodes.map((x: any) => x.state.id)).toEqual(['a', 'b']);
  });

  it('根级组件（直接挂在 ICE 上）同样支持', () => {
    const ice = makeIce();
    const a: any = new ICERect({ id: 'a', left: 0, top: 0, width: 10, height: 10 });
    const b: any = new ICERect({ id: 'b', left: 20, top: 0, width: 10, height: 10 });
    ice.addChild(a);
    ice.addChild(b);

    a.bringToFront();
    const order = ice.childNodes
      .slice()
      .sort((x: any, y: any) => (x.state.zIndex || 0) - (y.state.zIndex || 0))
      .map((x: any) => x.state.id);
    expect(order).toEqual(['b', 'a']);
  });

  it('重排只改次序：兄弟被重编号后不得被标成"派生参数要重算"', () => {
    const { a, b } = three();
    b.paramsDirty = false;
    a.bringToFront(); // 会把 a、b 都重编号
    expect({ dirty: b.dirty, paramsDirty: b.paramsDirty }).toEqual({ dirty: true, paramsDirty: false });
  });

  /**
   * **重编号的结果只与本容器有关，与进程级计数器无关**。
   *
   * 这条不是"实现细节"：默认 `zIndex` 取自 `ICEComponent.instanceCounter++`（进程级、跨 ICE 实例
   * 还会继续涨），所以"写死一个 zIndex: 90 表示在最上层"这种写法并不可靠 —— 同一个场景在两个
   * ICE 实例里拿到的默认值不同（实测 18~25 vs 109~116），90 在一边压得住、在另一边压不住
   * （2026-09-19 在 dirty-rect 像素用例上踩到）。要"置顶"就用 `bringToFront()`：
   * 它把同层重编号成 0..n-1，与计数器无关，两个实例结果一致。
   */
  it('★ 置顶后的同层 zIndex 是 0..n-1，与进程级计数器无关（两个实例结果一致）', () => {
    const build = () => {
      const ice = makeIce();
      const group: any = new ICEGroup({ left: 0, top: 0, width: 300, height: 300 });
      ice.addChild(group);
      const list: any[] = [];
      for (let i = 0; i < 3; i++) {
        const c: any = new ICERect({ id: 'c' + i, left: i * 20, top: 0, width: 10, height: 10 });
        group.addChild(c);
        list.push(c);
      }
      return { ice, group, list };
    };
    const one = build();
    const two = build(); // 进程级计数器已经涨过一截，第二个实例的默认值完全不同
    one.list[0].bringToFront();
    two.list[0].bringToFront();

    const zs = (g: any) => g.childNodes.map((c: any) => c.state.zIndex).sort((x: number, y: number) => x - y);
    expect(zs(one.group)).toEqual([0, 1, 2]);
    expect(zs(two.group)).toEqual([0, 1, 2]);
    expect(one.list[0].state.zIndex).toBe(2);
    expect(two.list[0].state.zIndex).toBe(2);
  });
});

describe('存盘归一化（zIndex 换成绘制次序的序号）', () => {
  it('次序没变就不写 zIndex；变了才写，且是 0..n-1 的小整数', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const a: any = new ICERect({ id: 'a', left: 0, top: 0, width: 10, height: 10 });
    const b: any = new ICERect({ id: 'b', left: 20, top: 0, width: 10, height: 10 });
    group.addChild(a);
    group.addChild(b);

    // 默认次序：什么都不用写
    let doc = new Serializer(ice).toJSONObject() as any;
    expect(doc.childNodes[0].childNodes.map((n: any) => n.state.zIndex)).toEqual([undefined, undefined]);

    // 把 a 抬到最上（同层重编号）→ 此时次序与插入次序不同，必须写出来
    a.bringToFront();
    doc = new Serializer(ice).toJSONObject() as any;
    const zs = doc.childNodes[0].childNodes.map((n: any) => n.state.zIndex);
    expect(zs.every((z: any) => typeof z === 'number' && z >= 0 && z < 2)).toBe(true);
    expect(new Set(zs).size).toBe(2);
  });

  it('天文数字的 zIndex 不会进文档；往返之后绘制次序逐项不变', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const ids = ['a', 'b', 'c', 'd'];
    ids.forEach((id, i) => {
      group.addChild(new ICERect({ id, left: i * 20, top: 0, width: 10, height: 10 }));
    });
    // 模拟"应用自己写死的大 zIndex"与"旧文档里的计数器残留"
    group.childNodes[0].setState({ zIndex: 1e6 });
    group.childNodes[3].setState({ zIndex: 12345 });
    const before = group.childNodes
      .slice()
      .sort((x: any, y: any) => (x.state.zIndex || 0) - (y.state.zIndex || 0))
      .map((x: any) => x.state.id);

    const doc = new Serializer(ice).toJSONObject() as any;
    const written = doc.childNodes[0].childNodes.map((n: any) => n.state.zIndex);
    expect(Math.max(...written)).toBeLessThan(ids.length);

    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONObject(doc);
    const group2: any = ice2.childNodes[0];
    const after = group2.childNodes
      .slice()
      .sort((x: any, y: any) => (x.state.zIndex || 0) - (y.state.zIndex || 0))
      .map((x: any) => x.state.id);
    expect(after).toEqual(before);
  });
});
