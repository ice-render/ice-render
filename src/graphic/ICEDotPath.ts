/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { vec2 } from 'gl-matrix';
import ICEPath from './ICEPath';

/**
 * @class ICEDotPath
 *
 * 基于一系列点进行绘制的路径。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default abstract class ICEDotPath extends ICEPath {
  /**
   * FIXME:编写完整的配置项描述
   * @cfg
   * {
   *
   * }
   *
   * @param props
   */
  constructor(props) {
    //dots 是内部计算使用的属性
    super({ dots: [], transformedDots: [], closePath: true, ...props });
  }

  /**
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
   * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * @overwrite
   * @returns
   */
  public calcOriginalDimension() {
    //DotPath 需要先计算每个点的坐标，然后才能计算 width/height
    this.calcDots();
    let points = this.calc4VertexPoints();
    let width = Math.abs(points[1][0] - points[0][0]); //maxX-minX
    let height = Math.abs(points[2][1] - points[0][1]); //maxY-minY
    this.state.width = width;
    this.state.height = height;
    return { width: this.state.width, height: this.state.height };
  }

  /**
   * 点状路径在重新计算本地原点坐标之后，需要移动内部所有点的位置。
   * @overwrite
   * @returns
   */
  protected calcLocalOrigin() {
    let origin = super.calcLocalOrigin();

    for (let i = 0; i < this.state.dots.length; i++) {
      let dot = this.state.dots[i];
      dot = vec2.transformMat2d([], dot, [1, 0, 0, 1, -origin[0], -origin[1]]);
      this.state.dots[i] = dot;
    }

    return origin;
  }

  /**
   * @returns
   */
  protected createPathObject(): Path2D {
    this.path2D = new Path2D();
    this.path2D.moveTo(this.state.dots[0][0], this.state.dots[0][1]);
    for (let i = 1; i < this.state.dots.length; i++) {
      const dot = this.state.dots[i];
      this.path2D.lineTo(dot[0], dot[1]);
    }
    if (this.state.closePath) {
      this.path2D.closePath();
    }
    return this.path2D;
  }

  /**
   * 计算路径上的关键点:
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   * this.calcOriginalDimension() 会依赖此方法，在计算尺寸时还没有确定原点坐标，所以 calcDots() 方法内部不能依赖原点坐标，只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * @returns
   */
  protected calcDots() {
    this.state.dots = [];
    return this.state.dots;
  }

  /**
   *
   * 计算4个顶点：
   * - 相对于组件本地的坐标系，原点位于左上角，没有经过矩阵变换。
   * - 返回值用于计算组件的原始 width/height 。
   *
   * @returns
   */
  protected calc4VertexPoints() {
    let minX = this.state.dots[0][0];
    let minY = this.state.dots[0][1];
    let maxX = this.state.dots[0][0];
    let maxY = this.state.dots[0][1];

    for (let i = 1; i < this.state.dots.length; i++) {
      let dot = this.state.dots[i];
      if (dot[0] < minX) {
        minX = dot[0];
      }
      if (dot[0] > maxX) {
        maxX = dot[0];
      }
      if (dot[1] < minY) {
        minY = dot[1];
      }
      if (dot[1] > maxY) {
        maxY = dot[1];
      }
    }

    //top-left point
    const x1 = minX;
    const y1 = minY;
    //top-right point
    const x2 = maxX;
    const y2 = minY;
    //bottom-left point
    const x3 = minX;
    const y3 = maxY;
    //bottom-right point
    const x4 = maxX;
    const y4 = maxY;
    return [
      [x1, y1],
      [x2, y2],
      [x3, y3],
      [x4, y4],
    ];
  }

  protected applyTransformToCtx(): void {
    super.applyTransformToCtx();

    const matrix = this.state.composedMatrix;
    const dots = this.state.dots;
    this.state.transformedDots = [];
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      const point = vec2.transformMat2d([], dot, matrix);
      this.state.transformedDots.push(point);
    }
  }
}
