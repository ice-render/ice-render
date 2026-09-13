/**
 * typeId 格式与注册表冲突契约。
 *
 * 本轮重构的目标：
 * - 注册名统一为 `namespace:Type`；
 * - 同一个 typeId 注册不同构造函数必须明确抛错；
 * - 同一个构造函数不能同时拥有两个 typeId（反查会歧义）；
 * - 同一个 typeId + 同一个构造函数视为幂等，允许重复调用；
 * - 只认 canonical `namespace:Type`，不做「旧的无 namespace 类名」兼容（家族仍在发布初期）。
 */
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import { TYPE_ID_PATTERN, isTypeId, makeTypeId, parseTypeId } from '../../src/util/type-id';

describe('typeId 格式', () => {
  it('接受 namespace:Type', () => {
    expect(isTypeId('ice-render:Rect')).toBe(true);
    expect(isTypeId('ice-entity-designer:FlowNode')).toBe(true);
    expect(isTypeId('my-company:Widget_2')).toBe(true);
  });

  it('拒绝无 namespace、空 namespace / Type 或大写 namespace', () => {
    expect(isTypeId('ICERect')).toBe(false);
    expect(isTypeId('ice-render:')).toBe(false);
    expect(isTypeId(':Rect')).toBe(false);
    expect(isTypeId('Ice-Render:Rect')).toBe(false);
    expect(isTypeId('ice_render:Rect')).toBe(false);
  });

  it('makeTypeId / parseTypeId 可往返', () => {
    expect(makeTypeId('my-app', 'Widget')).toBe('my-app:Widget');
    expect(parseTypeId('my-app:Widget')).toEqual({ namespace: 'my-app', type: 'Widget' });
  });

  it('格式契约随包导出（下游包复用，不必各处手写正则）', () => {
    const pkg = require('../../src/index');
    expect(pkg.TYPE_ID_PATTERN).toEqual(TYPE_ID_PATTERN);
    expect(pkg.isTypeId('ice-chart:PlotArea')).toBe(true);
    expect(pkg.isTypeId('PlotArea')).toBe(false);
    expect(pkg.makeTypeId('ice-chart', 'PlotArea')).toBe('ice-chart:PlotArea');
    expect(pkg.parseTypeId('ice-chart:PlotArea')).toEqual({ namespace: 'ice-chart', type: 'PlotArea' });
    expect(() => pkg.assertTypeId('PlotArea')).toThrow(/namespace:Type/);
  });
});

describe('ICE 类型注册表', () => {
  function makeIce(): any {
    return new ICE() as any;
  }

  it('内置类型使用 namespaced canonical typeId', () => {
    const ice = makeIce();
    expect(ice.getTypeId(ICERect)).toBe('ice-render:Rect');
    expect(ice.getType('ice-render:Rect')).toBe(ICERect);
    // 不做旧名兼容：无 namespace 的类名不是类型标识
    expect(ice.getType('ICERect')).toBeUndefined();
    expect(ice.hasType('ICERect')).toBe(false);
  });

  it('拒绝没有 namespace 的注册名', () => {
    const ice = makeIce();
    class Widget extends ICERect {}
    expect(() => ice.registerType('Widget', Widget)).toThrow(/namespace:Type/);
  });

  it('同一个 typeId + 同一个构造函数是幂等的', () => {
    const ice = makeIce();
    expect(() => ice.registerType('ice-render:Rect', ICERect)).not.toThrow();
    expect(ice.getTypeId(ICERect)).toBe('ice-render:Rect');
  });

  it('同一个 typeId 注册不同构造函数必须抛错', () => {
    const ice = makeIce();
    class OtherRect extends ICERect {}
    expect(() => ice.registerType('ice-render:Rect', OtherRect)).toThrow(/已注册|already/i);
  });

  it('同一个构造函数注册第二个 canonical typeId 必须抛错（避免反查歧义）', () => {
    const ice = makeIce();
    class Widget extends ICERect {}
    ice.registerType('my-app:Widget', Widget);
    expect(() => ice.registerType('my-app:WidgetAlias', Widget)).toThrow(/多个|反查|歧义|already/i);
  });

  it('注册表用无原型对象承载：Object.prototype 上的名字不会被当成类型', () => {
    const ice = makeIce();
    // 否则 getType('constructor') 会命中 Object.prototype.constructor，反序列化时
    // 把脏数据（type: 'constructor'）变成 new Object(state) 而不是「未知类型」
    expect(ice.getType('constructor')).toBeUndefined();
    expect(ice.getType('toString')).toBeUndefined();
    expect(ice.hasType('constructor')).toBe(false);
  });

  it('Clazz 不是构造函数时明确抛错', () => {
    const ice = makeIce();
    expect(() => ice.registerType('my-app:Widget', {} as any)).toThrow(/构造函数/);
  });
});
