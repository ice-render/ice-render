import ICEComponent from '../../graphic/ICEComponent';
import ICEControlPanel from '../ICEControlPanel';
import ResizeControl from './ResizeControl';
import RotateControl from './RotateControl';

/**
 * @class TransformControlPanel 变换操作工具集成面板。
 *
 * - TransformControlPanel 本身总是直接画在 canvas 上，不是任何组件的孩子。
 * - TransformControlPanel 是全局单例，在任意时刻，不可能同时出现多个 TransformControlPanel 的实例，因为在图形化的用户交互模式下，用户无法同时操控多个控制面板。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class TransformControlPanel extends ICEControlPanel {
  private rotateHandleInstance;
  private rotateHandleSize: number = 8; //TODO:改成可配置参数
  private rotateHandleOffsetY: number = 60; //TODO:改成可配置参数
  private resizeHandleInstanceCache = [];
  private resizeHandleSize: number = 16; //TODO:改成可配置参数
  private resizeHandleConfig: Array<any> = [
    {
      position: 'tl',
    },
    {
      position: 't',
    },
    {
      position: 'tr',
    },
    {
      position: 'r',
    },
    {
      position: 'rb',
    },
    {
      position: 'b',
    },
    {
      position: 'lb',
    },
    {
      position: 'l',
    },
  ];

  constructor(props) {
    super({ ...props, zIndex: Number.MAX_VALUE });
    this.initControls();
    this.initEvents();
  }

  /**
   * 添加尺寸和旋转变换手柄，初始化时添加在内部的[0,0]位置，此方法只创建对象实例，不执行渲染操作。
   * TODO:添加斜切手柄？
   */
  protected initControls(): void {
    // 6 个调整尺寸的手柄
    let counter = 1;
    this.resizeHandleInstanceCache = [];
    this.resizeHandleConfig.forEach((handleConfig) => {
      const handleInstance = new ResizeControl({
        zIndex: Number.MAX_VALUE - counter++,
        left: 0,
        top: 0,
        width: this.resizeHandleSize,
        height: this.resizeHandleSize,
        //TODO: style 放到 props 中去变成可配置的参数
        style: {
          strokeStyle: '#8b0000',
          fillStyle: '#CC3300',
          lineWidth: 1,
        },
        position: handleConfig.position,
      });

      this.addChild(handleInstance);
      this.resizeHandleInstanceCache.push(handleInstance);
    });

    // 1 个旋转手柄
    const rotateHandleInstance = new RotateControl({
      zIndex: Number.MAX_VALUE - counter++,
      left: 0,
      top: 0,
      radius: this.rotateHandleSize,
      //TODO: style 放到 props 中去变成可配置的参数
      style: {
        strokeStyle: '#8b0000',
        fillStyle: '#CC3300',
        lineWidth: 1,
      },
    });
    this.addChild(rotateHandleInstance);
    this.rotateHandleInstance = rotateHandleInstance;
  }

  protected initEvents(): void {
    this.on('after-resize', this.resizeEvtHandler, this);
    this.on('after-rotate', this.rotateEvtHandler, this);
  }

  /**
   * 设置所有手柄在父组件中的位置，相对于父组件的本地坐标系。
   */
  protected setControlPositions() {
    //计算8个尺寸手柄坐标位置
    let width = this.state.width;
    let height = this.state.height;
    let halfWidth = width / 2;
    let halfHeight = height / 2;
    let halfHandleSize = this.resizeHandleSize / 2;
    let position = {
      tl: new DOMPoint(-halfHandleSize, -halfHandleSize),
      t: new DOMPoint(halfWidth - halfHandleSize, -halfHandleSize),
      tr: new DOMPoint(width - halfHandleSize, -halfHandleSize),
      r: new DOMPoint(width - halfHandleSize, halfHeight - halfHandleSize),
      rb: new DOMPoint(width - halfHandleSize, height - halfHandleSize),
      b: new DOMPoint(halfWidth - halfHandleSize, height - halfHandleSize),
      lb: new DOMPoint(-halfHandleSize, height - halfHandleSize),
      l: new DOMPoint(-halfHandleSize, halfHeight - halfHandleSize),
    };
    this.resizeHandleInstanceCache.forEach((handle) => {
      let point = position[handle.props.position];
      handle.setState({
        left: point.x,
        top: point.y,
      });
    });

    //计算旋转手柄坐标位置。
    let left = this.state.width / 2 - this.rotateHandleSize;
    let top = -this.rotateHandleOffsetY;
    let point = new DOMPoint(left, top);
    this.rotateHandleInstance.setState({
      left: point.x,
      top: point.y,
    });
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

    let position = evt.position;
    let movementX = evt.movementX / window.devicePixelRatio;
    let movementY = evt.movementY / window.devicePixelRatio;
    let targetState = this.targetComponent.state;
    let newLeft = targetState.left;
    let newTop = targetState.top;
    let newWidth = targetState.width;
    let newHeight = targetState.height;

    //用 parentNode 的逆矩阵把全局坐标系中的移动量转换为组件本地的移动量。
    //组件自身的 absoluteLinearMatrix 已经包含了所有层级上的 transform 。
    let matrix = targetState.absoluteLinearMatrix.inverse();
    let point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
    movementX = point.x;
    movementY = point.y;

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

    this.targetComponent.setState({
      left: newLeft,
      top: newTop,
      width: Math.abs(newWidth),
      height: Math.abs(newHeight),
    });
  }

  public set targetComponent(component: ICEComponent) {
    this._targetComponent = component;
    if (component) {
      let angle = component.getRotateAngle();
      let { left, top, width, height } = component.getLocalLeftTop();
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
