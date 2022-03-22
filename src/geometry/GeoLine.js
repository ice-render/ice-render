/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * @class GeoLine
 * A geometrically line, invisible, no dimension, just used for mathematical operations.
 * This implementation is improved from http://diagramo.com/ .
 *
 *
 * 几何学意义上的直线，它不可见，没有宽度，用来进行数学运算。此实现从 diagramo 改进而来：http://diagramo.com/ 。
 *
 * @docauthor 大漠穷秋 <damoqiongqiu@126.com>
 */
export default class GeoLine {
  constructor(startPoint, endPoint) {
    this.startPoint = startPoint;
    this.endPoint = endPoint;
  }

  /**
   * @method constants
   * Tests to see if a point belongs to this line (not as infinite line but more like a segment)
   * Algorithm: Compute line's equation and see if (x, y) verifies it.
   *
   * 测试某个点是否位于直线上（这里不是数学意义上的无线延长直线，而是线段）。
   * 算法：计算斜率，看(x,y)点是否位于线段上。
   *
   * @see http://www.jeffreythompson.org/collision-detection/line-point.php
   * @param {Number} x - the X coordinates
   * @param {Number} y - the Y coordinates
   */
  contains(x, y) {
    // if the point is inside rectangle bounds of the segment
    if (
      Math.min(this.startPoint.x, this.endPoint.x) <= x &&
      x <= Math.max(this.startPoint.x, this.endPoint.x) &&
      Math.min(this.startPoint.y, this.endPoint.y) <= y &&
      y <= Math.max(this.startPoint.y, this.endPoint.y)
    ) {
      // check for vertical line
      if (this.startPoint.x == this.endPoint.x) {
        return x == this.startPoint.x;
      } else {
        // usual (not vertical) line can be represented as y = a * x + b
        let a = (this.endPoint.y - this.startPoint.y) / (this.endPoint.x - this.startPoint.x);
        let b = this.startPoint.y - a * this.startPoint.x;
        return y == a * x + b;
      }
    } else {
      return false;
    }
  }
}
