/**
 * AlignmentGuideManager 的纯几何吸附计算（computeSnap）单测。
 */
import { computeSnap } from '../../src/control-panel/AlignmentGuideManager';

function box(minX: number, minY: number, maxX: number, maxY: number) {
  return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

function opts(over = {}) {
  return { threshold: 5, edge: true, center: true, spacing: true, color: '#f00', lineWidth: 1, ...over };
}

describe('computeSnap 对齐吸附计算', () => {
  it('X 边缘对齐：source.left 吸附 target.right', () => {
    const source = box(102, 0, 202, 100);
    const targets = [box(0, 200, 100, 300)]; // target.right=100，source.left=102，delta=-2；Y 远离
    const r = computeSnap(source, targets, 5, 5, opts());
    expect(r.x.axis).toBe('x');
    expect(r.x.delta).toBe(-2);
    expect(r.y).toBeNull();
  });

  it('X 中心对齐', () => {
    const source = box(203, 0, 303, 100); // centerX=253
    const targets = [box(0, 200, 500, 300)]; // centerX=250，delta=-3；Y 远离
    const r = computeSnap(source, targets, 5, 5, opts({ edge: false }));
    expect(r.x.axis).toBe('x');
    expect(r.x.type).toBe('center');
    expect(r.x.delta).toBe(-3);
    expect(r.y).toBeNull();
  });

  it('Y 中心对齐', () => {
    const source = box(0, 102, 100, 202); // centerY=152
    const targets = [box(200, 0, 300, 300)]; // centerY=150，delta=-2；X 远离
    const r = computeSnap(source, targets, 5, 5, opts({ edge: false }));
    expect(r.y.axis).toBe('y');
    expect(r.y.delta).toBe(-2);
    expect(r.x).toBeNull();
  });

  it('等间距：source 中心吸附两目标中心中点', () => {
    const targets = [box(200, 500, 300, 600), box(500, 500, 600, 600)]; // centerX 250 / 550，中点 400；Y 远离
    // source.centerX=50 不在两者之间 → 不命中
    const source2 = box(0, 0, 100, 100);
    const r = computeSnap(source2, targets, 5, 5, opts({ edge: false, center: false }));
    expect(r.x).toBeNull();
    expect(r.y).toBeNull();

    const source3 = box(352, 0, 452, 100); // centerX=402，接近中点 400，在 250~550 之间
    const r3 = computeSnap(source3, targets, 5, 5, opts({ edge: false, center: false }));
    expect(r3.x.axis).toBe('x');
    expect(r3.x.type).toBe('spacing');
    expect(r3.x.delta).toBeCloseTo(-2);
    expect(r3.y).toBeNull();
  });

  it('阈值外不吸附', () => {
    const source = box(110, 110, 210, 210);
    const targets = [box(0, 0, 100, 100)]; // X/Y 都差 10 > 5
    const r = computeSnap(source, targets, 5, 5, opts());
    expect(r.x).toBeNull();
    expect(r.y).toBeNull();
  });

  it('可选关闭边缘/中心', () => {
    const source = box(102, 0, 202, 100);
    const targets = [box(0, 200, 100, 300)]; // 所有轴都远离
    const r = computeSnap(source, targets, 5, 5, opts({ edge: false }));
    expect(r.x).toBeNull();
    expect(r.y).toBeNull();
  });
});
