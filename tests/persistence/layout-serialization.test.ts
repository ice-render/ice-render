/**
 * 布局随快照往返（2026-09-15）。
 *
 * 布局是"怎么排"，与坐标一样属于**文档内容**：不写进文档的话「存盘再打开，版式散了」
 * （旧行为：`layoutManager` 完全不参与序列化）。这里守住三条：
 * ① 容器的策略写成 `layout: { type, props }`（props = 构造参数）；
 * ② 读回时按 type 反查构造函数重建，参数与子节点位置都要一致；
 * ③ 未注册的布局类型 → 跳过策略但保留坐标（不炸整份数据），并记进 `unknownTypes`。
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
import ICEBoxLayout from '../../src/layout/ICEBoxLayout';
import ICEFlowLayout from '../../src/layout/ICEFlowLayout';
import ICEGridLayout from '../../src/layout/ICEGridLayout';
import ICELayoutManager from '../../src/layout/ICELayoutManager';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

function makeIce(): ICE {
  const ice = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  return ice;
}

function roundTrip(ice: ICE) {
  const target = new ICE();
  target.evtBus = new EventBus();
  target.childNodes = [];
  new Deserializer(target).fromJSONObject(JSON.parse(JSON.stringify(new Serializer(ice).toJSONObject())));
  return target;
}

describe('布局随快照往返', () => {
  it('容器的策略写成 layout: { type, props }（内置布局注册了 canonical typeId）', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 400, height: 100 });
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 12, align: 'stretch' }));
    ice.addChild(group);

    const json: any = new Serializer(ice).toJSONObject();
    expect(json.childNodes[0].layout).toEqual({
      type: 'ice-render:ICEBoxLayout',
      props: { axis: 'x', gap: 12, align: 'stretch' },
    });
  });

  it('没有布局的容器不写 layout 字段（老文档与新文档都清爽）', () => {
    const ice = makeIce();
    ice.addChild(new ICEGroup({ width: 100, height: 50 }));
    const json: any = new Serializer(ice).toJSONObject();
    expect(json.childNodes[0].layout).toBe(undefined);
  });

  it('读回来：策略类型与参数一致，子节点位置也一致', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 400, height: 100 });
    const a = new ICERect({ width: 100, height: 20 });
    const b = new ICERect({ width: 60, height: 20 });
    group.addChildren([a, b]);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 12, align: 'end' }));
    ice.addChild(group);
    const expectedLeft = b.state.left;

    const loaded = roundTrip(ice);
    const restored: any = loaded.childNodes[0];
    expect(restored.layoutManager).toBeInstanceOf(ICEBoxLayout);
    expect(restored.layoutManager.toJSON()).toEqual({ axis: 'x', gap: 12, align: 'end' });
    expect(restored.childNodes[1].state.left).toBe(expectedLeft); // 112
    // 载入后再改尺寸仍会重排（策略是真被挂回去了，不只是记了个字段）
    restored.childNodes[0].setState({ width: 200 });
    restored.doLayout();
    expect(restored.childNodes[1].state.left).toBe(212);
  });

  it('三种内置布局往返（Flow / Grid / Box）', () => {
    const ice = makeIce();
    const row = new ICEGroup({ width: 300, height: 60 });
    row.setLayout(new ICEFlowLayout({ gap: 8, align: 'center', crossAlign: 'center' }));
    const grid = new ICEGroup({ width: 200, height: 100 });
    grid.setLayout(new ICEGridLayout({ cols: 3, gapX: 4, gapY: 6 }));
    const col = new ICEGroup({ width: 120, height: 200 });
    col.setLayout(new ICEBoxLayout({ axis: 'y', gap: 10 }));
    ice.addChildren([row, grid, col]);

    const loaded = roundTrip(ice);
    expect(loaded.childNodes[0].layoutManager.toJSON()).toEqual({
      gap: 8,
      // FlowLayout 2.10 起新增行间距与装箱方式（默认值 = 历史行为）
      gapY: 8,
      align: 'center',
      crossAlign: 'center',
      pack: 'in-order',
    });
    expect(loaded.childNodes[1].layoutManager.toJSON()).toEqual({
      cols: 3,
      rows: undefined,
      gapX: 4,
      gapY: 6,
      cellSizing: 'content',
    });
    expect(loaded.childNodes[2].layoutManager.toJSON()).toEqual({ axis: 'y', gap: 10, align: 'start' });
  });

  it('未注册的布局类型：**不写进快照**（不假装能读回）、保留坐标、记入 unregisteredTypes', () => {
    class MyLayout extends ICELayoutManager {
      layoutContainer(): void {}
      toJSON(): any {
        return { foo: 1 };
      }
    }
    const ice = makeIce();
    const group = new ICEGroup({ width: 200, height: 100 });
    const rect = new ICERect({ left: 33, top: 44, width: 20, height: 20 });
    group.addChild(rect);
    group.setLayout(new MyLayout());
    ice.addChild(group);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const serializer = new Serializer(ice);
    const json: any = serializer.toJSONObject();
    // 没注册 → 不写 layout 字段（回退写类名会产出"下游打包改名后就废"的数据）
    expect(json.childNodes[0].layout).toBeUndefined();
    expect(serializer.unregisteredTypes).toContain('MyLayout');
    expect(warn).toHaveBeenCalled();

    const target = new ICE();
    target.evtBus = new EventBus();
    target.childNodes = [];
    const deserializer = new Deserializer(target);
    deserializer.fromJSONObject(JSON.parse(JSON.stringify(json)));
    const restored: any = target.childNodes[0];
    expect(restored.layoutManager).toBe(null); // 没注册 → 保持无布局
    expect(restored.childNodes[0].state.left).toBe(33); // 坐标照旧
    warn.mockRestore();
  });

  it('旧快照里仍是类名的布局：读回时按未注册类型处理（向后兼容）', () => {
    // 用真实产物构造"旧快照"：先正常序列化，再把 layout.type 改写成 2.8 之前的无 namespace 类名
    const ice = makeIce();
    const group = new ICEGroup({ width: 200, height: 100 });
    const rect = new ICERect({ left: 0, top: 0, width: 20, height: 20 });
    group.addChild(rect);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 5 }));
    ice.addChild(group);
    const doc: any = JSON.parse(JSON.stringify(new Serializer(ice).toJSONObject()));
    expect(doc.childNodes[0].layout.type).toBe('ice-render:ICEBoxLayout');
    doc.childNodes[0].layout = { type: 'LegacyBoxLayout', props: { axis: 'x', gap: 5 } };

    const target = makeIce();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const deserializer = new Deserializer(target);
    deserializer.fromJSONObject(doc);
    const restored: any = target.childNodes[0];
    expect(restored.layoutManager).toBe(null); // 未注册 → 保持无布局
    expect(restored.childNodes[0].state.left).toBe(rect.state.left); // 坐标照旧
    expect(deserializer.unknownTypes).toContain('LegacyBoxLayout');
    warn.mockRestore();
  });

  it('布局用的是基类默认 toJSON()：开发期告警一次（有参布局的参数会丢）', () => {
    class LazyLayout extends ICELayoutManager {
      constructor(props: any = {}) {
        super();
        this.foo = props.foo;
      }
      public foo: any;
      layoutContainer(): void {}
      // 故意不实现 toJSON
    }
    const ice = makeIce();
    ice.registerType('test:LazyLayout', LazyLayout);
    const group = new ICEGroup({ width: 200, height: 100 });
    group.addChild(new ICERect({ width: 20, height: 20 }));
    group.setLayout(new LazyLayout({ foo: 42 }));
    ice.addChild(group);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const json: any = new Serializer(ice).toJSONObject();
    expect(json.childNodes[0].layout.props).toEqual({}); // 参数丢了 —— 但至少响了一声
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain('基类默认 toJSON');
    warn.mockRestore();
  });

  it('toJSON() 返回 null = 显式不进文档（组件内部策略），既不写也不告警', () => {
    class InternalLayout extends ICELayoutManager {
      layoutContainer(): void {}
      // 内部策略：参数活在组件 state 里，构造时由组件自己重建 —— 不需要进文档
      toJSON(): any {
        return null;
      }
    }
    const ice = makeIce();
    const group = new ICEGroup({ width: 200, height: 100 });
    group.addChild(new ICERect({ left: 7, top: 8, width: 20, height: 20 }));
    group.setLayout(new InternalLayout());
    ice.addChild(group);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const json: any = new Serializer(ice).toJSONObject();
    expect(json.childNodes[0].layout).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    expect(json.childNodes[0].childNodes[0].state.left).toBe(7); // 坐标照旧
    warn.mockRestore();
  });
});
