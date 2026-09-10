import ICEBoundingBox from '../../src/geometry/ICEBoundingBox';

describe('ICEBoundingBox.fromDimension', () => {
  it('根据 left/top/width/height 计算四角与中心', () => {
    const box = ICEBoundingBox.fromDimension(10, 20, 100, 50);
    expect(box.tl).toEqual([10, 20]);
    expect(box.tr).toEqual([110, 20]);
    expect(box.bl).toEqual([10, 70]);
    expect(box.br).toEqual([110, 70]);
    expect(box.center).toEqual([60, 45]);
  });
});

describe('ICEBoundingBox.getMinAndMaxPoint', () => {
  it('返回坐标极值', () => {
    const box = ICEBoundingBox.fromDimension(10, 20, 100, 50);
    expect(box.getMinAndMaxPoint()).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 70,
    });
  });
});

describe('ICEBoundingBox.containsBox', () => {
  it('内部盒子返回 true，越界盒子返回 false', () => {
    const outer = ICEBoundingBox.fromDimension(0, 0, 100, 100);
    expect(outer.containsBox(ICEBoundingBox.fromDimension(10, 10, 20, 20))).toBe(true);
    expect(outer.containsBox(ICEBoundingBox.fromDimension(50, 50, 80, 80))).toBe(false);
  });
});

describe('ICEBoundingBox.union', () => {
  it('返回覆盖两个盒子的最小轴对齐盒', () => {
    const a = ICEBoundingBox.fromDimension(0, 0, 10, 10);
    const b = ICEBoundingBox.fromDimension(5, -2, 20, 8);
    const u = a.union(b);
    expect(u.getMinAndMaxPoint()).toEqual({ minX: 0, minY: -2, maxX: 25, maxY: 10 });
  });
});
