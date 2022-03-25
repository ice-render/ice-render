/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { glMatrix, mat2d, vec2 } from 'gl-matrix';
import merge from 'lodash/merge';
import ICE_EVENT_NAME_CONSTS from '../consts/ICE_EVENT_NAME_CONSTS';
import EventBus from '../event/EventBus';
import ICEEvent from '../event/ICEEvent';
import ICEEventTarget from '../event/ICEEventTarget';
import ICEBoundingBox from '../geometry/ICEBoundingBox';
import ICEMatrix from '../geometry/ICEMatrix';
import ICE from '../ICE';
import { getVal } from '../util/data-util';
import { skew } from '../util/gl-matrix-skew';
import { uuid } from '../util/uuid';

/**
 * @class ICEComponent
 *
 * 最顶级的抽象类，Canvas 内部所有可见的组件都是它的子类。
 *
 * @abstract
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
abstract class ICEComponent extends ICEEventTarget {
  //组件当前归属的 ICE 实例，在处理一些内部逻辑时需要引用当前所在的 ICE 实例。只有当组件被 addChild() 方法加入到显示列表中之后， ice 属性才会有值。
  public ice: ICE;
  //当对象被添加到 canvas 中时，ICE 会自动设置 root 的值，没有被添加到 canvas 中的对象 root 为 null 。
  public root: any;
  //当对象被添加到 canvas 中时，ICE 会自动设置 ctx 的值，没有被添加到 canvas 中的对象 ctx 为 null 。
  public ctx: any;
  //事件总线， evtBus 在 render() 方法被调用时才会被设置，在被渲染出来之前，evtBus 为 null 。
  public evtBus: EventBus;
  //所有组件都有父组件，但不一定都有子组件，只有容器型的组件才有子组件。如果父组件为 null ，说明直接添加在 canvas 中。
  public parentNode: any;
  //静态属性，实例计数器
  protected static instanceCounter: number = 0;

  /**
   * @cfg
   * {
   *   id: 'ICE_XXXXXXX',                                      //UUID
   *   left: 0,                                                //x 坐标相对于父组件的偏移量
   *   top: 0,                                                 //y 坐标相对于父组件的偏移量
   *   width: 0,                                               //原始宽度，没有经过变换
   *   height: 0,                                              //原始高度，没有经过变换
   *   style: { fillStyle: 'red', strokeStyle: 'blue', lineWidth: 1 },
   *   animations: {},
   *   transform: {                                            //组件自身的变换参数，不包含父组件
   *     translate: [0, 0],                                    //平移，像素
   *     scale: [1, 1],                                        //X轴缩放倍数，Y轴缩放倍数
   *     skew: [0, 0],                                         //X轴扭曲角度，Y轴扭曲角度
   *     rotate: 0,                                            //旋转角度
   *   },
   *   linearMatrix: [],                            //线性变换矩阵，不含平移，按照 gl-matrix 的格式定义
   *   composedMatrix: [],                          //复合变换矩阵，包含所有祖先节点的平移、原点移动、线性变换计算，composedMatrix 不会实时更新，如果需要获取当前最新的变换矩阵，需要调用 composeMatrix() 方法。按照 gl-matrix 的格式定义
   *   origin:'localCenter',
   *   localOrigin: [0,0],                          //相对于组件本地坐标系（组件内部的左上角为 [0,0] 点）计算的原点坐标
   *   absoluteOrigin: [0,0],                       //相对于全局坐标系（canvas 的左上角 [0,0] 点）计算的原点坐标
   *   zIndex: ICEComponent.instanceCounter++,      //类似于 CSS 中的 zIndex
   *   display:true,                                //如果 display 为 false ， Renderer 不会调用其 render 方法，对象在内存中存在，但是不会被渲染出来。如果 display 为 false ，所有子组件也不会被渲染出来。
   *   draggable:true,                              //是否可以拖动
   *   transformable:true,                          //是否可以进行变换：scale/rotate/skew ，以及 resize ，但是不控制拖动
   *   linkable:true,                               //组件是否可以用连接线连接起来，如果此状态为 true ，ICELinkSlotManager 在运行时会动态在组件上创建连接插槽 ICELinkSlot 的实例
   *   interactive: true,                           //是否可以进行用户交互操作，如果此参数为 false ， draggable, transformable TODO:动画运行过程中不允许选中，不能进行交互？？？
   *   showMinBoundingBox:true,                     //是否显示最小包围盒，开发时打开，主要用于 debug
   *   showMaxBoundingBox:true,                     //是否显示最大包围盒，开发时打开，主要用于 debug
   * }
   * @param props
   */
  public props: any = {
    id: 'ICE_' + uuid(),
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    style: { fillStyle: 'red', strokeStyle: 'blue', lineWidth: 1 },
    fill: true,
    stroke: true,
    animations: {},
    transform: {
      translate: [0, 0],
      scale: [1, 1],
      skew: [0, 0],
      rotate: 0, //degree
    },
    linearMatrix: [],
    composedMatrix: [],
    origin: 'localCenter',
    localOrigin: [0, 0],
    absoluteOrigin: [0, 0],
    zIndex: ICEComponent.instanceCounter++,
    display: true,
    draggable: true,
    transformable: true,
    interactive: true,
    linkable: true,
    showMinBoundingBox: true,
    showMaxBoundingBox: true,
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

    this.initEvents();
  }

  /**
   * 子类需要提供自己的实现。
   */
  protected initEvents() {}

  /**
   * !Important: 核心方法，FrameManager 会调度此方法进行实际的渲染操作。
   * !Important: 这些方法调用有顺序
   */
  public render(): void {
    this.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_RENDER);
    if (!this.state.display) {
      return;
    }

    this.calcComponentParams();
    this.applyStyleToCtx();
    this.applyTransformToCtx();
    this.doRender();

    this.trigger(ICE_EVENT_NAME_CONSTS.AFTER_RENDER);
  }

  protected applyStyleToCtx(): void {
    const _style = { ...this.props.style, ...this.state.style };
    for (let p in _style) {
      this.ctx[p] = _style[p];
    }
  }

  /**
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * 此方法不能依赖原点位置和 transform 矩阵。
   * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * @returns
   */
  public calcComponentParams() {
    return { width: this.state.width, height: this.state.height };
  }

  /**
   * 计算本地原点坐标，相对于组件本地坐标系。
   * 此方法依赖于 width/height ，需要先计算组件的尺寸，然后才能调用此方法。
   * @returns
   */
  protected calcLocalOrigin() {
    let point = [0, 0];
    let position = this.state.origin;
    if (!position || position === 'localCenter') {
      let halfWidth = this.state.width / 2;
      let halfHeight = this.state.height / 2;
      point[0] = halfWidth;
      point[1] = halfHeight;
    }
    //FIXME:计算原点位于其它位置的情况
    this.state.localOrigin = point;
    return point;
  }

  /**
   * 根据原点位置描述计算原点坐标值。
   * 移动坐标原点后，组件内部所有的坐标点数值、边界盒子的坐标，都会受到影响。
   * 计算出的原点数值已经包含了所有父层的移位和变换。
   * @method calcAbsoluteOrigin
   */
  public calcAbsoluteOrigin() {
    let tx = getVal(this, 'state.transform.translate.0') + this.state.left;
    let ty = getVal(this, 'state.transform.translate.1') + this.state.top;

    let point = [...this.calcLocalOrigin()];
    point[0] += tx;
    point[1] += ty;

    if (this.parentNode) {
      let pLocalX = this.parentNode.state.localOrigin[0];
      let pLocalY = this.parentNode.state.localOrigin[1];
      point = vec2.transformMat2d([], point, [1, 0, 0, 1, -pLocalX, -pLocalY]);

      let pcm = this.parentNode.state.composedMatrix;
      point = vec2.transformMat2d([], point, pcm);
    }

    this.state.absoluteOrigin = point;
    return point;
  }

  /**
   * 计算线性变换矩阵，此矩阵不包含平移操作。
   * 线性变换顺序：旋转->错切->缩放
   * 由于矩阵变换有顺序，这里采用符合自然理解的顺序进行。
   * @method calcLinearMatrix
   * @returns
   */
  protected calcLinearMatrix() {
    let matrix = mat2d.create();

    //step1: skew
    const skewX = getVal(this, 'state.transform.skew.0');
    const skewY = getVal(this, 'state.transform.skew.1');
    matrix = skew([], matrix, glMatrix.toRadian(skewX), glMatrix.toRadian(skewY));

    //step2: rotate
    let angle = getVal(this, 'state.transform.rotate');
    matrix = mat2d.rotate([], matrix, glMatrix.toRadian(angle));

    //step3: scale
    const scaleX = getVal(this, 'state.transform.scale.0');
    const scaleY = getVal(this, 'state.transform.scale.1');
    matrix = mat2d.scale([], matrix, [scaleX, scaleY]);

    this.state.linearMatrix = matrix;
    return matrix;
  }

  /**
   * 复合所有祖先节点的线性变换矩阵，获得相对于全局 canvas 对象的变换矩阵。
   * @returns
   */
  protected calcAbsoluteLinearMatrix() {
    let component = this;
    let matrix = component.calcLinearMatrix();
    while (component.parentNode) {
      matrix = mat2d.multiply([], component.parentNode.state.linearMatrix, matrix);
      component = component.parentNode;
    }
    this.state.absoluteLinearMatrix = matrix;
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
   * @returns
   */
  protected composeMatrix() {
    //step-1: 移动到指定原点（全局坐标系）。
    let origin = this.calcAbsoluteOrigin();
    let translationMatrix = [1, 0, 0, 1, origin[0], origin[1]];

    //step-2: 计算线性变换矩阵，包含了所有祖先节点的线性变换。
    let linearMatrix = this.calcAbsoluteLinearMatrix();

    //step-3: 计算综合变换矩阵，相当于先在 canvas 默认原点（左上角位置）进行变换，然后在平移到计算出的原点位置。
    let composedMatrix = mat2d.multiply([], translationMatrix, linearMatrix);
    this.state.composedMatrix = composedMatrix;
    return composedMatrix;
  }

  /**
   * 把变换矩阵应用到 this.ctx 上
   */
  protected applyTransformToCtx(): void {
    this.ctx.setTransform(...this.composeMatrix());
  }

  /**
   * 所有子类都应该提供具体的实现。
   * @method doRender
   */
  protected doRender(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.lineWidth = 1;

    if (this.state.showMinBoundingBox) {
      let minBox = this.getMinBoundingBox();
      this.ctx.strokeStyle = '#ff0000';
      this.ctx.fillStyle = 'rgba(0,0,0,0)';
      this.ctx.beginPath();
      this.ctx.moveTo(minBox.tl[0], minBox.tl[1]);
      this.ctx.lineTo(minBox.tr[0], minBox.tr[1]);
      this.ctx.lineTo(minBox.br[0], minBox.br[1]);
      this.ctx.lineTo(minBox.bl[0], minBox.bl[1]);
      this.ctx.closePath();
      this.ctx.stroke();
      this.ctx.fill();
    }

    if (this.state.showMaxBoundingBox) {
      let maxBox = this.getMaxBoundingBox();
      this.ctx.strokeStyle = '#0000ff';
      this.ctx.fillStyle = 'rgba(0,0,0,0)';
      this.ctx.beginPath();
      this.ctx.moveTo(maxBox.tl[0], maxBox.tl[1]);
      this.ctx.lineTo(maxBox.tr[0], maxBox.tr[1]);
      this.ctx.lineTo(maxBox.br[0], maxBox.br[1]);
      this.ctx.lineTo(maxBox.bl[0], maxBox.bl[1]);
      this.ctx.closePath();
      this.ctx.stroke();
      this.ctx.fill();
    }
  }

  /**
   * 获取组件的最小包围盒，此盒子的变换矩阵与组件自身完全相同。
   * 此方法需要在 render() 之后调用，组件没有渲染时无法计算最小包围盒。
   * @returns
   */
  public getMinBoundingBox(refresh: boolean = false): ICEBoundingBox {
    //先基于组件本地坐标系进行计算
    let originX = this.state.localOrigin[0];
    let originY = this.state.localOrigin[1];
    let width = this.state.width;
    let height = this.state.height;
    let boundingBox = new ICEBoundingBox([
      0 - originX,
      0 - originY,
      0 - originX + width,
      0 - originY,
      0 - originX,
      0 - originY + height,
      0 - originX + width,
      0 - originY + height,
      0,
      0,
    ]);

    //再用 composedMatrix 进行变换
    const matrix = refresh ? this.composeMatrix() : this.state.composedMatrix;
    boundingBox = boundingBox.transform(matrix);
    return boundingBox;
  }

  /**
   * 获取组件的最大包围盒：
   * - 盒子保持水平和竖直，不旋转、不错切。
   * - 盒子的4边在全局坐标 X/Y 轴上的投影范围与组件完全一致。
   * @returns
   */
  public getMaxBoundingBox(refresh: boolean = false): ICEBoundingBox {
    let boundingBox = this.getMinBoundingBox(refresh);
    let { minX, minY, maxX, maxY } = boundingBox.getMinAndMaxPoint();
    let center = boundingBox.centerPoint;
    boundingBox = new ICEBoundingBox([minX, minY, maxX, minY, minX, maxY, maxX, maxY, center[0], center[1]]);
    return boundingBox;
  }

  /**
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   * @param newState
   */
  public setState(newState: any) {
    merge(this.state, newState);
    if (this.ice) {
      this.ice._dirty = true;
    }
  }

  /**
   * 相对于父组件的坐标系和原点。
   * @param left
   * @param top
   * @param evt
   */
  public setPosition(left: number, top: number, evt: any = new ICEEvent()): void {
    this.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_MOVE, { ...evt, left, top });
    this.setState({ left, top });
    this.trigger(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, { ...evt, left, top });
  }

  /**
   * 在全局空间(canvas)中移动指定的位移。
   * 注意：此方法用于直接设置组件在全局空间中的位移，而不是相对于其它坐标系。
   * @param tx
   * @param ty
   * @param evt
   */
  public moveGlobalPosition(tx: number, ty: number, evt: any = new ICEEvent()): void {
    //如果组件存在嵌套，需要先用逆矩阵抵消所有祖先节点 transform 导致的坐标偏移。
    if (this.parentNode) {
      let point = [tx, ty];
      let matrix = mat2d.invert([], this.parentNode.state.absoluteLinearMatrix);
      point = vec2.transformMat2d([], point, matrix);
      tx = point[0];
      ty = point[1];
    }
    this.setPosition(this.state.left + tx, this.state.top + ty, { ...evt, tx, ty });
  }

  /**
   * 直接设置在全局空间 (canvas) 中的位置。
   * 注意：此方法用于直接设置组件在全局空间中的位置，而不是相对于其它坐标系。
   * @param left
   * @param top
   * @param evt
   */
  public setGlobalPosition(left: number, top: number, evt: any = new ICEEvent()): void {
    //如果组件存在嵌套，需要先用逆矩阵抵消所有祖先节点 transform 导致的坐标偏移。
    if (this.parentNode) {
      let point = [left, top];
      let matrix = mat2d.invert([], this.parentNode.state.absoluteLinearMatrix);
      point = vec2.transformMat2d([], point, matrix);
      left = point[0];
      top = point[1];
    }
    this.setPosition(left, top, { ...evt, left, top });
  }

  /**
   * 在全局空间(canvas)中旋转指定的角度。
   * 注意：此方法用于直接设置组件在全局空间中的旋转角，而不是相对于其它坐标系。
   * @param rotateAngle
   */
  public setGlobalRotate(rotateAngle): void {
    if (this.parentNode) {
      //组件存在嵌套的情况下，减掉所有祖先节点旋转角的总和。
      let matrix = this.parentNode.state.absoluteLinearMatrix;
      let angle = ICEMatrix.calcRotateAngleFromMatrix(matrix);
      rotateAngle -= angle;
    }
    this.setState({
      transform: {
        rotate: rotateAngle,
      },
    });
  }

  /**
   * 组件局部坐标系中的点转换成全局空间(canvas)中的点，包含移动原点的操作。
   * @param localX
   * @param localY
   * @returns
   */
  public localToGlobal(localX: number, localY: number) {
    let point = [localX, localY];
    let matrix = this.state.composedMatrix;
    point = vec2.transformMat2d([], point, matrix);
    return point;
  }

  /**
   * 全局空间(canvas)中的点转换成组件局部坐标系中的点，包含移动原点的操作。
   * @param globalX
   * @param globalY
   * @returns
   */
  public globalToLocal(globalX: number, globalY: number) {
    let point = [globalX, globalY];
    let matrix = mat2d.invert([], this.state.composedMatrix);
    point = vec2.transformMat2d([], point, matrix);
    return point;
  }

  /**
   * 根据变换矩阵计算组件在全局空间(canvas)中的旋转角度。
   * @returns
   */
  public getRotateAngle(): number {
    return this.state.transform.rotate;
  }

  public getLocalLeftTop() {
    let box = this.getMinBoundingBox(true);
    let width = box.width;
    let height = box.height;
    let left = box.centerX - box.width / 2;
    let top = box.centerY - box.height / 2;
    return { left, top, width, height };
  }

  public containsPoint(x: number, y: number): boolean {
    return this.getMinBoundingBox().containsPoint([x, y]);
  }

  /**
   * @method destory
   * 销毁组件
   * - FIXME:立即停止组件上的所有动画效果
   * - 需要清理绑定的事件
   * - 带有子节点的组件需要先销毁子节点，然后再销毁自身。
   */
  public destory(): void {
    this.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, null, { component: this });

    this.purgeEvents();

    this.ice = null;
    this.ctx = null;
    this.root = null;
    this.evtBus = null;
    this.parentNode = null;
  }
}

export default ICEComponent;
