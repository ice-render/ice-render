/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { glMatrix, mat2d, vec2 } from 'gl-matrix';
import { cloneDeep } from '../util/lang';
import { merge } from '../util/lang';
import ICE_EVENT_NAME_CONSTS from '../consts/ICE_EVENT_NAME_CONSTS';
import root from '../cross-platform/root';
import EventBus from '../event/EventBus';
import ICEEvent from '../event/ICEEvent';
import ICEEventTarget from '../event/ICEEventTarget';
import GeoUtil from '../geometry/GeoUtil';
import ICEBoundingBox from '../geometry/ICEBoundingBox';
import ICE from '../ICE';
import { STYLE_PRESETS, getTheme } from '../theme/ICETheme';

/**
 * 阴影简写预设：style.shadow: 'sm' | 'md' | 'lg' 一行搞定浮起效果，
 * 对应展开为 shadowColor / shadowBlur / shadowOffsetX / shadowOffsetY。
 */
const SHADOW_PRESETS = {
  sm: { shadowColor: 'rgba(0,0,0,0.12)', shadowBlur: 4, shadowOffsetX: 0, shadowOffsetY: 1 },
  md: { shadowColor: 'rgba(0,0,0,0.18)', shadowBlur: 10, shadowOffsetX: 0, shadowOffsetY: 3 },
  lg: { shadowColor: 'rgba(0,0,0,0.25)', shadowBlur: 20, shadowOffsetX: 0, shadowOffsetY: 6 },
};

/**
 * 会跨组件泄漏的 ctx 绘制状态及其 canvas 默认值。
 *
 * canvas ctx 是全局状态机：某组件设置了 shadow/globalAlpha/composite/lineCap 等，
 * 若后继组件没写这些属性，会「继承」前驱的残留值，导致同一组件在全量重绘与脏矩形
 * 局部重绘（跳过不相交组件会改变「本帧前驱」）下像素不一致。
 * 因此每个组件 render 结束把自己写过的这些属性归位为 canvas 默认值 → 组件自包含，
 * 全量/局部两条路径在同一区域内的像素必然一致。
 */
const LEAKY_CTX_PROPS: Array<[string, any]> = [
  ['shadowColor', 'rgba(0,0,0,0)'],
  ['shadowBlur', 0],
  ['shadowOffsetX', 0],
  ['shadowOffsetY', 0],
  ['globalAlpha', 1],
  ['globalCompositeOperation', 'source-over'],
  ['lineCap', 'butt'],
  ['lineJoin', 'miter'],
  ['miterLimit', 10],
  ['textAlign', 'start'],
  ['textBaseline', 'alphabetic'],
];
import { skew } from '../util/gl-matrix-skew';
import { uuid } from '../util/uuid';

/**
 * 共享的默认 props（原型链共享，冻结）。
 *
 * 每个组件实例不再各自复制一份默认 style/transform/lineDash/animations，而是通过
 * `Object.create(DEFAULT_PROPS)` 原型继承；只有用户显式传入的字段才写到实例上
 * （merge 对嵌套对象做写时复制）。`id` / `zIndex` 是每实例唯一值，不在共享默认里。
 *
 * 这是内存优化的一部分：大量静态图元的默认配置从「每实例一份」变成「全局一份」。
 */
