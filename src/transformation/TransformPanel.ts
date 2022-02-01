import ICEMatrix from '../geometry/ICEMatrix';
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
    super({ ...props, transformable: false, zIndex: Number.MAX_VALUE });
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
    let counter = 1;
    this.scaleHandleInstanceCache = [];
    this.scaleHandleConfig.forEach((handleConfig) => {
      const handleInstance = new ScaleControl({
        zIndex: Number.MAX_VALUE - counter++,
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
      zIndex: Number.MAX_VALUE - counter++,
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

    let { rotate } = this.state.transform;
    // if (this.targetComponent.parentNode) {
    //   //在存在 N 层嵌套的情况下，减掉所有父层叠加起来的旋转角。
    //   //FIXME:所有父层的旋转抵消掉还不够，因为原点和旋转导致的位移没有消除。
    //   let matrix = this.targetComponent.parentNode.state.absoluteLinearMatrix;
    //   let angle = ICEMatrix.calcRotateAngle(matrix);
    //   rotate -= angle;
    // }

    this.targetComponent.setState({
      transform: {
        rotate: rotate,
      },
    });
  }

  public movePosition(tx: number, ty: number, evt?: any): void {
    super.movePosition(tx, ty, evt);
    if (this.targetComponent) {
      if (this.targetComponent.parentNode) {
        //如果组件存在嵌套，需要先用逆矩阵抵消 transform 导致的坐标偏移。
        //FIXME:为什么直接放在 canvas 上的组件不需要乘以逆矩阵？能否让处理方式保持一致，方便理解？
        let point = new DOMPoint(tx, ty);
        let matrix = this.targetComponent.state.absoluteLinearMatrix;
        matrix = matrix.inverse();
        point = point.matrixTransform(matrix);
        tx = point.x;
        ty = point.y;
      }
      this.targetComponent.movePosition(tx, ty, evt);
    }
  }

  public set targetComponent(component: ICEComponent) {
    this._targetComponent = component;
    if (component) {
      //根据变换矩阵反过来计算旋转角
      let matrix = component.state.absoluteLinearMatrix;
      let angle = ICEMatrix.calcRotateAngle(matrix);

      let box = component.getMinBoundingBox();
      let width = box.width;
      let height = box.height;
      let left = box.centerX - box.width / 2;
      let top = box.centerY - box.height / 2;
      if (component.parentNode) {
        //存在嵌套的情况下，组件的原点会被设置为父组件的几何中点 Component.calcAbsoluteOrigin()
        //这里需要计算组件自身的几何中点在相对于父层坐标系进行 transform 之后的全局坐标
        let x = 0 - component.state.globalOrigin.x + component.state.width / 2;
        let y = 0 - component.state.globalOrigin.y + component.state.height / 2;
        let cm = component.state.composedMatrix;
        let p = new DOMPoint(x, y);
        p = p.matrixTransform(cm);
        left = p.x - box.width / 2;
        top = p.y - box.height / 2;
      }
      console.log(box);
      console.log(left, top, width, height);
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
