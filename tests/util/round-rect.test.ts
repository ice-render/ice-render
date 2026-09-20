/**
 * `resolveRoundRect`：`roundRect` 的几何归一化。
 *
 * 这一份是**画布口径的唯一来源** —— 记录器（展开成 arcTo）与 SVG 导出器（生成 `d`）都读它，
 * 所以规则必须钉住，否则「画布上是圆角、导出成直角」会静默发生。
 *
 * 每条规则旁边都标了真机实测结果（Chromium，见 `e2e/visual/round-rect-parity.spec.ts` 的
 * 12 组像素对照）。原生怎么抛、怎么裁，这里就怎么写。
 */
import { resolveRoundRect } from '../../src/util/round-rect';

describe('resolveRoundRect', () => {
  it('标量半径 → 四角相同', () => {
    const g = resolveRoundRect(10, 20, 100, 50, 8);
    expect(g).toEqual({ x: 10, y: 20, width: 100, height: 50, radii: [8, 8, 8, 8], plain: false });
  });

  it('数组半径按 CSS border-radius 的补齐规则展开', () => {
    // 原生：1 个值四角相同；2 个值 [左上/右下, 右上/左下]；3 个值时右下取右上
    expect(resolveRoundRect(0, 0, 100, 50, [4]).radii).toEqual([4, 4, 4, 4]);
    expect(resolveRoundRect(0, 0, 100, 50, [4, 8]).radii).toEqual([4, 8, 4, 8]);
    expect(resolveRoundRect(0, 0, 100, 50, [4, 8, 12]).radii).toEqual([4, 8, 12, 8]);
    expect(resolveRoundRect(0, 0, 100, 50, [4, 8, 12, 16]).radii).toEqual([4, 8, 12, 16]);
  });

  it('没给半径 / 全 0 → plain（roundRect 与 rect 等价）', () => {
    expect(resolveRoundRect(0, 0, 10, 10, undefined).plain).toBe(true);
    expect(resolveRoundRect(0, 0, 10, 10, null).plain).toBe(true);
    expect(resolveRoundRect(0, 0, 10, 10, 0).plain).toBe(true);
    expect(resolveRoundRect(0, 0, 10, 10, [0, 0, 0, 0]).plain).toBe(true);
  });

  it('负数半径抛 RangeError（原生同样抛，不静默画成直角）', () => {
    expect(() => resolveRoundRect(0, 0, 10, 10, -1)).toThrow(RangeError);
    expect(() => resolveRoundRect(0, 0, 10, 10, [1, -2, 3, 4])).toThrow(RangeError);
  });

  it('数组长度不是 1~4 抛 RangeError（原生：Between one and four radii are necessary）', () => {
    expect(() => resolveRoundRect(0, 0, 10, 10, [])).toThrow(RangeError);
    expect(() => resolveRoundRect(0, 0, 10, 10, [1, 1, 1, 1, 1])).toThrow(RangeError);
  });

  it('NaN / Infinity 半径视作 0（真机实测：原生也画成直角矩形且不抛错）', () => {
    expect(resolveRoundRect(0, 0, 10, 10, NaN).plain).toBe(true);
    expect(resolveRoundRect(0, 0, 10, 10, Infinity).plain).toBe(true);
    expect(resolveRoundRect(0, 0, 10, 10, [NaN, 5, NaN, 5]).radii).toEqual([0, 5, 0, 5]);
  });

  it('负宽高：几何镜像，半径换到视觉上对应的角（原生就是这么画的）', () => {
    // 负宽：左上 ↔ 右上、左下 ↔ 右下
    const w = resolveRoundRect(200, 100, -80, 60, [1, 2, 3, 4]);
    expect([w.x, w.width]).toEqual([120, 80]);
    expect(w.radii).toEqual([2, 1, 4, 3]);

    // 负高：左上 ↔ 左下、右上 ↔ 右下
    const h = resolveRoundRect(200, 100, 80, -60, [1, 2, 3, 4]);
    expect([h.y, h.height]).toEqual([40, 60]);
    expect(h.radii).toEqual([4, 3, 2, 1]);

    // 都负：180° 换位
    const both = resolveRoundRect(200, 100, -80, -60, [1, 2, 3, 4]);
    expect([both.x, both.y, both.width, both.height]).toEqual([120, 40, 80, 60]);
    expect(both.radii).toEqual([3, 4, 1, 2]);
  });

  it('半径之和超过边长时**等比缩放**（不是各自截断）', () => {
    // 均匀 100 画在 80x40 上：四条边里最紧的是 40/(100+100) → 0.2 → 半径 20（= 半高，胶囊形）
    expect(resolveRoundRect(0, 0, 80, 40, 100).radii).toEqual([20, 20, 20, 20]);

    // 非均匀 [60,5,60,5] 画在 100x50 上：上/下边 65 vs 100 → 1.538；
    // 左/右边 65 vs 50 → 0.769（最紧）→ 整体缩到 0.769，而不是把 60 截成 25
    const g = resolveRoundRect(0, 0, 100, 50, [60, 5, 60, 5]);
    expect(g.radii[0]).toBeCloseTo(46.1538, 3);
    expect(g.radii[1]).toBeCloseTo(3.8462, 3);
    expect(g.radii[2]).toBeCloseTo(46.1538, 3);
    expect(g.radii[3]).toBeCloseTo(3.8462, 3);
  });

  it('尺寸为 0 时不炸（退化成空路径，半径缩到 0）', () => {
    const g = resolveRoundRect(5, 5, 0, 0, 10);
    expect(g.plain).toBe(true);
  });
});