const DEFAULT_PROPS = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  style: Object.freeze({ fillStyle: 'red', strokeStyle: 'blue', lineWidth: 1 }),
  lineDash: Object.freeze([]),
  lineDashOffset: 0,
  lineDashFlow: false,
  lineDashFlowSpeed: 60,
  lineBorder: false,
  lineBorderWidth: 1.5,
  lineBorderColor: '#999999',
  fill: true,
  stroke: true,
  animations: Object.freeze({}),
  transform: Object.freeze({
    translate: Object.freeze([0, 0]),
    scale: Object.freeze([1, 1]),
    skew: Object.freeze([0, 0]),
    rotate: 0,
  }),
  linearMatrix: Object.freeze([]),
  composedMatrix: Object.freeze([]),
  origin: 'localCenter',
  originX: 0,
  originY: 0,
  localOrigin: Object.freeze([0, 0]),
  absoluteOrigin: Object.freeze([0, 0]),
  display: true,
  draggable: true,
  transformable: true,
  interactive: true,
  linkable: true,
  showMinBoundingBox: false,
  showMaxBoundingBox: false,
};

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
  //@static
  //静态属性，实例计数器
  protected static instanceCounter: number = 0;

  protected __dirty: boolean = true;

  //@perf: 复用矩阵计算的临时缓冲，避免每帧为每个组件 / 每层祖先分配新数组（降低 GC 压力）。
  private __absScratchA: any = null;
  private __absScratchB: any = null;
  private __transScratch: any = null;
  private __originScratch: any = null;
  private __composeScratch: any = null;
  private __viewportScratch: any = null;

  /**
   * @cfg
   * {
   *   id: 'ICE_XXXXXXX',                                      //UUID
   *   left: 0,                                                //x 坐标相对于父组件的偏移量
   *   top: 0,                                                 //y 坐标相对于父组件的偏移量
   *   width: 0,                                               //原始宽度，没有经过变换
   *   height: 0,                                              //原始高度，没有经过变换
   *   style: {
   *     fillStyle: 'red',
   *     strokeStyle: 'blue',
   *     lineWidth: 1,
   *   },
   *   fill:true,                                              //是否填充
   *   stroke:true,                                            //是否描边
   *   animations: {},                                         //动画
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
  public props: any;

  /**
   * 在 ICE 引擎中，所有对象都可以启用动画效果，所以对象的 state 随时可能发生变化。
   * props 与 state 之间的关系与行为模式借鉴自 React 框架，概念模型完全一致。
   * @see https://reactjs.org/docs/components-and-props.html
   */
  public state: any;

  // 主题热切换：记录 preset 名 + 用户原始 props（preset 展开前），供 setTheme 时重新 resolve
  private __presetName?: string;
  private __userProps?: any;

  constructor(props: any = {}) {
    super();
    // 记录用户原始 props（preset 展开前），供主题热切换时重新 resolve preset
    this.__userProps = props;
    // 预设样式：props.preset 引用 STYLE_PRESETS 里的命名预设，作为默认 props 补丁（用户 props 可覆盖）
    if (props && props.preset && STYLE_PRESETS[props.preset]) {
      this.__presetName = props.preset;
      props = merge({}, STYLE_PRESETS[props.preset](getTheme()), props);
    }
    // 原型继承共享默认 props，用户字段经 merge 写时复制到实例。
    this.props = Object.create(DEFAULT_PROPS);
    this.props.id = 'ICE_' + uuid();
    this.props.zIndex = ICEComponent.instanceCounter++;
    merge(this.props, props);
    this.__initState();
    this.root = root;
    this.initEvents();
  }

  /**
   * 初始化 state：同样原型继承共享默认，只把用户传入的 own 字段深拷贝到实例，
   * 运行时派生字段（矩阵/原点等）预分配 own 空值。
   *
   * 这样 state 与 props 是独立对象，任何「直接写 state」都不会污染 props 或共享默认；
   * 同时省去「完整 cloneDeep(props)」里重复的默认嵌套对象（内存优化）。
   */
  private __initState(): void {
    this.state = Object.create(DEFAULT_PROPS);
    this.state.id = this.props.id;
    this.state.zIndex = this.props.zIndex;
    for (const key in this.props) {
      if (Object.prototype.hasOwnProperty.call(this.props, key)) {
        this.state[key] = cloneDeep(this.props[key]);
      }
    }
    // 运行时派生字段：会在 render/compose 中被直接写，预分配为实例 own 值。
    this.state.linearMatrix = [];
    this.state.composedMatrix = [];
    this.state.localOrigin = [0, 0];
    this.state.absoluteOrigin = [0, 0];
  }

  /**
   * 重新 resolve preset（主题热切换用）：把 preset 补丁按当前主题重新展开，
   * 只更新 preset 涉及的字段（style + radius/stroke/fill 等），用户显式传的值优先。
   */
  public __reapplyPreset(): void {
    if (!this.__presetName || !STYLE_PRESETS[this.__presetName]) {
      return;
    }
    const patch = STYLE_PRESETS[this.__presetName](getTheme());
    const user = this.__userProps || {};
    const newState: any = {};
    for (const k in patch) {
      if (k === 'style') {
        newState.style = merge({}, patch.style, user.style);
      } else if (user[k] !== undefined) {
        newState[k] = user[k];
      } else {
        newState[k] = patch[k];
      }
    }
    this.setState(newState);
  }

  /**
   * @method initEvents 注册默认支持的事件
   *
   * - ICEComponent 是顶级类，这里注册的事件所有子类都会响应。
   * - 子类可以提供自己特殊的实现，也可以把此方法覆盖成空函数。
   *
   * @see {ICEComponent.keyboardEvtHandler}
   */
  protected initEvents() {
    this.on('mousedown', this.mouseDownEvtHandler, this);
    this.on('keydown', this.keyboardEvtHandler, this);
    this.on('keyup', this.keyboardEvtHandler, this);
  }

  protected mouseDownEvtHandler(evt?: any) {
    if (!this.state.interactive || !this.state.draggable) {
      return;
    }
    this.on('mousemove', this.mouseMoveEvtHandler, this);
    this.on('mouseup', this.mouseUpEvtHandler, this);
  }

  protected mouseMoveEvtHandler(evt: any) {
    // console.log('window.devicePixelRatio>', window.devicePixelRatio);
    // let tx = evt.movementX / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
    // let ty = evt.movementY / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
    //@ts-ignore
    const tx = evt.movementX;
    //@ts-ignore
    const ty = evt.movementY;
    this.moveGlobalPosition(tx, ty, evt);
    return true;
  }

  protected mouseUpEvtHandler(evt?: any) {
    this.off('mousemove', this.mouseMoveEvtHandler, this);
    this.off('mouseup', this.mouseUpEvtHandler, this);
  }

  /**
   * @method keyboardEvtHandler 默认键盘事件处理
   *
   * - ICE 中的所有组件默认都可以接收键盘事件，子类可以覆盖此方法提供自己的实现。
   * - 子类如果不需要响应键盘事件，可以覆盖一个空实现，或者在构造完成之后删掉对键盘事件的监听。
   *
   * !注意，这里只支持标准写法，不再兼容历史的 charCode 和 keyCode 写法。
   * !W3C 标准按键值定义 https://www.w3.org/TR/uievents-key/#key-attribute-value
   * @param evt
   * @returns
   */
  protected keyboardEvtHandler(evt: any) {
    const MOVE_STEP = 2; //每按键一次移动的步长，像素值
    const keyName = evt.key;
    switch (keyName) {
      case 'ArrowUp':
        this.moveGlobalPosition(0, -MOVE_STEP, evt);
        break;
      case 'ArrowDown':
        this.moveGlobalPosition(0, MOVE_STEP, evt);
        break;
      case 'ArrowLeft':
        this.moveGlobalPosition(-MOVE_STEP, 0, evt);
        break;
      case 'ArrowRight':
        this.moveGlobalPosition(MOVE_STEP, 0, evt);
        break;
      case 'Delete':
        if (this.parentNode && this.parentNode.removeChild) {
          this.parentNode.removeChild(this);
        } else {
          this.ice.removeChild(this);
        }
        break;
      default:
        break;
    }
  }

  /**
   * !Important: 核心方法，FrameManager 会调度此方法进行实际的渲染操作。
   * !Important: 这些方法调用有顺序
   */
  public render(): void {
    this.__renderCore(null, true);
  }

  /**
   * 把组件渲染到指定的目标上下文（离屏缓存用）。
   *
   * - baseMatrix：在组件自身 composedMatrix 之前再叠加的基准矩阵。离屏缓存用它把世界盒
   *   平移到离屏画布左上角，即最终 CTM = baseMatrix · composedMatrix。
   * - 渲染期间临时把 this.ctx 重定向到 targetCtx，结束后恢复，不改变组件状态。
   */
  public renderTo(targetCtx: any, baseMatrix: number[] | null = null): void {
    if (!targetCtx) {
      return;
    }
    const origCtx = this.ctx;
    this.ctx = targetCtx;
    try {
      this.__renderCore(baseMatrix, false);
    } finally {
      this.ctx = origCtx;
    }
  }

  private __renderCore(baseMatrix: number[] | null, applyViewport: boolean): void {
    this.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_RENDER);
    if (!this.state.display) {
      return;
    }

    this.calcComponentParams();
    this.applyStyleToCtx();
    this.applyTransformToCtx(baseMatrix, applyViewport);
    this.doRender();
    this.__resetLeakyCtxState();

    this.trigger(ICE_EVENT_NAME_CONSTS.AFTER_RENDER);
    this.dirty = false;
  }

  protected applyStyleToCtx(): void {
    //@perf: 直接遍历 props.style / state.style 赋值，避免每帧为每个组件分配合并后的 style 对象。
    //       用 for...in（零分配）而非 Object.keys（会分配 key 数组，反而加重 GC）。
    const propsStyle = this.props.style;
    const stateStyle = this.state.style;
    if (propsStyle) {
      for (const p in propsStyle) {
        this.__applyStyleProp(p, propsStyle[p]);
      }
    }
    if (stateStyle) {
      for (const p in stateStyle) {
        this.__applyStyleProp(p, stateStyle[p]);
      }
    }
  }

  /**
   * 应用单个样式属性到 ctx，支持简写：
   * - shadow: 'sm' | 'md' | 'lg' 展开成 shadowColor/shadowBlur/shadowOffsetX/shadowOffsetY。
   */
  private __applyStyleProp(prop: string, value: any): void {
    if (prop === 'shadow' && typeof value === 'string' && SHADOW_PRESETS[value]) {
      const preset = SHADOW_PRESETS[value];
      this.ctx.shadowColor = preset.shadowColor;
      this.ctx.shadowBlur = preset.shadowBlur;
      this.ctx.shadowOffsetX = preset.shadowOffsetX;
      this.ctx.shadowOffsetY = preset.shadowOffsetY;
      return;
    }
    this.ctx[prop] = value;
  }

  /**
   * @method calcComponentParams
   * - 计算组件最原始的宽高和位置，此时没有经过任何变换，也没有移动坐标原点。
   * - 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * - 此方法不能依赖原点位置和 transform 矩阵。
   * - 此方法会在 render() 中调用，所以不需要在构造函数中调用。
   * - 此方法中不能使用 setState() ，如果需要修改状态，直接赋值，如：this.state.width = 100;
   * - 子类可以覆盖此方法，实现自己的计算逻辑。
   * @returns
   */
  protected calcComponentParams() {
    return { width: this.state.width, height: this.state.height };
  }

  /**
   * 计算本地原点坐标，相对于组件本地坐标系。
   * 此方法依赖于 width/height ，需要先计算组件的尺寸，然后才能调用此方法。
   * @returns
   */
  protected calcLocalOrigin() {
    //@perf: 复用 state.localOrigin，避免每帧分配 [0,0] 数组；先重置为原点再按 position 覆盖，语义与原来一致
    let point = this.state.localOrigin;
    if (!point || point.length < 2) {
      point = this.state.localOrigin = [0, 0];
    }
    point[0] = 0;
    point[1] = 0;
    const position = this.state.origin;
    if (!position || position === 'localCenter') {
      point[0] = this.state.width / 2;
      point[1] = this.state.height / 2;
    } else if (position === 'top-left') {
      point[0] = 0;
      point[1] = 0;
    } else if (position === 'custom') {
      // 自定义原点：originX/originY 相对组件左上角
      point[0] = Number(this.state.originX) || 0;
      point[1] = Number(this.state.originY) || 0;
    }
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
    //@perf: 用直接属性访问替代 getVal 字符串路径解析（避免 split + reduce），并复用 scratch 数组
    const transform = this.state.transform;
    const tx = transform.translate[0] + this.state.left;
    const ty = transform.translate[1] + this.state.top;

    const localOrigin = this.calcLocalOrigin();
    let point = this.__originScratch;
    if (!point) point = this.__originScratch = [0, 0];
    point[0] = localOrigin[0] + tx;
    point[1] = localOrigin[1] + ty;

    if (this.parentNode) {
      const pLocalX = this.parentNode.state.localOrigin[0];
      const pLocalY = this.parentNode.state.localOrigin[1];
      //@ts-ignore
      vec2.transformMat2d(point, point, [1, 0, 0, 1, -pLocalX, -pLocalY]);
      const pcm = this.parentNode.state.composedMatrix;
      //@ts-ignore
      vec2.transformMat2d(point, point, pcm);
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
    //@perf: 复用 this.state.linearMatrix，避免每帧分配新数组
    if (!this.state.linearMatrix || this.state.linearMatrix.length < 6) {
      this.state.linearMatrix = mat2d.create();
    }
    const matrix = this.state.linearMatrix;
    mat2d.identity(matrix);

    //@perf: 直接属性访问替代 getVal 字符串路径解析
    const transform = this.state.transform;

    //step1: skew
    const skewX = transform.skew[0];
    const skewY = transform.skew[1];
    //@ts-ignore
    skew(matrix, matrix, glMatrix.toRadian(skewX), glMatrix.toRadian(skewY));

    //step2: rotate
    const angle = transform.rotate;
    //@ts-ignore
    mat2d.rotate(matrix, matrix, glMatrix.toRadian(angle));

    //step3: scale
    const scaleX = transform.scale[0];
    const scaleY = transform.scale[1];
    //@ts-ignore
    mat2d.scale(matrix, matrix, [scaleX, scaleY]);

    this.state.linearMatrix = matrix;
    return matrix;
  }

  /**
   * 复合所有祖先节点的线性变换矩阵，获得相对于全局 canvas 对象的变换矩阵。
   * @returns
   */
  public calcAbsoluteLinearMatrix() {
    let component = this;
    let matrix = component.calcLinearMatrix();
    //@perf: 复用普通数组作为 scratch，既避免每帧分配，又保持矩阵为 Array 类型（兼容序列化/Array.isArray）
    if (!this.__absScratchA) this.__absScratchA = [0, 0, 0, 0, 0, 0];
    if (!this.__absScratchB) this.__absScratchB = [0, 0, 0, 0, 0, 0];
    let out = this.__absScratchA;
    while (component.parentNode) {
      const parent = component.parentNode;
      // 优先复用父节点已缓存且未过期的自身线性矩阵，避免重复计算（性能）。
      // 仅当父节点自身线性矩阵尚未计算（空数组）或父节点处于 dirty（其变换可能已改变）时，
      // 才重新计算，确保嵌套坐标系结果始终正确（与之前的 bug fix 行为一致）。
      //@ts-ignore
      const parentLinearMatrix =
        parent.state && parent.state.linearMatrix && parent.state.linearMatrix.length >= 6 && !parent.dirty
          ? parent.state.linearMatrix
          : //@ts-ignore
            parent.calcLinearMatrix();
      //@perf: 复用两个 scratch 缓冲做矩阵连乘，避免每层祖先都分配新数组
      out = out === this.__absScratchA ? this.__absScratchB : this.__absScratchA;
      //@ts-ignore
      mat2d.multiply(out, parentLinearMatrix, matrix);
      matrix = out;
      component = parent;
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
    // 先确保祖先节点已经完成组合，使其缓存的 composedMatrix / linearMatrix 是最新的。
    // 否则子节点组合时读取到的父节点矩阵可能是未初始化的空数组（[]）或上一帧的脏值，
    // 导致嵌套坐标系下的坐标计算错误。祖先链长度有限，递归在此终止于根节点，不会无限循环。
    //@ts-ignore
    if (this.parentNode && typeof this.parentNode.composeMatrix === 'function') {
      //@ts-ignore
      const parent = this.parentNode;
      const parentComposed = parent.state ? parent.state.composedMatrix : null;
      const parentNeedsRefresh = parent.dirty || !parentComposed || parentComposed.length < 6;
      if (parentNeedsRefresh) {
        //@ts-ignore
        parent.composeMatrix();
      }
    }

    //step-1: 移动到指定原点（全局坐标系）。
    const origin = this.calcAbsoluteOrigin();
    //@perf: 复用平移矩阵 scratch，避免每帧分配新数组
    if (!this.__transScratch) this.__transScratch = [1, 0, 0, 1, 0, 0];
    this.__transScratch[4] = origin[0];
    this.__transScratch[5] = origin[1];
    const translationMatrix = this.__transScratch;

    //step-2: 计算线性变换矩阵，包含了所有祖先节点的线性变换。
    // calcAbsoluteLinearMatrix 内部会实时重新计算每一层祖先的线性矩阵，不再依赖缓存。
    const linearMatrix = this.calcAbsoluteLinearMatrix();

    //step-3: 计算综合变换矩阵，相当于先在 canvas 默认原点（左上角位置）进行变换，然后在平移到计算出的原点位置。
    //@perf: 复用 state.composedMatrix（普通数组），避免每帧分配新数组
    if (!this.state.composedMatrix || this.state.composedMatrix.length < 6) {
      this.state.composedMatrix = [1, 0, 0, 1, 0, 0];
    }
    //@ts-ignore
    const composedMatrix = mat2d.multiply(this.state.composedMatrix, translationMatrix, linearMatrix);
    this.state.composedMatrix = composedMatrix;
    return composedMatrix;
  }

  /**
   * 把变换矩阵应用到 this.ctx 上
   */
  protected applyTransformToCtx(baseMatrix: number[] | null = null, applyViewport: boolean = false): void {
    const matrix = this.dirty ? this.composeMatrix() : this.state.composedMatrix;
    const vp = applyViewport && this.ice ? this.ice.viewport : null;
    const hasViewport = vp && (vp.scale !== 1 || vp.tx !== 0 || vp.ty !== 0);
    if (baseMatrix || hasViewport) {
      //@perf: 复用 scratch 缓冲做 base/viewport · composed，避免每帧分配新数组。
      if (!this.__composeScratch) this.__composeScratch = [1, 0, 0, 1, 0, 0];
      const out = this.__composeScratch;
      let left = baseMatrix;
      if (hasViewport) {
        if (!this.__viewportScratch) this.__viewportScratch = [1, 0, 0, 1, 0, 0];
        const vm = this.__viewportScratch;
        vm[0] = vp.scale;
        vm[1] = 0;
        vm[2] = 0;
        vm[3] = vp.scale;
        vm[4] = vp.tx;
        vm[5] = vp.ty;
        left = vm;
      }
      //@ts-ignore
      mat2d.multiply(out, left, matrix);
      this.ctx.setTransform(out[0], out[1], out[2], out[3], out[4], out[5]);
    } else {
      this.ctx.setTransform(...matrix);
    }
  }

  /**
   * 所有子类都应该提供具体的实现。
   * @method doRender
   */
  protected doRender(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.lineWidth = 1;

    if (this.state.showMinBoundingBox) {
      const minBox = this.getMinBoundingBox();
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
      const maxBox = this.getMaxBoundingBox();
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
    const originX = this.state.localOrigin[0];
    const originY = this.state.localOrigin[1];
    const width = this.state.width;
    const height = this.state.height;
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
    const { minX, minY, maxX, maxY } = boundingBox.getMinAndMaxPoint();
    const center = boundingBox.centerPoint;
    boundingBox = new ICEBoundingBox([minX, minY, maxX, minY, minX, maxY, maxX, maxY, center[0], center[1]]);
    return boundingBox;
  }

  /**
   * @method setState 更新组件状态
   *
   * - setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   * - state 上的所有数据是随时可能发生变化的，而 props 构造参数是不可变的，这一特性与 React 框架保持一致。 @see https://reactjs.org/docs/components-and-props.html
   * - state 上的所有参数默认都会被序列化。
   *
   * @param newState
   */
  public setState(newState: any) {
    merge(this.state, newState);
    this.dirty = true;
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  public set dirty(flag: boolean) {
    this.__dirty = flag;
  }

  public get dirty() {
    return this.__dirty;
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
      //@ts-ignore
      const matrix = mat2d.invert([], this.parentNode.calcAbsoluteLinearMatrix());
      //@ts-ignore
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
      //@ts-ignore
      const matrix = mat2d.invert([], this.parentNode.calcAbsoluteLinearMatrix());
      //@ts-ignore
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
      const matrix = this.parentNode.calcAbsoluteLinearMatrix();
      const angle = GeoUtil.calcRotateAngleFromMatrix(matrix);
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
    const matrix = this.state.composedMatrix;
    //@ts-ignore
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
    //@ts-ignore
    const matrix = mat2d.invert([], this.state.composedMatrix);
    //@ts-ignore
    point = vec2.transformMat2d([], point, matrix);
    return point;
  }

  /**
   * @method getRotateAngle 获取组件的旋转角度。
   * 根据变换矩阵计算组件在全局空间(canvas)中的旋转角度。
   * @param refresh 如果为 true ，则重新计算变换矩阵，否则使用缓存的变换矩阵。
   * @returns
   */
  public getRotateAngle(refresh: boolean = false): number {
    const matrix = refresh ? this.composeMatrix() : this.state.composedMatrix;
    return GeoUtil.calcRotateAngleFromMatrix(matrix);
  }

  /**
   * @method getLocalLeftTop 得到组件在局部坐标系中的左上角坐标。
   * @param refresh 如果为 true ，则重新计算变换矩阵，否则使用缓存的变换矩阵。
   * @returns
   */
  public getLocalLeftTop(refresh: boolean = false) {
    const box = this.getMinBoundingBox(refresh);
    const width = box.width;
    const height = box.height;
    const left = box.centerX - box.width / 2;
    const top = box.centerY - box.height / 2;
    return { left, top, width, height };
  }

  /**
   * @internal 渲染器专用：render 结束后的 ctx 泄漏属性归位（组件自包含，见顶部 LEAKY_CTX_PROPS）。
   * 仅当本组件确实写过了某个泄漏属性时才归位，避免无谓的每帧属性写入。
   */
  public __resetLeakyCtxState(): void {
    let touched = 0;
    const scan = (style: any) => {
      if (!style) return;
      for (const k in style) {
        const idx = this.__leakyIndex(k);
        if (idx >= 0) touched |= 1 << idx;
      }
    };
    scan(this.props.style);
    scan(this.state.style);
    // 折线/蚂蚁线等内部直接写的虚线状态
    if (this.state.lineDash && this.state.lineDash.length) touched |= 1 << 11;
    if (this.state.lineDashFlow || this.state.lineDashOffset) touched |= 1 << 11;
    if (!touched) return;

    const ctx = this.ctx;
    for (let i = 0; i < LEAKY_CTX_PROPS.length; i++) {
      if (touched & (1 << i)) {
        ctx[LEAKY_CTX_PROPS[i][0]] = LEAKY_CTX_PROPS[i][1];
      }
    }
    if (touched & (1 << 11) && typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
  }

  private __leakyIndex(k: string): number {
    switch (k) {
      case 'shadowColor':
        return 0;
      case 'shadowBlur':
        return 1;
      case 'shadowOffsetX':
        return 2;
      case 'shadowOffsetY':
        return 3;
      case 'globalAlpha':
        return 4;
      case 'globalCompositeOperation':
        return 5;
      case 'lineCap':
        return 6;
      case 'lineJoin':
        return 7;
      case 'miterLimit':
        return 8;
      case 'textAlign':
        return 9;
      case 'textBaseline':
        return 10;
      default:
        return -1;
    }
  }

  /**
   * @internal 渲染器专用：用「当前的 composedMatrix + width/height/localOrigin」计算世界轴对齐包围盒
   * [minX, minY, maxX, maxY]，零分配（手动 4 角变换，不复用 vec2 以免每帧分配）。
   * 前置条件：调用方已保证 composedMatrix 新鲜（render 之后 / composeMatrix 之后）。
   */
  public __paintWorldBox(out: any = [0, 0, 0, 0]): number[] {
    const m = this.state.composedMatrix;
    const w = this.state.width || 0;
    const h = this.state.height || 0;
    const origin = this.state.localOrigin;
    const ox = origin ? origin[0] : 0;
    const oy = origin ? origin[1] : 0;
    out[0] = out[1] = Infinity;
    out[2] = out[3] = -Infinity;

    if (!m || m.length < 6) {
      // 未合成过矩阵：退回本地几何（此时若真上屏，render 会先合成）
      out[0] = -ox;
      out[1] = -oy;
      out[2] = w - ox;
      out[3] = h - oy;
      return out;
    }
    const a = m[0];
    const b = m[1];
    const c = m[2];
    const d = m[3];
    const e = m[4];
    const f = m[5];
    const xs = [-ox, w - ox];
    const ys = [-oy, h - oy];
    for (let i = 0; i < 2; i++) {
      const lx = xs[i];
      for (let j = 0; j < 2; j++) {
        const ly = ys[j];
        const gx = a * lx + c * ly + e;
        const gy = b * lx + d * ly + f;
        if (gx < out[0]) out[0] = gx;
        if (gx > out[2]) out[2] = gx;
        if (gy < out[1]) out[1] = gy;
        if (gy > out[3]) out[3] = gy;
      }
    }
    return out;
  }

  public containsPoint(x: number, y: number): boolean {
    // 把全局坐标变换到组件本地坐标系（以 origin 为原点的空间），再做精确判定。
    // 此前直接用 getMinBoundingBox()（旋转后的包围盒）判定，对圆/椭圆/星形等非矩形图元
    // 会在包围盒的边角处误命中（包围盒大于真实形状）。
    // 注意：这里用缓存的 state.composedMatrix，而非 composeMatrix()——后者会触发
    // calcLocalOrigin() 平移 dots 的副作用（ICEDotPath），污染点集。命中检测发生在渲染之后，
    // 缓存是新鲜的；若尚未渲染过则回退到包围盒判定。
    const composed = this.state.composedMatrix;
    if (!composed || composed.length < 6) {
      return this.getMinBoundingBox().containsPoint([x, y]);
    }
    //@ts-ignore
    const matrix = mat2d.invert([], composed);
    //@ts-ignore
    const point = vec2.transformMat2d([], [x, y], matrix);
    return this.containsLocalPoint(point[0], point[1]);
  }

  /**
   * 判断本地坐标（以组件 origin 为原点的空间）的点是否位于图元内部。
   * 默认用最小包围盒（AABB），子类可覆盖为精确形状判定。
   * @param localX
   * @param localY
   */
  protected containsLocalPoint(localX: number, localY: number): boolean {
    const halfWidth = this.state.width / 2;
    const halfHeight = this.state.height / 2;
    return localX >= -halfWidth && localX <= halfWidth && localY >= -halfHeight && localY <= halfHeight;
  }

  /**
   * @method destory
   * 销毁组件
   * - FIXME:立即停止组件上的所有动画效果
   * - 需要清理绑定的事件
   * - 带有子节点的组件需要先销毁子节点，然后再销毁自身。
   * - 子类需要覆盖此方法，释放自己占有的资源。
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
