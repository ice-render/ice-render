/**
 * 变换手柄的约束算法（纯函数，便于单测）。
 *
 * 这些约束由输入层透传的修饰键驱动（`evt.shiftKey` 等）——注意 DOM 事件的修饰键是原型上的
 * 不可枚举 getter，`ICEEvent` 的 `for...in` 拷贝带不过来，必须由 `input-normalize` 显式透传。
 */

/** 旋转吸附的默认步进（度）。 */
export const ROTATE_SNAP_STEP = 15;

/**
 * 等比约束：在「目标尺寸」基础上保持 `currentWidth : currentHeight` 不变。
 *
 * 取两个方向中**相对变化更大**的那个作为基准，另一个方向按比例跟随 —— 这样拖动角手柄时
 * 跟随手感更贴近手指，也不会出现「一个方向已到目标、另一个方向还没动」的粘滞感。
 * 尺寸取绝对值（翻转由调用方决定，不在这里处理）。
 */
export function applyAspectLock(
  currentWidth: number,
  currentHeight: number,
  nextWidth: number,
  nextHeight: number
): { width: number; height: number } {
  const w = Math.abs(nextWidth);
  const h = Math.abs(nextHeight);
  if (!(currentWidth > 0) || !(currentHeight > 0)) {
    return { width: w, height: h };
  }
  const k = Math.max(w / currentWidth, h / currentHeight);
  return { width: currentWidth * k, height: currentHeight * k };
}

/**
 * 角度吸附：把角度吸附到 `step` 的整数倍（默认 15°）。
 * 吸附在**最终角度**上做（调用方已把补偿角加上），避免补偿把吸附结果带偏。
 */
export function snapAngle(angle: number, step: number = ROTATE_SNAP_STEP): number {
  if (!(step > 0) || !isFinite(angle)) {
    return angle;
  }
  return Math.round(angle / step) * step;
}
