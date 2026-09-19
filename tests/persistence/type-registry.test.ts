/**
 * 序列化类型注册、反序列化容错与版本迁移。
 *
 * 契约：
 * - 序列化写出的 type 由「构造函数 → canonical typeId」反查得到（namespace:Type）
 * - 未注册的自定义类型回退到 constructor.name（保持既有约定），并记录到 unregisteredTypes
 * - 反序列化遇到未注册类型不再抛错：跳过该节点并记录到 unknownTypes，其余内容照常加载
 * - 类型名只有 canonical 一种形式：无 namespace 的旧类名按未注册类型处理（跳过 + 记录）
 * - SERIALIZATION_MIGRATIONS 按 to 升序逐级执行
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
  bezierCurveTo() {}
  quadraticCurveTo() {}
};

import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import { componentTypeEntries } from '../../src/consts/COMPONENT_TYPE_MAPPING';
import ICERect from '../../src/graphic/shape/ICERect';
import ICECircle from '../../src/graphic/shape/ICECircle';
import ICERose from '../../src/graphic/shape/ICERose';
import ICEText from '../../src/graphic/text/ICEText';
import Serializer, { SERIALIZATION_VERSION } from '../../src/persistence/Serializer';
import Deserializer, { SERIALIZATION_MIGRATIONS } from '../../src/persistence/Deserializer';

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  return ice;
}

describe('类型注册表（typeId）', () => {
  it('内置类型全部可反查：ICERose 不再漏注册，可完整 round-trip', () => {
    const ice = makeIce();
    ice.addChild(new ICERose({ left: 10, top: 10, radius: 40, leafNum: 3 }));

    const json = new Serializer(ice).toJSONString();
    expect(json).toContain('"type":"ice-render:Rose"');

    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONString(json);
    expect(ice2.childNodes.length).toBe(1);
    expect(ice2.childNodes[0]).toBeInstanceOf(ICERose);
  });

  it('每种已注册类型都能由构造函数反查到稳定 typeId', () => {
    const ice = makeIce();
    for (const entry of componentTypeEntries) {
      expect(ice.getTypeId(entry.ctor)).toBe(entry.typeId);
      expect(ice.hasType(entry.typeId)).toBe(true);
    }
  });

  it('序列化用反查到的注册名，与类的 JS 名解耦（模拟压缩改名）', () => {
    class RenamedByBundler extends ICERect {}
    const ice = makeIce();
    ice.registerType('test:CustomRect', RenamedByBundler);

    const r = new RenamedByBundler({ left: 1, top: 2, width: 10, height: 10 });
    ice.addChild(r);
    const json: any = new Serializer(ice).toJSONObject();

    expect(r.constructor.name).toBe('RenamedByBundler');
    expect(json.childNodes[0].type).toBe('test:CustomRect'); // 用 canonical typeId 而非类名
  });

  it('未注册类型回退到 constructor.name（不破坏既有约定）', () => {
    class NeverRegistered extends ICERect {}
    const ice = makeIce();
    ice.addChild(new NeverRegistered({ width: 10, height: 10 }));

    expect(ice.getTypeId(NeverRegistered)).toBeUndefined();
    const serializer = new Serializer(ice);
    const json: any = serializer.toJSONObject();
    expect(json.childNodes[0].type).toBe('NeverRegistered');
    // 回退写类名是**有风险**的（下游 mangle 后读不回来），必须可观测
    expect(serializer.unregisteredTypes).toEqual(['NeverRegistered']);
  });

  it('未注册类型只告警一次，且每次序列化重新收集', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      class NeverRegistered extends ICERect {}
      const ice = makeIce();
      ice.addChild(new NeverRegistered({ width: 10, height: 10 }));
      ice.addChild(new NeverRegistered({ width: 20, height: 20 }));

      const serializer = new Serializer(ice);
      serializer.toJSONObject();
      expect(serializer.unregisteredTypes).toEqual(['NeverRegistered']);
      expect(warn.mock.calls.filter((c) => String(c[0]).includes('未注册'))).toHaveLength(1);

      serializer.toJSONObject(); // 第二次：重新收集，不再累积
      expect(serializer.unregisteredTypes).toEqual(['NeverRegistered']);
      expect(warn.mock.calls.filter((c) => String(c[0]).includes('未注册'))).toHaveLength(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('内置 / 已注册类型不产生未注册告警', () => {
    const ice = makeIce();
    ice.addChild(new ICERect({ width: 10, height: 10 }));
    const serializer = new Serializer(ice);
    serializer.toJSONObject();
    expect(serializer.unregisteredTypes).toEqual([]);
  });

  it('注册前 getTypeId 返回 undefined，注册后返回 canonical typeId', () => {
    class Aliased extends ICERect {}
    const ice = makeIce();
    ice.addChild(new Aliased({ width: 10, height: 10 }));
    expect(ice.getTypeId(Aliased)).toBeUndefined();

    ice.registerType('test:Aliased', Aliased);
    expect(ice.getTypeId(Aliased)).toBe('test:Aliased');
    expect(ice.getType('test:Aliased')).toBe(Aliased);
  });
});

describe('反序列化容错', () => {
  it('未注册类型被跳过并记录，其余组件照常加载（不再抛错）', () => {
    const ice = makeIce();
    const json: any = {
      version: SERIALIZATION_VERSION, // 本用例与版本迁移无关：用当前版本，避免走迁移
      childNodes: [
        { type: 'ice-render:Rect', state: { left: 1, top: 2, width: 10, height: 10 }, childNodes: [] },
        {
          type: 'other-app:Widget',
          state: { foo: 1 },
          childNodes: [{ type: 'ice-render:Circle', state: { radius: 5 }, childNodes: [] }],
        },
        { type: 'ice-render:Circle', state: { radius: 7 }, childNodes: [] },
      ],
    };

    const d = new Deserializer(ice);
    expect(() => d.fromJSONObject(json)).not.toThrow();

    expect(ice.childNodes.length).toBe(2); // 未知节点（含其子树）被跳过
    expect(ice.childNodes[0]).toBeInstanceOf(ICERect);
    expect(ice.childNodes[1]).toBeInstanceOf(ICECircle);
    expect(d.unknownTypes).toEqual(['other-app:Widget']);
    expect(json.version).toBe(SERIALIZATION_VERSION); // 未发生迁移
  });

  it('registerType 之后同一份数据即可完整加载', () => {
    class Widget extends ICERect {}
    const ice = makeIce();
    ice.registerType('test:NotRegisteredWidget', Widget);

    const json: any = {
      version: 1,
      childNodes: [{ type: 'test:NotRegisteredWidget', state: { width: 10, height: 10 }, childNodes: [] }],
    };
    const d = new Deserializer(ice);
    d.fromJSONObject(json);

    expect(ice.childNodes.length).toBe(1);
    expect(ice.childNodes[0]).toBeInstanceOf(Widget);
    expect(d.unknownTypes).toEqual([]);
  });

  it('无 namespace 的旧类名不被识别：跳过该节点并记入 unknownTypes（无 version 字段也不影响）', () => {
    const ice = makeIce();
    const legacy: any = {
      createTime: '2022/1/1 00:00:00',
      lastModifyTime: '2022/1/1 00:00:00',
      childNodes: [{ type: 'ICERect', state: { left: 3, top: 4, width: 5, height: 6 }, childNodes: [] }],
    };
    const d = new Deserializer(ice);
    expect(() => d.fromJSONObject(legacy)).not.toThrow(); // 无 version 字段
    expect(ice.childNodes.length).toBe(0);
    expect(d.unknownTypes).toEqual(['ICERect']);
  });

  it('缺失 / 空 childNodes 不抛错', () => {
    const ice = makeIce();
    expect(() => new Deserializer(ice).fromJSONObject({ version: 1 })).not.toThrow();
    expect(() => new Deserializer(ice).fromJSONObject({ version: 1, childNodes: [] })).not.toThrow();
    expect(ice.childNodes.length).toBe(0);
  });
});

describe('版本迁移', () => {
  it('高于当前版本的数据仍抛错（明确拒绝，不误读）', () => {
    const ice = makeIce();
    const future: any = { version: 999, childNodes: [] };
    expect(() => new Deserializer(ice).fromJSONObject(future)).toThrow(/不支持的反序列化版本/);
  });

  it('迁移表按 to 升序逐级执行，并把 version 抬到最新', () => {
    const ran: string[] = [];
    // 注意：迁移表里现在**已有一条内置迁移**（v1 → v2 的 zIndex 归一化），
    // 所以这里用"相对当前版本"的目标（不能用写死的 2 / 3，否则会跟内置那条撞号），
    // 且结束时必须**还原**迁移表，而不是清空（清空会把内置迁移一起干掉）。
    const saved = SERIALIZATION_MIGRATIONS.slice();
    SERIALIZATION_MIGRATIONS.push({
      to: SERIALIZATION_VERSION + 1,
      run: (j: any) => {
        ran.push('v2');
        j.migratedV2 = true;
      },
    });
    SERIALIZATION_MIGRATIONS.push({
      to: SERIALIZATION_VERSION + 2,
      run: (j: any) => {
        ran.push('v3');
        j.migratedV3 = true;
      },
    });
    try {
      const ice = makeIce();
      const json: any = { version: 1, childNodes: [] };
      new Deserializer(ice).fromJSONObject(json);

      expect(ran).toEqual(['v2', 'v3']);
      expect(json.migratedV2).toBe(true);
      expect(json.migratedV3).toBe(true);
      expect(json.version).toBe(SERIALIZATION_VERSION + 2);
    } finally {
      SERIALIZATION_MIGRATIONS.length = 0;
      saved.forEach((m) => SERIALIZATION_MIGRATIONS.push(m));
    }
  });

  it('版本已是最新时不执行任何迁移', () => {
    const ran: string[] = [];
    const saved = SERIALIZATION_MIGRATIONS.slice();
    SERIALIZATION_MIGRATIONS.push({ to: 1, run: () => ran.push('v1') });
    try {
      const ice = makeIce();
      new Deserializer(ice).fromJSONObject({ version: SERIALIZATION_VERSION, childNodes: [] });
      expect(ran).toEqual([]);
    } finally {
      SERIALIZATION_MIGRATIONS.length = 0;
      saved.forEach((m) => SERIALIZATION_MIGRATIONS.push(m));
    }
  });
});

describe('派生字段不进序列化', () => {
  it('文本的换行结果 lines 不写进 JSON（反序列化后由 measureText 重算）', () => {
    const ice = makeIce();
    const t: any = new ICEText({ text: 'abcdefgh', wrap: true, width: 50 });
    ice.addChild(t);
    t.ctx = {
      font: '',
      measureText: (s: string) => ({ width: s.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    };
    t.measureText();
    expect(t.state.lines).toEqual(['abcde', 'fgh']);

    const json: any = new Serializer(ice).toJSONObject();
    expect(json.childNodes[0].state.lines).toBeUndefined();
    expect(json.childNodes[0].state.wrap).toBe(true); // 配置本身要序列化
  });
});
