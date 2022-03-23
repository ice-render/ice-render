/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { vec2 } from 'gl-matrix';

/**
 * @class ICEBoundingBox 用4点法描述的边界盒子。
 *
 * - 边界盒子一定是矩形。
 * - 边界盒子总是绘制在全局坐标系中。
 * - 边界盒子总是通过自身的坐标点进行变换，而不是变换 canvas.ctx 。
 * - 边界盒子总是通过组件的参数计算出来的，直接修改边界盒子不影响组件本身的参数。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEBoundingBox {
  //top-left
  public tl = [0, 0];
  //top-right
  public tr = [0, 0];
  //bottom-left
  public bl = [0, 0];
  //bottom-right
  public br = [0, 0];
  //center-point
  public center = [0, 0];

  constructor(props: Array<number> = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) {
    this.tl = [props[0], props[1]];
    this.tr = [props[2], props[3]];
    this.bl = [props[4], props[5]];
    this.br = [props[6], props[7]];
    this.center = [props[8], props[9]];
  }

  /**
   * 从指定的 top/left/width/height 构建 ICEBoundingBox。
   * @param left
   * @param top
   * @param width
   * @param height
   * @returns
   */
  public static fromDimension(left, top, width, height): ICEBoundingBox {
    let tl = [left, top];
    let tr = [left + width, top];
    let bl = [left, top + height];
    let br = [left + width, top + height];
    let center = [left + width / 2, top + height / 2];
    return new ICEBoundingBox([...tl, ...tr, ...bl, ...br, ...center]);
  }

  /**
   * 判断指定的坐标点是否位于边界矩形内部，向右水平射线法。
   * 这里参考了 fabricjs 的实现方式。
   * @see http://fabricjs.com/
   * @param point
   * @returns
   */
  public containsPoint(point): boolean {
    //只考虑凸包的情况：[x,y]有一个值位于最大最小值之外，则不可能包含在边界盒子内部。
    const { minX, minY, maxX, maxY } = this.getMinAndMaxPoint();
    if (point[0] < minX || point[0] > maxX || point[1] < minY || point[1] > maxY) {
      return false;
    }

    let xcount = 0; //交叉点个数
    let xi; //交点的 x 坐标
    const boudingLines = this.getBoundingLines();

    for (let i = 0; i < boudingLines.length; i++) {
      const line = boudingLines[i];

      //特例1：点位于线段下方，水平射线不可能与线段交叉
      if (point[1] > line.o[1] && point[1] > line.d[1]) {
        continue;
      }

      //特例2：点位于线段上方，水平射线不可能与线段交叉
      if (point[1] < line.o[1] && point[1] < line.d[1]) {
        continue;
      }

      if (line.o[0] === line.d[0] && line.o[0] >= point[0]) {
        //特例3：处理垂直于 x 轴（平行于 y 轴）的特殊情况
        xi = line.o[0];
      } else {
        //斜率法求向右的射线与线段的交点 x 坐标
        const k = (line.d[1] - line.o[1]) / (line.d[0] - line.o[0]); //斜率
        xi = line.o[0] + (point[1] - line.o[1]) / k;
      }

      if (xi > point[0]) {
        //只处理向右侧的射线情况即可
        xcount++;
      }

      if (xcount === 2) {
        continue;
      }
    }

    return xcount !== 0 && xcount % 2 === 1;
  }

  /**
   * 获取边界盒子的边所构成的线段，由于边界盒子总是被定义成 4 边形，这里直接简化处理。
   */
  private getBoundingLines(): Array<any> {
    const line_1 = { o: [...this.tl], d: [...this.tr] }; //o:origin, d:destination
    const line_2 = { o: [...this.tr], d: [...this.br] };
    const line_3 = { o: [...this.br], d: [...this.bl] };
    const line_4 = { o: [...this.bl], d: [...this.tl] };
    return [line_1, line_2, line_3, line_4];
  }

  /**
   * 获取边界盒子 x,y 的最大和最小值
   * @returns
   */
  public getMinAndMaxPoint(): any {
    //取任意一个顶点坐标作为初始值，然后与其它3个顶点的坐标进行比较
    let minX = this.tl[0];
    let minY = this.tl[1];
    let maxX = this.tl[0];
    let maxY = this.tl[1];

    const arr = [this.tr, this.bl, this.br];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (p[0] < minX) {
        minX = p[0];
      }
      if (p[0] > maxX) {
        maxX = p[0];
      }
      if (p[1] < minY) {
        minY = p[1];
      }
      if (p[1] > maxY) {
        maxY = p[1];
      }
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * FIXME:需要实现
   * 另一个边界盒子是否完全位于当前盒子内部。
   * @param box
   * @returns
   */
  public containsBox(box: ICEBoundingBox): boolean {
    return false;
  }

  /**
   * 是否与另一个盒子存在相交的部分。
   * @param box
   * @returns
   */
  public isIntersect(box: ICEBoundingBox): boolean {
    let left1 = this.tl[0];
    let right1 = this.br[0];
    let top1 = this.tl[1];
    let bottom1 = this.br[1];

    let left2 = box.tl[0];
    let right2 = box.br[0];
    let top2 = box.tl[1];
    let bottom2 = box.br[1];

    let isIntersect = !(left1 > right2 || top1 > bottom2 || right1 < left2 || bottom1 < top2);
    return isIntersect;
  }

  /**
   * @param matrix
   * @returns A new ICEBoundingBox instance.
   */
  public transform(matrix): ICEBoundingBox {
    const tl = vec2.transformMat2d([], this.tl, matrix);
    const tr = vec2.transformMat2d([], this.tr, matrix);
    const bl = vec2.transformMat2d([], this.bl, matrix);
    const br = vec2.transformMat2d([], this.br, matrix);
    const center = vec2.transformMat2d([], this.center, matrix);
    return new ICEBoundingBox([...tl, ...tr, ...bl, ...br, ...center]);
  }

  /**
   * @param box
   * @returns A new ICEBoundingBox instance.
   */
  public union(box: ICEBoundingBox): ICEBoundingBox {
    return null;
  }

  public get width(): number {
    const deltaX = this.br[0] - this.bl[0];
    const deltaY = this.br[1] - this.bl[1];
    return Math.hypot(deltaX, deltaY);
  }

  public get height(): number {
    const deltaX = this.br[0] - this.tr[0];
    const deltaY = this.br[1] - this.tr[1];
    return Math.hypot(deltaX, deltaY);
  }

  public get left(): number {
    return this.tl[0];
  }

  //不允许设置 left 参数
  private set left(num: number) {
    throw new Error('Can not set left to ICEBoundingBox directly.');
  }

  public get top(): number {
    return this.tl[1];
  }

  //不允许设置 top 参数
  private set top(num: number) {
    throw new Error('Can not set top to ICEBoundingBox directly.');
  }

  public get centerX(): number {
    return this.center[0];
  }

  public get centerY(): number {
    return this.center[1];
  }

  public get centerPoint() {
    return this.center;
  }

  public get topCenter() {
    return [this.tl[0] + (this.tr[0] - this.tl[0]) / 2, this.tl[1] + (this.tr[1] - this.tl[1]) / 2];
  }

  public get rightCenter() {
    return [this.tr[0] + (this.br[0] - this.tr[0]) / 2, this.tr[1] + (this.br[1] - this.tr[1]) / 2];
  }

  public get bottomCenter() {
    return [this.bl[0] + (this.br[0] - this.bl[0]) / 2, this.bl[1] + (this.br[1] - this.bl[1]) / 2];
  }

  public get leftCenter() {
    return [this.tl[0] + (this.bl[0] - this.tl[0]) / 2, this.tl[1] + (this.bl[1] - this.tl[1]) / 2];
  }
}
export default ICEBoundingBox;
