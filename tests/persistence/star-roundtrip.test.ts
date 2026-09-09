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
import ICEStar from '../../src/graphic/shape/ICEStar';
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

function makeIce(): ICE {
  const ice = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.typeMapping = { ...componentTypeMap };
  return ice;
}

describe('序列化 ICEDotPath round-trip（排除 dots 后）', () => {
  it('星形：序列化排除 dots，反序列化后重新计算 dots 正常', () => {
    const ice = makeIce();
    const star = new ICEStar({ left: 10, top: 10, width: 100, height: 100 });
    ice.addChild(star);
    star.getMinBoundingBox(true); // 触发 calcDots

    const str = new Serializer(ice).toJSONString();
    const json: any = JSON.parse(str);
    // dots 是缓存，序列化应排除
    expect(json.childNodes[0].state.dots).toBeUndefined();

    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONString(str);
    const star2: any = ice2.childNodes[0];
    expect(star2).toBeInstanceOf(ICEStar);
    // 反序列化后 dots 为空（缓存不序列化）
    expect(star2.state.dots.length).toBe(0);
    // 访问 dots 的入口（calc4VertexPoints）应惰性补齐 dots（ensureDots → calcDots）
    star2.calc4VertexPoints();
    expect(star2.state.dots.length).toBeGreaterThan(0);
  });

  it('折线：序列化排除 dots，反序列化正常', () => {
    const ice = makeIce();
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
    });
    ice.addChild(line);
    line.getMinBoundingBox(true);

    const str = new Serializer(ice).toJSONString();
    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONString(str);
    const line2: any = ice2.childNodes[0];
    expect(line2).toBeInstanceOf(ICEPolyLine);
    line2.getMinBoundingBox(true);
    expect(line2.state.dots.length).toBeGreaterThan(0);
  });
});
