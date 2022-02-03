import ICEMatrix from '../geometry/ICEMatrix';
import ICEGroup from '../graphic/container/ICEGroup';
import ICEComponent from '../graphic/ICEComponent';
import ResizeControl from './ResizeControl';
import RotateControl from './RotateControl';

/**
 * @class TransformPanel 变换操作工具集成面板。
 *
 * - TransformPanel 只跟随目标对象的 width/height/rotate 这3个参数，其它所有参数都不跟随。
 * - TransformPanel 总是直接画在 canvas 上，不是任何组件的孩子。
 * - TransformPanel 是全局单例的，在任意时刻，不可能同时出现多个 TransformPanel 的实例，因为在用户交互状态下，同时出现多个 TransformPanel 没有意义。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class TransformPanel extends ICEGroup {
  private _targetComponent;
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
    super({ ...props, transformable: false, zIndex: Number.MAX_VALUE });
    this.initTransformationHandles();
    this.on('after-resize', this.resizeEvtHandler, this);
    this.on('after-rotate', this.rotateEvtHandler, this);
  }

  /**
   * 添加尺寸和旋转变换手柄，初始化时添加在内部的[0,0]位置，此方法只创建对象实例，不执行渲染操作。
   * TODO:添加斜切手柄？
   */
  private initTransformationHandles() {
    // 6 个调整尺寸的手柄
    let counter = 1;
    this.resizeHandleInstanceCache = [];
    this.resizeHandleConfig.forEach((handleConfig) => {
      const handleInstance = new ResizeControl({
        zIndex: Number.MAX_VALUE - counter++,
        transformable: false,
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
      transformable: false,
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

  /**
   * 设置所有手柄在父组件中的位置，相对于父组件的本地坐标系。
   */
  public calcControlPositions() {
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

  protected renderChildren(): void {
    this.calcControlPositions();
    super.renderChildren();
  }

  private resizeEvtHandler(evt: any) {
    if (!this.targetComponent) {
      return;
    }

    let movementX = evt.movementX / window.devicePixelRatio;
    let movementY = evt.movementY / window.devicePixelRatio;

    if (this.targetComponent.parentNode) {
      let matrix = this.targetComponent.parentNode.state.absoluteLinearMatrix.inverse();
      let point = new DOMPoint(movementX, movementY);
      point = point.matrixTransform(matrix);
      movementX = point.x;
      movementY = point.y;
    }

    let { width, height } = this.targetComponent.state;
    width += 2 * movementX;
    height += 2 * movementY;

    this.targetComponent.setState({
      width: Math.abs(width),
      height: Math.abs(height),
    });
  }

  private rotateEvtHandler(evt: any) {
    if (!this.targetComponent) {
      return;
    }
    let { rotate } = this.state.transform;
    this.targetComponent.setGlobalRotate(rotate);
  }

  public moveGlobalPosition(tx: number, ty: number, evt?: any): void {
    super.moveGlobalPosition(tx, ty, evt);
    if (this.targetComponent) {
      this.targetComponent.moveGlobalPosition(tx, ty, evt);
    }
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
      let left = box.centerX - box.width / 2;
      let top = box.centerY - box.height / 2;

      this.setState({
        left,
        top,
        width,
        height,
        transform: {
          rotate: angle,
        },
      });
    } else {
      //FIXME:component 为空时隐藏 TransformPanel
    }
  }

  public get targetComponent(): ICEComponent {
    return this._targetComponent;
  }
}
