/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * @class GeoPoint
 * A geometrically point, invisible, no dimension, just used for mathematical operations.
 * This implementation is improved from http://diagramo.com/ .
 *
 *
 * 几何学意义上的点，它不可见，没有大小，用来进行数学运算。此实现从 diagramo 改进而来：http://diagramo.com/ 。
 *
 * @docauthor 大漠穷秋 <damoqiongqiu@126.com>
 */
export default class GeoPoint {
  /**
   * @constructor GeoPoint
   * @param {*} x
   * @param {*} y
   */
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   *
   * @method load
   * Creates a {GeoPoint} out of JSON parsed object.
   *
   *
   * 从 JSON 对象创建 {GeoPoint} 实例。
   * @param {Object} o the JSON parsed object
   * @return {GeoPoint} a newly constructed GeoPoint
   */
  static load(o) {
    return new GeoPoint(Number(o.x), Number(o.y));
  }

  /**
   *
   * @method cloneArray
   * Clones an array of points.
   *
   *
   * 克隆一组点。
   * @param {Array} v - the array of {GeoPoint}s
   * @return an {Array} of {GeoPoint}s
   */
  static cloneArray(v) {
    let newPoints = [];
    for (let i = 0; i < v.length; i++) {
      newPoints.push(v[i].clone());
    }
    return newPoints;
  }

  /**
   * @method equals
   * Tests if this point is equals to other point.
   *
   *
   * 测试当前点是否与另一个点相等。
   * @param {GeoPoint} anotherPoint - the other point
   */
  equals(anotherPoint) {
    return this.x == anotherPoint.x && this.y == anotherPoint.y;
  }

  /**
   * @method clone
   * Clone current GeoPoint.
   *
   *
   * 克隆当前点。
   */
  clone() {
    let newPoint = new GeoPoint(this.x, this.y);
    return newPoint;
  }
}
