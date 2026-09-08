import GeoPoint from '../../src/geometry/GeoPoint';

describe('GeoPoint', () => {
  it('默认构造为原点 (0,0)', () => {
    const p = new GeoPoint();
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('构造时设置 x/y', () => {
    const p = new GeoPoint(3, 4);
    expect(p.x).toBe(3);
    expect(p.y).toBe(4);
  });

  it('load 从 JSON 对象创建（字符串坐标转 number）', () => {
    const p = GeoPoint.load({ x: '10', y: '20' });
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
  });

  it('cloneArray 深拷贝点数组', () => {
    const arr = [new GeoPoint(1, 2), new GeoPoint(3, 4)];
    const cloned = GeoPoint.cloneArray(arr);
    expect(cloned).toHaveLength(2);
    expect(cloned[0]).not.toBe(arr[0]);
    expect(cloned[0].x).toBe(1);
    expect(cloned[0].y).toBe(2);
    expect(cloned[1].x).toBe(3);
  });

  it('equals 判断相等', () => {
    expect(new GeoPoint(1, 2).equals(new GeoPoint(1, 2))).toBe(true);
    expect(new GeoPoint(1, 2).equals(new GeoPoint(1, 3))).toBe(false);
  });

  it('clone 返回相等但不同的实例', () => {
    const p = new GeoPoint(5, 6);
    const c = p.clone();
    expect(c).not.toBe(p);
    expect(c.equals(p)).toBe(true);
  });
});
