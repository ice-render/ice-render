/**
 * 连线命中语义：**不认领落在自己端点节点盒子内部的点**（2026-09-15 修）。
 *
 * 现场两处（都是"点节点中心选中的却是线 → 节点拖不动"）：
 *   - 状态图示例：转移「库存校验 → 已取消」的端口是 R→L，而目标在源的左下方，
 *     折线首段从源节点右边缘出发后又横穿源节点自身（实测节点中心距折线 3.1px）；
 *   - BPMN 示例：池子被跨池消息流压住，点上去选中的是线，整张池子拖不动。
 *
 * 判据：① 端点节点盒子内部的点，线一律不认领；② 盒子外的线上点照旧命中；
 * ③ 端点移动后按**当前**盒子判定（不能缓存盒子，否则节点一拖就失效）。
 */
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
import ICERect from '../../src/graphic/shape/ICERect';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});
global.Path2D = class {
  moveTo() {}
  lineTo() {}
  closePath() {}
  rect() {}
  arc() {}
  ellipse() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
};

/** 造一条挂在节点上的线：points 是线的世界坐标点，box 是端点节点的世界盒。 */
function makeLinkedLine(box: number[]) {
  const node = new ICERect({ left: box[0], top: box[1], width: box[2] - box[0], height: box[3] - box[1] });
  const line: any = new ICEPolyLine({
    points: [
      [100, 20],
      [300, 20],
    ],
    // 只连起点：另一端留空，线的几何保持 points 给的两点（否则两端会被端口点覆盖，测不到"线本身"）
    links: { start: { id: 'node-1', position: 'R' } },
  });
  line.ice = {
    findComponent: (id: string) => (id === 'node-1' ? node : null),
    renderer: { getWorldBox: (c: any) => (c === node ? Float64Array.from(box) : null) },
    dirty: false,
    evtBus: { once: () => undefined, on: () => undefined, off: () => undefined },
  };
  line.syncConnections();
  line.getMinBoundingBox(true); // 合成矩阵（真实使用中渲染每帧都会合成）
  return line;
}

describe('连线命中：不认领端点节点盒子内部的点', () => {
  it('端点盒子内部的点被判给节点，线上的其它位置照旧命中', () => {
    const line = makeLinkedLine([0, 0, 100, 40]); // 节点盖住线的左端
    expect(line.containsPoint(50, 20)).toBe(false); // 节点盒子内部（线的首段在此）→ 不认领
    expect(line.containsPoint(150, 20)).toBe(true); // 线上、盒子外 → 照旧命中
    expect(line.containsPoint(200, 40)).toBe(false); // 不在线上（精确折线判定没被绕过）
  });

  it('端点移动后按当前盒子判定（盒子是实时读的，不缓存）', () => {
    const line = makeLinkedLine([0, 0, 100, 40]);
    expect(line.containsPoint(200, 20)).toBe(true);
    // 把端点盒子挪到线的中段：同一个点该翻过来
    const node = line.ice.findComponent('node-1');
    line.ice.renderer.getWorldBox = (c: any) => (c === node ? Float64Array.from([150, 0, 250, 40]) : null);
    expect(line.containsPoint(200, 20)).toBe(false); // 现在在端点盒子内部
    expect(line.containsPoint(120, 20)).toBe(true); // 盒子挪走后，线在盒子外的部分恢复可点
  });

  it('没有连接任何节点的线，命中语义不变', () => {
    const line: any = new ICEPolyLine({
      points: [
        [100, 20],
        [300, 20],
      ],
    });
    line.getMinBoundingBox(true);
    expect(line.containsPoint(150, 20)).toBe(true);
    expect(line.containsPoint(150, 60)).toBe(false);
  });

  it('容差不随线段长度放大：长线中点旁 8px 不再被判成"在线上"', () => {
    // 旧实现（三角不等式）对 L=400 的线段容差约 √(3·400/2) ≈ 24px —— 8px 会被误判为命中
    const long: any = new ICEPolyLine({
      points: [
        [0, 0],
        [400, 0],
      ],
    });
    long.getMinBoundingBox(true);
    expect(long.containsPoint(200, 0)).toBe(true); // 正落在线上
    expect(long.containsPoint(200, 8)).toBe(false); // 8px 外 → 不再命中（旧实现这里会 true）
    expect(long.containsPoint(200, 4)).toBe(true); // 容差 4px 之内仍可点中（线宽 1 → max(4, 0.5+3)）
  });
});
