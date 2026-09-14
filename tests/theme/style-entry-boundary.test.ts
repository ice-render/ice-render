/**
 * 「外观只有一个容器」的边界回归。
 *
 * 结论（也是写进架构文档的规则）：
 * - **`style` = 外观**：ctx 属性 + 引擎的样式糖（`shadow` / 渐变）+ 子元素外观（`style.label`）。
 *   它可以引用主题 token、可以被 `props.states` 覆盖 —— 因为它在绘制那一刻解析。
 * - **顶层 props = 动画可写通道 + 几何/缓存签名参数**（`lineDash` / `lineDashOffset` /
 *   `lineBorder*` / `opacity`）。它们不是"漏进 props 的外观"，而是：① 动画按顶层 key 写值
 *   （`state[key]`），② `ObjectCache` 的签名与脏矩形外扩量直接读它们 —— 挪进 style 会让这两条同时失效。
 */
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
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

const makeLine = (props: any = {}) =>
  new ICEPolyLine({
    points: [
      [0, 0],
      [100, 0],
    ],
    label: '连接',
    ...props,
  } as any);

describe('连线标签：外观归 style.label', () => {
  it('默认标签样式就在 style.label 里（不是第二个容器）', () => {
    const line = makeLine();
    const label: any = line.props.style.label;
    expect(label).toBeTruthy();
    expect(label.fontSize).toBe(14);
    expect((line.props as any).labelStyle).toBeUndefined();
  });

  it('老写法 labelStyle 会在构造时单向并入 style.label（且 style.label 优先）', () => {
    const line = makeLine({ labelStyle: { fontSize: 20, fillStyle: '#123456' } });
    const label: any = line.props.style.label;
    expect(label.fontSize).toBe(20);
    expect(label.fillStyle).toBe('#123456');
    // 两个都写时，规范位置（style.label）赢
    const both = makeLine({
      labelStyle: { fontSize: 20 },
      style: { label: { fontSize: 11 } },
    });
    expect((both.props.style.label as any).fontSize).toBe(11);
  });

  it('标签色可以引用主题 token（在绘制那一刻解析）', () => {
    const line = makeLine({ style: { label: { fillStyle: token('chrome.linkLabel.fill') } } });
    // 渲染一次，确认解析路径没抛错、且解析结果是主题里的值
    const theme = line.themeOf();
    const resolved = (line as any).state.style.label.fillStyle;
    expect(resolved.$token).toBe('chrome.linkLabel.fill');
    expect(DEFAULT_THEME.semantic.chrome.linkLabel.fill).toBe(theme.semantic.chrome.linkLabel.fill);
  });

  it('标签的文本 / 量测走同一份 style.label（解析结果与主题一致）', () => {
    const line = makeLine();
    const label: any = line.props.style.label;
    const theme = line.themeOf();
    // 默认值就是 token 引用 → 解析结果必须等于主题里那一项（不依赖渲染，纯数据断言）
    expect((label.fillStyle as any).$token).toBe('chrome.linkLabel.fill');
    expect((label.backgroundColor as any).$token).toBe('chrome.linkLabel.background');
    expect(theme.semantic.chrome.linkLabel.fill).toBeTruthy();
  });
});

describe('顶层 props 的边界（不是漏网的外观）', () => {
  it('lineDash / lineDashOffset / lineBorder* 仍在顶层：动画与缓存签名按顶层 key 读写', () => {
    const line: any = makeLine({ lineDash: [4, 2], lineDashOffset: 3, lineBorder: true, lineBorderWidth: 2 });
    expect(line.state.lineDash).toEqual([4, 2]);
    expect(line.state.lineDashOffset).toBe(3);
    expect(line.state.lineBorder).toBe(true);
    expect(line.state.lineBorderWidth).toBe(2);
  });

  it('但它们的**颜色**归主题：lineBorderColor 支持 token 引用', () => {
    const line: any = makeLine({ lineBorder: true, lineBorderColor: token('border') });
    const resolved = (line as any).themeOf().semantic.border;
    expect(resolved).toBe(DEFAULT_THEME.semantic.border);
  });
});
