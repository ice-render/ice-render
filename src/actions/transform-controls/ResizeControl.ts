/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import round from 'lodash/round';
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
    super({ position: 'l', direction: 'x', quadrant: 1, ...props });
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

    let { quadrant } = evt;
    let movementX = evt.movementX / window.devicePixelRatio;
    let movementY = evt.movementY / window.devicePixelRatio;
    let parentState = this.parentNode.state;
    let newLeft = parentState.left;
    let newTop = parentState.top;
    let newWidth = parentState.width;
    let newHeight = parentState.height;

    //用 parentNode 的逆矩阵把全局坐标系中的移动量转换为组件本地的移动量。
    //组件自身的 absoluteLinearMatrix 已经包含了所有层级上的 transform 。
    let matrix = parentState.absoluteLinearMatrix.inverse();
    let point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
    movementX = point.x;
    movementY = point.y;

    switch (quadrant) {
      case 1:
        newLeft -= movementX;
        newTop += movementY;
        newWidth += 2 * movementX;
        newHeight -= 2 * movementY;
        break;
      case 2:
        newLeft += movementX;
        newTop += movementY;
        newWidth -= 2 * movementX;
        newHeight -= 2 * movementY;
        break;
      case 3:
        newLeft += movementX;
        newTop -= movementY;
        newWidth -= 2 * movementX;
        newHeight += 2 * movementY;
        break;
      case 4:
        newLeft -= movementX;
        newTop -= movementY;
        newWidth += 2 * movementX;
        newHeight += 2 * movementY;
        break;
      case 5:
        newTop += movementY;
        newHeight -= 2 * movementY;
        break;
      case 6:
        newTop -= movementY;
        newHeight += 2 * movementY;
        break;
      case 7:
        newLeft += movementX;
        newWidth -= 2 * movementX;
        break;
      case 8:
        newLeft -= movementX;
        newWidth += 2 * movementX;
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
    this.parentNode.trigger('before-resize', new ICEEvent(evt, { quadrant }));
    this.parentNode.setState(param);
    this.parentNode.trigger('after-resize', new ICEEvent(evt, { quadrant }));
  }

  /**
   * @overwrite
   * ResizeControl 不能自由移动自己的位置，自能在X轴、Y轴，以及矩形的2条对角线上移动位置。
   *
   * 在全局空间(canvas)中移动指定的位移。
   * 注意：此方法用于直接设置组件在全局空间中的位移，而不是相对于其它坐标系。
   *
   * @param tx
   * @param ty
   * @param evt
   */
  public moveGlobalPosition(tx: number, ty: number, evt: any = new ICEEvent()): void {
    let signX = tx > 0 ? 1 : -1; //signX 大于 0 表示鼠标正在向 X 轴正向移动
    let signY = ty > 0 ? 1 : -1; //signY 大于 0 表示鼠标正在向 Y 轴正向移动

    let parentState = this.parentNode.state;
    let parentLocalOrigin = parentState.localOrigin;
    let parentWidth = parentState.width;
    let parentHeight = parentState.height;
    let matrix = parentState.absoluteLinearMatrix.inverse();
    let point = new DOMPoint(tx, ty).matrixTransform(matrix);
    tx = point.x;
    ty = point.y;

    let { left, top, quadrant } = this.state;
    let halfandleSize = this.state.width / 2;
    let newQuadrant = 0;

    if (this.state.direction === 'x') {
      left += tx;
      //用 0.5 像素的偏移量，防止 left 与原点重叠
      if (round(left) === 0) {
        left = signX * 0.5;
      }

      //手柄发生移动之后，重新计算当前位于哪个象限或者坐标轴上
      if (left + halfandleSize - parentLocalOrigin.x > 0) {
        newQuadrant = 8;
      } else {
        newQuadrant = 7;
      }
    } else if (this.state.direction === 'y') {
      top += ty;
      //用 0.5 像素的偏移量，防止 top 与原点重叠
      if (round(top) === 0) {
        top = signY * 0.5;
      }

      //手柄发生移动之后，重新计算当前位于哪个象限或者坐标轴上
      if (top + halfandleSize - parentLocalOrigin.y > 0) {
        newQuadrant = 6;
      } else {
        newQuadrant = 5;
      }
    } else if (this.state.direction === 'xy') {
      //限制4个顶点位置的手柄只能沿着对角线移动，第1象限和第3象限可以交换位置，第2象限和第4象限可以交换位置。
      //矩形两条对角线过原点，直线解析式 y=kx 。
      //Canvas 中 Y 轴正向向下，与数学坐标反向，斜向右上角的对角线 k 值小于0，斜向右下角对角线 k 值大于 0 。
      let x1 = -parentWidth / 2;
      if (round(x1) === 0) {
        x1 = signX * 0.5;
      }
      let y1 = -parentHeight / 2;
      let k1 = y1 / x1;

      let x2 = parentWidth / 2;
      if (round(x2) === 0) {
        x2 = signX * 0.5;
      }
      let y2 = -parentHeight / 2;
      let k2 = y2 / x2;

      //子组件的 left/top 是相对于父组件的左上角位置的数值，而不是父组件移动原点之后的数值，换基到本地原点，然后基于斜率计算。
      //k=(top+halfandleSize-parentLocalOrigin.y+ty)/(left+halfandleSize-parentLocalOrigin.x+tx)
      //ty=k(left+halfandleSize-parentLocalOrigin.x+tx)-(top+halfandleSize-parentLocalOrigin.y)

      if (quadrant === 2 || quadrant == 4) {
        ty = k1 * (left + halfandleSize - parentLocalOrigin.x + tx) - (top + halfandleSize - parentLocalOrigin.y);
      } else {
        ty = k2 * (left + halfandleSize - parentLocalOrigin.x + tx) - (top + halfandleSize - parentLocalOrigin.y);
      }

      left += tx;
      top += ty;

      //手柄发生移动之后，重新计算当前位于哪个象限或者坐标轴上
      if (left + halfandleSize - parentLocalOrigin.x > 0) {
        if (top + halfandleSize - parentLocalOrigin.y > 0) {
          newQuadrant = 4;
        } else {
          newQuadrant = 1;
        }
      } else {
        if (top + halfandleSize - parentLocalOrigin.y > 0) {
          newQuadrant = 3;
        } else {
          newQuadrant = 2;
        }
      }
    }

    //可能需要和对面的手柄交换象限
    let quadrantSwitched = quadrant === newQuadrant ? false : true;
    if (quadrantSwitched) {
      this.parentNode.toggleControlQuadrant(this, newQuadrant);
    }

    this.setPosition(left, top, new ICEEvent(evt, { left, top, tx, ty, quadrant: newQuadrant }));
  }
}
