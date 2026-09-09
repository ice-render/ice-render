import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
import ICELayeredLayout from '../../src/layout/ICELayeredLayout';

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

function makeNode(id: string) {
  return new ICERect({ id, width: 100, height: 40 });
}
function makeEdge(from: string, to: string) {
  return new ICEPolyLine({
    points: [
      [0, 0],
      [100, 100],
    ],
    links: { start: { id: from, position: 'R' }, end: { id: to, position: 'L' } },
  });
}

describe('ICELayeredLayout（分层图布局）', () => {
  it('链式 A→B→C：按层级从左到右排列', () => {
    const group = new ICEGroup({ width: 1000, height: 600 });
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    group.addChild(a);
    group.addChild(b);
    group.addChild(c);
    group.addChild(makeEdge('A', 'B'));
    group.addChild(makeEdge('B', 'C'));

    group.setLayout(new ICELayeredLayout({ gapX: 80, gapY: 40 }));

    expect(a.state.left).toBeLessThan(b.state.left);
    expect(b.state.left).toBeLessThan(c.state.left);
    // 同链无交叉，A/B/C 垂直方向对齐（都在层内 order 0）
    expect(a.state.top).toBe(0);
    expect(b.state.top).toBe(0);
    expect(c.state.top).toBe(0);
  });

  it('菱形 A→(B,C)→D：B/C 同一层', () => {
    const group = new ICEGroup({ width: 1000, height: 600 });
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    group.addChild(a);
    group.addChild(b);
    group.addChild(c);
    group.addChild(d);
    group.addChild(makeEdge('A', 'B'));
    group.addChild(makeEdge('A', 'C'));
    group.addChild(makeEdge('B', 'D'));
    group.addChild(makeEdge('C', 'D'));

    group.setLayout(new ICELayeredLayout({ gapX: 80, gapY: 40 }));

    expect(b.state.left).toBe(c.state.left); // B/C 同一层
    expect(a.state.left).toBeLessThan(b.state.left);
    expect(b.state.left).toBeLessThan(d.state.left);
  });

  it('无连接节点的 rank 为 0（孤岛在左侧）', () => {
    const group = new ICEGroup({ width: 1000, height: 600 });
    const a = makeNode('A');
    const b = makeNode('B');
    const solo = makeNode('S');
    group.addChild(a);
    group.addChild(b);
    group.addChild(solo);
    group.addChild(makeEdge('A', 'B'));

    group.setLayout(new ICELayeredLayout({ gapX: 80, gapY: 40 }));

    // 孤岛无前驱，rank=0，与 A 同层
    expect(solo.state.left).toBe(a.state.left);
  });
});
