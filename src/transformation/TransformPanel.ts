import ICEGroup from '../graphic/container/ICEGroup';
import ICEComponent from '../graphic/ICEComponent';
import RotateControl from './RotateControl';
import ScaleControl from './ScaleControl';

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
  private scaleHandleInstanceCache = [];
  private rotateHandleInstance;
  private scaleHandleSize: number = 16; //TODO:改成可配置参数
  private rotateHandleSize: number = 8; //TODO:改成可配置参数
  private rotateHandleOffsetY: number = 60; //TODO:改成可配置参数
  private scaleHandleConfig: Array<any> = [
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
    super({ ...props, transformable: false });
    this.initTransformationHandles();
    this.on('after-scale', this.scaleEvtHandler, this);
    this.on('after-rotate', this.rotateEvtHandler, this);
  }

  /**
   * 添加缩放和旋转变换手柄，初始化时添加在内部的[0,0]位置，此方法只创建对象实例，不执行渲染操作。
   * TODO:添加斜切手柄？
   */
  private initTransformationHandles() {
    // 6 个缩放手柄
    this.scaleHandleInstanceCache = [];
    this.scaleHandleConfig.forEach((handleConfig) => {
      const handleInstance = new ScaleControl({
        transformable: false,
        host: this,
        left: 0,
        top: 0,
        width: this.scaleHandleSize,
        height: this.scaleHandleSize,
        //TODO: style 放到 props 中去变成可配置的参数
        style: {
          strokeStyle: '#8b0000',
          fillStyle: '#CC3300',
          lineWidth: 1,
        },
        position: handleConfig.position,
      });

      this.addChild(handleInstance);
      this.scaleHandleInstanceCache.push(handleInstance);
    });

    // 1 个旋转手柄
    const rotateHandleInstance = new RotateControl({
      transformable: false,
      host: this,
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
    //计算8个缩放手柄坐标位置
    let width = this.state.width;
    let height = this.state.height;
    let halfWidth = width / 2;
    let halfHeight = height / 2;
    let halfHandleSize = this.scaleHandleSize / 2;
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
    this.scaleHandleInstanceCache.forEach((handle) => {
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

  private scaleEvtHandler(evt: any) {
    if (!this.targetComponent) {
      return;
    }
    const { width, height } = this.state;
    //FIXME:这里的计算方法看起来有问题，skew 参数也可能导致 width/height 发生变化，这里看起来还是需要进行矩阵变换。
    const targetWidth = this.targetComponent.props.width;
    const targetHeight = this.targetComponent.props.height;
    const scaleX = width / targetWidth;
    const scaleY = height / targetHeight;
    this.targetComponent.setState({
      transform: {
        scale: [scaleX, scaleY],
      },
    });
  }

  private rotateEvtHandler(evt: any) {
    if (!this.targetComponent) {
      return;
    }
    const { rotate } = this.state.transform;
    this.targetComponent.setState({
      transform: {
        rotate: rotate,
      },
    });
  }

  public movePosition(tx: number, ty: number, evt?: any): void {
    super.movePosition(tx, ty, evt);
    if (this.targetComponent) {
      this.targetComponent.movePosition(tx, ty, evt);
    }
  }

  public set targetComponent(component: ICEComponent) {
    this._targetComponent = component;
    if (component) {
      let translateMatrix = component.state.absoluteTranslateMatrix;
      let box = component.getMinBoundingBox();
      let angle = component.state.transform.rotate;
      this.setState({
        left: translateMatrix.e,
        top: translateMatrix.f,
        width: box.width,
        height: box.height,
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
