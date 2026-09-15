/**
 * 布局机制对齐 Java Swing（2026-09-15）。
 *
 * 三条口径（OpenJDK 21 源码 / 运行时实测确认）：
 * 1. **布局不继承**：`Container.setLayout()` 只写自己的字段，父布局只给子容器摆位置，
 *    子容器用自己的策略排自己的子项（引擎旧实现把策略递归灌给后代，等于穿透组件内部）；
 * 2. **自顶向下校验**：`Container.validateTree()` 先排自己，再递归失效的子容器
 *    （引擎旧实现只有"向上 requestLayout"，内层容器被改尺寸后不会重排自己的子树）；
 * 3. **尺寸协商**：布局问 `child.getPreferredSize()`（`BorderLayout.preferredLayoutSize`
 *    就是这么写的），而不是直接读子项的盒子；Flow/Box/Border 跳过不可见子项、GridLayout 保留格子。
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEFlowLayout from '../../src/layout/ICEFlowLayout';
import ICEBoxLayout from '../../src/layout/ICEBoxLayout';
import ICEBorderLayout from '../../src/layout/ICEBorderLayout';
import ICEGridLayout from '../../src/layout/ICEGridLayout';

/** 自己报首选尺寸的组件：用来证明布局问的是 `getPreferredSize()` 而不是盒子。 */
class SizedLeaf extends ICERect {
  private native: [number, number];
  constructor(props: any = {}) {
    super(props);
    this.native = [props.nativeWidth || 10, props.nativeHeight || 10];
  }
  public getPreferredSize(): [number, number] {
    return [this.native[0], this.native[1]];
  }
}

describe('布局不继承（对齐 Swing 的 Container.setLayout）', () => {
  it('setLayout 不会把策略灌给已有子容器', () => {
    const outer = new ICEGroup({ width: 400, height: 200 });
    const inner = new ICEGroup({ width: 100, height: 50 });
    outer.addChild(inner);
    outer.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(outer.layoutManager).toBeTruthy();
    expect(inner.layoutManager).toBe(null);
  });

  it('setLayout 之后新增的子容器也不继承', () => {
    const outer = new ICEGroup({ width: 400, height: 200 });
    outer.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    const inner = new ICEGroup({ width: 100, height: 50 });
    outer.addChild(inner);
    expect(inner.layoutManager).toBe(null);
  });

  it('孙容器同样不继承（旧实现会递归灌到整棵树）', () => {
    const outer = new ICEGroup({ width: 400, height: 200 });
    const inner = new ICEGroup({ width: 100, height: 50 });
    const grand = new ICEGroup({ width: 40, height: 20 });
    inner.addChild(grand);
    outer.addChild(inner);
    outer.setLayout(new ICEFlowLayout({ gap: 5 }));
    expect(inner.layoutManager).toBe(null);
    expect(grand.layoutManager).toBe(null);
  });

  it('子容器自己要排子项，得自己 setLayout（各持策略）', () => {
    const outer = new ICEGroup({ width: 400, height: 200 });
    const inner = new ICEGroup({ width: 100, height: 50 });
    const leaf = new ICERect({ width: 30, height: 10 });
    const leaf2 = new ICERect({ width: 30, height: 10 });
    inner.addChild(leaf);
    inner.addChild(leaf2);
    inner.setLayout(new ICEBoxLayout({ axis: 'x', gap: 5 }));
    outer.addChild(inner);
    outer.setLayout(new ICEFlowLayout({ gap: 5 }));
    expect(leaf2.state.left).toBe(35);
    expect(leaf.state.left).toBe(0);
  });
});

describe('自顶向下校验（对齐 Swing 的 validateTree）', () => {
  it('父布局改了内层容器的尺寸后，内层容器自己会跟着重排', () => {
    const outer = new ICEGroup({ width: 400, height: 200 });
    const inner = new ICEGroup({ width: 10, height: 10 });
    const card = new ICERect({ width: 5, height: 5 });
    inner.addChild(card);
    inner.setLayout(new ICEBorderLayout({ gap: 0 }));
    outer.addChild(inner);

    // inner 没给 layoutConstraint → 落在 center，会被外层拉满
    outer.setLayout(new ICEBorderLayout({ gap: 0 }));

    expect(inner.state.width).toBe(400);
    expect(inner.state.height).toBe(200);
    // 关键：inner 自己的布局也跟着跑了一遍（旧实现要等下一次显式 doLayout）
    expect(card.state.width).toBe(400);
    expect(card.state.height).toBe(200);
  });

  it('中间层容器没有布局时，校验仍能穿过去（失效的深层容器会被重排）', () => {
    const outer = new ICEGroup({ width: 300, height: 120 });
    const middle = new ICEGroup({ width: 300, height: 120 }); // 没有布局：中间层只是"过道"
    const inner = new ICEGroup();
    const card = new ICERect({ width: 5, height: 5 });
    inner.addChild(card);
    inner.setLayout(new ICEBorderLayout({ gap: 0 }));
    middle.addChild(inner);
    outer.addChild(middle);

    // 深层容器自己失效 → 沿父链冒泡 → 顶层下一次 doLayout 沿失效路径下潜
    inner.setState({ width: 200, height: 80 });
    outer.doLayout();
    expect(card.state.width).toBe(200);
    expect(card.state.height).toBe(80);
  });
});

