/**
 * **主题补丁层（v2.14.0）**：`setTheme()` 写**基座**，`setThemePatch(id, patch)` 写**叠在基座上的命名补丁**。
 *
 * 修的是什么：一个画布上，UI 主题（控件库）与领域主题（图表调色板 / 设计器外壳）会写同一组
 * `semantic.*` / `chrome`。以前两边都直接改实例主题 → **后写的赢**：换 UI 主题会把领域主题抹掉，
 * 换领域主题会把 UI 主题抹掉，成败取决于调用顺序（agent-console 的 `diagram-layer.ts` 注释里记过这条）。
 */
import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICERect from '../../src/graphic/shape/ICERect';
import { token } from '../../src/theme/ICETheme';

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  return ice;
}

describe('主题补丁层', () => {
  it('补丁叠在基座上：`setTheme` 换基座，补丁自动重放（不再"后写的赢"）', () => {
    const ice = makeIce();
    ice.setTheme('light');
    ice.setThemePatch('ice-chart', { primary: '#FF00FF' });
    expect(ice.getTheme().semantic.primary).toBe('#FF00FF');

    // 换 UI 主题（基座）—— 领域补丁必须**还在**（这才是它存在的意义）
    ice.setTheme('dark');
    expect(ice.getTheme().semantic.primary).toBe('#FF00FF');
    // 基座的其他槽位跟着 UI 主题走（拿一份"纯 dark"实例对照，避免写死色值）
    const pure = makeIce();
    pure.setTheme('dark');
    expect(ice.getTheme().semantic.background).toBe(pure.getTheme().semantic.background);
  });

  it('调用顺序无关：先注册补丁再切基座 == 先切基座再注册补丁', () => {
    const a = makeIce();
    a.setThemePatch('ice-designer', { primary: '#00FF00' });
    a.setTheme('dark');

    const b = makeIce();
    b.setTheme('dark');
    b.setThemePatch('ice-designer', { primary: '#00FF00' });

    expect(a.getTheme().semantic.primary).toBe(b.getTheme().semantic.primary);
    expect(a.getTheme().semantic.background).toBe(b.getTheme().semantic.background);
    expect(a.getTheme().semantic.primary).toBe('#00FF00');
  });

  it('多层补丁按注册顺序叠加；同 id 再注册即替换（幂等）', () => {
    const ice = makeIce();
    ice.setTheme('light');
    ice.setThemePatch('ui', { primary: '#111111' });
    ice.setThemePatch('domain', { primary: '#222222' });
    expect(ice.getTheme().semantic.primary).toBe('#222222');
    expect(ice.getThemePatchIds()).toEqual(['ui', 'domain']);

    ice.setThemePatch('domain', { primary: '#333333' });
    expect(ice.getTheme().semantic.primary).toBe('#333333');
    expect(ice.getThemePatchIds()).toEqual(['ui', 'domain']);
  });

  it('clearThemePatch 撤掉后回到基座', () => {
    const ice = makeIce();
    ice.setTheme('light');
    const base = ice.getTheme().semantic.primary;
    ice.setThemePatch('ice-chart', { primary: '#ABCDEF' });
    expect(ice.getTheme().semantic.primary).toBe('#ABCDEF');
    ice.clearThemePatch('ice-chart');
    expect(ice.getTheme().semantic.primary).toBe(base);
  });

  it('补丁改了主题 ⇒ 引用式样式在下一帧就是新色（版本号 + 广播都走到）', () => {
    const ice = makeIce();
    ice.setTheme('light');
    const rect: any = new ICERect({ width: 10, height: 10, style: { fillStyle: token('primary') } });
    ice.addChild(rect);

    const changes: string[] = [];
    ice.onThemeChange((info: any) => changes.push(info.kind));
    const beforeRev = ice.__themeRevision;

    ice.setThemePatch('ice-chart', { primary: '#123456' });
    expect(ice.__themeRevision).toBeGreaterThan(beforeRev);
    expect(rect.themeOf().semantic.primary).toBe('#123456');
    expect(changes).toContain('patch');
  });

  it('`setChrome` 写的也是基座（不会被补丁层的存在改变语义）', () => {
    const ice = makeIce();
    ice.setTheme('light');
    ice.setThemePatch('domain', { primary: '#FF0000' });
    ice.setChrome({ handle: { fill: '#00FF00' } });
    expect(ice.getTheme().semantic.chrome.handle.fill).toBe('#00FF00');
    expect(ice.getTheme().semantic.primary).toBe('#FF0000');
  });
});
