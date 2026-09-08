import GeoUtil from './GeoUtil';

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
  // 函数计算的是 hypot(a,b)/a 与 hypot(c,d)/d(轴对齐缩放会归一化为 1),并非直接返回缩放值。
  it('轴对齐缩放矩阵归一化为 [1,1]', () => {
    expect(GeoUtil.calcScaleFromMatrix([2, 0, 0, 3])).toEqual([1, 1]);
  });
  it('带旋转的矩阵返回非 1 的比例', () => {
    // a=2,b=2 → hypot=2√2, scaleX=2√2/2=√2≈1.414; d=3 → scaleY=1
    expect(GeoUtil.calcScaleFromMatrix([2, 2, 0, 3])[0]).toBeCloseTo(Math.SQRT2, 5);
    expect(GeoUtil.calcScaleFromMatrix([2, 2, 0, 3])[1]).toBe(1);
  });
});
