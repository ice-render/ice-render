import ICEEvent from '../event/ICEEvent';
import ICECircle from '../graphic/shape/ICECircle';

/**
 * @class RotateControl 旋转操作手柄
 *
 * 旋转操作手柄不能独立存在，只能依附在某个宿主对象上。
 *
 * TODO: 补全 props 配置项
 * {
 *   host: 宿主对象引用
 * }
 */
export default class RotateControl extends ICECircle {
  constructor(props) {
    super(props);
    this.on('after-move', this.rotateEvtHandler, this);
  }

  private rotateEvtHandler(evt) {
    let hostState = this.props.host.state;
    let hostOrigin = hostState.globalOrigin;
    let matrix = hostState.absoluteTranslateMatrix;
    let hostCenterPoint = hostOrigin.matrixTransform(matrix);

    //计算手柄旋转角
    let offsetX = evt.clientX - hostCenterPoint.x;
    let offsetY = evt.clientY - hostCenterPoint.y;
    let cos = offsetX / Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    let sin = offsetY / Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    let sign = sin < 0 ? -1 : 1;
    let rotateAngle = (sign * Math.acos(cos) * 180) / Math.PI + 90; //加上90度的旋转手柄初始角度

    //host 旋转角与手柄设置为相同数值
    const param = {
      transform: {
        rotate: rotateAngle,
      },
    };
    this.props.host.trigger('before-rotate', new ICEEvent(param));
    this.props.host.setState(param);
    this.props.host.trigger('after-rotate', new ICEEvent(param));
  }
}
