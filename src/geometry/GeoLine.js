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

  contains(x, y) {
    let delta = 3;
    let lineLength = Math.hypot(this.endPoint.x - this.startPoint.x, this.endPoint.y - this.startPoint.y);
    let len1 = Math.hypot(x - this.startPoint.x, y - this.startPoint.y);
    let len2 = Math.hypot(x - this.endPoint.x, y - this.endPoint.y);
    if (len1 + len2 >= lineLength - delta && len1 + len2 <= lineLength + delta) {
      return true;
    }
    return false;
  }
}
