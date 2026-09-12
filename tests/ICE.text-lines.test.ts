/**
 * 多行文本行距回归。
 *
 * 背景：`__measureByCanvas()` 用 `actualBoundingBoxAscent/Descent`（字形墨迹）算行高，
 * 14px Tahoma 的墨迹高只有 ≈12px —— 多行文本按这个行距画，中文行会上下叠在一起
 * （XP 桌面 demo 的记事本、IE 正文都中招）。
 *
 * 规则：
 * - 单行：盒子仍然贴合墨迹（全库的居中/对齐都按它调过，不能变）；
 * - 多行：行距 ≥ 字号 × 1.35，盒子高 = 行距 × 行数。
 */
import ICEText from '../src/graphic/text/ICEText';

const fakeCtx: any = {
  font: '',
  // 模拟 Canvas 文本度量：墨迹高 11 + 3 = 14px（字号 14），宽度按字符数估
  measureText: (s: string) => ({
    width: String(s).length * 7,
    actualBoundingBoxAscent: 11,
    actualBoundingBoxDescent: 3,
  }),
};

const makeText = (text: string, fontSize = 14) => {
  const node = new ICEText({ text, width: 300, style: { fontSize, fontFamily: 'Tahoma' } });
  // ctx 是组件上的普通属性（引擎在组件入场景时才注入），这里手动给一个假的度量器
  (node as any).ctx = fakeCtx;
  (node as any).measureText();
  return node;
};

describe('ICEText 多行行距', () => {
  it('单行：盒子仍贴合字形墨迹（不改变既有布局行为）', () => {
    const node = makeText('Hello');
    expect(node.state.textHeight).toBe(14);
  });

  it('多行：行距不小于字号 × 1.35，中文不会叠字', () => {
    const node = makeText('第一行\n第二行\n第三行');
    const lineCount = 3;
    expect(node.state.textHeight).toBeGreaterThanOrEqual(lineCount * 14 * 1.35 - 0.01);
    // 每行可用高度必须 ≥ 字号（否则墨迹会重叠）
    expect(node.state.textHeight / lineCount).toBeGreaterThanOrEqual(14);
  });

  it('行数越多盒子越高（线性增长）', () => {
    // 多行之间是等差（每一行加一个行距）；单行沿用墨迹高度，不参与比较
    const two = makeText('一行\n二行');
    const three = makeText('一行\n二行\n三行');
    const four = makeText('一行\n二行\n三行\n四行');
    expect(three.state.textHeight - two.state.textHeight).toBeCloseTo(
      four.state.textHeight - three.state.textHeight,
      4
    );
  });

  it('字号更大时行距同步变大', () => {
    const small = makeText('a\nb', 12);
    const large = makeText('a\nb', 24);
    expect(large.state.textHeight).toBeGreaterThan(small.state.textHeight);
    expect(small.state.textHeight / 2).toBeGreaterThanOrEqual(12);
  });
});
