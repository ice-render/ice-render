import ICEEvent from '../event/ICEEvent';
import ICERect from '../graphic/shape/ICERect';

/**
 * @class ResizeControl 调整尺寸的操作手柄
 *
 * 调整尺寸的操作手柄不能独立存在，只能依附在某个宿主对象上。
 *
 * TODO: 补全 props 配置项
 * {
 *   direction: 改变的方向，共有3个可选的值： x/y/both
 *   position: 手柄在变换矩形4个边上的位置，共有8个：lt/t/rt/r/rb/b/lb/l
 * }
 */
export default class ResizeControl extends ICERect {
  constructor(props) {
    super({ position: 'l', ...props });
    this.on('after-move', this.resizeToCenter, this);
  }

  /**
   * 围绕几何中心点调整宽高。
   * @param evt
   */
  private resizeToCenter(evt) {
    if (!this.parentNode) {
      //parentNode 是 TransformPanel
      return;
    }

    let movementX = evt.movementX / window.devicePixelRatio;
    let movementY = evt.movementY / window.devicePixelRatio;
    let parentState = this.parentNode.state;
    let newLeft = parentState.left;
    let newTop = parentState.top;
    let newWidth = parentState.width;
    let newHeight = parentState.height;
    let position = this.props.position;

    //用逆矩阵补偿 parentNode 的 transform 导致的坐标变换。
    let point = new DOMPoint(movementX, movementY);
    let matrix = parentState.absoluteLinearMatrix;
    matrix = matrix.inverse();
    point = point.matrixTransform(matrix);
    movementX = point.x;
    movementY = point.y;

    switch (position) {
      case 'tl':
        newLeft += movementX;
        newTop += movementY;
        newWidth -= 2 * movementX;
        newHeight -= 2 * movementY;
        break;
      case 'l':
        newLeft += movementX;
        newWidth -= 2 * movementX;
        break;
      case 'lb':
        newLeft += movementX;
        newTop -= movementY;
        newWidth -= 2 * movementX;
        newHeight += 2 * movementY;
        break;
      case 'tr':
        newLeft -= movementX;
        newTop += movementY;
        newWidth += 2 * movementX;
        newHeight -= 2 * movementY;
        break;
      case 'r':
        newLeft -= movementX;
        newWidth += 2 * movementX;
        break;
      case 'rb':
        newLeft -= movementX;
        newTop -= movementY;
        newWidth += 2 * movementX;
        newHeight += 2 * movementY;
        break;
      case 't':
        newTop += movementY;
        newHeight -= 2 * movementY;
        break;
      case 'b':
        newTop -= movementY;
        newHeight += 2 * movementY;
        break;
      default:
        break;
    }

    const param = {
      top: newTop,
      left: newLeft,
      width: Math.abs(newWidth),
      height: Math.abs(newHeight),
    };
    this.parentNode.trigger('before-resize', new ICEEvent(evt, { position, movementX, movementY }));
    this.parentNode.setState(param);
    this.parentNode.trigger('after-resize', new ICEEvent(evt, { position, movementX, movementY }));
  }
}
