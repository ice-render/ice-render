import get from 'lodash/get';
import merge from 'lodash/merge';
import EventTarget from '../event/EventTarget';
import ICEEvent from '../event/ICEEvent';
import ICEBoundingBox from '../geometry/ICEBoundingBox';
import { ICE_CONSTS } from '../ICE_CONSTS';

/**
 * @class ICEComponent
 * 最顶级的抽象类，Canvas 内部所有组件都是它的子类。
 * @abstract
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class ICEComponent extends EventTarget {
  //当对象被添加到 canvas 中时，ICE 会自动设置 root 的值，没有被添加到 canvas 中的对象 root 为 null 。
  public root: any = null;
  //当对象被添加到 canvas 中时，ICE 会自动设置 ctx 的值，没有被添加到 canvas 中的对象 ctx 为 null 。
  public ctx: any = null;
  //所有组件都有父组件，但不一定都有子组件，只有容器型的组件才有子组件。如果父组件为 null ，说明直接添加在 canvas 中。
  public parentNode: any = null;
  //标志位，渲染器在渲染过程中会检查此标志位
  protected isRendering: boolean = false;
  //静态属性，实例计数器
  protected static instanceCounter: number = 0;

  /**
   * @cfg
   * {
   *   id: 'ICE_' + Math.floor(Math.random() * 10000000000), //全局唯一，跨机器，跨时间
   *   left: 0,    //x 坐标相对于父组件的偏移量
   *   top: 0,     //y 坐标相对于父组件的偏移量
   *   width: 0,   //原始宽度，没有经过变换
   *   height: 0,  //原始高度，没有经过变换
   *   style: { fillStyle: 'red', strokeStyle: 'blue', lineWidth: 1 },
   *   animations: {},
   *   transform: {     //组件自身的变换参数，不包含父组件
   *     translate: [0, 0],
   *     scale: [1, 1],
   *     skew: [0, 0],
   *     rotate: 0,     //角度
   *   },
   *   translationMatrix: new DOMMatrix(), //平移变换矩阵
   *   linearMatrix: new DOMMatrix(),      //线性变换矩阵，不含平移
   *   composedMatrix: new DOMMatrix(),    //复合变换矩阵，包含所有祖先节点的平移和线性变换
   *   origin: new DOMPoint(0, 0),         //组件原点坐标
   *   zIndex: ICEComponent.instanceCounter++, //类似于 CSS 中的 zIndex
   *   interactive: true, //是否可以进行用户交互操作 TODO:动画运行过程中不允许选中，不能进行交互？？？
   *   transformable: true,
   * }
   * @param props
   */
  public props: any = {
    id: 'ICE_' + Math.floor(Math.random() * 10000000000),
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    style: { fillStyle: 'red', strokeStyle: 'blue', lineWidth: 1 },
    animations: {},
    transform: {
      translate: [0, 0],
      scale: [1, 1],
      skew: [0, 0],
      rotate: 0, //degree
    },
    translationMatrix: new DOMMatrix(),
    linearMatrix: new DOMMatrix(),
    composedMatrix: new DOMMatrix(),
    origin: new DOMPoint(0, 0),
    zIndex: ICEComponent.instanceCounter++,
    draggable: true,
    transformable: true,
    selectable: true,
    interactive: true,
  };

  /**
   * 在 ICE 引擎中，所有对象都可以启用动画效果，所以对象的 state 随时可能发生变化。
   * props 与 state 之间的关系与行为模式借鉴自 React 框架，概念模型完全一致。
   * @see https://reactjs.org/docs/components-and-props.html
   */
  public state: any = { ...this.props };

  constructor(props: any = {}) {
    super();
    this.props = merge(this.props, props);
    this.state = JSON.parse(JSON.stringify(this.props));

    //FIXME:生成随机ID有问题???
    // this.props.id = 'ICE_' + sha256(Math.random() * 100000000).toString();
    //sha256(Math.random() * 100000000).toString();
  }

  /**
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   * @param newState
   */
  public setState(newState: any) {
    merge(this.state, newState);
  }

  /**
   * 相对于父组件的坐标系和原点。
   * @param left
   * @param top
   * @param evt
   */
  public setPosition(left: number, top: number, evt: any = new ICEEvent()): void {
    this.trigger('before-move', { ...evt, left, top });
    this.setState({ left, top });
    this.trigger('after-move', { ...evt, left, top });
  }

  /**
   * 相对于父组件的坐标系和原点。
   * @param tx
   * @param ty
   * @param evt
   */
  public movePosition(tx: number, ty: number, evt: any = new ICEEvent()): void {
    this.setPosition(this.state.left + tx, this.state.top + ty, { ...evt, tx, ty });
  }

  /**
   * !Important: 核心方法，FrameManager 会调度此方法进行实际的渲染操作。
   * !Important: 这些方法调用有顺序
   */
  public render(): void {
    this.isRendering = true;
    this.trigger(ICE_CONSTS.BEFORE_RENDER);

    this.applyStyle();
    this.calcOriginalDimension();
    this.setLocalOrigin('center');
    this.applyTransformToCtx();
    this.doRender();
    this.ctx.setTransform(new DOMMatrix());

    this.trigger(ICE_CONSTS.AFTER_RENDER);
    this.isRendering = false;
  }

  protected applyStyle(): void {
    Object.assign(this.ctx, { ...this.props.style, ...this.state.style });
  }

  /**
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * @returns
   */
  protected calcOriginalDimension() {
    return { width: this.state.width, height: this.state.height };
  }

  /**
   * 设置组件内部的原点坐标，相对于组件的 local 坐标系进行计算，而不是 canvas 全局坐标系。
   * 在不修改坐标原点时，ctx 的坐标原点默认放在组件的左上角位置。
   * 移动坐标原点后，组件内部所有的坐标点数值、边界盒子的坐标，都会受到影响。
   * @method setLocalOrigin
   * @param point
   */
  public setLocalOrigin(position = 'center'): void {
    let point = new DOMPoint();
    let halfWidth = this.state.width / 2;
    let halfHeight = this.state.height / 2;

    if (position === 'center') {
      point.x = halfWidth;
      point.y = halfHeight;
    }

    //如果存在父层节点，把父层节点的原点设置为当前组件的原点。
    //因为基于父层组件的中心点进行变换时，才能正确复合父层组件的变换形态。
    //本质上说，所有组件的变换都是基于父层组件的坐标系进行的，只是最顶层的组件直接放在 canvas 对象中，而 canvas 默认的左上角位置就是 (0,0) 点。
    //这里的本质是进行两个坐标系之间的映射，把组件自身的 local 坐标系原点映射到父层组件的坐标系中。
    //这里需要把坐标点看成二维向量进行理解。
    //FIXME:需要采用统一的处理机制，无论组件是否直接放在 canvas 上，都采用统一的机制。
    if (this.parentNode) {
      let tx = get(this, 'state.transform.translate.0') + this.state.left;
      let ty = get(this, 'state.transform.translate.1') + this.state.top;
      point.x = this.parentNode.state.origin.x - tx;
      point.y = this.parentNode.state.origin.y - ty;
    }

    this.state.origin = point;
  }

  /**
   * 计算平移矩阵，默认平移到组件的左上角位置。
   * @method calcTranslationMatrix
   * @returns DOMMatrix
   */
  protected calcTranslationMatrix(): DOMMatrix {
    let matrix = new DOMMatrix();

    //共有2个参数会影响 translate 坐标的计算：translate, left/top 。
    let tx = get(this, 'state.transform.translate.0') + this.state.left;
    let ty = get(this, 'state.transform.translate.1') + this.state.top;
    matrix.translateSelf(tx, ty);

    this.state.translationMatrix = matrix;
    return matrix;
  }

  /**
   * 计算线性变换矩阵，此矩阵不包含平移操作。
   * 线性变换顺序：旋转->错切->缩放
   * 由于矩阵变换有顺序，这里采用符合自然理解的顺序进行。
   * @method calcLinearMatrix
   * @returns DOMMatrix
   */
  protected calcLinearMatrix(): DOMMatrix {
    let matrix = new DOMMatrix();

    //step1: skew
    //DOMMatrix.skeXSelf 方法的参数是角度值，不是百分比。 @see https://drafts.fxtf.org/geometry/#DOMMatrix
    const skewX = get(this, 'state.transform.skew.0');
    const skewY = get(this, 'state.transform.skew.1');
    matrix.skewXSelf(skewX);
    matrix.skewYSelf(skewY);

    //step2: rotate
    let angle = get(this, 'state.transform.rotate');
    matrix.rotateSelf(angle);

    //step3: scale
    const scaleX = get(this, 'state.transform.scale.0');
    const scaleY = get(this, 'state.transform.scale.1');
    matrix.scaleSelf(scaleX, scaleY);

    this.state.linearMatrix = matrix;
    return matrix;
  }

  /**
   * 复合所有祖先节点的位移矩阵，获得相对全局 canvas 对象的位移矩阵。
   * @returns
   */
  protected calcAbsoluteTranslationMatrix() {
    let component = this;
    let matrix = DOMMatrix.fromMatrix(component.calcTranslationMatrix());
    while (component.parentNode) {
      matrix.multiplySelf(component.parentNode.state.translationMatrix);
      component = component.parentNode;
    }
    this.state.absoluteTranslateMatrix = DOMMatrix.fromMatrix(matrix);
    return matrix;
  }

  /**
   * 复合所有祖先节点的线性变换矩阵，获得相对于全局 canvas 对象的变换矩阵。
   * @returns
   */
  protected calcAbsoluteLinearMatrix() {
    let component = this;
    let matrix = DOMMatrix.fromMatrix(component.calcLinearMatrix());
    while (component.parentNode) {
      matrix.multiplySelf(component.parentNode.state.linearMatrix);
      component = component.parentNode;
    }
    this.state.absoluteLinearMatrix = DOMMatrix.fromMatrix(matrix);
    return matrix;
  }

  /**
   * 仿射变换由2步完成：
   * - ctx 平移到指定的原点。
   * - ctx 进行线性变换。
   *
   * Canvas 绘图过程中的仿射变换动作与线性代数中的规则有差异：
   * - Canvas 的 Y 坐标轴方向是向下的。
   * - Canvas 在做仿射变换时，变换的是 ctx 本身，而不是组件对象，相当于画布本身是具有弹性的可变形对象。
   *
   * @method composeMatrix
   * @returns DOMMatrix
   */
  protected composeMatrix(): DOMMatrix {
    //step-1: 计算平移变换矩阵，递归复合所有祖先节点的位移矩阵。
    let translationMatrix = this.calcAbsoluteTranslationMatrix();

    //step-2: 移动原点，因为 state.translationMatrix 中没有包含移动原点的操作。
    let moveOriginMatrix = new DOMMatrix([1, 0, 0, 1, this.state.origin.x, this.state.origin.y]);
    translationMatrix.multiplySelf(moveOriginMatrix);

    //step-3: 计算线性变换矩阵，并复合所有祖先节点的线性变换矩阵。
    let linearMatrix = this.calcAbsoluteLinearMatrix();

    let composedMatrix = translationMatrix.multiplySelf(linearMatrix);
    this.state.composedMatrix = DOMMatrix.fromMatrix(composedMatrix);
    return composedMatrix;
  }

  /**
   * 把变换矩阵应用到 this.ctx 上
   */
  protected applyTransformToCtx(): void {
    this.ctx.setTransform(this.composeMatrix());
  }

  /**
   * 所有子类都应该提供具体的实现。
   * @method doRender
   */
  protected doRender(): void {
    //For test, don't delete.
    let minBox = this.getMinBoundingBox();
    this.ctx.setTransform(new DOMMatrix());
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.fillStyle = 'rgba(0,0,0,0)';
    this.ctx.beginPath();
    this.ctx.moveTo(minBox.tl.x, minBox.tl.y);
    this.ctx.lineTo(minBox.tr.x, minBox.tr.y);
    this.ctx.lineTo(minBox.br.x, minBox.br.y);
    this.ctx.lineTo(minBox.bl.x, minBox.bl.y);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.fill();

    let maxBox = this.getMaxBoundingBox();
    this.ctx.setTransform(new DOMMatrix());
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = '#0000ff';
    this.ctx.fillStyle = 'rgba(0,0,0,0)';
    this.ctx.beginPath();
    this.ctx.moveTo(maxBox.tl.x, maxBox.tl.y);
    this.ctx.lineTo(maxBox.tr.x, maxBox.tr.y);
    this.ctx.lineTo(maxBox.br.x, maxBox.br.y);
    this.ctx.lineTo(maxBox.bl.x, maxBox.bl.y);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.fill();
  }

  /**
   * 获取组件的最小包围盒，此盒子的变换过程与组件自身完全相同。
   * @returns
   */
  public getMinBoundingBox(): ICEBoundingBox {
    let originX = this.state.origin.x;
    let originY = this.state.origin.y;
    let width = this.state.width;
    let height = this.state.height;

    let boundingBox = new ICEBoundingBox([
      0 - originX,
      0 - originY,
      width - originX,
      0 - originY,
      0 - originX,
      height - originY,
      width - originX,
      height - originY,
    ]);

    boundingBox = boundingBox.transform(this.state.composedMatrix);
    return boundingBox;
  }

  /**
   * 获取组件的最大包围盒：
   * - 盒子保持水平和竖直，不旋转、不错切。
   * - 盒子的4边在全局坐标 X/Y 轴上的投影范围与组件完全一致。
   * @returns
   */
  public getMaxBoundingBox(): ICEBoundingBox {
    let boundingBox = this.getMinBoundingBox();
    let { minX, minY, maxX, maxY } = boundingBox.getMinAndMaxPoint();
    boundingBox = new ICEBoundingBox([minX, minY, maxX, minY, minX, maxY, maxX, maxY]);
    return boundingBox;
  }

  /**
   * TODO:改成 abstract?
   * @returns
   */
  public toJSON(): string {
    return '{}';
  }

  /**
   * TODO:改成 abstract
   * @returns
   */
  public fromJSON(jsonStr: string): object {
    return {};
  }
}

export default ICEComponent;
