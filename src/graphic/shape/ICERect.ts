/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEDotPath from '../ICEDotPath';

/**
 * @class ICERect 矩形
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICERect extends ICEDotPath {
  constructor(props: any = {}) {
    super({ width: 10, height: 10, ...props });
  }

  /**
   * 计算路径上的关键点:
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   * - this.calcOriginalDimension() 会依赖此方法，在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * @returns
   */
  protected calcDots(): Array<DOMPoint> {
    let point1 = new DOMPoint(0, 0); //top-left point
    let point2 = new DOMPoint(this.state.width, 0); //top-right point
    let point3 = new DOMPoint(this.state.width, this.state.height); //bottom-right point
    let point4 = new DOMPoint(0, this.state.height); //bottom-left point
    this.state.dots = [point1, point2, point3, point4];
    return this.state.dots;
  }
}
export default ICERect;
