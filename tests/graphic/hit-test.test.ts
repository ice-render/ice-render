import ICECircle from '../../src/graphic/shape/ICECircle';
import ICEEllipse from '../../src/graphic/shape/ICEEllipse';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEStar from '../../src/graphic/shape/ICEStar';

jest.mock('../../src/cross-platform/root', () => ({ __esModule: true, default: {} }));
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
};

describe('命中检测精度（精确点-形状判定）', () => {
  it('圆：包围盒边角点（圆外但包围盒内）不误命中', () => {
    const circle = new ICECircle({ left: 100, top: 100, radius: 12 });
    circle.getMinBoundingBox(true); // 触发 compose，缓存 composedMatrix

    expect(circle.containsPoint(112, 112)).toBe(true); // 圆心
    expect(circle.containsPoint(117, 117)).toBe(true); // 距离圆心 ~7 < 12
    expect(circle.containsPoint(123, 123)).toBe(false); // 距离 ~15.6 > 12，但仍在 24×24 包围盒内
  });

  it('椭圆：长短轴精确判定', () => {
    const ellipse = new ICEEllipse({ left: 0, top: 0, radiusX: 20, radiusY: 10 });
    ellipse.getMinBoundingBox(true); // 圆心全局 (20, 10)

    expect(ellipse.containsPoint(20, 10)).toBe(true); // 中心
    expect(ellipse.containsPoint(20, 15)).toBe(true); // 短轴内 (0,5)
    expect(ellipse.containsPoint(20, 21)).toBe(false); // 短轴外 (0,11)
  });

  it('矩形：AABB 判定不变', () => {
    const rect = new ICERect({ left: 0, top: 0, width: 40, height: 20 });
    rect.getMinBoundingBox(true); // 中心全局 (20, 10)

    expect(rect.containsPoint(20, 10)).toBe(true); // 中心
    expect(rect.containsPoint(1, 1)).toBe(true); // 角内
    expect(rect.containsPoint(50, 30)).toBe(false); // 外
  });

  it('点-多边形判定（射线法）：中心在内、角在外', () => {
    const star = new ICEStar({ width: 100, height: 100 });
    // 直接给 containsLocalPoint 喂一个已知菱形点集（本地坐标，中心为原点），验证射线法
    (star as any).state.dots = [
      [-50, 0],
      [0, -50],
      [50, 0],
      [0, 50],
    ];
    expect((star as any).containsLocalPoint(0, 0)).toBe(true); // 菱形中心在内
    expect((star as any).containsLocalPoint(-49, -49)).toBe(false); // 左下角在菱形外
  });
});
