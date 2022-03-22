/**
 * !gl-matrix 的当前版本中没有提供 skew 函数，需要手动合 https://github.com/toji/gl-matrix/pull/293
 * @see https://github.com/talltyler/gl-matrix/commit/7c408d649073f6240f4694041ceb2af5f5284658
 */
/**
 * Skew (shear) a mat2d by the given angle
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to skew
 * @param {Number} rad the angle to skew the matrix by
 * @param {Number} rad the angle to skew the matrix by
 * @returns {mat2d} out
 */
export function skew(out, a, radX, radY) {
  let x = Math.tan(radX);
  let y = Math.tan(radY);
  out[0] = a[0];
  out[1] = a[1] + x;
  out[2] = a[2] + y;
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  return out;
}
