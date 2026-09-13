/**
 * 动画写值通道（A）+ 位移量化（B）的回归。
 *
 * 背景（2026-09-13 实测）：动画写值走 `setState` 会**无条件**置 `paramsDirty`，
 * 于是离屏位图每帧重建 —— 1000 个文本 32.5ms/帧（位图重建 20000 次、复用 0 次）；
 * 改走"只置 dirty"的通道后是 2.5ms/帧（复用 19000 次）。但位图复用只在**整数设备像素位移**
 * 时成立（`ObjectCache.refreshPosition` 的保真契约），所以还要把飞行中的平移量量化到设备像素栅格。
 *
 * 语义约定（本文档即契约）：
 * 1. `setState(patch, { paramsDirty })` —— 省略 = 沿用旧行为（置脏）；显式 false 才跳过派生参数重算；
 * 2. 「是否安全」由**子类显式声明的安全键白名单**决定，未声明的一律视为"影响派生参数"（保守方向：
 *    漏判只会少优化，不会算错尺寸）；
 * 3. 量化只作用于**纯平移**（`left` / `top` / `transform.translate`）、且只对**当前可离屏缓存**的组件生效；
 *    动画的**终点值**永远精确写入（配置成 100.5 就落在 100.5，不会被吸附）。
 */
import AnimationManager from '../../src/animation/AnimationManager';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEStar from '../../src/graphic/shape/ICEStar';
import ICEText from '../../src/graphic/text/ICEText';

/** 造一个「真实组件 + 可选离屏缓存能力」的 AnimationManager 环境。 */
function makeManager(options: { cachable?: boolean; viewportScale?: number } = {}) {
  const ice: any = {
    evtBus: { on: () => {}, off: () => {}, trigger: () => {} },
    getRenderViewport: () => ({ scale: options.viewportScale ?? 1, tx: 0, ty: 0 }),
    renderer: {
      cache: {
        isCachable: () => options.cachable ?? false,
      },
    },
  };
  const manager: any = new AnimationManager(ice);
  return { manager, ice };
}

/** 造一个文本组件（显式尺寸，避免自动量测干扰），并挂到 ice 上。 */
function makeText(ice: any, props: any = {}) {
  const text: any = new ICEText({ text: 'hello', left: 0, top: 0, width: 100, height: 20, ...props });
  text.ice = ice;
  return text;
}

describe('A · setState 的 paramsDirty 选项', () => {
  it('省略选项 = 旧行为（置 paramsDirty）', () => {
    const rect: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    rect.paramsDirty = false;
    rect.dirty = false;
    rect.setState({ left: 5 });
    expect(rect.state.left).toBe(5);
    expect(rect.paramsDirty).toBe(true);
    expect(rect.dirty).toBe(true);
  });

  it('显式 { paramsDirty: false } 时跳过派生参数重算，但仍置 dirty', () => {
    const rect: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    rect.paramsDirty = false;
    rect.dirty = false;
    rect.setState({ left: 5 }, { paramsDirty: false });
    expect(rect.state.left).toBe(5);
    expect(rect.paramsDirty).toBe(false);
    expect(rect.dirty).toBe(true);
  });

  it('容器（ICEGroup）也支持：自身可跳过重算，子节点仍被置 dirty', () => {
    const group: any = new ICEGroup({ left: 0, top: 0, width: 100, height: 50 });
    const child: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    group.addChild(child);
    group.paramsDirty = false;
    child.dirty = false;
    child.paramsDirty = false;
    group.setState({ left: 20 }, { paramsDirty: false });
    expect(group.state.left).toBe(20);
    expect(group.paramsDirty).toBe(false); // 自身跳过
    expect(child.dirty).toBe(true); // 子节点必须重绘（祖先矩阵变了）
    expect(child.paramsDirty).toBe(false); // 但不连带重量测
  });
});

describe('A · 动画安全键白名单（保守方向：未声明 = 影响派生参数）', () => {
  it('基类：平移/变换/透明度/显示可见 zIndex 安全，宽高不安全', () => {
    const rect: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    // 基类（不量测的图形）：`style.*` 全是绘制属性，安全
    [
      'left',
      'top',
      'transform.rotate',
      'transform.translate',
      'opacity',
      'display',
      'zIndex',
      'style.fillStyle',
    ].forEach((key) => {
      expect([key, rect.isAnimationSafeKey(key)]).toEqual([key, true]);
    });
    ['width', 'height', 'radius'].forEach((key) => {
      expect([key, rect.isAnimationSafeKey(key)]).toEqual([key, false]);
    });
  });

  it('文本：位置/透明度/颜色/装饰线/光标安全；字号、字间距、行高、文本、换行不安全', () => {
    const text: any = new ICEText({ text: 'hello' });
    ['left', 'top', 'opacity', 'caretIndex', 'selectionStart', 'style.fillStyle', 'style.textDecoration'].forEach(
      (key) => {
        expect([key, text.isAnimationSafeKey(key)]).toEqual([key, true]);
      }
    );
    [
      'text',
      'width',
      'height',
      'wrap',
      'maxLines',
      'direction',
      'style.fontSize',
      'style.letterSpacing',
      'style.lineHeight',
    ].forEach((key) => {
      expect([key, text.isAnimationSafeKey(key)]).toEqual([key, false]);
    });
  });

  it('点集类：几何参数（outerRadius）不安全，位置安全', () => {
    const star: any = new ICEStar({ left: 0, top: 0, outerRadius: 20 });
    expect(star.isAnimationSafeKey('outerRadius')).toBe(false);
    expect(star.isAnimationSafeKey('left')).toBe(true);
  });

  it('未知键一律按「影响派生参数」处理', () => {
    const text: any = new ICEText({ text: 'hello' });
    expect(text.isAnimationSafeKey('someBrandNewKey')).toBe(false);
    expect(text.isAnimationSafeKey('style.someBrandNewStyle')).toBe(false);
  });

  it('静态查询（不需要实例）：下游按类问「这个属性动画安全吗」', () => {
    expect(ICEText.isAnimationSafeKeyFor(ICEText, 'left')).toBe(true);
    expect(ICEText.isAnimationSafeKeyFor(ICEText, 'style.fontSize')).toBe(false);
    expect(ICEStar.isAnimationSafeKeyFor(ICEStar, 'outerRadius')).toBe(false);
    expect(ICEStar.isAnimationSafeKeyFor(ICEStar, 'transform.rotate')).toBe(true);
    // 没声明白名单的类 → 落到基类白名单（保守：只有位置/变换那批算安全）
    class Custom extends ICERect {}
    expect(ICERect.isAnimationSafeKeyFor(Custom, 'left')).toBe(true);
    expect(ICERect.isAnimationSafeKeyFor(Custom, 'width')).toBe(false);
  });
});

