import ICEMatrix from '../../geometry/ICEMatrix';
import ICEComponent from '../../graphic/ICEComponent';
import ICEControlPanel from '../ICEControlPanel';
import { default as LineControl } from './LineControl';

/**
 * FIXME:线条控制面板内部的操作工具需要全屏幕自由移动位置，操作工具位置不固定，也不影响 LineControlPanel 本身的位置和尺寸， LineControlPanel 只作为空的逻辑容器存在。
 *
 * @class LineControlPanel 变换操作工具集成面板。
 *
 * - LineControlPanel 本身总是直接画在 canvas 上，不是任何组件的孩子。
 * - LineControlPanel 是全局单例，在任意时刻，不可能同时出现多个 LineControlPanel 的实例，因为在图形化的用户交互模式下，用户无法同时操控多个控制面板。
 * - LineControlPanel 具有的功能：1、移动线条的位置；2、调整线条起点和终点的位置；3、将线条连接到其它组件上。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class LineControlPanel extends ICEControlPanel {
  private controlSize: number = 16; //TODO:改成可配置参数
  private startPointControl: LineControl;
  private endPointControl: LineControl;

  constructor(props) {
    super({ ...props, zIndex: Number.MAX_VALUE });
    this.initControls();
    this.initEvents();
  }

  protected initControls(): void {
    let counter = 1;

    this.startPointControl = new LineControl({
      zIndex: Number.MAX_VALUE - counter++,
      left: 0,
      top: 0,
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
    this.addChild(this.startPointControl);

    this.endPointControl = new LineControl({
      zIndex: Number.MAX_VALUE - counter++,
      left: 0,
      top: 0,
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
    this.addChild(this.endPointControl);
  }

  protected initEvents(): void {
    this.on('after-move', this.moveEvtHandler, this);
  }

  /**
   * 设置所有手柄在父组件中的位置，相对于父组件的本地坐标系。
   */
  protected setControlPositions() {
    if (this.targetComponent) {
      let targetState = this.targetComponent.state;
      let startPoint = new DOMPoint(targetState.startPoint[0], targetState.startPoint[1]);
      let endPoint = new DOMPoint(targetState.endPoint[0], targetState.endPoint[1]);

      let targetMatrix = this.targetComponent.state.composedMatrix;
      startPoint = startPoint.matrixTransform(targetMatrix);
      endPoint = endPoint.matrixTransform(targetMatrix);

      let thisMatrix = this.state.composedMatrix.inverse();
      startPoint = startPoint.matrixTransform(thisMatrix);
      endPoint = endPoint.matrixTransform(thisMatrix);

      this.startPointControl.setState({
        left: startPoint.x,
        top: startPoint.y,
      });

      this.endPointControl.setState({
        left: endPoint.x,
        top: endPoint.y,
      });
    } else {
      let width = this.state.width;
      let height = this.state.height;
      let halfControlSize = this.controlSize / 2;

      this.startPointControl.setState({
        left: -halfControlSize,
        top: -halfControlSize,
      });

      this.endPointControl.setState({
        left: width - halfControlSize,
        top: height - halfControlSize,
      });
    }
  }

  private moveEvtHandler(evt: any) {
    // console.log('LineControlPanel move...');
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
        newStartX -= movementX;
        newStartY -= movementY;
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
      //step-1: 根据变换矩阵反过来计算当前旋转角度
      let matrix = component.state.absoluteLinearMatrix;
      let angle = ICEMatrix.calcRotateAngle(matrix);

      //step-2: 计算变换之后左上角 left/top 的坐标
      let box = component.getMinBoundingBox();
      let width = box.width;
      let height = box.height;
      let left = box.centerX;
      let top = box.centerY;

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

  public get targetComponent(): ICEComponent {
    return this._targetComponent;
  }
}
