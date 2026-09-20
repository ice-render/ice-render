import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEBoxLayout from '../../src/layout/ICEBoxLayout';

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
  bezierCurveTo() {}
  quadraticCurveTo() {}
};

describe('最小尺寸协议（getMinimumSize / setMinimumSize）', () => {
  it('组件缺省没有下限（[0,0]），且 isMinimumSizeSet() 为 false', () => {
    const rect = new ICERect({ width: 60, height: 20 });
    expect(rect.getMinimumSize()).toEqual([0, 0]);
    expect(rect.isMinimumSizeSet()).toBe(false);
  });

  it('setMinimumSize 支持只约束一个轴（另一个轴回落到首选尺寸）', () => {
    const rect = new ICERect({ width: 60, height: 20 });
    rect.setMinimumSize({ width: 30 });
    expect(rect.getMinimumSize()).toEqual([30, 0]);
    expect(rect.isMinimumSizeSet()).toBe(true);
  });

  it('空间不足时**默认不压缩**（没声明下限 = 不可压，保持历史行为）', () => {
    const group = new ICEGroup({ width: 100, height: 40 });
    const a = new ICERect({ width: 80, height: 20, grow: 1 });
    const b = new ICERect({ width: 80, height: 20, grow: 1 });
    group.addChildren([a, b]);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));
    // 需要 160、只有 100：两项都保持 80（如实溢出），不被压成 50
    expect(a.state.width).toBe(80);
    expect(b.state.width).toBe(80);
  });

  it('声明了 setMinimumSize 之后，grow 的子项才参与收缩，且不低于下限', () => {
    const group = new ICEGroup({ width: 100, height: 40 });
    const a = new ICERect({ width: 80, height: 20, grow: 1 });
    const b = new ICERect({ width: 80, height: 20, grow: 1 });
    a.setMinimumSize({ width: 40 });
    b.setMinimumSize({ width: 40 });
    group.addChildren([a, b]);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));
    // 缺 60，两项各能让 40 → 各让 30，落到 50（都在下限之上）
    expect(a.state.width).toBe(50);
    expect(b.state.width).toBe(50);
  });

  it('收缩到下限就停：容器再小也不再压内容（如实溢出，而不是压没）', () => {
    const group = new ICEGroup({ width: 60, height: 40 });
    const a = new ICERect({ width: 80, height: 20, grow: 1 });
    const b = new ICERect({ width: 80, height: 20, grow: 1 });
    a.setMinimumSize({ width: 40 });
    b.setMinimumSize({ width: 40 });
    group.addChildren([a, b]);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));
    expect(a.state.width).toBe(40);
    expect(b.state.width).toBe(40);
  });

  it('只有"能压"和"不能压"混合时，压力集中在能压的那一项上', () => {
    const group = new ICEGroup({ width: 100, height: 40 });
    const fixed = new ICERect({ width: 60, height: 20 });
    const flexible = new ICERect({ width: 80, height: 20, grow: 1 });
    flexible.setMinimumSize({ width: 40 });
    group.addChildren([fixed, flexible]);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));
    expect(fixed.state.width).toBe(60); // 没声明 grow / 下限 → 不参与收缩
    expect(flexible.state.width).toBe(40); // 缺口 40 全由它承担，正好到下限
  });

  it('容器把子项的最小值沿嵌套向上报（getMinimumSize → 策略 → 子项）', () => {
    const inner = new ICEGroup({ width: 200, height: 40 });
    const leaf = new ICERect({ width: 80, height: 20 });
    leaf.setMinimumSize({ width: 40 });
    inner.addChild(leaf);
    inner.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));
    expect(inner.getMinimumSize()).toEqual([40, 20]);

    const outer = new ICEGroup({ width: 200, height: 40 });
    outer.addChild(inner);
    outer.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));
    expect(outer.getMinimumSize()).toEqual([40, 20]);
  });

  it('setMinimumSize 会请求父容器重排（对齐 Swing 的 revalidate()）', () => {
    const group = new ICEGroup({ width: 100, height: 40 });
    const child = new ICERect({ width: 80, height: 20, grow: 1 });
    group.addChild(child);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));
    const spy = jest.spyOn(group, 'requestLayout');
    child.setMinimumSize({ width: 40 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
