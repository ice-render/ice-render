/**
 * 带标签的折线：**盒子必须覆盖标签**。
 *
 * 为什么重要：`__localBox()` 是「上屏快照盒 / 脏区擦除盒 / 离屏缓存位图范围」的**唯一来源**
 * （见 ICEComponent 的说明）。标签在折线中点绘制，墨迹天然会超出折线带宽盒；盒子不含标签时：
 *   - 局部重绘会留下标签残影（旧盒没盖住标签）；
 *   - 离屏缓存位图会把标签裁掉 —— 2026-09-11 应用层 A/B 就是这么抓到的：
 *     开启连线缓存后墨色像素少约 6%（关系连线全带「1 : N」标签）。
 */
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

/** label = '1 : N'（5 字符）、fontSize = 20 → 降级估算宽度 = 5 * 20 = 100 */
const LABEL = '1 : N';
const FONT_SIZE = 20;

function makeLine() {
  return new ICEPolyLine({
    points: [
      [0, 0],
      [100, 0],
    ],
    label: LABEL,
    labelStyle: { fontSize: FONT_SIZE },
    style: { strokeStyle: '#333333', lineWidth: 2 },
  });
}

describe('折线标签的包围盒', () => {
  it('无 ctx（未挂载）时用降级估算，盒子仍覆盖标签矩形', () => {
    const line: any = makeLine();
    line.getMinBoundingBox(true); // 触发 compose
    const box = line.getMinBoundingBox(true);
    const mm = box.getMinAndMaxPoint();
    // 标签的中点 = (50, 0)；halfW = 100/2 + 4 = 54；halfH = 20/2 + 4 = 14
    expect(mm.minX).toBeLessThanOrEqual(50 - 54);
    expect(mm.maxX).toBeGreaterThanOrEqual(50 + 54);
    expect(mm.minY).toBeLessThanOrEqual(-14);
    expect(mm.maxY).toBeGreaterThanOrEqual(14);
  });

  it('有 ctx 时用 measureText 的实测宽度（与 drawLabel 的口径一致）', () => {
    const line: any = makeLine();
    // 量测桩：固定返回 200 宽，应与降级估算的 100 区分开
    line.ctx = {
      measureText: () => ({ width: 200 }),
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      fillText: () => {},
      font: '',
      textAlign: '',
      textBaseline: '',
      fillStyle: '',
    };
    line.getMinBoundingBox(true);
    const mm = line.getMinBoundingBox(true).getMinAndMaxPoint();
    // halfW = 200/2 + 4 = 104 → 盒子必须覆盖到 50 ± 104
    expect(mm.minX).toBeLessThanOrEqual(-54);
    expect(mm.maxX).toBeGreaterThanOrEqual(154);
  });

  it('无标签时不额外扩大盒子', () => {
    const line: any = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 0],
      ],
      style: { strokeStyle: '#333333', lineWidth: 2 },
    });
    line.getMinBoundingBox(true);
    const mm = line.getMinBoundingBox(true).getMinAndMaxPoint();
    expect(mm.minY).toBeGreaterThan(-10); // 只有带宽盒（±1 左右）
    expect(mm.minX).toBeGreaterThan(-10);
  });
});