describe('A · AnimationManager 的写值通道', () => {
  it('平移动画：不置 paramsDirty（位图可复用）；几何动画：仍置 paramsDirty', () => {
    const { manager, ice } = makeManager();
    const text = makeText(ice);
    text.props.animations = { left: { from: 0, to: 100, duration: 100 } };
    text.paramsDirty = false;
    (manager as any).tween(text, 0);
    (manager as any).tween(text, 50);
    expect(text.state.left).toBeCloseTo(50, 6);
    expect((text as any).paramsDirty).toBe(false);

    const text2 = makeText(ice);
    text2.props.animations = { width: { from: 100, to: 200, duration: 100 } };
    text2.paramsDirty = false;
    (manager as any).tween(text2, 0);
    (manager as any).tween(text2, 50);
    expect(text2.state.width).toBeCloseTo(150, 6);
    expect((text2 as any).paramsDirty).toBe(true);
  });
});

describe('B · 位移量化（设备像素栅格）', () => {
  it('可缓存组件的平移在飞行中吸附到设备像素；终点值精确写入', () => {
    const { manager, ice } = makeManager({ cachable: true });
    const text = makeText(ice);
    text.props.animations = { left: { from: 0, to: 100.5, duration: 100 } };
    (manager as any).tween(text, 0); // 起帧（初始化 startTime）
    (manager as any).tween(text, 20); // 20% → 20.1 → 吸到 20
    expect(text.state.left).toBe(20);
    (manager as any).tween(text, 120); // 到点 → 精确 100.5
    expect(text.state.left).toBeCloseTo(100.5, 6);
  });

  it('dpr/视口放大时按 1/(dpr·scale) 的栅格吸附（scale=2 → 0.5 的倍数）', () => {
    const { manager, ice } = makeManager({ cachable: true, viewportScale: 2 });
    const text = makeText(ice);
    // 0 → 82.4，50% 处是 41.2 → 吸到 0.5 栅格上的 41.0
    text.props.animations = { left: { from: 0, to: 82.4, duration: 100 } };
    (manager as any).tween(text, 0);
    (manager as any).tween(text, 50);
    expect(text.state.left).toBeCloseTo(41, 6);
    expect(Number.isInteger(text.state.left * 2)).toBe(true);
  });

  it('不可缓存的组件不吸附（避免无谓地改变运动精度）', () => {
    const { manager, ice } = makeManager({ cachable: false });
    const text = makeText(ice);
    text.props.animations = { left: { from: 0, to: 100.5, duration: 100 } };
    (manager as any).tween(text, 0);
    (manager as any).tween(text, 20);
    expect(text.state.left).toBeCloseTo(20.1, 6);
  });

  it('单条动画可显式关掉吸附（snapToDevicePixel: false）', () => {
    const { manager, ice } = makeManager({ cachable: true });
    const text = makeText(ice);
    text.props.animations = { left: { from: 0, to: 100.5, duration: 100, snapToDevicePixel: false } };
    (manager as any).tween(text, 0);
    (manager as any).tween(text, 20);
    expect(text.state.left).toBeCloseTo(20.1, 6);
  });

  it('实例级开关关闭后完全不吸附（AnimationManager.snapToDevicePixel = false）', () => {
    const { manager, ice } = makeManager({ cachable: true });
    manager.snapToDevicePixel = false;
    const text = makeText(ice);
    text.props.animations = { left: { from: 0, to: 100.5, duration: 100 } };
    (manager as any).tween(text, 0);
    (manager as any).tween(text, 20);
    expect(text.state.left).toBeCloseTo(20.1, 6);
  });

  it('非平移键（透明度/颜色）不吸附', () => {
    const { manager, ice } = makeManager({ cachable: true });
    const text = makeText(ice);
    text.props.animations = { 'style.globalAlpha': { from: 0, to: 1, duration: 100 } };
    (manager as any).tween(text, 0); // 起帧（初始化 startTime）
    (manager as any).tween(text, 33);
    expect(text.state.style.globalAlpha).toBeCloseTo(0.33, 6);
  });
});
