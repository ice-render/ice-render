import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEFlowLayout from '../../src/layout/ICEFlowLayout';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
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

describe('ICEFlowLayout（对齐 Swing FlowLayout）', () => {
  it('left 对齐：子组件从左到右横向排列', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    const r2 = new ICERect({ width: 80, height: 40 });
    const r3 = new ICERect({ width: 60, height: 40 });
    group.addChild(r1);
    group.addChild(r2);
    group.addChild(r3);

    group.setLayout(new ICEFlowLayout({ gap: 10 }));

    expect(r1.state.left).toBe(0);
    expect(r2.state.left).toBe(110); // 100 + 10
    expect(r3.state.left).toBe(200); // 110 + 80 + 10
    expect(r1.state.top).toBe(0);
    expect(r2.state.top).toBe(0);
    expect(r3.state.top).toBe(0);
  });

  it('换行：超出容器宽度时换到下一行', () => {
    const group = new ICEGroup({ width: 150, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    const r2 = new ICERect({ width: 100, height: 40 });
    group.addChild(r1);
    group.addChild(r2);

    group.setLayout(new ICEFlowLayout({ gap: 10 }));

    expect(r1.state.left).toBe(0);
    expect(r1.state.top).toBe(0);
    expect(r2.state.left).toBe(0); // 换行
    expect(r2.state.top).toBe(50); // 40 + 10
  });

  it('center 对齐', () => {
    const group = new ICEGroup({ width: 300, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    group.addChild(r1);

    group.setLayout(new ICEFlowLayout({ gap: 10, align: 'center' }));

    expect(r1.state.left).toBe(100); // (300 - 100) / 2
  });

  it('right 对齐', () => {
    const group = new ICEGroup({ width: 300, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    group.addChild(r1);

    group.setLayout(new ICEFlowLayout({ gap: 10, align: 'right' }));

    expect(r1.state.left).toBe(200); // 300 - 100
  });

  it('doLayout 手动触发布局', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    group.addChild(r1);

    group.setLayout(new ICEFlowLayout({ gap: 10 }));
    r1.setState({ left: 999 }); // 手动打乱
    group.doLayout(); // 重新布局

    expect(r1.state.left).toBe(0); // 恢复布局位置
  });
});
