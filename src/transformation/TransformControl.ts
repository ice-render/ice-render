import ICEGroup from '../graphic/container/ICEGroup';
import RotateControl from './RotateControl';
import ScaleControl from './ScaleControl';

/**
 * @class TransformControl 变换操作手柄
 * - TransformControl 不能单独存在，只能附属于某个组件之上。
 * - TransformControl 总是直接画在 canvas 上，不是任何组件的孩子。
 * - TransformControl 是全局单例的，在任意时刻，不可能同时出现多个 TransformControl 的实例。
 *
 * TODO: 对于不同的手柄鼠标显示成不同的外观
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class TransformControl extends ICEGroup {
  private scaleHandleInstanceCache = [];
  private rotateHandleInstance;
  private scaleHandleSize: number = 15;
  private rotateHandleSize: number = 8;
  private rotateHandleOffsetY: number = 60; //offset in y axis.
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
    super(props);
    this.initTransformationHandles();
    // this.calcHandlePosition();
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
   * 计算缩放手柄坐标位置，相对于父组件的本地坐标系。
   * @returns
   */
  private calcScaleHandlePositions(): any {
    let width = this.state.width;
    let height = this.state.height;
    let halfWidth = width / 2;
    let halfHeight = height / 2;
    let halfHandleSize = this.scaleHandleSize / 2;
    let result = {
      tl: new DOMPoint(-halfHandleSize, -halfHandleSize),
      t: new DOMPoint(halfWidth - halfHandleSize, -halfHandleSize),
      tr: new DOMPoint(width - halfHandleSize, -halfHandleSize),
      r: new DOMPoint(width - halfHandleSize, halfHeight - halfHandleSize),
      rb: new DOMPoint(width - halfHandleSize, height - halfHandleSize),
      b: new DOMPoint(halfWidth - halfHandleSize, height - halfHandleSize),
      lb: new DOMPoint(-halfHandleSize, height - halfHandleSize),
      l: new DOMPoint(-halfHandleSize, halfHeight - halfHandleSize),
    };
    return result;
  }

  /**
   * 计算旋转手柄坐标位置，相对于父组件的本地坐标系。
   * @returns
   */
  private calcRotateHandlePosition(): any {
    let left = this.state.width / 2 - this.rotateHandleSize;
    let top = -this.rotateHandleOffsetY;

    let point = new DOMPoint(left, top);
    return point;
  }

  /**
   * 设置所有手柄在父组件中的位置，相对于父组件的本地坐标系。
   */
  public calcHandlePosition() {
    let position = this.calcScaleHandlePositions();
    this.scaleHandleInstanceCache.forEach((handle) => {
      let point = position[handle.props.position];
      handle.setState({
        left: point.x,
        top: point.y,
      });
    });

    let point = this.calcRotateHandlePosition();
    this.rotateHandleInstance.setState({
      left: point.x,
      top: point.y,
    });
  }

  protected renderChildren(): void {
    this.calcHandlePosition();
    super.renderChildren();
  }
}
