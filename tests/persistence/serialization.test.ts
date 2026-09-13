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
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICECircle from '../../src/graphic/shape/ICECircle';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

function makeIce(): ICE {
  const ice = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
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
    expect(g.type).toBe('ice-render:Group');
    expect(g.state.left).toBe(10);
    expect(g.state.width).toBe(100);
    expect(g.childNodes.length).toBe(1);
    expect(g.childNodes[0].type).toBe('ice-render:Rect');
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

  it('序列化结果含 version 字段', () => {
    const ice = makeIce();
    ice.addChild(new ICERect({ width: 10, height: 10 }));
    const json: any = new Serializer(ice).toJSONObject();
    expect(json.version).toBe(1);
  });

  it('时间戳是 ISO 8601 UTC（与运行环境语言/时区无关，可排序、可解析）', () => {
    const ice = makeIce();
    ice.addChild(new ICERect({ width: 10, height: 10 }));
    const json: any = new Serializer(ice).toJSONObject();

    // 旧实现是 `new Date().toLocaleString()`：zh-CN 下 `2026/9/13 12:12:33`、en-US 下
    // `9/13/2026, 12:12:33 PM` —— 同一份数据换个语言环境就不一样，且不能直接排序。
    const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    expect(json.createTime).toMatch(ISO_UTC);
    expect(json.lastModifyTime).toMatch(ISO_UTC);
    expect(json.createTime).not.toMatch(/[/年月]|AM|PM/);

    // 可被标准解析器还原，且往返无损（定长 → 字典序 = 时间序）
    expect(new Date(json.createTime).toISOString()).toBe(json.createTime);
    expect(new Date(json.lastModifyTime).getTime()).not.toBeNaN();

    // 同一次写出两个字段取同一时刻
    expect(json.lastModifyTime).toBe(json.createTime);
  });

  describe('createTime 的语义（首次创建 / 最后修改）', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('「打开 → 再保存」保留 createTime，只推进 lastModifyTime', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-13T00:00:00.000Z'));

      const first = makeIce();
      first.addChild(new ICERect({ width: 10, height: 10 }));
      const saved: any = new Serializer(first).toJSONObject();
      expect(saved.createTime).toBe('2026-09-13T00:00:00.000Z');
      expect(saved.lastModifyTime).toBe('2026-09-13T00:00:00.000Z');

      // 一小时后打开它、改点东西、再保存
      jest.setSystemTime(new Date('2026-09-13T01:00:00.000Z'));
      const second = makeIce();
      new Deserializer(second).fromJSONObject(saved);
      second.addChild(new ICECircle({ radius: 5 }));
      const savedAgain: any = new Serializer(second).toJSONObject();

      expect(savedAgain.createTime).toBe('2026-09-13T00:00:00.000Z'); // 不变
      expect(savedAgain.lastModifyTime).toBe('2026-09-13T01:00:00.000Z'); // 前进
    });

    it('数据里没有 createTime 时不沿用上一个文档的时间', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-13T00:00:00.000Z'));
      const ice = makeIce();
      new Deserializer(ice).fromJSONObject({
        version: 1,
        createTime: '2020-01-01T00:00:00.000Z',
        childNodes: [{ type: 'ice-render:Rect', state: { width: 5, height: 5 }, childNodes: [] }],
      });
      expect((ice as any).documentMeta.createTime).toBe('2020-01-01T00:00:00.000Z');

      jest.setSystemTime(new Date('2026-09-13T02:00:00.000Z'));
      new Deserializer(ice).fromJSONObject({
        version: 1,
        childNodes: [{ type: 'ice-render:Rect', state: { width: 5, height: 5 }, childNodes: [] }],
      });
      const json: any = new Serializer(ice).toJSONObject();
      expect(json.createTime).toBe('2026-09-13T02:00:00.000Z');
    });

    it('历史格式 / 脏 createTime 会被归一化或忽略', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-13T03:00:00.000Z'));

      const legacy = makeIce();
      new Deserializer(legacy).fromJSONObject({ version: 1, createTime: '2022/1/1 00:00:00', childNodes: [] });
      const legacyOut: any = new Serializer(legacy).toJSONObject();
      expect(legacyOut.createTime).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/); // 不再是 2022/1/1 这种本地格式
      expect(Date.parse(legacyOut.createTime)).toBe(Date.parse('2022/1/1 00:00:00'));

      const dirty = makeIce();
      new Deserializer(dirty).fromJSONObject({ version: 1, createTime: '不是时间', childNodes: [] });
      expect((dirty as any).documentMeta.createTime).toBeUndefined();
      const dirtyOut: any = new Serializer(dirty).toJSONObject();
      expect(dirtyOut.createTime).toBe('2026-09-13T03:00:00.000Z'); // 回退到当前时刻
    });

    it('clearAll() 之后视为新文档：createTime 重新取当前时刻', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-13T00:00:00.000Z'));
      const ice = makeIce();
      ice.addChild(new ICERect({ width: 10, height: 10 }));
      const before: any = new Serializer(ice).toJSONObject();

      jest.setSystemTime(new Date('2026-09-13T05:00:00.000Z'));
      ice.clearAll();
      ice.addChild(new ICERect({ width: 20, height: 20 }));
      const after: any = new Serializer(ice).toJSONObject();

      expect(after.createTime).toBe('2026-09-13T05:00:00.000Z');
      expect(after.createTime).not.toBe(before.createTime);
    });
  });

  it('序列化排除运行时缓存值（linearMatrix/composedMatrix/localOrigin/absoluteOrigin）', () => {
    const ice = makeIce();
    const rect = new ICERect({ width: 10, height: 10 });
    ice.addChild(rect);
    rect.getMinBoundingBox(true); // 触发 compose，产生缓存值

    const json: any = new Serializer(ice).toJSONObject();
    const state = json.childNodes[0].state;
    expect(state.linearMatrix).toBeUndefined();
    expect(state.composedMatrix).toBeUndefined();
    expect(state.localOrigin).toBeUndefined();
    expect(state.absoluteOrigin).toBeUndefined();
    expect(state.width).toBe(10); // 用户数据保留
  });

  it('反序列化不支持的版本抛错', () => {
    const ice = makeIce();
    const deserializer = new Deserializer(ice);
    expect(() => deserializer.fromJSONObject({ version: 999, childNodes: [] })).toThrow();
  });
});
