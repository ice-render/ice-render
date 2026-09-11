/**
 * 变换手柄约束算法单测：Shift 等比缩放、Shift 旋转角度吸附。
 * （输入层是否把修饰键透传上来，另见 tests/event/DOMEventDispatcher.input.test.ts）
 */
import { applyAspectLock, snapAngle, ROTATE_SNAP_STEP } from '../../src/control-panel/transform-controls/constraints';

describe('applyAspectLock 等比缩放', () => {
  it('按「相对变化更大」的方向为基准，另一个方向按比例跟随', () => {
    // 200x100 → 目标 300x120：宽 +50%、高 +20% → 以宽为准 → 300x150
    expect(applyAspectLock(200, 100, 300, 120)).toEqual({ width: 300, height: 150 });
    // 反向：高变化更大 → 以高为准
    expect(applyAspectLock(200, 100, 220, 300)).toEqual({ width: 600, height: 300 });
  });

  it('保持比例不变', () => {
    // 输入宽 200、高 300 → 比例 2:3，约束后必须仍是 2:3
    const origin = 200 / 300;
    const out = applyAspectLock(200, 300, 500, 400);
    expect(out.width / out.height).toBeCloseTo(origin, 10);
    // 高方向变化更大（400/300 > 500/200？否 → 500/200=2.5 > 1.33，以宽为准）→ 500 x 750
    expect(out).toEqual({ width: 500, height: 750 });
  });

  it('负尺寸取绝对值（翻转不在这里处理）', () => {
    expect(applyAspectLock(100, 50, -200, -80)).toEqual({ width: 200, height: 100 });
  });

  it('原尺寸为 0 时退化为不约束（避免除零）', () => {
    expect(applyAspectLock(0, 0, 30, 40)).toEqual({ width: 30, height: 40 });
  });
});

describe('snapAngle 角度吸附', () => {
  it('吸附到 15° 整数倍', () => {
    expect(snapAngle(7)).toBe(0);
    expect(snapAngle(8)).toBe(15);
    expect(snapAngle(22)).toBe(15);
    expect(snapAngle(23)).toBe(30);
    expect(snapAngle(91)).toBe(90);
    expect(snapAngle(-22)).toBe(-15);
  });

  it('默认步进是 15°，可自定义', () => {
    expect(ROTATE_SNAP_STEP).toBe(15);
    expect(snapAngle(22, 45)).toBe(0);
    expect(snapAngle(23, 45)).toBe(45);
  });

  it('非法输入原样返回', () => {
    expect(snapAngle(NaN)).toBeNaN();
    expect(snapAngle(10, 0)).toBe(10);
  });
});
