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
