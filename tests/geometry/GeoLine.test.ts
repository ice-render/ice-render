import GeoPoint from '../../src/geometry/GeoPoint';
import GeoLine from '../../src/geometry/GeoLine';

describe('GeoLine', () => {
  it('构造保存起终点', () => {
    const line = new GeoLine(new GeoPoint(0, 0), new GeoPoint(10, 0));
    expect(line.startPoint.x).toBe(0);
    expect(line.endPoint.x).toBe(10);
  });

  it('contains：线段中点命中', () => {
    const line = new GeoLine(new GeoPoint(0, 0), new GeoPoint(10, 0));
    expect(line.contains(5, 0)).toBe(true);
  });

  it('contains：线段端点命中', () => {
    const line = new GeoLine(new GeoPoint(0, 0), new GeoPoint(10, 0));
    expect(line.contains(0, 0)).toBe(true);
    expect(line.contains(10, 0)).toBe(true);
  });

  it('contains：线段外不命中', () => {
    const line = new GeoLine(new GeoPoint(0, 0), new GeoPoint(10, 0));
    expect(line.contains(5, 10)).toBe(false);
  });
});
