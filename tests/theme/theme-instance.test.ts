/**
 * 主题的实例级隔离。
 *
 * 契约：
 * - `ice.setTheme()` 只改**本实例**，不污染模块级默认主题（多品牌/多租户可并存）
 * - 组件的 `preset` 在加入实例时按**该实例的主题**解析（构造时用的仍是模块级默认主题，
 *   因此单实例、未设主题的场景行为完全不变）
 * - 模块级 `setTheme()` 仍作为「此后新建实例」的默认值
 * - 未使用 preset 的组件不受主题影响（`__reapplyPreset` 为空转）
 * - `ice.getTheme()` 返回本实例主题
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import { DEFAULT_THEME, DARK_THEME, getTheme, setTheme } from '../../src/theme/ICETheme';

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  return ice;
}

afterEach(() => {
  // 模块级主题是全局的，测试里若改过要还原，避免影响同文件其它用例
  setTheme('default');
});

describe('实例级主题隔离', () => {
  it('两个 ICE 实例设不同主题时 preset 各自解析，互不污染', () => {
    const iceA = makeIce();
    const iceB = makeIce();

    iceA.setTheme('dark');
    // iceB 保持默认

    const a: any = new ICERect({ preset: 'title', width: 10, height: 10 });
    iceA.addChild(a);
    const b: any = new ICERect({ preset: 'title', width: 10, height: 10 });
    iceB.addChild(b);

    expect(a.state.style.fillStyle).toBe(DARK_THEME.semantic.text);
    expect(b.state.style.fillStyle).toBe(DEFAULT_THEME.semantic.text);
    expect(a.state.style.fillStyle).not.toBe(b.state.style.fillStyle);
  });

  it('ice.setTheme() 不修改模块级默认主题', () => {
    const ice = makeIce();
    const before = getTheme();

    ice.setTheme('dark');

    expect(getTheme()).toBe(before); // 模块级未变
    expect(ice.getTheme()).toBe(DARK_THEME); // 实例级已变
  });

  it('ice.getTheme() 返回本实例主题', () => {
    const iceA = makeIce();
    const iceB = makeIce();
    iceA.setTheme({ primary: '#123456' });

    expect((iceA.getTheme() as any).semantic.primary).toBe('#123456');
    expect((iceB.getTheme() as any).semantic.primary).toBe(DEFAULT_THEME.semantic.primary);
  });

  it('后加入的组件按所属实例的主题重新解析 preset', () => {
    const ice = makeIce();
    // 先构造（此刻按模块级默认主题解析 preset）
    const rect: any = new ICERect({ preset: 'title', width: 10, height: 10 });
    expect(rect.state.style.fillStyle).toBe(DEFAULT_THEME.semantic.text);

    ice.setTheme('dark'); // 实例切到暗色
    ice.addChild(rect); // 加入时被纠正

    expect(rect.state.style.fillStyle).toBe(DARK_THEME.semantic.text);
  });

  it('用户显式传入的样式优先于 preset', () => {
    const ice = makeIce();
    ice.setTheme('dark');
    const rect: any = new ICERect({ preset: 'title', width: 10, height: 10, style: { fillStyle: '#ABCDEF' } });
    ice.addChild(rect);

    expect(rect.state.style.fillStyle).toBe('#ABCDEF');
  });

  it('setTheme 会重新解析整棵树（含嵌套子组件）', () => {
    const ice = makeIce();
    const group: any = new ICEGroup({ width: 100, height: 100 });
    const nested: any = new ICERect({ preset: 'body', width: 10, height: 10 });
    group.addChild(nested);
    ice.addChild(group);

    expect(nested.state.style.fillStyle).toBe(DEFAULT_THEME.semantic.text);

    ice.setTheme('dark');

    expect(nested.state.style.fillStyle).toBe(DARK_THEME.semantic.text);
  });

  it('未使用 preset 的组件不受主题影响（preset 空转）', () => {
    const ice = makeIce();
    const rect: any = new ICERect({ width: 10, height: 10, style: { fillStyle: '#FEDCBA' } });
    ice.addChild(rect);

    ice.setTheme('dark');

    expect(rect.state.style.fillStyle).toBe('#FEDCBA');
  });

  it('实例级 setTheme 可反复切换且可回到默认', () => {
    const ice = makeIce();
    const rect: any = new ICERect({ preset: 'body', width: 10, height: 10 });
    ice.addChild(rect);

    ice.setTheme('dark');
    expect(rect.state.style.fillStyle).toBe(DARK_THEME.semantic.text);

    ice.setTheme('default');
    expect(rect.state.style.fillStyle).toBe(DEFAULT_THEME.semantic.text);
  });
});

describe('模块级默认主题仍然可用', () => {
  it('模块级 setTheme 作为此后新建实例的默认主题', () => {
    setTheme('dark');
    const ice = makeIce();
    const rect: any = new ICERect({ preset: 'body', width: 10, height: 10 });
    ice.addChild(rect);

    expect((ice.getTheme() as any).semantic.text).toBe(DARK_THEME.semantic.text);
    expect(rect.state.style.fillStyle).toBe(DARK_THEME.semantic.text);
  });

  it('模块级主题不影响已显式设置过主题的实例', () => {
    const ice = makeIce();
    ice.setTheme('default');

    setTheme('dark'); // 之后改模块级默认

    expect((ice.getTheme() as any).semantic.text).toBe(DEFAULT_THEME.semantic.text);
  });
});
