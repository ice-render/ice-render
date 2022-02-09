import ICEEvent from '../../event/ICEEvent';
import GeometryUtil from '../../geometry/GeometryUtil';
import ICECircle from '../../graphic/shape/ICECircle';

/**
 * @class RotateControl 旋转操作手柄
 *
 * - 旋转手柄不能独立存在，只能依附在某个宿主对象上。
 * - 此手柄仅用来修改组件的旋转角度。
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

    //计算手柄旋转角
    let parentOrigin = this.parentNode.state.absoluteOrigin;
    let rotateAngle = GeometryUtil.calcRotateAngle(evt.offsetX, evt.offsetY, parentOrigin.x, parentOrigin.y) + 90; //旋转手柄默认处于逆时针90度位置，这里补偿90度。

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
