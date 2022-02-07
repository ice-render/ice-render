import isNil from 'lodash/isNil';
import merge from 'lodash/merge';
import ICEDotPath from '../ICEDotPath';

/**
 * FIXME: 把 ICELine 改成抽象类，其它所有线条形的组件都改成 ICELine 的子类，方便操作面板进行类型判断。
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
    let param = merge({ lineType: 'solid', arrow: 'none', startPoint: [0, 0], endPoint: [10, 10] }, props);
    //ICELine 的参数需要特殊处理，总是把 left/top 移动到 startPoint 的位置，外部传递的 left/top ， translate.x/translate.y 都无效。
    param = merge(param, { left: props.startPoint[0], top: props.startPoint[1], transform: { translate: [0, 0] } });
    super(param);
  }

  /**
   * ICELine 有自己的特殊处理，它的原点永远在 (0,0) 位置，而不在几何中点。
   *
   * @overwrite
   * @returns
   */
  protected calcLocalOrigin(): DOMPoint {
    let point = new DOMPoint(0, 0);
    this.state.localOrigin = point;
    return point;
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

  /**
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   *
   * ICELine 有自己特殊的处理方法：
   *
   * - width/height 不能修改。
   * - 两点决定一条直线，所以 ICELine 只能修改 startPoint 和 endPoint 。
   *
   * @overwrite
   * @param newState
   */
  public setState(newState: any) {
    if (!isNil(newState.width)) {
      delete newState.width;
    }

    if (!isNil(newState.height)) {
      delete newState.height;
    }

    super.setState(newState);
  }
}

export default ICELine;
