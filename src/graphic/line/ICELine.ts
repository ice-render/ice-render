import isNil from 'lodash/isNil';
import merge from 'lodash/merge';
import round from 'lodash/round';
import GeometryUtil from '../../geometry/GeometryUtil';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import ICEDotPath from '../ICEDotPath';

/**
 * FIXME: 把 ICELine 改成抽象类，其它所有线条形的组件都改成 ICELine 的子类，方便操作面板进行类型判断。
 *
 * @class ICELine
 *
 * 直线
 *
 * 基本特征：
 *
 * - ICELine 以及所有子类不能进行 transform 操作
 * - ICELine 以及所有子类的 left/top 总是定位在 startPoint 点上
 * - ICELine 以及所有子类的原点都在 startPoint 点上，而不在几何中心点
 *
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

    if (isNil(param.style.lineWidth) || param.style.lineWidth <= 0) {
      param.style.lineWidth = 2;
    }

    super(param);
  }

  /**
   * ICELine 有自己的特殊处理，它的原点永远在 (0,0) 位置，而不在几何中点。
   * @overwrite
   * @returns
   */
  protected calcLocalOrigin(): DOMPoint {
    let point = new DOMPoint(0, 0);
    this.state.localOrigin = point;
    return point;
  }

  /**
   * ICELine 有自己特殊的计算方式：
   * - 原点总是放在 startPoint 的位置。
   * - 数值相对于组件本地坐标系进行计算。
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

  /**
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
   * @overwrite
   * @returns
   */
  protected calcOriginalDimension() {
    this.calcDots();

    let startX = this.state.startPoint[0];
    let endX = this.state.endPoint[0];

    let width = Math.abs(endX - startX);
    let height = this.state.style.lineWidth; //对于线条来说，高度就是线条本身的粗细

    this.state.width = width;
    this.state.height = height;

    return { width: this.state.width, height: this.state.height };
  }

  /**
   * 计算4个顶点：
   * - 相对于组件本地的坐标系，原点位于左上角，没有经过矩阵变换。
   * - 返回值用于计算组件的原始 width/height 。
   * @returns Array<DOMPoint>
   */
  protected calc4VertexPoints(): Array<DOMPoint> {
    let startX = 0; //由于 ICELine 总是把 left/top 与 startPoint 重合，所以这里的 startX 总是为 0
    let startY = 0; //由于 ICELine 总是把 left/top 与 startPoint 重合，所以这里的 startY 总是为 0
    let endX = this.state.endPoint[0] - this.state.startPoint[0];
    let endY = this.state.endPoint[1] - this.state.startPoint[1];
    let angle = this.getRotateAngle();

    let height = this.state.height;
    let deltaX = (Math.cos((angle * Math.PI) / 180) * height) / 2;
    let deltaY = (Math.sin((angle * Math.PI) / 180) * height) / 2;
    deltaX = round(deltaX, 3);
    deltaY = round(deltaY, 3);

    //计算4个顶点，让边界盒子紧贴直线
    let point1 = new DOMPoint(startX + deltaX, startY + deltaY);
    let point2 = new DOMPoint(startX - deltaX, startY - deltaY);
    let point3 = new DOMPoint(endX + deltaX, endY + deltaY);
    let point4 = new DOMPoint(endX - deltaX, endY - deltaY);

    return [point1, point2, point3, point4];
  }

  /**
   * 获取组件的最小包围盒，此盒子的变换矩阵与组件自身完全相同。
   * @returns
   */
  public getMinBoundingBox(): ICEBoundingBox {
    //先基于组件本地坐标系进行计算
    let originX = this.state.localOrigin.x;
    let originY = this.state.localOrigin.y;
    let points = this.calc4VertexPoints();
    let boundingBox = new ICEBoundingBox([
      points[0].x - originX,
      points[0].y - originY,
      points[1].x - originX,
      points[1].y - originY,
      points[2].x - originX,
      points[2].y - originY,
      points[3].x - originX,
      points[3].y - originY,
      0,
      0,
    ]);

    //再用 composedMatrix 进行变换
    boundingBox = boundingBox.transform(this.state.composedMatrix);
    return boundingBox;
  }

  /**
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   *
   * ICELine 有自己特殊的处理方法：
   *
   * - ICELine 的 width/height 属性总是计算出来的，不能直接修改，不接受 width/height 配置项。
   * - ICELine ICELine 不能进行 transform 操作，不接受 transform 配置项。
   * - ICELine 可以直接修改 startPoint 和 endPoint 的数值。
   * - ICELine 的 left/top 数值可以直接修改，修改 left/top 时，会重新计算起点和终点坐标，保证 left/top 与 startPoint 始终保持在同一个点上。
   *
   * @overwrite
   * @param newState
   */
  public setState(newState: any) {
    //ICELine 的 width/height 属性总是计算出来的，不能直接修改，不接受 width/height 配置项。
    if (!isNil(newState.width)) {
      delete newState.width;
    }

    if (!isNil(newState.height)) {
      delete newState.height;
    }

    //ICELine 不能进行 transform 操作，不接受 transform 配置项。
    if (!isNil(newState.transform)) {
      delete newState.transform;
    }

    let startX = this.state.startPoint[0];
    let startY = this.state.startPoint[1];
    let endX = this.state.endPoint[0];
    let endY = this.state.endPoint[1];
    let deltaX = endX - startX;
    let deltaY = endY - startY;

    if (!isNil(newState.left)) {
      this.state.startPoint[0] = newState.left;
      this.state.endPoint[0] = newState.left + deltaX;
    }

    if (!isNil(newState.top)) {
      this.state.startPoint[1] = newState.top;
      this.state.endPoint[1] = newState.top + deltaY;
    }

    if (!isNil(newState.startPoint)) {
      this.state.startPoint = [...newState.startPoint];

      //对 ICELine 来说，需要保证 left/top 与 startPoint 始终保持在同一个点上。
      this.state.left = this.state.startPoint[0];
      this.state.top = this.state.startPoint[1];
    }

    super.setState(newState);
  }

  public getRotateAngle(): number {
    let startX = 0; //由于 ICELine 总是把 left/top 与 startPoint 重合，所以这里的 startX 总是为 0
    let startY = 0; //由于 ICELine 总是把 left/top 与 startPoint 重合，所以这里的 startY 总是为 0
    let endX = this.state.endPoint[0] - this.state.startPoint[0];
    let endY = this.state.endPoint[1] - this.state.startPoint[1];

    //计算直线的旋转角
    let angle = GeometryUtil.calcRotateAngle(endX, endY, startX, startY);
    angle += 90; //旋转90度，法向

    return angle;
  }
}

export default ICELine;
