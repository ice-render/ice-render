import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEBoxLayout from '../../src/layout/ICEBoxLayout';
import ICECardLayout from '../../src/layout/ICECardLayout';
import ICEOverlayLayout from '../../src/layout/ICEOverlayLayout';

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

describe('ICEBoxLayout（箱式布局）', () => {
  it('横向 x：left 递增，top 恒 0', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const r1 = new ICERect({ width: 100, height: 40 });
    const r2 = new ICERect({ width: 80, height: 40 });
    group.addChild(r1);
    group.addChild(r2);

    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    expect(r1.state.left).toBe(0);
    expect(r2.state.left).toBe(110);
    expect(r1.state.top).toBe(0);
  });

  it('纵向 y：top 递增，left 恒 0', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const r1 = new ICERect({ width: 100, height: 40 });
    const r2 = new ICERect({ width: 80, height: 50 });
    group.addChild(r1);
    group.addChild(r2);

    group.setLayout(new ICEBoxLayout({ axis: 'y', gap: 10 }));
    expect(r1.state.top).toBe(0);
    expect(r2.state.top).toBe(50);
    expect(r1.state.left).toBe(0);
  });
});

describe('ICECardLayout（卡片布局）', () => {
  it('一次只显示一个卡片，其余隐藏', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const c1 = new ICERect({ width: 100, height: 40 });
    const c2 = new ICERect({ width: 100, height: 40 });
    const c3 = new ICERect({ width: 100, height: 40 });
    group.addChild(c1);
    group.addChild(c2);
    group.addChild(c3);

    group.setLayout(new ICECardLayout({}));
    expect(c1.state.display).toBe(true);
    expect(c2.state.display).toBe(false);
    expect(c3.state.display).toBe(false);
  });

  it('show(index) 切换卡片', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const c1 = new ICERect({ width: 100, height: 40 });
    const c2 = new ICERect({ width: 100, height: 40 });
    group.addChild(c1);
    group.addChild(c2);

    const layout = new ICECardLayout({});
    group.setLayout(layout);
    layout.show(1);
    expect(c1.state.display).toBe(false);
    expect(c2.state.display).toBe(true);
  });
});

describe('ICEOverlayLayout（叠加布局）', () => {
  it('所有子组件叠放到左上角', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const r1 = new ICERect({ width: 100, height: 40 });
    const r2 = new ICERect({ width: 80, height: 50 });
    group.addChild(r1);
    group.addChild(r2);

    group.setLayout(new ICEOverlayLayout({}));
    expect(r1.state.left).toBe(0);
    expect(r1.state.top).toBe(0);
    expect(r2.state.left).toBe(0);
    expect(r2.state.top).toBe(0);
  });
});
