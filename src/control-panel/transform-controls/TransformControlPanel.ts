/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { mat2d, vec2 } from 'gl-matrix';
import bigZIndexNum from '../../consts/BIG_ZINDEX_NUMBER';
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEComponent from '../../graphic/ICEComponent';
import ICEControlPanel from '../ICEControlPanel';
import ResizeControl from './ResizeControl';
import RotateControl from './RotateControl';

/**
 * @class TransformControlPanel
 *
 * 变换控制面板
 *
 * - TransformControlPanel 本身总是直接画在 canvas 上，不是任何组件的孩子。
 * - TransformControlPanel 是全局单例，在任意时刻，不可能同时出现多个 TransformControlPanel 的实例，因为在图形化的用户交互模式下，用户无法同时操控多个控制面板。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class TransformControlPanel extends ICEControlPanel {
  private rotateControlInstance;
  private rotateControlSize: number = 8; //TODO:改成可配置参数
  private rotateControlffsetY: number = 60; //TODO:改成可配置参数
  private resizeControlInstanceCache = [];
  private resizeControlSize: number = 16; //TODO:改成可配置参数

  constructor(props) {
    super({
      ...props,
      zIndex: bigZIndexNum + 1,
      linkable: false,
      showMinBoundingBox: false,
      showMaxBoundingBox: false,
    });
    this.initControls();
  }

  /**
   * 添加尺寸和旋转变换手柄，初始化时添加在内部的[0,0]位置，此方法只创建对象实例，不执行渲染操作。
   * TODO:添加斜切手柄？
   */
  protected initControls(): void {
    // 创建 8 个 ResizeControl
    // 计算手柄位于父组件的哪一个象限中，有以下取值：
    // - 1: 第1象限；
    // - 2: 第2象限；
    // - 3: 第3象限；
    // - 4: 第4象限；
    // - 5: 位于X轴上方，y值为负，不属于任何象限；
    // - 6: 位于X轴下方，y值为正，不属于任何象限；
    // - 7: 位于Y轴左侧，x值为负，不属于任何象限；
    // - 8: 位于Y轴右侧，x值为正，不属于任何象限；
    //
    // 默认创建顺序，从左上角开始顺时针：tl:2/t:5/tr:1/r:8/rb:4/b:6/lb:3/l:7
    // 第1和第3象限可以交换位置
    // 第2和第4象限可以交换位置
    // X 轴正负可以交换位置
    // Y 轴正负可以交换位置
    let width = this.state.width;
    let height = this.state.height;
    let halfWidth = width / 2;
    let halfHeight = height / 2;
    let halfControlSize = this.resizeControlSize / 2;
    let resizeControlConfig: Array<any> = [
      {
        direction: 'xy', //可以移动的坐标轴
        quadrant: 2, //在组件本地坐标轴中的象限 @see ResizeControl
        position: [-halfControlSize, -halfControlSize],
      },
      {
        direction: 'y',
        quadrant: 5,
        position: [halfWidth - halfControlSize, -halfControlSize],
      },
      {
        direction: 'xy',
        quadrant: 1,
        position: [width - halfControlSize, -halfControlSize],
      },
      {
        direction: 'x',
        quadrant: 8,
        position: [width - halfControlSize, halfHeight - halfControlSize],
      },
      {
        direction: 'xy',
        quadrant: 4,
        position: [width - halfControlSize, height - halfControlSize],
      },
      {
        direction: 'y',
        quadrant: 6,
        position: [halfWidth - halfControlSize, height - halfControlSize],
      },
      {
        direction: 'xy',
        quadrant: 3,
        position: [-halfControlSize, height - halfControlSize],
      },
      {
        direction: 'x',
        quadrant: 7,
        position: [-halfControlSize, halfHeight - halfControlSize],
      },
    ];

    this.resizeControlInstanceCache = [];
    for (let i = 0; i < resizeControlConfig.length; i++) {
      const controlConfig = resizeControlConfig[i];
      const handleInstance = new ResizeControl({
        zIndex: bigZIndexNum + 2,
        display: false,
        left: controlConfig.position[0],
        top: controlConfig.position[1],
        width: this.resizeControlSize,
        height: this.resizeControlSize,
        //TODO: style 放到 props 中去变成可配置的参数
        style: {
          strokeStyle: '#8b0000',
          fillStyle: '#CC3300',
          lineWidth: 1,
        },
        direction: controlConfig.direction,
        quadrant: controlConfig.quadrant,
      });

      this.addChild(handleInstance);
      this.resizeControlInstanceCache.push(handleInstance);
    }

    // 创建 1 个 RotateControl
    let left = this.state.width / 2 - this.rotateControlSize;
    let top = -this.rotateControlffsetY;
    this.rotateControlInstance = new RotateControl({
      zIndex: bigZIndexNum + 3,
      display: false,
      left: left,
      top: top,
      radius: this.rotateControlSize,
      //TODO: style 放到 props 中去变成可配置的参数
      style: {
        strokeStyle: '#8b0000',
        fillStyle: '#CC3300',
        lineWidth: 1,
      },
    });
    this.addChild(this.rotateControlInstance);
  }

  protected initEvents(): void {
    super.initEvents();
    this.on(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE, this.resizeEvtHandler, this);
    this.on(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE, this.rotateEvtHandler, this);
  }

  public enable() {
    this.rotateControlInstance.setState({ display: true });
    for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
      const item = this.resizeControlInstanceCache[i];
      item.setState({ display: true });
    }
    this.setState({ display: true });
    this.resume(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE);
    this.resume(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE);
  }

  public disable() {
    this.rotateControlInstance.setState({ display: false });
    for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
      const item = this.resizeControlInstanceCache[i];
      item.setState({ display: false });
    }
    this.setState({ display: false });
    this.suspend(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE);
    this.suspend(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE);
  }

  protected setControlPositions() {
    //重新计算所有 ResizeControl 的位置，共8个
    let width = this.state.width;
    let height = this.state.height;
    let halfWidth = width / 2;
    let halfHeight = height / 2;
    let halfControlSize = this.resizeControlSize / 2;

    for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
      const resizeControl = this.resizeControlInstanceCache[i];
      let quadrant = resizeControl.state.quadrant;
      let point = [0, 0];
      switch (quadrant) {
        case 1:
          point = [width - halfControlSize, -halfControlSize];
          break;
        case 2:
          point = [-halfControlSize, -halfControlSize];
          break;
        case 3:
          point = [-halfControlSize, height - halfControlSize];
          break;
        case 4:
          point = [width - halfControlSize, height - halfControlSize];
          break;
        case 5:
          point = [halfWidth - halfControlSize, -halfControlSize];
          break;
        case 6:
          point = [halfWidth - halfControlSize, height - halfControlSize];
          break;
        case 7:
          point = [-halfControlSize, halfHeight - halfControlSize];
          break;
        case 8:
          point = [width - halfControlSize, halfHeight - halfControlSize];
          break;
        default:
          break;
      }
      resizeControl.setState({
        left: point[0],
        top: point[1],
      });
    }

    //重新计算 RotateControl 的位置
    let left = this.state.width / 2 - this.rotateControlSize;
    let top = -this.rotateControlffsetY;
    this.rotateControlInstance.setState({ left, top });
  }

  private rotateEvtHandler(evt: any) {
    if (!this.targetComponent) {
      return;
    }
    let { rotate } = this.state.transform;
    this.targetComponent.setGlobalRotate(rotate);
  }

  private resizeEvtHandler(evt: any) {
    if (!this.targetComponent) {
      return;
    }

    let { quadrant } = evt;
    let movementX = evt.movementX;
    let movementY = evt.movementY;
    let targetState = this.targetComponent.state;
    let newLeft = targetState.left;
    let newTop = targetState.top;
    let newWidth = targetState.width;
    let newHeight = targetState.height;

    let matrix = mat2d.invert([], targetState.absoluteLinearMatrix);
    let point = vec2.transformMat2d([], [movementX, movementY], matrix);
    movementX = point[0];
    movementY = point[1];

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

    this.targetComponent.setState({
      left: newLeft,
      top: newTop,
      width: Math.abs(newWidth),
      height: Math.abs(newHeight),
    });
  }

  protected updatePanel() {
    if (this.targetComponent) {
      let angle = this.targetComponent.getRotateAngle();
      let { left, top, width, height } = this.targetComponent.getLocalLeftTop();
      this.setState({
        left,
        top,
        width,
        height,
        transform: {
          rotate: angle,
        },
      });
    }
  }

  public set targetComponent(component: ICEComponent) {
    this._targetComponent && this._targetComponent.off(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.updatePanel, this);
    this._targetComponent = component;
    this._targetComponent.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.updatePanel, this);
    this.updatePanel();
  }

  public get targetComponent(): ICEComponent {
    return this._targetComponent;
  }

  /**
   * 交换两个 Control 的象限
   * @param control
   * @param quadrant
   */
  public toggleControlQuadrant(control, quadrant: number): void {
    //1-3可以交换，2-4可以交换，5-6可以交换，7-8可以交换
    for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
      const item = this.resizeControlInstanceCache[i];
      if (item.state.quadrant === quadrant) {
        let tempQuadrant = 0;
        switch (quadrant) {
          case 1:
            tempQuadrant = 3;
            break;
          case 2:
            tempQuadrant = 4;
            break;
          case 3:
            tempQuadrant = 1;
            break;
          case 4:
            tempQuadrant = 2;
            break;
          case 5:
            tempQuadrant = 6;
            break;
          case 6:
            tempQuadrant = 5;
            break;
          case 7:
            tempQuadrant = 8;
            break;
          case 8:
            tempQuadrant = 7;
            break;
          default:
            break;
        }
        item.setState({
          quadrant: tempQuadrant,
        });
      }
    }

    control.setState({ quadrant: quadrant });
  }
}
