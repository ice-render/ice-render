import get from 'lodash/get';
import merge from 'lodash/merge';
import ICEDotPath from '../ICEDotPath';

/**
 * @class ICELine 直线
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICELine extends ICEDotPath {
  /**
   * FIXME:编写完整的配置项描述
   * @cfg
   * {
   *  lineType: 'solid', //solid, dashed
   *  arrow: 'none' //none, start, end ,both
   * }
   * @param props
   */
  constructor(props: any = {}) {
    super(merge({ lineType: 'solid', arrow: 'none', startPoint: [0, 0], endPoint: [10, 10] }, props));
  }

  /**
   * ICELine 有自己特殊的计算方式，默认的计算原点总是放在 startPoint 的位置。
   * @overwrite
   * @returns
   */
  protected calcOriginalDots(): Array<DOMPoint> {
    this.state.dots = [
      new DOMPoint(0, 0),
      new DOMPoint(
        this.state.endPoint[0] - this.state.startPoint[0],
        this.state.endPoint[1] - this.state.startPoint[1]
      ),
    ];
    return this.state.dots;
  }

  /**
   * ICELine 的平移矩阵有自己的特殊算法，默认需要把 startPoint 的坐标加到平移矩阵上。
   * @method calcTranslationMatrix
   * @overwrite
   * @returns DOMMatrix
   */
  protected calcTranslationMatrix(): DOMMatrix {
    let startX = this.state.startPoint[0];
    let startY = this.state.startPoint[1];
    let tx = get(this, 'state.transform.translate.0') + this.state.left + startX;
    let ty = get(this, 'state.transform.translate.1') + this.state.top + startY;
    let matrix = new DOMMatrix().translateSelf(tx, ty);
    this.state.translationMatrix = matrix;
    return matrix;
  }

  /**
   * 设置组件内部的原点坐标，坐标点的计算相对于组件的 local 坐标系，而不是全局默认坐标系。
   * 在不修改坐标原点时，ctx 的坐标原点默认放在组件的左上角位置。
   * 移动坐标原点后，组件中所有的坐标点，当前边界盒子，都会受到影响。
   * @param point
   */
  public calcLocalOrigin(position = 'center'): void {
    let point = new DOMPoint();
    if (position === 'center') {
      //ICELine 几何中心点的计算方法与普通组件不同，需要根据起点坐标和终点坐标进行计算。
      let startX = this.state.startPoint[0];
      let startY = this.state.startPoint[1];
      let endX = this.state.endPoint[0];
      let endY = this.state.endPoint[1];
      point.x = (endX - startX) / 2;
      point.y = (endY - startY) / 2;
    } else {
      //FIXME:
    }
    this.state.originPoint = point;

    //根据新的几何中点移动原始的关键点
    for (let i = 0; i < this.state.dots.length; i++) {
      let dot = this.state.dots[i];
      dot = dot.matrixTransform(new DOMMatrix([1, 0, 0, 1, -point.x, -point.y]));
      this.state.dots[i] = dot;
    }
  }

  public setStartPoint(point: []): void {
    this.state.startPoint = [...point];
  }

  public setEndPoint(point: []): void {
    this.state.endPoint = [...point];
  }
}

export default ICELine;
