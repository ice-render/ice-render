import merge from 'lodash/merge';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import ICEDotPath from '../ICEDotPath';

/**
 * TODO:线条不能进行 transform
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
   * 计算路径上的关键点:
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   * @returns
   */
  protected calcOriginalDots(): Array<DOMPoint> {
    this.state.dots = [
      new DOMPoint(this.state.startPoint[0], this.state.startPoint[1]),
      new DOMPoint(this.state.endPoint[0], this.state.endPoint[1]),
    ];
    return this.state.dots;
  }

  /**
   * 设置组件内部的原点坐标，坐标点的计算相对于组件的 local 坐标系，而不是全局默认坐标系。
   * 在不修改坐标原点时，ctx 的坐标原点默认放在组件的左上角位置。
   * 移动坐标原点后，组件中所有的坐标点，当前边界盒子，都会受到影响。
   * @param point
   */
  public setLocalOrigin(position = 'center'): void {
    let point = new DOMPoint();
    if (position === 'center') {
      //ICELine 几何中心点的计算方法与普通组件不同，需要根据起点坐标和终点坐标进行计算。
      let startX = this.state.startPoint[0];
      let startY = this.state.startPoint[1];
      let endX = this.state.endPoint[0];
      let endY = this.state.endPoint[0];
      point.x = (endX - startX) / 2;
      point.y = (endY - startY) / 2;
    } else {
      //FIXME:
    }
    this.state.origin = point;

    for (let i = 0; i < this.state.dots.length; i++) {
      let dot = this.state.dots[i];
      dot = dot.matrixTransform(new DOMMatrix([1, 0, 0, 1, -this.state.origin.x, -this.state.origin.y]));
      this.state.dots[i] = dot;
    }
  }

  /**
   * 获取经过变换算之后的边界盒子：
   * - 此盒子是组件的最小包围盒。
   * - 盒子本身的 transform matrix 与组件完全一致。
   * - IMPORTANT: 边界盒子的坐标相对于全局坐标系进行计算，而不是组件的本地坐标系。
   * FIXME:需要考虑 parentNode 的情况？
   * @returns
   */
  getMinBoundingBox(): ICEBoundingBox {
    let startX = this.state.startPoint[0];
    let startY = this.state.startPoint[1];
    let boundingBox = new ICEBoundingBox([
      startX,
      startY,
      startX + this.state.width,
      startY,
      startX,
      startY + this.state.height,
      startX + this.state.width,
      startY + this.state.height,
    ]);

    boundingBox = boundingBox.transform(this.state.composedMatrix);
    boundingBox = boundingBox.transform(new DOMMatrix().translateSelf(-this.state.origin.x, -this.state.origin.y));
    return boundingBox;
  }
}

export default ICELine;
