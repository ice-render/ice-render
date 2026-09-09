/**
 * 序列化 / 反序列化 round-trip 回归测试。
 *
 * 验证 Serializer（state+type+childNodes 递归编码）与 Deserializer（靠 COMPONENT_TYPE_MAPPING
 * 的类名→构造函数映射重建树）的往返一致性。这是引擎「持久化」能力的核心，之前完全没有自动化覆盖。
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
import ICERect from '../../src/graphic/shape/ICERect';
import ICECircle from '../../src/graphic/shape/ICECircle';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

function makeIce(): ICE {
  const ice = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.typeMapping = { ...componentTypeMap };
  return ice;
}

describe('序列化 / 反序列化 round-trip', () => {
  it('序列化嵌套组件树：type/state/childNodes 结构正确', () => {
    const ice = makeIce();
    const group = new ICEGroup({ left: 10, top: 20, width: 100, height: 80 });
    const rect = new ICERect({ left: 5, top: 5, width: 20, height: 20 });
    ice.addChild(group);
    group.addChild(rect);

    const json: any = new Serializer(ice).toJSONObject();
    expect(json.childNodes.length).toBe(1);
    const g = json.childNodes[0];
    expect(g.type).toBe('ICEGroup');
    expect(g.state.left).toBe(10);
    expect(g.state.width).toBe(100);
    expect(g.childNodes.length).toBe(1);
    expect(g.childNodes[0].type).toBe('ICERect');
    expect(g.childNodes[0].state.width).toBe(20);
  });

  it('反序列化重建嵌套树，state 与拓扑一致（含 transform）', () => {
    const ice = makeIce();
    const group = new ICEGroup({
      left: 10,
      top: 20,
      width: 100,
      height: 80,
      transform: { translate: [1, 2], scale: [2, 2], skew: [0, 0], rotate: 45 },
    });
    const rect = new ICERect({ left: 5, top: 5, width: 20, height: 20 });
    ice.addChild(group);
    group.addChild(rect);

    const str = new Serializer(ice).toJSONString();

    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONString(str);

    expect(ice2.childNodes.length).toBe(1);
    const g2: any = ice2.childNodes[0];
    expect(g2).toBeInstanceOf(ICEGroup);
    expect(g2.state.left).toBe(10);
    expect(g2.state.transform.rotate).toBe(45);
    expect(g2.state.transform.scale[0]).toBe(2);
    expect(g2.childNodes.length).toBe(1);
    const r2: any = g2.childNodes[0];
    expect(r2).toBeInstanceOf(ICERect);
    expect(r2.state.width).toBe(20);
    expect(r2.parentNode).toBe(g2);
  });

  it('多组件类型往返：ICERect / ICECircle / ICEGroup', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 100, height: 100 });
    const rect = new ICERect({ width: 10, height: 10 });
    const circle = new ICECircle({ width: 12, height: 12 });
    ice.addChild(group);
    group.addChild(rect);
    group.addChild(circle);

    const str = new Serializer(ice).toJSONString();
    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONString(str);

    const g2: any = ice2.childNodes[0];
    expect(g2).toBeInstanceOf(ICEGroup);
    expect(g2.childNodes.length).toBe(2);
    expect(g2.childNodes[0]).toBeInstanceOf(ICERect);
    expect(g2.childNodes[1]).toBeInstanceOf(ICECircle);
  });
});
