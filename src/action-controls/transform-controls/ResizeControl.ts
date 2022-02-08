import ICEEvent from '../../event/ICEEvent';
import ICERect from '../../graphic/shape/ICERect';

/**
 * @class ResizeControl 调整尺寸的操作手柄
 *
 * - 调整尺寸的操作手柄不能独立存在，只能依附在某个宿主对象上。
 * - 此手柄只能调整尺寸，不能实现翻转
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
    this.on('after-move', this.resizeEvtHandler, this);
  }

  /**
   * 围绕几何中心点调整宽高。
   * @param evt
   */
  private resizeEvtHandler(evt) {
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

    //用 parentNode 的逆矩阵把全局坐标系中的移动量转换为组件本地的移动量。
    //组件自身的 absoluteLinearMatrix 已经包含了所有层级上的 transform 。
    let matrix = parentState.absoluteLinearMatrix.inverse();
    let point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
    movementX = point.x;
    movementY = point.y;

    let x = evt.clientX;
    let y = evt.clientY;
    let localPoint = this.parentNode.globalCoordToLocal(x, y);

    //位于本地Y轴左侧
    if (position.indexOf('l') != -1) {
      newLeft += movementX;
      newWidth -= 2 * movementX;
    }

    //位于本地Y轴右侧
    if (position.indexOf('r') != -1) {
      newLeft -= movementX;
      newWidth += 2 * movementX;
    }

    //位于本地X轴上方
    if (position.indexOf('t') != -1) {
      newTop += movementY;
      newHeight -= 2 * movementY;
    }

    //位于本地X轴下方
    if (position.indexOf('b') != -1) {
      newTop -= movementY;
      newHeight += 2 * movementY;
    }

    const param = {
      top: newTop,
      left: newLeft,
      width: Math.abs(newWidth),
      height: Math.abs(newHeight),
    };

    this.parentNode.trigger('before-resize', new ICEEvent(evt, { position }));
    this.parentNode.setState(param);
    this.parentNode.trigger('after-resize', new ICEEvent(evt, { position }));
  }
}
