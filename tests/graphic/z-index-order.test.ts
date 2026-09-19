/**
 * **zIndex 的语义（2026-09-19 改版：默认值 = `0` / auto 层）**：
 *
 * 1. **默认 `zIndex` 是 `0`，就是 CSS 的 `z-index: auto` 那一档**：同层没显式写过 zIndex 的
 *    兄弟彼此相等，次序退化为**加入顺序** —— "后加入的默认画在最上面"。没有进程级计数器，
 *    因此也不存在"新会话计数器落后 → 新建组件被已有内容盖住"这类跨会话倒挂。
 * 2. **显式写的值是钉子，一视同仁地参与比较**（与 CSS 同义）：负数压到 auto 层**之下**，
 *    正数抬到 auto 层**之上**。⚠️ 正数钉住的兄弟会盖住**之后新加入**的 auto 组件 ——
 *    这是 CSS 口径；要"永远在最上"就用工具层（`ice.addTool`，工具层整体在组件层之上）。
 * 3. **四个 z 序 API 只在同一个父容器内生效**（`zIndex` 只在兄弟之间比较），
 *    实现是把同层重编号成 **`-(n-1) … 0`（最上 = 0）**：置顶之后**新加入的组件仍然画在最上面**
 *    （相等 → 按加入顺序，新加入的最后画）。
 * 4. **存盘：默认值不写、显式值原样写**；往返之后绘制次序逐项不变。
 *
 * ⚠️ 第 3 条最容易写错的是"平手"：zIndex 相等时次序由**加入顺序**决定（稳定排序），
 * 所以"只把自己那个数加一"根本挪不动位置 —— 实现是整层重编号，测试也就按这个口径验。
 */
import ICE from '../../src/ICE';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import EventBus from '../../src/event/EventBus';
import Z_INDEX_AUTO from '../../src/consts/Z_INDEX_AUTO';
import { sortSiblingsByZIndex, zIndexOf } from '../../src/util/data-util';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

function makeIce() {
  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.evtBus = new EventBus();
  return ice;
}

function rect(id: string, extra: any = {}): any {
  return new ICERect({ id, left: 0, top: 0, width: 10, height: 10, ...extra });
}

/** 某个容器（或 ICE 的顶层）当前的**绘制次序**：按 zIndex 升序、稳定 —— 与展平口径一致。 */
function paint(container: any): string[] {
  const list = container.childNodes || [];
  return sortSiblingsByZIndex(list).map((c: any) => c.state.id);
}