describe('尺寸协商（对齐 Swing 的 preferredLayoutSize）', () => {
  it('布局问的是 getPreferredSize()，不是子项的盒子', () => {
    const group = new ICEGroup({ width: 400, height: 60 });
    const a = new SizedLeaf({ width: 10, height: 10, nativeWidth: 80, nativeHeight: 20 });
    const b = new SizedLeaf({ width: 10, height: 10, nativeWidth: 80, nativeHeight: 20 });
    group.addChildren([a, b]);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(a.state.left).toBe(0);
    expect(b.state.left).toBe(90); // 80 + gap10

    // 没给尺寸的容器才对外报内容自然尺寸（给了尺寸的报自己的盒子）
    const auto = new ICEGroup();
    const c = new SizedLeaf({ nativeWidth: 80, nativeHeight: 20 });
    const d = new SizedLeaf({ nativeWidth: 80, nativeHeight: 20 });
    auto.addChildren([c, d]);
    auto.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(auto.getPreferredSize()).toEqual([170, 20]);
  });

  it('构造期给的 width/height 是「当前边界」，不参与首选尺寸协商（Swing 的 setBounds 语义）', () => {
    const inner = new ICEGroup({ width: 120, height: 40 });
    inner.addChild(new ICERect({ width: 30, height: 10 }));
    inner.setLayout(new ICEBoxLayout({ axis: 'x', gap: 5 }));
    expect(inner.isPreferredSizeSet()).toBe(false);
    expect(inner.getPreferredSize()).toEqual([30, 10]); // 内容想要的尺寸
    expect(inner.state.width).toBe(120); // 边界不受影响
  });

  it('没给尺寸的容器报内容自然尺寸', () => {
    const inner = new ICEGroup();
    inner.addChild(new ICERect({ width: 30, height: 10 }));
    inner.addChild(new ICERect({ width: 40, height: 10 }));
    inner.setLayout(new ICEBoxLayout({ axis: 'x', gap: 5 }));
    expect(inner.isPreferredSizeSet()).toBe(false);
    expect(inner.getPreferredSize()).toEqual([75, 10]);
  });

  it('setPreferredSize() 可以覆盖内容尺寸（Swing 同名 API）', () => {
    const inner = new ICEGroup();
    inner.addChild(new ICERect({ width: 30, height: 10 }));
    inner.setLayout(new ICEBoxLayout({ axis: 'x', gap: 5 }));
    inner.setPreferredSize([200, 60]);
    expect(inner.isPreferredSizeSet()).toBe(true);
    expect(inner.getPreferredSize()).toEqual([200, 60]);
  });

  it('父布局按子容器报的首选尺寸摆位', () => {
    const outer = new ICEGroup({ width: 500, height: 100 });
    const inner = new ICEGroup();
    inner.addChild(new ICERect({ width: 30, height: 10 }));
    inner.addChild(new ICERect({ width: 40, height: 10 }));
    inner.setLayout(new ICEBoxLayout({ axis: 'x', gap: 5 }));
    const tail = new ICERect({ width: 20, height: 10 });
    outer.addChildren([inner, tail]);
    outer.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(tail.state.left).toBe(85); // 75 + gap10
  });
});

describe('不可见子项（对齐 Swing：Flow/Box/Border 跳过、Grid 保留格子）', () => {
  it('FlowLayout 不为 display:false 的子项留位', () => {
    const group = new ICEGroup({ width: 400, height: 60 });
    const a = new ICERect({ width: 80, height: 20 });
    const hidden = new ICERect({ width: 100, height: 20 });
    const c = new ICERect({ width: 80, height: 20 });
    hidden.setState({ display: false });
    group.addChildren([a, hidden, c]);
    group.setLayout(new ICEFlowLayout({ gap: 10 }));
    expect(c.state.left).toBe(90);
  });

  it('BoxLayout 不为 display:false 的子项留位', () => {
    const group = new ICEGroup({ width: 400, height: 60 });
    const a = new ICERect({ width: 80, height: 20 });
    const hidden = new ICERect({ width: 100, height: 20 });
    const c = new ICERect({ width: 80, height: 20 });
    hidden.setState({ display: false });
    group.addChildren([a, hidden, c]);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(c.state.left).toBe(90);
  });

  it('BorderLayout 跳过 display:false 的区域，center 顶上来', () => {
    const group = new ICEGroup({ width: 300, height: 120 });
    const north = new ICERect({ width: 300, height: 30 });
    const center = new ICERect({ width: 10, height: 10 });
    north.setState({ display: false });
    group.addChildren([north, center]);
    group.setLayout(new ICEBorderLayout({ gap: 0 }));
    expect(center.state.width).toBe(300);
    expect(center.state.height).toBe(120);
  });

  it('GridLayout 保留不可见子项的格子（Swing 同口径）', () => {
    const group = new ICEGroup({ width: 200, height: 60 });
    const a = new ICERect({ width: 40, height: 20 });
    const hidden = new ICERect({ width: 40, height: 20 });
    hidden.setState({ display: false });
    group.addChildren([a, hidden]);
    group.setLayout(new ICEGridLayout({ cols: 2, gapX: 0, gapY: 0 }));
    expect(a.state.left).toBe(0);
    // 隐藏项照样占一格（列宽 40 + gap 0），所以它不会被跳过、后面也没有别的项挤上来
    expect(hidden.state.left).toBe(40);
  });
});
