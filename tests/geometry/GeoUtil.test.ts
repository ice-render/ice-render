import GeoUtil from '../../src/geometry/GeoUtil';

describe('GeoUtil.calcRotateAngle', () => {
  it('沿 +X 轴返回 0 度', () => {
    expect(GeoUtil.calcRotateAngle(1, 0, 0, 0)).toBe(0);
  });
  it('沿 +Y 轴返回 90 度', () => {
    expect(GeoUtil.calcRotateAngle(0, 1, 0, 0)).toBe(90);
  });
  it('沿 -X 轴返回 180 度', () => {
    expect(GeoUtil.calcRotateAngle(-1, 0, 0, 0)).toBe(180);
  });
});

describe('GeoUtil.calcRotateAngleFromMatrix', () => {
  it('单位矩阵返回 0 度', () => {
    expect(GeoUtil.calcRotateAngleFromMatrix([1, 0, 0, 1])).toBe(0);
  });
  it('90 度旋转矩阵返回 90 度', () => {
    expect(GeoUtil.calcRotateAngleFromMatrix([0, 1, -1, 0])).toBe(90);
  });
});

describe('GeoUtil.calcScaleFromMatrix', () => {
  it('轴对齐缩放矩阵返回真实缩放值', () => {
    expect(GeoUtil.calcScaleFromMatrix([2, 0, 0, 3])).toEqual([2, 3]);
  });
  it('带旋转的矩阵返回各轴的缩放模长', () => {
    // scaleX = hypot(2,2) = 2√2 ≈ 2.828；scaleY = hypot(0,3) = 3
    expect(GeoUtil.calcScaleFromMatrix([2, 2, 0, 3])[0]).toBeCloseTo(2.828, 3);
    expect(GeoUtil.calcScaleFromMatrix([2, 2, 0, 3])[1]).toBe(3);
  });
});
