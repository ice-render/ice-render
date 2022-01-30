import GeometryUtil from './GeometryUtil';

/**
 * @class ICEBoundingBox 用4点法描述的边界盒子。
 *
 * - 边界盒子一定是矩形。
 * - 边界盒子总是绘制在全局坐标系中。
 * - 边界盒子总是通过自身的坐标点进行变换，而不是变换 canvas.ctx 。
 *
 * TODO: Wrap up the original DOMPoint and DOMMatrix interfaces, add some util functions.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMPoint
 * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMMatrix/DOMMatrix
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEBoundingBox {
  //top-left
  public tl = new DOMPoint();
  //top-right
  public tr = new DOMPoint();
  //bottom-left
  public bl = new DOMPoint();
  //bottom-right
  public br = new DOMPoint();
  //center-point
  public center = new DOMPoint();

  constructor(props: Array<number> = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) {
    this.tl = new DOMPoint(props[0], props[1]);
    this.tr = new DOMPoint(props[2], props[3]);
    this.bl = new DOMPoint(props[4], props[5]);
    this.br = new DOMPoint(props[6], props[7]);
    this.center = new DOMPoint(props[8], props[9]);
  }

  /**
   * 判断指定的坐标点是否位于边界矩形内部，向右水平射线法。
   * 这里参考了 fabricjs 的实现方式。
   * @see http://fabricjs.com/
   * @param point
   * @returns
   */
  public containsPoint(point: DOMPoint): boolean {
    //只考虑凸包的情况：[x,y]有一个值位于最大最小值之外，则不可能包含在边界盒子内部。
    const { minX, minY, maxX, maxY } = this.getMinAndMaxPoint();
    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
      return false;
    }

    let xcount = 0; //交叉点个数
    let xi; //交点的 x 坐标
    const boudingLines = this.getBoundingLines();

    for (let i = 0; i < boudingLines.length; i++) {
      const line = boudingLines[i];

      //特例1：点位于线段下方，水平射线不可能与线段交叉
      if (point.y > line.o.y && point.y > line.d.y) {
        continue;
      }

      //特例2：点位于线段上方，水平涉嫌不可能与线段交叉
      if (point.y < line.o.y && point.y < line.d.y) {
        continue;
      }

      if (line.o.x === line.d.x && line.o.x >= point.x) {
        //特例3：处理垂直于 x 轴（平行于 y 轴）的特殊情况
        xi = line.o.x;
      } else {
        //斜率法求向右的射线与线段的交点 x 坐标
        const k = (line.d.y - line.o.y) / (line.d.x - line.o.x); //斜率
        xi = line.o.x + (point.y - line.o.y) / k;
      }

      if (xi > point.x) {
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
    const line_1 = { o: DOMPoint.fromPoint(this.tl), d: DOMPoint.fromPoint(this.tr) }; //o:origin, d:destination
    const line_2 = { o: DOMPoint.fromPoint(this.tr), d: DOMPoint.fromPoint(this.br) };
    const line_3 = { o: DOMPoint.fromPoint(this.br), d: DOMPoint.fromPoint(this.bl) };
    const line_4 = { o: DOMPoint.fromPoint(this.bl), d: DOMPoint.fromPoint(this.tl) };
    return [line_1, line_2, line_3, line_4];
  }

  /**
   * 获取边界盒子 x,y 的最大和最小值
   * @returns
   */
  public getMinAndMaxPoint(): any {
    //取任意一个顶点坐标作为初始值，然后与其它3个顶点的坐标进行比较
    let minX = this.tl.x;
    let minY = this.tl.y;
    let maxX = this.tl.x;
    let maxY = this.tl.y;

    const arr = [this.tr, this.bl, this.br];
    arr.forEach((p) => {
      if (p.x < minX) {
        minX = p.x;
      }
      if (p.x > maxX) {
        maxX = p.x;
      }
      if (p.y < minY) {
        minY = p.y;
      }
      if (p.y > maxY) {
        maxY = p.y;
      }
    });

    return { minX, minY, maxX, maxY };
  }

  /**
   * 另一个边界盒子是否完全位于当前盒子内部。
   * @param box
   * @returns
   */
  public containsBox(box: ICEBoundingBox): boolean {
    return false;
  }

  /**
   * 是否与另一个盒子相交。
   * @param box
   * @returns
   */
  public isIntersect(box: ICEBoundingBox): boolean {
    return false;
  }

  /**
   * @param matrix
   * @returns A new ICEBoundingBox instance.
   */
  public transform(matrix: DOMMatrix): ICEBoundingBox {
    const tl = DOMPoint.fromPoint(this.tl).matrixTransform(matrix);
    const tr = DOMPoint.fromPoint(this.tr).matrixTransform(matrix);
    const bl = DOMPoint.fromPoint(this.bl).matrixTransform(matrix);
    const br = DOMPoint.fromPoint(this.br).matrixTransform(matrix);
    const center = DOMPoint.fromPoint(this.center).matrixTransform(matrix);
    return new ICEBoundingBox([tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y, center.x, center.y]);
  }

  /**
   * @param box
   * @returns A new ICEBoundingBox instance.
   */
  public union(box: ICEBoundingBox): ICEBoundingBox {
    return null;
  }

  public get width(): number {
    return GeometryUtil.getLength(this.br.x, this.br.y, this.bl.x, this.bl.y);
  }

  public get height(): number {
    return GeometryUtil.getLength(this.br.x, this.br.y, this.tr.x, this.tr.y);
  }

  public get left(): number {
    return this.tl.x;
  }

  public get centerX(): number {
    return this.center.x;
  }

  public get centerY(): number {
    return this.center.y;
  }

  public get centerPoint(): DOMPoint {
    return this.center;
  }

  //不允许设置 left 参数
  private set left(num: number) {}

  public get top(): number {
    return this.tl.y;
  }
  //不允许设置 top 参数
  private set top(num: number) {}
}
export default ICEBoundingBox;