describe('默认 zIndex = 0（auto 层）', () => {
  it('默认值是 `auto` 哨兵，不再是"构造顺序计数器"', () => {
    const ice = makeIce();
    const list = [0, 1, 2].map((i) => {
      const c = rect('c' + i);
      ice.addChild(c);
      return c;
    });
    expect(list.map((c: any) => c.state.zIndex)).toEqual([Z_INDEX_AUTO, Z_INDEX_AUTO, Z_INDEX_AUTO]);
    // 排序时当 0 用
    expect(list.map((c: any) => zIndexOf(c))).toEqual([0, 0, 0]);
  });

  it('★ 次序看"加入顺序"，不看构造顺序：先加 b 再加 a → a 画在最上', () => {
    const ice = makeIce();
    // 故意"先构造 a、后构造 b"，但**先加 b、后加 a**
    const a = rect('a');
    const b = rect('b');
    ice.addChild(b);
    ice.addChild(a);

    expect(a.state.zIndex).toBe(b.state.zIndex); // 默认值相等（都是 auto 层）
    expect(paint(ice)).toEqual(['b', 'a']); // 次序由加入顺序决定，a 在最上
  });

  it('★ 跨会话倒挂从根上消失：打开一份元件很多的文档后新建，仍在最上层', () => {
    // 会话 A：造 200 个元件，只留 3 个，然后存盘
    const iceA = makeIce();
    const groupA: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    iceA.addChild(groupA);
    const made: any[] = [];
    for (let i = 0; i < 200; i++) {
      const c = rect('c' + i, { left: i, top: 0 });
      groupA.addChild(c);
      made.push(c);
    }
    made.slice(0, 197).forEach((c) => groupA.removeChild(c));
    const stored: any = new Serializer(iceA).toJSONObject();
    // 默认值不进文档：没有任何 zIndex 需要写
    expect(stored.childNodes[0].childNodes.every((n: any) => n.state.zIndex === undefined)).toBe(true);

    // 会话 B：加载这份文档，再新建一个组件
    const iceB = makeIce();
    new Deserializer(iceB).fromJSONObject(stored);
    const groupB: any = iceB.childNodes[0];
    const fresh = rect('fresh', { left: 5, top: 5 });
    groupB.addChild(fresh);

    expect(fresh.state.zIndex).toBe(Z_INDEX_AUTO);
    const order = paint(groupB);
    expect(order[order.length - 1]).toBe('fresh'); // 新建的仍在最上层
  });

  it('显式正数是钉子：它盖住**之后**新加入的 auto 组件（CSS 口径，文档里已注明）', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    group.addChild(rect('pinned', { zIndex: 5 }));
    group.addChild(rect('fresh'));

    expect(paint(group)).toEqual(['fresh', 'pinned']);
  });

  it('显式负数是"压到 auto 层之下"（背景类），与加入顺序无关', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    group.addChild(rect('content')); // 先加入 → 不加钉子时它在最下
    group.addChild(rect('bg', { zIndex: -1 }));

    expect(paint(group)).toEqual(['bg', 'content']);
  });

  it('脏值不破坏整层排序：非数值 / NaN 一律当 0（auto 层）', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const a = rect('a');
    const b = rect('b');
    group.addChild(a);
    group.addChild(b);
    a.state.zIndex = 'auto' as any; // 历史写法 / 手工塞的脏值
    b.state.zIndex = NaN;

    expect(zIndexOf(a)).toBe(0);
    expect(zIndexOf(b)).toBe(0);
    expect(paint(group)).toEqual(['a', 'b']); // 不会被 NaN 比较搅成未知次序
  });

  it('显式 `zIndex: 0` 与 `auto` 等价（同层都算 auto 层，平手按加入顺序）', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const a = rect('a', { zIndex: 0 }); // 显式 0
    const b = rect('b'); // auto
    group.addChild(a);
    group.addChild(b);

    expect(zIndexOf(a)).toBe(0);
    expect(zIndexOf(b)).toBe(0);
    expect(paint(group)).toEqual(['a', 'b']); // 平手 → 加入顺序
  });
});

