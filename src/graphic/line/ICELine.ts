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
  protected calcDots(): Array<DOMPoint> {
    this.state.dots = [
      new DOMPoint(0, 0),
      new DOMPoint(
        this.state.endPoint[0] - this.state.startPoint[0],
        this.state.endPoint[1] - this.state.startPoint[1]
      ),
    ];
    return this.state.dots;
  }

  public setStartPoint(point: []): void {
    this.state.startPoint = [...point];
  }

  public setEndPoint(point: []): void {
    this.state.endPoint = [...point];
  }
}

export default ICELine;
