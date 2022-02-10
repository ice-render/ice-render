import ICEComponent from '../../graphic/ICEComponent';
import ICEControlPanel from '../ICEControlPanel';
import { default as LineControl } from './LineControl';

/**
 *
 * FIXME: LineControlPanel 不需要跟随组件移动位置。
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
  private startControl: LineControl;
  private endControl: LineControl;

  constructor(props) {
    super({ ...props, zIndex: Number.MAX_VALUE });
    this.initControls();
    this.initEvents();
  }

  protected initControls(): void {
    let counter = 1;
    let width = this.state.width;
    let height = this.state.height;
    let halfControlSize = this.controlSize / 2;

    this.startControl = new LineControl({
      zIndex: Number.MAX_VALUE - counter++,
      left: -halfControlSize,
      top: -halfControlSize,
      width: this.controlSize,
      height: this.controlSize,
      //TODO: style 放到 props 中去变成可配置的参数
      style: {
        strokeStyle: '#8b0000',
        fillStyle: '#CC3300',
        lineWidth: 1,
      },
      position: 'start',
    });
    this.addChild(this.startControl);

    this.endControl = new LineControl({
      zIndex: Number.MAX_VALUE - counter++,
      left: width - halfControlSize,
      top: height - halfControlSize,
      width: this.controlSize,
      height: this.controlSize,
      //TODO: style 放到 props 中去变成可配置的参数
      style: {
        strokeStyle: '#8b0000',
        fillStyle: '#CC3300',
        lineWidth: 1,
      },
      position: 'end',
    });
    this.addChild(this.endControl);
  }

  protected initEvents(): void {
    this.on('after-resize', this.resizeEvtHandler, this);
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
    let movementX = evt.movementX / window.devicePixelRatio;
    let movementY = evt.movementY / window.devicePixelRatio;
    let targetState = this.targetComponent.state;
    let newStartX = targetState.startPoint[0];
    let newStartY = targetState.startPoint[1];
    let newEndX = targetState.endPoint[0];
    let newEndY = targetState.endPoint[1];

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

  public set targetComponent(component: ICEComponent) {
    this._targetComponent = component;

    if (component) {
      //ICELine 的处理方式与其它组件不同，这里 LineControPanel 本身的外观不重要，只要变换手柄能自由移动就可以
      //设置 LineControlPanel 自身的位置
      this.setState({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        transform: {
          translate: [0, 0],
          scale: [1, 1],
          skew: [0, 0],
          rotate: 0, //degree
        },
      });

      //设置 LineControlPanel 内部手柄的位置
      let halfControlSize = this.controlSize / 2;
      let start = component.state.startPoint;
      let end = component.state.endPoint;
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

  public get targetComponent(): ICEComponent {
    return this._targetComponent;
  }
}
