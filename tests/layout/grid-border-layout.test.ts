import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGridLayout from '../../src/layout/ICEGridLayout';
import ICEBorderLayout from '../../src/layout/ICEBorderLayout';

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

describe('ICEGridLayout（网格布局）', () => {
  it('2 列行优先填入', () => {
    const group = new ICEGroup({ width: 500, height: 300 });
    const r1 = new ICERect({ width: 100, height: 40 });
    const r2 = new ICERect({ width: 80, height: 50 });
    const r3 = new ICERect({ width: 60, height: 40 });
    const r4 = new ICERect({ width: 70, height: 30 });
    group.addChild(r1);
    group.addChild(r2);
    group.addChild(r3);
    group.addChild(r4);

    group.setLayout(new ICEGridLayout({ cols: 2, gapX: 10, gapY: 10 }));

    // 第 1 行
    expect(r1.state.left).toBe(0);
    expect(r1.state.top).toBe(0);
    expect(r2.state.left).toBe(110); // 100 + 10
    expect(r2.state.top).toBe(0);
    // 第 2 行（行高取第 1 行最高 50，y = 50 + 10）
    expect(r3.state.left).toBe(0);
    expect(r3.state.top).toBe(60);
    expect(r4.state.left).toBe(70); // 60 + 10
    expect(r4.state.top).toBe(60);
  });
});

describe('ICEBorderLayout（五区域布局）', () => {
  it('north/south/center 三区域', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const north = new ICERect({ layoutConstraint: 'north', width: 100, height: 30 });
    const south = new ICERect({ layoutConstraint: 'south', width: 100, height: 30 });
    const center = new ICERect({ layoutConstraint: 'center', width: 100, height: 100 });
    group.addChild(north);
    group.addChild(south);
    group.addChild(center);

    group.setLayout(new ICEBorderLayout({ gap: 5 }));

    expect(north.state.left).toBe(0);
    expect(north.state.top).toBe(0);
    expect(north.state.width).toBe(400); // 占满整宽

    expect(south.state.top).toBe(270); // 300 - 30
    expect(south.state.width).toBe(400);

    expect(center.state.top).toBe(35); // 30 + 5
    expect(center.state.height).toBe(230); // 265 - 35
  });

  it('五区域全占', () => {
    const group = new ICEGroup({ width: 400, height: 300 });
    const north = new ICERect({ layoutConstraint: 'north', width: 100, height: 30 });
    const south = new ICERect({ layoutConstraint: 'south', width: 100, height: 30 });
    const east = new ICERect({ layoutConstraint: 'east', width: 50, height: 100 });
    const west = new ICERect({ layoutConstraint: 'west', width: 60, height: 100 });
    const center = new ICERect({ layoutConstraint: 'center', width: 100, height: 100 });
    group.addChild(north);
    group.addChild(south);
    group.addChild(east);
    group.addChild(west);
    group.addChild(center);

    group.setLayout(new ICEBorderLayout({ gap: 5 }));

    expect(west.state.left).toBe(0);
    expect(east.state.left).toBe(350); // 400 - 50
    expect(center.state.left).toBe(65); // 60 + 5
    expect(center.state.width).toBe(280); // 345 - 65
  });
});
