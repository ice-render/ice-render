/**
 * 主题变更通知：`ice.onThemeChange(fn)`（底层是 evtBus 上的 `THEME_CHANGE` 事件）。
 *
 * 为什么需要它：`setTheme` 以前**不发任何信号**，所以应用层只能"自己是调用方"时才知道主题变了。
 * 图表 `theme:'auto'`（跟随引擎明暗）、设计器外壳（从引擎主题派生）这类**被动跟随**的场景，
 * 只能各自发明同步时机，或者干脆等下一次重建 —— 这是之前"引擎换了主题、图表纹丝不动"的根因。
 */
import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICE_EVENT_NAME_CONSTS from '../../src/consts/ICE_EVENT_NAME_CONSTS';
import { DEFAULT_THEME, DARK_THEME } from '../../src/theme/ICETheme';

function makeIce(): any {
  const ice: any = new ICE();
  ice.theme = DEFAULT_THEME;
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.evtBus = new EventBus();
  return ice;
}

describe('主题变更通知', () => {
  it('setTheme 通知订阅者，并把「新主题 / 旧主题 / 来源」一起给出来', () => {
    const ice = makeIce();
    const seen: any[] = [];
    ice.onThemeChange((info: any) => seen.push(info));

    ice.setTheme('dark');

    expect(seen).toHaveLength(1);
    expect(seen[0].kind).toBe('theme');
    expect(seen[0].theme).toBe(ice.getTheme());
    expect(seen[0].theme.semantic.primary).toBe(DARK_THEME.semantic.primary);
    expect(seen[0].previous.semantic.primary).toBe(DEFAULT_THEME.semantic.primary);
  });

  it('部分主题（深合并）同样通知', () => {
    const ice = makeIce();
    let count = 0;
    ice.onThemeChange(() => count++);
    ice.setTheme({ primary: '#123456' });
    expect(count).toBe(1);
    expect(ice.getTheme().semantic.primary).toBe('#123456');
  });

  it('setChrome 也算主题变更（外壳是主题的一部分），但 kind 不同', () => {
    const ice = makeIce();
    const kinds: string[] = [];
    ice.onThemeChange((info: any) => kinds.push(info.kind));
    ice.setChrome({ handle: { fill: '#0d6efd' } } as any);
    expect(kinds).toEqual(['chrome']);
  });

  it('取消订阅之后不再收到通知（返回的函数就是退订）', () => {
    const ice = makeIce();
    let count = 0;
    const off = ice.onThemeChange(() => count++);
    ice.setTheme({ primary: '#111111' });
    off();
    ice.setTheme({ primary: '#222222' });
    expect(count).toBe(1);
  });

  it('多个订阅者互不影响；订阅者里抛错不会打断主题应用', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ice = makeIce();
    const order: string[] = [];
    ice.onThemeChange(() => order.push('a'));
    ice.onThemeChange(() => {
      order.push('b');
      throw new Error('订阅者自己炸了');
    });
    ice.onThemeChange(() => order.push('c'));
    expect(() => ice.setTheme({ primary: '#333333' })).not.toThrow();
    // 后面的订阅者照常收到通知
    expect(order).toEqual(['a', 'b', 'c']);
    // 主题确实应用了
    expect(ice.getTheme().semantic.primary).toBe('#333333');
    // 抛错不是静默吞掉：给一条 warn（且只给一次，避免切主题时刷屏）
    expect(warn).toHaveBeenCalledTimes(1);
    ice.setTheme({ primary: '#444444' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('底层事件名也暴露出来（不用硬编码字符串）', () => {
    const ice = makeIce();
    let fired = 0;
    ice.evtBus.on(ICE_EVENT_NAME_CONSTS.THEME_CHANGE, () => fired++);
    ice.setTheme('dark');
    expect(fired).toBe(1);
  });

  it('init() 之前订阅也不会丢（总线上还没建起来时按需建）', () => {
    const ice: any = new ICE();
    ice.theme = DEFAULT_THEME;
    ice.childNodes = [];
    ice.toolNodes = [];
    let fired = 0;
    ice.onThemeChange(() => fired++);
    ice.setTheme({ primary: '#654321' });
    expect(fired).toBe(1);
  });
});