describe('z 序操作 API（只在同一父容器内）', () => {
  function three(): { ice: any; group: any; a: any; b: any; c: any; d?: any } {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const a = rect('a');
    const b = rect('b', { left: 20 });
    const c = rect('c', { left: 40 });
    [a, b, c].forEach((item) => group.addChild(item));
    return { ice, group, a, b, c };
  }

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
    b.moveUp();
    expect(paint(group)).toEqual(['c', 'a', 'b']);
  });

  it('★ 平手（zIndex 全相等）也挪得动 —— 靠整层重编号，不是加减一', () => {
    const { a, c, group } = three();
    expect(paint(group)).toEqual(['a', 'b', 'c']);

    a.bringToFront(); // 若实现只是"把自己的数加一"，这里会纹丝不动
    expect(paint(group)).toEqual(['b', 'c', 'a']);
    c.sendToBack();
    expect(paint(group)).toEqual(['c', 'b', 'a']);
    // 编号口径：-(n-1) … 'auto'（最上面那个 = auto 层），无重复、无空洞
    expect(group.childNodes.map((x: any) => zIndexOf(x)).sort((x: number, y: number) => x - y)).toEqual([-2, -1, 0]);
    // 最上面那个写回的是 `auto` 哨兵本身（不写显式 0）
    expect(group.childNodes.filter((x: any) => x.state.zIndex === Z_INDEX_AUTO).length).toBe(1);
  });

  it('★ 置顶之后新加入的组件仍然画在最上面（重编号把 0 留给最上层）', () => {
    const { a, group } = three();
    a.bringToFront();
    expect(a.state.zIndex).toBe(Z_INDEX_AUTO);
    expect(paint(group)).toEqual(['b', 'c', 'a']);

    const d = rect('d', { left: 60 });
    group.addChild(d);
    // d 是默认值（auto 层），与 a 相等 → 按加入顺序排在 a 之后 = 最上面
    expect(d.state.zIndex).toBe(Z_INDEX_AUTO);
    expect(paint(group)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('作用域只在本层：不动别的容器，也不动父容器在祖父里的次序', () => {
    const ice = makeIce();
    const outer: any = new ICEGroup({ id: 'g1', left: 0, top: 0, width: 400, height: 400 });
    const other: any = new ICEGroup({ id: 'g2', left: 0, top: 0, width: 400, height: 400 });
    ice.addChild(outer);
    ice.addChild(other);
    const a = rect('a');
    const b = rect('b', { left: 20 });
    outer.addChild(a);
    outer.addChild(b);
    const outsider = rect('x');
    other.addChild(outsider);

    const outsiderZ = outsider.state.zIndex;
    const outerRootZ = outer.state.zIndex;
    a.bringToFront();

    expect(outsider.state.zIndex).toBe(outsiderZ); // 别的容器没被动
    expect(outer.state.zIndex).toBe(outerRootZ); // 父容器在根层的次序也没动
    expect(paint(outer)).toEqual(['b', 'a']);
    // ⚠️ 重编号改的是 **zIndex**，`childNodes` 数组保持插入顺序（调用方按 childNodes[0]
    // 取"第一个子节点"是既有语义）—— 断言次序要看绘制次序，不要看数组
    expect(outer.childNodes.map((x: any) => x.state.id)).toEqual(['a', 'b']);
  });

  it('根级组件（直接挂在 ICE 上）同样支持', () => {
    const ice = makeIce();
    const a = rect('a');
    const b = rect('b', { left: 20 });
    ice.addChild(a);
    ice.addChild(b);

    a.bringToFront();
    expect(paint(ice)).toEqual(['b', 'a']);
  });

  it('重排只改次序：兄弟被重编号后不得被标成"派生参数要重算"', () => {
    const { a, b } = three();
    b.paramsDirty = false;
    a.bringToFront(); // 会把 a、b 都重编号
    expect({ dirty: b.dirty, paramsDirty: b.paramsDirty }).toEqual({ dirty: true, paramsDirty: false });
  });

  /**
   * **2026-09-19 收紧：四个 z 序 API 只排「可排层」**（排序键 ≤ 0：`'auto'` 与负值），
   * 应用自己钉成正数的兄弟（浮层 / 水印 / 吸顶条）不参与、值也不会被改写。
   * 旧实现"整层重编号"会把钉子一起洗掉 —— "置顶一次，浮层就掉下去了"。
   */
  it('★ 正数钉子不参与重排，也不会被改写（仍压在可排层之上）', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const pinned = rect('pinned', { zIndex: 9 });
    const a = rect('a');
    const b = rect('b', { left: 20 });
    group.addChild(pinned);
    group.addChild(a);
    group.addChild(b);

    a.bringToFront();
    expect(pinned.state.zIndex).toBe(9); // 钉子原样
    expect(paint(group)).toEqual(['b', 'a', 'pinned']); // 钉子仍然在最上面
    expect(a.state.zIndex).toBe(Z_INDEX_AUTO); // 可排层内部：a 排到了最上
    expect(b.state.zIndex).toBe(-1);
  });

  it('★ 目标自己就是钉子：bringToFront 抬到最大值之上，sendToBack 压到最小值之下', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const p9 = rect('p9', { zIndex: 9 });
    const p5 = rect('p5', { zIndex: 5 });
    const a = rect('a');
    group.addChild(p9);
    group.addChild(p5);
    group.addChild(a);

    expect(paint(group)).toEqual(['a', 'p5', 'p9']);
    p5.bringToFront();
    expect(p5.state.zIndex).toBe(10); // 同层最大值 9 + 1
    expect(p9.state.zIndex).toBe(9); // 别的钉子不动
    expect(paint(group)).toEqual(['a', 'p9', 'p5']);

    p5.sendToBack();
    expect(paint(group)).toEqual(['p5', 'a', 'p9']); // 压到含 auto 层在内的最小值之下
    expect(zIndexOf(p5)).toBeLessThan(0);
  });

  it('钉子之间上移一位：与相邻的钉子交换数值（不碰可排层）', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const p5 = rect('p5', { zIndex: 5 });
    const p9 = rect('p9', { zIndex: 9 });
    const a = rect('a');
    group.addChild(p5);
    group.addChild(p9);
    group.addChild(a);

    p5.moveUp(); // 与相邻钉子 p9 交换数值
    expect(paint(group)).toEqual(['a', 'p9', 'p5']);
    expect(p5.state.zIndex).toBe(9);
    expect(p9.state.zIndex).toBe(5);
    expect(a.state.zIndex).toBe(Z_INDEX_AUTO); // 可排层没被碰

    p5.moveDown(); // 再换回来（p5 已在钉子档最上，下移一位即与 p9 交换）
    expect(paint(group)).toEqual(['a', 'p5', 'p9']);
  });

  it('可排层里的组件不会被"上移"越过钉子（钉子永远是应用自己那一档）', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const pinned = rect('pinned', { zIndex: 9 });
    const a = rect('a');
    const b = rect('b', { left: 20 });
    group.addChild(pinned);
    group.addChild(a);
    group.addChild(b);

    a.moveUp(); // 在可排层里与 b 换位
    expect(paint(group)).toEqual(['b', 'a', 'pinned']);
    a.moveUp(); // 已是可排层最上 → 不动（不会挤到钉子之上）
    expect(paint(group)).toEqual(['b', 'a', 'pinned']);
    expect(pinned.state.zIndex).toBe(9);
  });
});

