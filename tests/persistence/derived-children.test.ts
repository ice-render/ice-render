/**
 * 复合组件（构造时按 state 自建内部子组件）的序列化回归。
 *
 * 契约：`hasDerivedChildren() === true` 的组件只持久化自身 state，内部子组件视为派生结果 ——
 * 反序列化后既不会重复挂载，也不会因为子组件的自动 zIndex 变化导致两次序列化结果不同。
 */
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

import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import componentTypeMap from '../../src/consts/COMPONENT_TYPE_MAPPING';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICEText from '../../src/graphic/text/ICEText';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

function makeIce(): ICE {
  const ice = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.typeMapping = { ...componentTypeMap };
  return ice;
}

/** 复合组件：构造时按自身 state 建一个文字子节点（与 IED 的 Entity 同一形态） */
class Card extends ICEGroup {
  public static readonly typeId = 'Card';
  constructor(props: any = {}) {
    super({ title: 'card', width: 100, height: 40, ...props });
    this.addChild(new ICEText({ text: this.state.title, width: this.state.width, height: this.state.height }));
  }

  public hasDerivedChildren(): boolean {
    return true;
  }
}

describe('复合组件的引擎序列化', () => {
  it('派生内部子组件的复合组件：文档里不写 childNodes，往返后不重复挂载', () => {
    const ice = makeIce();
    ice.registerType('Card', Card as any);
    const card = new Card({ title: 'hello' });
    ice.addChild(card);
    const json: any = new Serializer(ice).toJSONObject();
    expect(card.childNodes.length).toBe(1);
    // 派生：文档里不带 childNodes
    expect(json.childNodes[0].childNodes).toEqual([]);

    const ice2 = makeIce();
    ice2.registerType('Card', Card as any);
    new Deserializer(ice2).fromJSONObject(JSON.parse(JSON.stringify(json)));
    const restored: any = ice2.childNodes[0];
    // 构造函数按 state 重建了一份，且没有被再挂一份
    expect(restored.childNodes.length).toBe(1);
    expect(restored.childNodes[0].state.text).toBe('hello');
  });

  it('同一份数据两次序列化结果一致（子组件 zIndex 不再抖动）', () => {
    const ice = makeIce();
    ice.registerType('Card', Card as any);
    ice.addChild(new Card({ title: 'stable' }));
    const first = new Serializer(ice).toJSONString();

    const ice2 = makeIce();
    ice2.registerType('Card', Card as any);
    new Deserializer(ice2).fromJSONObject(JSON.parse(first));
    const second = new Serializer(ice2).toJSONString();
    expect(second).toBe(first);
  });

  it('未声明派生的普通容器：子节点照常序列化并往返', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 100, height: 80 });
    group.addChild(new ICEText({ text: 'child', width: 10, height: 10 }));
    ice.addChild(group);

    const json: any = new Serializer(ice).toJSONObject();
    expect(json.childNodes[0].childNodes.length).toBe(1);

    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONObject(JSON.parse(JSON.stringify(json)));
    expect((ice2.childNodes[0] as any).childNodes.length).toBe(1);
    expect((ice2.childNodes[0] as any).childNodes[0].state.text).toBe('child');
  });
});
