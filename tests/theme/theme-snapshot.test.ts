/**
 * 主题进快照：文档存盘之后，「它是按哪个主题设计的」不能丢。
 *
 * 存的是**补丁 / 名字**而不是整份主题：整份主题会把内置 token 全写进文档（体积 + 与引擎版本耦合）。
 */
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';
import EventBus from '../../src/event/EventBus';
import { token, DEFAULT_THEME, setTheme } from '../../src/theme/ICETheme';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D(), createOffscreenCanvas: () => null } };
});
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
};

afterEach(() => {
  setTheme('default');
});

function makeIce() {
  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.evtBus = new EventBus();
  ice.serializer = new Serializer(ice);
  ice.deserializer = new Deserializer(ice);
  ice.theme = DEFAULT_THEME;
  ice.registerType('ice-render:Rect', ICERect);
  ice.registerType('ice-render:Group', ICEGroup);
  return ice;
}

describe('主题进快照', () => {
  it('命名主题存名字', () => {
    const ice = makeIce();
    ice.setTheme('dark');
    const json: any = ice.serializer.toJSONObject();
    expect(json.theme).toEqual({ name: 'dark' });
  });

  it('部分主题存补丁：相对命名主题的真实差异，不写整份主题', () => {
    const ice = makeIce();
    ice.setTheme({ primary: '#ff0000' });
    const json: any = ice.serializer.toJSONObject();
    // 基线是 default —— 补丁是「相对 default 改了哪几处」，形状与主题同构
    expect(json.theme.name).toBe('default');
    expect(json.theme.patch).toEqual({ semantic: { primary: '#ff0000' } });
    // 没把内置 token 全写进去（只有一个 primary）
    expect(Object.keys(json.theme.patch)).toEqual(['semantic']);
    expect(Object.keys(json.theme.patch.semantic)).toEqual(['primary']);
  });

  it('整份主题对象进去，出来的仍然是最小差异（这条是修 bug 的回归）', () => {
    const ice = makeIce();
    // 模拟应用层把「一整份主题对象」塞给 setTheme（旧实现会把 base+semantic 全存进快照）
    ice.setTheme({ base: { radius: { md: 6 } }, semantic: { primary: '#010203' } } as any);
    const json: any = ice.serializer.toJSONObject();
    expect(json.theme.patch.base).toEqual({ radius: { md: 6 } });
    expect(json.theme.patch.semantic).toEqual({ primary: '#010203' });
    // 不可能出现整份内置 token
    expect(json.theme.patch.semantic.chrome).toBeUndefined();
    expect(json.theme.patch.semantic.motion).toBeUndefined();
    expect(json.theme.patch.semantic.palette).toBeUndefined();
  });

  it('与命名主题完全一致时不写 patch（只写名字）', () => {
    const ice = makeIce();
    ice.setTheme('dark');
    const json: any = ice.serializer.toJSONObject();
    expect(json.theme).toEqual({ name: 'dark' });
  });

  it('setChrome 的覆盖也会进补丁（形状同上，只有那一处差异）', () => {
    const ice = makeIce();
    ice.setChrome({ handle: { fill: '#0d6efd' } as any });
    const json: any = ice.serializer.toJSONObject();
    expect(json.theme).toEqual({ name: 'default', patch: { semantic: { chrome: { handle: { fill: '#0d6efd' } } } } });
  });

  it('没动过主题就不写 theme 字段（旧快照格式不受影响）', () => {
    const ice = makeIce();
    const json: any = ice.serializer.toJSONObject();
    expect(json.theme).toBeUndefined();
  });

  it('还原时主题先于组件生效（默认样式 / preset / 主题引用都对上）', () => {
    const source = makeIce();
    source.setTheme({ primary: '#ff0000' });
    const rect = new ICERect({ style: { fillStyle: token('primary') } } as any);
    source.addChild(rect);
    const json = source.serializer.toJSONString();

    const target = makeIce();
    target.theme = DEFAULT_THEME;
    target.deserializer.fromJSONString(json);
    expect(target.getTheme().semantic.primary).toBe('#ff0000');
    // 主题引用在还原后的实例上解析成补丁里的颜色
    const restored: any = target.childNodes[0];
    restored.ctx = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
    (restored as any).applyStyleToCtx();
    expect(restored.ctx.fillStyle).toBe('#ff0000');
  });

  it('旧快照（没有 theme 字段）还原时不改当前主题', () => {
    const ice = makeIce();
    const rect = new ICERect({ style: { fillStyle: '#123456' } } as any);
    ice.addChild(rect);
    const json: any = ice.serializer.toJSONObject();
    delete json.theme;

    const target = makeIce();
    target.setTheme('dark');
    target.deserializer.fromJSONObject(json);
    // 明确断言：仍是 dark（没有被重置成 default）
    expect(target.getTheme().semantic.background).not.toBe(DEFAULT_THEME.semantic.background);
  });
});
