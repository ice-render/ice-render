/**
 * **换主题必须作废位图缓存**（2026-09-17 修的真实缺陷）。
 *
 * 缺陷现象：热切换到深色后，大量文本仍停在**浅色主题的深字**，压在深底上看不清；
 * 而 `?theme=dark`（重建场景/刷新）完全正常 —— 说明配色写法没错，错在"不重建的那条路径"。
 *
 * 根因是两套机制的隐含假设冲突：
 * - 主题引用（`token('ui.colors.text')`）假设"样式是引用、paint 时解析"；
 * - 组件级离屏缓存 / 静态层假设"内容没变就贴旧位图" —— 而**主题不在内容指纹里**
 *   （`contentKeyVector` 推的是 `st.fillStyle`，换主题前后是同一个引用对象）。
 *
 * 而且 `__reapplyPreset()` 只对「用了 preset / 没写 style」的组件 `setState`，
 * **写了主题引用但没用 preset** 的组件根本不会被置脏 → 静态命中路径直接贴旧图。
 *
 * 这条用例钉住"四条主题入口都作废两层位图缓存"这件事（真机像素判据见
 * `e2e/visual/theme-cache-pixel.spec.ts`）。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});

global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  addPath() {}
  roundRect() {}
} as any;

import EventBus from '../../src/event/EventBus';
import ICE from '../../src/ICE';
import ICEText from '../../src/graphic/text/ICEText';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import { token } from '../../src/theme/ICETheme';

function makeIce() {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.renderer = new CanvasRenderer(ice);
  return ice;
}

/** 每条入口都要走一遍：setTheme / setChrome / setThemePatch / clearThemePatch。 */
const ENTRIES: Array<[string, (ice: any) => void]> = [
  ['setTheme', (ice) => ice.setTheme('dark')],
  ['setChrome', (ice) => ice.setChrome({ handle: { fill: '#123456' } })],
  ['setThemePatch', (ice) => ice.setThemePatch('probe', { primary: '#123456' })],
  ['clearThemePatch', (ice) => ice.clearThemePatch('probe')],
];

describe('换主题 → 位图缓存作废', () => {
  for (const [name, apply] of ENTRIES) {
    it(`${name}：清组件级离屏缓存 + 丢静态层 + 保证有帧`, () => {
      const ice = makeIce();
      const clearSpy = jest.spyOn((ice.renderer as any).cache, 'clear');
      // 造一个"已经烤好的静态层"，验证它被显式丢掉（不是靠 markQueueDirty 的副作用）
      (ice.renderer as any).__layer = { canvas: {}, members: [] };
      ice.dirty = false;
      if (name === 'clearThemePatch') ice.setThemePatch('probe', { primary: '#123456' });

      apply(ice);

      expect(clearSpy).toHaveBeenCalled();
      expect((ice.renderer as any).__layer).toBeNull();
      // ⚠️ 用对象断言而不是 `expect(x, '消息')` —— 本仓 jest 的 expect 只吃一个参数
      expect({ 有帧: ice.dirty }).toEqual({ 有帧: true });
    });
  }

  it('主题没变时也不会漏：文本组件的样式仍持有**引用**（换主题不需要重建组件）', () => {
    const ice = makeIce();
    const text: any = new ICEText({
      text: 'hello',
      width: 80,
      height: 20,
      style: { fillStyle: token('ui.colors.text') },
    });
    ice.addChild(text);
    const before = text.state.style.fillStyle;
    ice.setTheme('dark');
    // 引用对象本身不变（这就是"指纹靠不住"的原因）；变的是它解析出来的颜色
    expect(text.state.style.fillStyle).toBe(before);
    expect((ice.renderer as any).cache).toBeTruthy();
  });

  it('`invalidateObjectCache()` 返回 this，便于链式', () => {
    const ice = makeIce();
    expect((ice.renderer as any).invalidateObjectCache()).toBe(ice.renderer);
  });
});