describe('存盘：默认值不写、显式值原样写', () => {
  it('默认（0）不写进文档；显式值原样保留', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const a = rect('a');
    const b = rect('b', { left: 20 });
    group.addChild(a);
    group.addChild(b);

    let doc: any = new Serializer(ice).toJSONObject();
    expect(doc.childNodes[0].childNodes.map((n: any) => n.state.zIndex)).toEqual([undefined, undefined]);

    // 应用自己钉的值：原样进文档（不归一化、不改写 —— 不再有"计数器残留"要洗）
    a.setState({ zIndex: 9000 });
    doc = new Serializer(ice).toJSONObject();
    const zs = doc.childNodes[0].childNodes.map((n: any) => n.state.zIndex);
    expect(zs).toEqual([9000, undefined]);
  });

  it('★ 重排 API 落下的负数往返后次序逐项不变，且新加入的仍在最上', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    const ids = ['a', 'b', 'c'];
    ids.forEach((id, i) => group.addChild(rect(id, { left: i * 20 })));
    group.childNodes[0].bringToFront(); // 次序变成 b, c, a；编号 -2, -1, 0
    expect(paint(group)).toEqual(['b', 'c', 'a']);

    const doc: any = new Serializer(ice).toJSONObject();
    // 最上面那个是 0（= 默认值）→ 不写；被压下去的两个落成负数 → 必须写
    // 注意文档里的 childNodes 仍是**加入顺序** a,b,c —— 次序信息只在 zIndex 上
    expect(doc.childNodes[0].childNodes.map((n: any) => n.state.zIndex)).toEqual([undefined, -2, -1]);

    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONObject(doc);
    const group2: any = ice2.childNodes[0];
    expect(paint(group2)).toEqual(['b', 'c', 'a']);

    // 打开文档后新建：仍在最上层（0 那一档，按加入顺序排最后）
    const fresh = rect('fresh', { left: 99 });
    group2.addChild(fresh);
    const order = paint(group2);
    expect(order[order.length - 1]).toBe('fresh');
  });
});
