/**
 * 序列化类型注册、反序列化容错与版本迁移。
 *
 * 契约：
 * - 序列化写出的 type 由「构造函数 → 注册名」反查得到，与类的 JS 名解耦（压缩改名不破坏数据）
 * - 未注册的自定义类型回退到 constructor.name（保持既有约定）
 * - 反序列化遇到未注册类型不再抛错：跳过该节点并记录到 unknownTypes，其余内容照常加载
 * - 旧数据（type 写类名）仍能加载；缺失 version 视为 1；高于当前版本仍抛错
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
import componentTypeMap from '../../src/consts/COMPONENT_TYPE_MAPPING';
import ICERect from '../../src/graphic/shape/ICERect';
import ICECircle from '../../src/graphic/shape/ICECircle';
import ICERose from '../../src/graphic/shape/ICERose';
import ICEText from '../../src/graphic/text/ICEText';
import Serializer from '../../src/persistence/Serializer';
import Deserializer, { SERIALIZATION_MIGRATIONS } from '../../src/persistence/Deserializer';

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.typeMapping = { ...componentTypeMap };
  return ice;
}

describe('类型注册表（typeId）', () => {
  it('内置类型全部可反查：ICERose 不再漏注册，可完整 round-trip', () => {
    const ice = makeIce();
    ice.addChild(new ICERose({ left: 10, top: 10, radius: 40, leafNum: 3 }));

    const json = new Serializer(ice).toJSONString();
    expect(json).toContain('"type":"ICERose"');

    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONString(json);
    expect(ice2.childNodes.length).toBe(1);
    expect(ice2.childNodes[0]).toBeInstanceOf(ICERose);
  });

  it('每种已注册类型都能由构造函数反查到稳定 typeId', () => {
    const ice = makeIce();
    for (const name in componentTypeMap) {
      expect(ice.getTypeId(componentTypeMap[name])).toBe(name);
    }
  });

  it('序列化用反查到的注册名，与类的 JS 名解耦（模拟压缩改名）', () => {
    class RenamedByBundler extends ICERect {}
    const ice = makeIce();
    ice.registerType('CustomRect', RenamedByBundler);

    const r = new RenamedByBundler({ left: 1, top: 2, width: 10, height: 10 });
    ice.addChild(r);
    const json: any = new Serializer(ice).toJSONObject();

    expect(r.constructor.name).toBe('RenamedByBundler');
    expect(json.childNodes[0].type).toBe('CustomRect'); // 用注册名而非类名
  });

  it('未注册类型回退到 constructor.name（不破坏既有约定）', () => {
    class NeverRegistered extends ICERect {}
    const ice = makeIce();
    ice.addChild(new NeverRegistered({ width: 10, height: 10 }));

    expect(ice.getTypeId(NeverRegistered)).toBeUndefined();
    const json: any = new Serializer(ice).toJSONObject();
    expect(json.childNodes[0].type).toBe('NeverRegistered');
  });

  it('同名别名的注册会让反查表失效并重建', () => {
    class Aliased extends ICERect {}
    const ice = makeIce();
    ice.addChild(new Aliased({ width: 10, height: 10 }));
    expect(ice.getTypeId(Aliased)).toBeUndefined();

    ice.registerType('Aliased', Aliased);
    expect(ice.getTypeId(Aliased)).toBe('Aliased');
  });
});

describe('反序列化容错', () => {
  it('未注册类型被跳过并记录，其余组件照常加载（不再抛错）', () => {
    const ice = makeIce();
    const json: any = {
      version: 1,
      childNodes: [
        { type: 'ICERect', state: { left: 1, top: 2, width: 10, height: 10 }, childNodes: [] },
        {
          type: 'NotRegisteredWidget',
          state: { foo: 1 },
          childNodes: [{ type: 'ICECircle', state: { radius: 5 }, childNodes: [] }],
        },
        { type: 'ICECircle', state: { radius: 7 }, childNodes: [] },
      ],
    };

    const d = new Deserializer(ice);
    expect(() => d.fromJSONObject(json)).not.toThrow();

    expect(ice.childNodes.length).toBe(2); // 未知节点（含其子树）被跳过
    expect(ice.childNodes[0]).toBeInstanceOf(ICERect);
    expect(ice.childNodes[1]).toBeInstanceOf(ICECircle);
    expect(d.unknownTypes).toEqual(['NotRegisteredWidget']);
    expect(json.version).toBe(1); // 未发生迁移
  });

  it('registerType 之后同一份数据即可完整加载', () => {
    class Widget extends ICERect {}
    const ice = makeIce();
    ice.registerType('NotRegisteredWidget', Widget);

    const json: any = {
      version: 1,
      childNodes: [{ type: 'NotRegisteredWidget', state: { width: 10, height: 10 }, childNodes: [] }],
    };
    const d = new Deserializer(ice);
    d.fromJSONObject(json);

    expect(ice.childNodes.length).toBe(1);
    expect(ice.childNodes[0]).toBeInstanceOf(Widget);
    expect(d.unknownTypes).toEqual([]);
  });

  it('旧数据（type 写类名）仍能加载', () => {
    const ice = makeIce();
    const legacy: any = {
      createTime: '2022/1/1 00:00:00',
      lastModifyTime: '2022/1/1 00:00:00',
      childNodes: [{ type: 'ICERect', state: { left: 3, top: 4, width: 5, height: 6 }, childNodes: [] }],
    };
    new Deserializer(ice).fromJSONObject(legacy); // 无 version 字段
    expect(ice.childNodes[0]).toBeInstanceOf(ICERect);
    expect(ice.childNodes[0].state.left).toBe(3);
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
    SERIALIZATION_MIGRATIONS.push({
      to: 2,
      run: (j: any) => {
        ran.push('v2');
        j.migratedV2 = true;
      },
    });
    SERIALIZATION_MIGRATIONS.push({
      to: 3,
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
      expect(json.version).toBe(3);
    } finally {
      SERIALIZATION_MIGRATIONS.length = 0;
    }
  });

  it('版本已是最新时不执行任何迁移', () => {
    const ran: string[] = [];
    SERIALIZATION_MIGRATIONS.push({ to: 1, run: () => ran.push('v1') });
    try {
      const ice = makeIce();
      new Deserializer(ice).fromJSONObject({ version: 1, childNodes: [] });
      expect(ran).toEqual([]);
    } finally {
      SERIALIZATION_MIGRATIONS.length = 0;
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
