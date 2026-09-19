/**
 * **v1 → v2 的 `zIndex` 迁移**（2026-09-19）。
 *
 * v1（≤ 2.16.0）文档里的 `zIndex` 是"构造顺序计数器"留下的数字（`198/199/200…`）。
 * v2 把它们当**应用自己钉的正数**，于是新组件（`'auto'` = 0）会画到它们下面 ——
 * 也就是 v1 时代那个"新建的图元看不见"的症状换个入口回来了（实测复现）。
 *
 * 迁移规则：按**每个兄弟组**归一化 —— 绘制次序逐项不变，最上层落回 auto 层，
 * 这样"打开旧文档后新建的组件仍然画在最上面"这条承诺继续成立。
 */
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import EventBus from '../../src/event/EventBus';
import Serializer, { SERIALIZATION_VERSION } from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';
import { sortSiblingsByZIndex, zIndexOf } from '../../src/util/data-util';

function makeIce() {
  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.evtBus = new EventBus();
  return ice;
}

/** 某个容器的绘制次序（按 zIndex 升序、稳定 —— 与展平口径一致）。 */
const paint = (list: any[]) => sortSiblingsByZIndex(list).map((c: any) => c.state.id);

/** 造一份"v1 风格"的文档：用当前序列化器写出来，再把 version 手改回 1（v1 就是这么存的）。 */
function legacyDoc(build: (group: any) => void): any {
  const ice = makeIce();
  const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
  ice.addChild(group);
  build(group);
  const doc: any = new Serializer(ice).toJSONObject();
  doc.version = 1;
  return doc;
}

describe('v1 → v2：旧文档的 zIndex 迁移', () => {
  it('★ 计数器数字的旧文档：载入后次序逐项不变，且新建的仍在最上层', () => {
    const doc = legacyDoc((group) => {
      // v1 里这就是"构造顺序计数器"留下的数字
      group.addChild(new ICERect({ id: 'old1', width: 10, height: 10, zIndex: 198 }));
      group.addChild(new ICERect({ id: 'old2', width: 10, height: 10, zIndex: 199 }));
      group.addChild(new ICERect({ id: 'old3', width: 10, height: 10, zIndex: 200 }));
    });

    const ice = makeIce();
    new Deserializer(ice).fromJSONObject(doc);
    const group: any = ice.childNodes[0];
    expect(paint(group.childNodes)).toEqual(['old1', 'old2', 'old3']); // 次序不变

    // 迁移把编号压回新口径：最上面那个落回 auto 层（默认值不写），其余是负数
    expect(zIndexOf(group.childNodes[0])).toBe(-2);
    expect(zIndexOf(group.childNodes[1])).toBe(-1);
    expect(group.childNodes[2].state.zIndex).toBe('auto');

    const fresh = new ICERect({ id: 'fresh', width: 10, height: 10 });
    group.addChild(fresh);
    expect(paint(group.childNodes)).toEqual(['old1', 'old2', 'old3', 'fresh']); // 新建的在最上
  });

  it('次序与加入次序不同时也逐项保持（钉子/负值一律按"次序"解释）', () => {
    const doc = legacyDoc((group) => {
      group.addChild(new ICERect({ id: 'a', width: 10, height: 10, zIndex: 9 }));
      group.addChild(new ICERect({ id: 'b', width: 10, height: 10, zIndex: 1 }));
      group.addChild(new ICERect({ id: 'c', width: 10, height: 10, zIndex: 5 }));
      group.addChild(new ICERect({ id: 'bg', width: 10, height: 10, zIndex: -1 }));
    });
    const ice = makeIce();
    new Deserializer(ice).fromJSONObject(doc);
    const group: any = ice.childNodes[0];
    expect(paint(group.childNodes)).toEqual(['bg', 'b', 'c', 'a']);

    const fresh = new ICERect({ id: 'fresh', width: 10, height: 10 });
    group.addChild(fresh);
    expect(paint(group.childNodes)).toEqual(['bg', 'b', 'c', 'a', 'fresh']);
  });

  it('旧文档整组都没写 zIndex（等于纯加入顺序）时不动它', () => {
    const doc = legacyDoc((group) => {
      group.addChild(new ICERect({ id: 'a', width: 10, height: 10 }));
      group.addChild(new ICERect({ id: 'b', width: 10, height: 10 }));
    });
    expect(doc.childNodes[0].childNodes.every((n: any) => n.state.zIndex === undefined)).toBe(true);

    const ice = makeIce();
    new Deserializer(ice).fromJSONObject(doc);
    expect(doc.childNodes[0].childNodes.every((n: any) => n.state.zIndex === undefined)).toBe(true);
    expect(paint((ice.childNodes[0] as any).childNodes)).toEqual(['a', 'b']);
  });

  it('v2 文档不做迁移：应用自己钉的值原样保留', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ id: 'g', left: 0, top: 0, width: 300, height: 300 });
    ice.addChild(group);
    group.addChild(new ICERect({ id: 'overlay', width: 10, height: 10, zIndex: 9000 }));
    group.addChild(new ICERect({ id: 'a', width: 10, height: 10 }));
    const doc: any = new Serializer(ice).toJSONObject();
    expect(doc.version).toBe(SERIALIZATION_VERSION);

    const ice2 = makeIce();
    new Deserializer(ice2).fromJSONObject(doc);
    const group2: any = ice2.childNodes[0];
    expect(group2.childNodes[0].state.zIndex).toBe(9000); // 钉子没被归一化掉
    expect(paint(group2.childNodes)).toEqual(['a', 'overlay']);
  });

  it('载入后版本号被抬到最新（再存就是 v2 文档）', () => {
    const doc = legacyDoc((group) => {
      group.addChild(new ICERect({ id: 'a', width: 10, height: 10, zIndex: 7 }));
    });
    const ice = makeIce();
    new Deserializer(ice).fromJSONObject(doc);
    expect(doc.version).toBe(SERIALIZATION_VERSION);
    const resaved: any = new Serializer(ice).toJSONObject();
    expect(resaved.version).toBe(SERIALIZATION_VERSION);
  });
});
