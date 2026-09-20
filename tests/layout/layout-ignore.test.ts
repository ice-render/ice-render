import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEBoxLayout from '../../src/layout/ICEBoxLayout';
import ICEFlowLayout from '../../src/layout/ICEFlowLayout';
import ICEGridLayout from '../../src/layout/ICEGridLayout';
import ICEBorderLayout from '../../src/layout/ICEBorderLayout';

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

describe('layoutIgnore：手动定位的子项（CSS `position:absolute` 的对应物）', () => {
  it('BoxLayout 跳过它、位置保持不动，其余子项照常排且不留空位', () => {
    const group = new ICEGroup({ width: 300, height: 50 });
    const a = new ICERect({ width: 60, height: 20 });
    const pinned = new ICERect({ width: 60, height: 20, left: 111, top: 7, layoutIgnore: true });
    const b = new ICERect({ width: 60, height: 20 });
    group.addChildren([a, pinned, b]);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));

    expect(a.state.left).toBe(0);
    expect(pinned.state.left).toBe(111); // 布局不碰它
    expect(pinned.state.top).toBe(7);
    expect(b.state.left).toBe(70); // a(60) + gap(10)，手动项不占位
  });

  it('FlowLayout 跳过它（不参与换行与行内推进）', () => {
    const group = new ICEGroup({ width: 200, height: 100 });
    const a = new ICERect({ width: 60, height: 20 });
    const pinned = new ICERect({ width: 60, height: 20, left: 5, top: 5, layoutIgnore: true });
    const b = new ICERect({ width: 60, height: 20 });
    group.addChildren([a, pinned, b]);
    group.setLayout(new ICEFlowLayout({ gap: 10 }));
    expect(pinned.state.left).toBe(5);
    expect(b.state.left).toBe(70);
  });

  it('GridLayout 跳过它（不占格），而**不可见**子项仍占格（对齐 Swing GridLayout）', () => {
    const group = new ICEGroup({ width: 300, height: 40 });
    const a = new ICERect({ width: 40, height: 10 });
    const pinned = new ICERect({ width: 40, height: 10, left: 9, top: 9, layoutIgnore: true });
    const hidden = new ICERect({ width: 40, height: 10, display: false });
    const b = new ICERect({ width: 40, height: 10 });
    group.addChildren([a, pinned, hidden, b]);
    group.setLayout(new ICEGridLayout({ cols: 2, gapX: 5, gapY: 0 }));

    expect(pinned.state.left).toBe(9);
    // 占格顺序 = a(0,0)、hidden(0,1)、b(1,0)（手动项不占格，不可见项照占）
    expect(a.state.left).toBe(0);
    expect(hidden.state.left).toBe(40 + 5);
    expect(b.state.left).toBe(0);
    expect(b.state.top).toBe(10); // 第二行
  });

  it('BorderLayout 跳过它（不会把它当成 center 摆到中间）', () => {
    const group = new ICEGroup({ width: 200, height: 100 });
    const north = new ICERect({ width: 200, height: 20, layoutConstraint: 'north' });
    const pinned = new ICERect({ width: 30, height: 30, left: 77, top: 88, layoutIgnore: true });
    group.addChildren([north, pinned]);
    group.setLayout(new ICEBorderLayout({ gap: 0 }));
    expect(pinned.state.left).toBe(77);
    expect(pinned.state.top).toBe(88);
  });

  it('手动定位的子项不参与容器首选尺寸（否则会给容器撑出一块空白）', () => {
    const group = new ICEGroup({ width: 300, height: 50 });
    group.addChild(new ICERect({ width: 60, height: 20 }));
    group.addChild(new ICERect({ width: 999, height: 20, layoutIgnore: true }));
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(group.getPreferredSize()[0]).toBe(60);
  });
});
