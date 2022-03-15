/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEBaseComponent from '../../graphic/ICEBaseComponent';
import ICELinkHook from '../../graphic/linkable/ICELinkHook';
import ICEControlPanel from '../ICEControlPanel';

/**
 *
 * FIXME: 当组件移动位置是， LineControlPanel 不需要跟随移动，始终保持在左上角即可。
 *
 * @class LineControlPanel
 *
 * 线条变换控制面板
 *
 * LineControlPanel 只作为空的逻辑容器存在，控制面板内部的操作手柄需要全屏幕自由移动位置，手柄位置不固定，对 LineControlPanel 本身的参数完全没有影响。
 *
 * LineControlPanel 功能：
 *
 * - 移动线条的位置
 * - 调整线条起点和终点的位置
 * - 将线条连接到其它组件上
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class LineControlPanel extends ICEControlPanel {
  private controlSize: number = 16; //TODO:改成可配置参数
  private startControl: ICELinkHook;
  private endControl: ICELinkHook;

  constructor(props) {
    super({ ...props, zIndex: Number.MAX_VALUE, showMinBoundingBox: false, showMaxBoundingBox: false });
    this.initControls();
  }

  protected initControls(): void {
    let counter = 1;
    let width = this.state.width;
    let height = this.state.height;
    let halfControlSize = this.controlSize / 2;

    this.startControl = new ICELinkHook({
      zIndex: Number.MAX_VALUE - counter++,
      display: false,
      left: -halfControlSize,
      top: -halfControlSize,
      width: this.controlSize,
      height: this.controlSize,
      //TODO: style 放到 props 中去变成可配置的参数
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
      position: 'start',
    });
    this.addChild(this.startControl);

    this.endControl = new ICELinkHook({
      zIndex: Number.MAX_VALUE - counter++,
      display: false,
      left: width - halfControlSize,
      top: height - halfControlSize,
      width: this.controlSize,
      height: this.controlSize,
      //TODO: style 放到 props 中去变成可配置的参数
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
      position: 'end',
    });
    this.addChild(this.endControl);
  }

  protected initEvents(): void {
    this.on('after-resize', this.resizeEvtHandler, this);
  }

  public enable() {
    this.setState({ display: true });
    this.resume('after-resize');
    this.showHooks();
  }

  public disable() {
    this.setState({ display: false });
    this.suspend('after-resize');
    this.hideHooks();
  }

  /**
   * 设置所有手柄在父组件中的位置，相对于父组件的本地坐标系。
   * LineControlPanel 不强制操作手柄的位置，操作手柄可以自由移动。
   */
  protected setControlPositions() {}

  private resizeEvtHandler(evt: any) {
    if (!this.targetComponent) {
      return;
    }

    let position = evt.position;
    let movementX = evt.movementX;
    let movementY = evt.movementY;
    let targetState = this.targetComponent.state;
    let len = targetState.points.length;
    let newStartX = targetState.points[0][0];
    let newStartY = targetState.points[0][1];
    let newEndX = targetState.points[len - 1][0];
    let newEndY = targetState.points[len - 1][1];

    //用逆矩阵补偿组件 transform 导致的坐标变换。
    //组件自身的 absoluteLinearMatrix 已经包含了所有层级上的 transform 。
    let matrix = targetState.absoluteLinearMatrix.inverse();
    let point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
    movementX = point.x;
    movementY = point.y;

    switch (position) {
      case 'start':
        newStartX += movementX;
        newStartY += movementY;
        break;
      case 'end':
        newEndX += movementX;
        newEndY += movementY;
        break;
      default:
        break;
    }

    this.targetComponent.setState({
      startPoint: [newStartX, newStartY],
      endPoint: [newEndX, newEndY],
    });
  }

  protected updatePosition() {
    if (this.targetComponent) {
      //ICEPolyLine 的处理方式与其它组件不同，这里 LineControPanel 本身的外观不重要，只要变换手柄能自由移动就可以
      //设置 LineControlPanel 自身的位置
      this.setState({
        left: 0,
        top: -5,
        width: 3,
        height: 3,
        transform: {
          translate: [0, 0],
          scale: [1, 1],
          skew: [0, 0],
          rotate: 0, //degree
        },
      });

      //设置 LineControlPanel 内部手柄的位置
      let halfControlSize = this.controlSize / 2;
      let len = this.targetComponent.state.points.length;
      let start = this.targetComponent.state.points[0];
      let end = this.targetComponent.state.points[len - 1];
      let startPoint = new DOMPoint(start[0], start[1]);
      let endPoint = new DOMPoint(end[0], end[1]);
      this.startControl.setState({
        left: startPoint.x - halfControlSize,
        top: startPoint.y - halfControlSize,
      });
      this.endControl.setState({
        left: endPoint.x - halfControlSize,
        top: endPoint.y - halfControlSize,
      });
    }
  }

  public set targetComponent(component: ICEBaseComponent) {
    this._targetComponent = component;
    if (component) {
      this.updatePosition();
      component.on('after-move', this.updatePosition, this);
    } else {
      component.off('after-move', this.updatePosition, this);
    }
  }

  public get targetComponent(): ICEBaseComponent {
    return this._targetComponent;
  }

  public showHooks() {
    this.startControl.setState({ display: true });
    this.endControl.setState({ display: true });
  }

  public hideHooks() {
    this.startControl.setState({ display: false });
    this.endControl.setState({ display: false });
  }
}
