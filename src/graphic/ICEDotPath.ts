/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { vec2 } from 'gl-matrix';
import root from '../cross-platform/root';
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
   * @cfg
   * {
   *   dots: [],       //点状路径的点集
   *   closePath:true, //是否闭合
   * }
   *
   * @param props
   */
  constructor(props) {
    //dots 是内部计算使用的属性
    super({ dots: [], closePath: true, ...props });
  }

  /**
   * @overwrite
   * @method calcComponentParams
   * - 计算组件最原始的宽高和位置，此时没有经过任何变换，也没有移动坐标原点。
   * - 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * - 此方法不能依赖原点位置和 transform 矩阵。
   * - 此方法会在 render() 中调用，所以不需要在构造函数中调用。
   * - 此方法中不能使用 setState() ，如果需要修改状态，直接赋值，如：this.state.width = 100;
   * - 子类可以覆盖此方法，实现自己的计算逻辑。
   * @returns
   */
  protected calcComponentParams() {
    if (!this.paramsDirty) {
      return { width: this.state.width, height: this.state.height };
    }

    //DotPath 需要先计算每个点的坐标，然后才能计算 width/height
    this.calcDots();
    const points = this.calc4VertexPoints();
    const width = Math.abs(points[1][0] - points[0][0]); //maxX-minX
    const height = Math.abs(points[2][1] - points[0][1]); //maxY-minY
    this.state.width = width;
    this.state.height = height;
    return { width: this.state.width, height: this.state.height };
  }

  /**
   * 精确命中判定：点是否位于点集构成的多边形内部（射线法）。
   * dots 在 calcLocalOrigin() 之后是「以 origin 为原点」的本地坐标，与 containsLocalPoint 的参数空间一致。
   * @overwrite
   */
  protected containsLocalPoint(localX: number, localY: number): boolean {
    const dots = this.state.dots;
    if (!dots || dots.length < 3) {
      return super.containsLocalPoint(localX, localY);
    }
    let inside = false;
    for (let i = 0, j = dots.length - 1; i < dots.length; j = i++) {
      const xi = dots[i][0];
      const yi = dots[i][1];
      const xj = dots[j][0];
      const yj = dots[j][1];
      const intersect = yi > localY !== yj > localY && localX < ((xj - xi) * (localY - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * 点状路径在重新计算本地原点坐标之后，需要移动内部所有点的位置。
   *
   * 关键：这里**只补「目标平移量 − 已应用平移量」的差额**。
   * 旧实现每次都无条件平移 -origin，导致每 compose 一次 dots 就再偏移一个原点
   * （实测连续三次 compose，dots 依次偏移 1/2/3 个原点），因此调用方必须严格保证
   * 「compose 之前先重算 dots（calcDots）」——这正是局部重绘 / 包围盒刷新等路径
   * 必须显式配对调用 `calcComponentParams()` 的原因，也是「跳过重量测」优化无法落地的原因。
   * 记录已应用量之后，重复 compose 变成幂等操作（差额为 0）。
   *
   * @overwrite
   * @returns
   */
  protected calcLocalOrigin() {
    const origin = super.calcLocalOrigin();

    const dx = -origin[0] - this.__dotsShiftX;
    const dy = -origin[1] - this.__dotsShiftY;
    if (dx !== 0 || dy !== 0) {
      const shift = [1, 0, 0, 1, dx, dy];
      for (let i = 0; i < this.state.dots.length; i++) {
        //@ts-ignore
        this.state.dots[i] = vec2.transformMat2d([], this.state.dots[i], shift);
      }
      this.__dotsShiftX = -origin[0];
      this.__dotsShiftY = -origin[1];
    }

    return origin;
  }

  /**
   * @returns
   */
  protected createPathObject(): any {
    this.ensureDots();
    this.path2D = root.createPath2D();
    this.path2D.moveTo(this.state.dots[0][0], this.state.dots[0][1]);
    for (let i = 1; i < this.state.dots.length; i++) {
      const dot = this.state.dots[i];
      this.path2D.lineTo(dot[0], dot[1]);
    }
    return this.path2D;
  }

  /**
   * dots 上已应用的平移量（当前 dots 相对「绝对本地坐标」的偏移），供 calcLocalOrigin() 做幂等补偿。
   * 见 calcLocalOrigin() 的说明。
   */
  protected __dotsShiftX = 0;
  protected __dotsShiftY = 0;

  /**
   * dots 重建的**唯一入口**：先把「已应用平移量」归零（__calcDots() 产出的是**绝对**本地坐标），
   * 再交给子类实现。
   *
   * 子类请覆盖 `__calcDots()`，**不要**覆盖本方法——否则幂等补偿会失效。
   *
   * 计算路径上的关键点：
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   * - this.calcComponentParams() 会依赖此方法来计算位置和尺寸，此时还没有确定原点坐标，所以 __calcDots() 内部不能依赖原点坐标，只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * @returns
   */
  protected calcDots() {
    this.__dotsShiftX = 0;
    this.__dotsShiftY = 0;
    return this.__calcDots();
  }

  /**
   * 子类实现：按**绝对**本地坐标（未减去原点）填充 `state.dots`。
   * @returns
   */
  protected __calcDots() {
    this.state.dots = [];
    return this.state.dots;
  }

  /**
   * 确保 dots 已计算：反序列化时 dots 属缓存值不会被序列化，反序列化后 dots 为空，
   * 在 render 之前若访问 dots（如 getMinBoundingBox → calc4VertexPoints）会取到空数组导致报错。
   * 这里在 dots 缺失时惰性触发 calcDots 补齐。
   */
  protected ensureDots(): void {
    if (!this.state.dots || this.state.dots.length === 0) {
      this.calcDots();
    }
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
    this.ensureDots();
    let minX = this.state.dots[0][0];
    let minY = this.state.dots[0][1];
    let maxX = this.state.dots[0][0];
    let maxY = this.state.dots[0][1];

    for (let i = 1; i < this.state.dots.length; i++) {
      const dot = this.state.dots[i];
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

  protected getTransformedDots() {
    const matrix = this.state.composedMatrix;
    const dots = this.state.dots;
    const result = [];
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      //@ts-ignore
      const point = vec2.transformMat2d([], dot, matrix);
      result.push(point);
    }
    return result;
  }
}
