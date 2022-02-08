import ICEEvent from '../../event/ICEEvent';
import GeometryUtil from '../../geometry/GeometryUtil';
import ICECircle from '../../graphic/shape/ICECircle';

/**
 * @class RotateControl 旋转操作手柄
 *
 * 旋转操作手柄不能独立存在，只能依附在某个宿主对象上。
 *
 * TODO: 补全 props 配置项
 * {
 * }
 */
export default class RotateControl extends ICECircle {
  constructor(props) {
    super(props);
    this.on('after-move', this.rotateEvtHandler, this);
  }

  private rotateEvtHandler(evt) {
    if (!this.parentNode) {
      //parentNode 是 TransformPanel
      return;
    }

    let parentState = this.parentNode.state;
    let parentOrigin = parentState.absoluteOrigin;
    let matrix = parentState.absoluteTranslateMatrix;
    let hostCenterPoint = parentOrigin.matrixTransform(matrix);

    //计算手柄旋转角
    let rotateAngle = GeometryUtil.calcRotateAngle(evt.clientX, evt.clientY, hostCenterPoint.x, hostCenterPoint.y) + 90; //加上90度的旋转手柄初始角度

    //parentNode 旋转角与手柄设置为相同数值
    const param = {
      transform: {
        rotate: rotateAngle,
      },
    };

    this.parentNode.trigger('before-rotate', new ICEEvent(param));
    this.parentNode.setState(param);
    this.parentNode.trigger('after-rotate', new ICEEvent(param));
  }
}
