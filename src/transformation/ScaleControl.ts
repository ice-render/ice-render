import ICERect from '../graphic/shape/ICERect';

/**
 * @class ScaleControl 缩放操作手柄
 *
 * 缩放操作手柄不能独立存在，只能依附在某个宿主对象上。
 *
 * TODO: 补全 props 配置项
 * {
 *   host: 宿主对象引用
 *   direction: 改变的方向，共有3个可选的值： x/y/both
 *   position: 手柄在变换矩形4个边上的位置，共有8个：lt/t/rt/r/rb/b/lb/l
 * }
 */
export default class ScaleControl extends ICERect {
  constructor(props) {
    super({ position: 'l', ...props });
    this.on('after-move', this.scaleToCenter, this);
  }

  /**
   * 围绕几何中心点缩放。
   * @param evt
   */
  private scaleToCenter(evt) {
    let movementX = evt.movementX / window.devicePixelRatio;
    let movementY = evt.movementY / window.devicePixelRatio;
    let hostState = this.props.host.state;
    let newLeft = hostState.left;
    let newTop = hostState.top;
    let newWidth = hostState.width;
    let newHeight = hostState.height;
    let position = this.props.position;

    //用逆矩阵补偿 host 的 transform 导致的坐标变换。
    let point = new DOMPoint(movementX, movementY);
    let matrix = hostState.absoluteLinearMatrix;
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

    this.props.host.setState({
      top: newTop,
      left: newLeft,
      width: Math.abs(newWidth),
      height: Math.abs(newHeight),
    });
  }

  // private scaleToLeftTop(evt) {
  //   //FIXME:更新 width/height 的时候，host 原点坐标会发生变化
  //   console.log(this.props.host.state.origin);

  //   let movementX = evt.movementX / window.devicePixelRatio;
  //   let movementY = evt.movementY / window.devicePixelRatio;

  //   let hostState = this.props.host.state;
  //   let newLeft = hostState.left;
  //   let newTop = hostState.top;
  //   let newWidth = hostState.width;
  //   let newHeight = hostState.height;
  //   let position = this.props.position;

  //   let point = new DOMPoint(movementX, movementY);
  //   let matrix = this.props.host.calcAbsoluteLinearMatrix();
  //   matrix = matrix.inverse();
  //   point = point.matrixTransform(matrix);
  //   movementX = point.x;
  //   movementY = point.y;

  //   switch (position) {
  //     case 'tl':
  //       newTop += movementY;
  //       newLeft += movementX;
  //       break;
  //     case 'l':
  //     case 'lb':
  //       newLeft += movementX;
  //       break;
  //     case 't':
  //     case 'tr':
  //       newTop += movementY;
  //       break;
  //     default:
  //       break;
  //   }

  //   //当手柄位于左侧时，鼠标向右移动是缩小矩形的宽度，向左是拉大矩形的宽度，位于右侧时刚好相反。
  //   let xSign = position.includes('l') ? -1 : 1;
  //   //当手柄位于顶部时，鼠标向上移动是拉大矩形的高度，向下是减小矩形的高度，位于底部时刚好相反。
  //   let ySign = position.includes('t') ? -1 : 1;
  //   let direction = this.props.direction;
  //   switch (direction) {
  //     case 'x':
  //       newWidth += xSign * movementX;
  //       break;
  //     case 'y':
  //       newHeight += ySign * movementY;
  //       break;
  //     case 'both':
  //       newWidth += xSign * movementX;
  //       newHeight += ySign * movementY;
  //       break;
  //     default:
  //       break;
  //   }

  //   this.props.host.setState({
  //     top: newTop,
  //     left: newLeft,
  //     width: newWidth,
  //     height: newHeight,
  //   });
  // }

  // private scaleToLeftBorder(evt) {
  //   //FIXME:
  // }

  // private scaleToRightBorder(evt) {
  //   //FIXME:
  // }

  // private scaleToPoint(evt) {
  //   //FIXME:
  // }
}
