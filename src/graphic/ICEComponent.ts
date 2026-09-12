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
import { bumpVisibilityEpoch, getVisibilityEpoch } from '../util/data-util';
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
export const SHADOW_PRESETS = {
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

/** 单位矩阵（gl-matrix mat2d 布局）；`__activeWorldMatrix` 为空时代表世界→设备是恒等变换。 */
const IDENTITY_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]) as unknown as number[];
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
  /**
   * 是否把**所有后代**裁到自己的盒子里（滚动容器 / 可裁剪视口用）。
   * 默认 false —— 与旧行为一致，零成本（热路径上只是一次布尔读）。
   */
  clipChildren: false,
  /**
   * 子树不透明度（0~1，默认 1）：作用于**本组件及其所有后代**。
   *
   * 与 `style.globalAlpha` 的区别：后者只影响组件自身的绘制（组件是逐个独立渲染的，
   * 祖先的 ctx 状态不会自动继承给后代），所以淡入淡出整棵子树（Modal / Drawer / Message）
   * 要用 opacity。
   */
  opacity: 1,
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

/** 把渐变 stop 归一化成 [offset, color] 且按 offset 升序。接受 [[o,c],...] 或 [{offset,color},...]。 */
function normalizeGradientStops(stops: any): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  if (!Array.isArray(stops)) {
    return out;
  }
  for (let i = 0; i < stops.length; i++) {
    const item = stops[i];
    let offset = NaN;
    let color = '';
    if (Array.isArray(item)) {
      offset = Number(item[0]);
      color = String(item[1]);
    } else if (item && typeof item === 'object') {
      offset = Number(item.offset);
      color = String(item.color);
    }
    if (!isFinite(offset) || !color) {
      continue;
    }
    out.push([offset < 0 ? 0 : offset > 1 ? 1 : offset, color]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out;
}

/**
 * @class ICEComponent
 *
 * 最顶级的抽象类，Canvas 内部所有可见的组件都是它的子类。
 *
 * @abstract
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
/**
 * 递归给后代派发 AFTER_MOVE（父容器移动 → 后代世界坐标变化）。
 * 只派发事件、不改状态：订阅者（连线 followComponent、对齐标尺等）自行按新位置重算。
 */
function triggerSubtreeMove(component: any, payload: any): void {
  const children = (component && component.childNodes) || [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    child.trigger(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, payload);
    triggerSubtreeMove(child, payload);
  }
}

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

  /**
   * 本组件是否**已经真正绘制过一次**（`__renderCore` 走完了 doRender 才会置真）。
   *
   * 存在的意义：`dirty` 同时承担两个语义 —— 「本帧要重绘」和「几何缓存（`ICEPath.createPathObject`）
   * 是否有效」。后者只在 doRender 里以 `if (this.dirty)` 的形式被消费，因此**从未渲染过的组件
   * 一旦被置干净，它的路径缓存就永远不会被建立**，首次上屏是空的（见 `__applyDirty`）。
   */
  protected __everRendered: boolean = false;

  // __localBox() 的复用缓冲（避免每帧为每个组件的包围盒分配数组）
  private __localBoxScratch: number[] = [0, 0, 0, 0];

  /** 本渲染通道的「本地 → 设备」CTM（主画布通道 = 视口·composed；离屏位图通道 = base·composed）。 */
  private __activeCtm: number[] | null = null;
  /** 本渲染通道的「世界 → 设备」矩阵（主画布通道 = 视口；离屏通道 = 缓存位图的 base 矩阵）。 */
  private __activeWorldMatrix: number[] | null = null;
  /** 可见性缓存（代际号 + 值）：见 `isEffectivelyVisible` 的说明。 */
  private __visEpoch = -1;
  private __visValue = true;
  /** 本帧是否因为子树不透明度过 ctx.globalAlpha（见 __renderCore / __resetLeakyCtxState）。 */
  private __opacityApplied = false;
  /** 声明式渐变缓存：按描述对象引用判定，`refreshParams()` 里失效（setState 必然触发它）。 */
  private __gradCache: { fill?: { src: any; grad: any }; stroke?: { src: any; grad: any } } = {};

  /**
   * 「自身派生参数需要重算」标志（尺寸 / 点集 / 文本量测等，由 calcComponentParams 产出）。
   *
   * 与 `dirty` 的区别：
   * - `dirty` 表示**需要重绘**。祖先变换变化时，后代的绝对矩阵变了 → 必须重绘；
   * - `paramsDirty` 表示**自身派生参数需要重算**。它只取决于组件自身的 state，
   *   与祖先变换无关。
   *
   * 拆分的目的：移动一个容器时，旧实现递归把所有后代置 `dirty`，而后代又以 `dirty`
   * 判断是否重算派生参数 → 后代（尤其点集类图元）会白白重算 `calcDots()`。
   * 现在后代只置 `dirty`（要重绘），派生参数仍为干净 → 跳过重量测。
   *
   * 统一由 `refreshParams()` 读取与清理，不要在别处手工维护。
   */
  protected __paramsDirty: boolean = true;

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
  public __reapplyPreset(theme?: any): void {
    if (!this.__presetName || !STYLE_PRESETS[this.__presetName]) {
      return;
    }
    // 优先用调用方给的主题（实例级主题），否则回退模块级当前主题
    const patch = STYLE_PRESETS[this.__presetName](theme || getTheme());
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
    // movementX/Y 是屏幕像素位移；在缩放视口下，世界坐标位移需要除以 scale。
    const scale = this.ice && this.ice.viewport ? this.ice.viewport.scale : 1;
    const tx = evt.movementX / scale;
    const ty = evt.movementY / scale;
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

  /**
   * 「最终可见」：自身与**所有祖先**的 `state.display` 都为真。
   *
   * `state.display = false` 的语义是「整棵子树都不渲染」（见上方 props 文档），但渲染队列
   * 是把树拉平后逐个入队的，只判组件自身的话，把一个父容器设为 false 后它的子组件仍会被
   * 画出来、也仍能被点中。
   *
   * 顶层组件（无 parentNode）走 O(1) 快路径 —— 绝大多数组件都是顶层，热路径上不付出遍历成本。
   */
  public isEffectivelyVisible(): boolean {
    // 同一代内命中缓存：绝大多数调用走这条路径（两次字段读 + 比较）
    if (this.__visEpoch === getVisibilityEpoch()) {
      return this.__visValue;
    }
    const value = this.__computeEffectivelyVisible();
    this.__visEpoch = getVisibilityEpoch();
    this.__visValue = value;
    return value;
  }

  /** 真正沿父链判定一次（只在代际变化时执行）。 */
  private __computeEffectivelyVisible(): boolean {
    if (!this.state.display) {
      return false;
    }
    let node: any = this.parentNode;
    while (node) {
      // 父链上只有「组件」带 state；宿主对象（ICE 实例等）没有 → 到此为止，无需再往上
      if (!node.state) {
        break;
      }
      if (!node.state.display) {
        return false;
      }
      node = node.parentNode;
    }
    return true;
  }

  private __renderCore(baseMatrix: number[] | null, applyViewport: boolean): void {
    this.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_RENDER);
    //祖先 display:false 时同样不渲染（display 的语义是整棵子树）
    if (!this.isEffectivelyVisible()) {
      return;
    }

    this.refreshParams();
    this.applyStyleToCtx();
    // 子树不透明度：祖先的 opacity 不会自动继承（组件是逐个独立绘制的），这里相乘后叠到
    // ctx.globalAlpha 上。默认全为 1 时只是一次字段读，热路径无开销。
    const subtreeOpacity = this.getEffectiveOpacity();
    if (subtreeOpacity !== 1) {
      this.__applyStyleProp('globalAlpha', (Number(this.ctx.globalAlpha) || 1) * subtreeOpacity);
      // 记一笔：这个 alpha 不在 style 键里，__resetLeakyCtxState 的扫描发现不了它
      this.__opacityApplied = true;
    }
    this.applyTransformToCtx(baseMatrix, applyViewport);
    // 祖先开了 clipChildren 时，先在本组件绘制前建立裁剪区（设备空间），绘制完再还原
    const clipped = this.__applyAncestorClips();
    this.doRender();
    if (clipped) {
      this.ctx.restore();
    }
    this.__resetLeakyCtxState();

    this.trigger(ICE_EVENT_NAME_CONSTS.AFTER_RENDER);
    this.__everRendered = true;
    this.dirty = false;
  }

  protected applyStyleToCtx(): void {
    //@perf: 直接遍历 props.style / state.style 赋值，避免每帧为每个组件分配合并后的 style 对象。
    //       用 for...in（零分配）而非 Object.keys（会分配 key 数组，反而加重 GC）。
    const propsStyle = this.props.style;
    const stateStyle = this.state.style;
    // 渐变单独摘出来放到最后应用：它写的是同一个 ctx.fillStyle / strokeStyle，
    // 若按 style 的键序谁先谁后，「渐变 vs 纯色」的胜负就会不定（state.style 覆盖 props.style）
    let fillGrad: any = null;
    let strokeGrad: any = null;
    if (propsStyle) {
      for (const p in propsStyle) {
        if (p === 'fillGradient') {
          fillGrad = propsStyle[p];
          continue;
        }
        if (p === 'strokeGradient') {
          strokeGrad = propsStyle[p];
          continue;
        }
        this.__applyStyleProp(p, propsStyle[p]);
      }
    }
    if (stateStyle) {
      for (const p in stateStyle) {
        if (p === 'fillGradient') {
          fillGrad = stateStyle[p];
          continue;
        }
        if (p === 'strokeGradient') {
          strokeGrad = stateStyle[p];
          continue;
        }
        this.__applyStyleProp(p, stateStyle[p]);
      }
    }
    if (fillGrad) {
      this.__applyStyleProp('fillGradient', fillGrad);
    }
    if (strokeGrad) {
      this.__applyStyleProp('strokeGradient', strokeGrad);
    }
  }

  /**
   * 应用单个样式属性到 ctx，支持简写：
   * - shadow: 'sm' | 'md' | 'lg' 展开成 shadowColor/shadowBlur/shadowOffsetX/shadowOffsetY。
   */
  private __applyStyleProp(prop: string, value: any): void {
    // 声明式渐变：fillGradient / strokeGradient 解析成 CanvasGradient 后写进 fillStyle / strokeStyle
    if (prop === 'fillGradient' || prop === 'strokeGradient') {
      const target = prop === 'fillGradient' ? 'fillStyle' : 'strokeStyle';
      const resolved = this.__resolveGradient(prop === 'fillGradient' ? 'fill' : 'stroke', value);
      if (resolved) {
        this.ctx[target] = resolved;
      } else if (value) {
        // 解析失败（无 stop / 运行时缺 API）时退回纯色，避免「什么都没画出来」
        const stops = normalizeGradientStops(value.stops);
        if (stops.length) {
          this.ctx[target] = stops[Math.floor(stops.length / 2)][1];
        }
      }
      return;
    }
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
   * 把声明式渐变描述解析成 `CanvasGradient`（带缓存）。
   *
   * 描述形状（坐标是**组件本地坐标**）：
   * ```
   * { type: 'linear', from: [0,0], to: [100,0], stops: [[0,'#fff'],[1,'#000']] }
   * { type: 'radial', center: [50,50], radius: 50, innerRadius: 0, stops: [...] }
   * { type: 'conic',  center: [50,50], startAngle: 0, stops: [...] }
   * ```
   * 它比手搓 `CanvasGradient` 多两个好处：**可序列化**（纯对象，存盘不丢）与**可用于主题 preset**。
   */
  private __resolveGradient(kind: 'fill' | 'stroke', desc: any): any {
    if (!desc || typeof desc !== 'object') {
      return null;
    }
    const slot = this.__gradCache[kind];
    if (slot && slot.src === desc) {
      return slot.grad;
    }
    const grad = this.__buildGradient(desc);
    this.__gradCache[kind] = { src: desc, grad };
    return grad;
  }

  /** 真正构造 CanvasGradient。缺少对应 ctx API 时返回 null（调用方会退回纯色）。 */
  private __buildGradient(desc: any): any {
    const ctx: any = this.ctx;
    if (!ctx) {
      return null;
    }
    const stops = normalizeGradientStops(desc.stops);
    if (stops.length < 1) {
      return null;
    }
    const w = Number(this.state.width) || 0;
    const h = Number(this.state.height) || 0;
    const type = desc.type || 'linear';
    let grad: any = null;

    if (type === 'radial' && typeof ctx.createRadialGradient === 'function') {
      const c = Array.isArray(desc.center) ? desc.center : [w / 2, h / 2];
      const radius = Number(desc.radius) > 0 ? Number(desc.radius) : Math.max(w, h) / 2;
      const inner = Number(desc.innerRadius) > 0 ? Number(desc.innerRadius) : 0;
      grad = ctx.createRadialGradient(c[0], c[1], inner, c[0], c[1], radius);
    } else if (type === 'conic' && typeof ctx.createConicGradient === 'function') {
      const c = Array.isArray(desc.center) ? desc.center : [w / 2, h / 2];
      grad = ctx.createConicGradient(Number(desc.startAngle) || 0, c[0], c[1]);
    } else if (type === 'conic') {
      // 运行时没有 createConicGradient（旧 Safari / 部分小程序）→ 退回中间色纯色
      return null;
    } else if (typeof ctx.createLinearGradient === 'function') {
      const from = Array.isArray(desc.from) ? desc.from : [0, 0];
      const to = Array.isArray(desc.to) ? desc.to : [w, 0];
      grad = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
    }
    if (!grad && typeof ctx.createLinearGradient !== 'function') {
      return null;
    }
    if (!grad) {
      return null;
    }
    for (let i = 0; i < stops.length; i++) {
      try {
        grad.addColorStop(stops[i][0], stops[i][1]);
      } catch (e) {
        // 非法颜色：跳过这一档，别让一个笔误把整帧渲染打断
      }
    }
    return grad;
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
   * 组件**本地包围盒**（未变换、未减去原点），写入并返回 [x0, y0, x1, y1]。
   *
   * 默认约定：几何自本地 (0,0) 起、尺寸为 `state.width/height`。
   * **子类若几何不遵守该约定必须覆盖本方法** —— 例如 `ICEPolyLine` 的本地原点固定为 (0,0)，
   * 而点集可以含负坐标，此时 [0,0,w,h] 并非它的真实盒子。
   *
   * `getMinBoundingBox()` 与 `__paintWorldBox()` 都消费本方法，因此两者**必然一致**。
   * 这两者以前各算各的：`__paintWorldBox()` 直接由 width/height 推导，而折线的 `width ≈ 0`
   * （见 ICEPolyLine.calcComponentParams 的历史实现）→ 它上屏快照是个退化小盒 →
   * dirty-rect 按快照盒挑选「需要重画的组件」时会漏掉折线，导致擦除区域内折线笔迹丢失。
   *
   * 注意：返回的是实例内复用缓冲，调用方应**立即读取**，不要持有。
   */
  protected __localBox(): number[] {
    const box = this.__localBoxScratch;
    box[0] = 0;
    box[1] = 0;
    box[2] = this.state.width || 0;
    box[3] = this.state.height || 0;
    return box;
  }

  /**
   * 显式「测量」：刷新一次自身派生参数（尺寸 / 点集 / 文本量测）。
   *
   * 布局管理器（`ICELayoutManager`）排布时读的是 `child.state.width/height`，
   * 而这些值在首次渲染之前是 0（文本甚至是 10 的哨兵值）—— 布局因此会算错。
   * 由容器在布局前统一调一次本方法，布局就不必「等一帧才正确」。
   */
  public measure(): void {
    this.refreshParams();
  }

  /**
   * 派生参数刷新入口（**唯一**）：按需调用子类的 `calcComponentParams()`，并在算完后清除 `paramsDirty`。
   *
   * - 参数干净时直接返回，因此「只重绘、不改自身参数」的帧（例如祖先移动）不会重算点集/文本量测。
   * - 需要强制重算时请先置 `paramsDirty = true`（`setState` 已自动做这件事）。
   */
  public refreshParams(): void {
    if (!this.__paramsDirty) {
      return;
    }
    this.calcComponentParams();
    this.__paramsDirty = false;
    // 样式可能一起变了：渐变按描述对象引用缓存，这里失效一次即可（重建只发生一次）
    this.__gradCache.fill = undefined;
    this.__gradCache.stroke = undefined;
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
    const vp = applyViewport && this.ice ? this.ice.getRenderViewport() : null;
    const hasViewport = vp && (vp.scale !== 1 || vp.tx !== 0 || vp.ty !== 0);

    // 「世界 → 设备」矩阵：主画布通道是视口矩阵；离屏位图通道是 base 矩阵
    //（base 已含渲染缩放与把世界盒平移到位图左上角的平移）。
    let world: number[] | null = null;
    if (hasViewport) {
      if (!this.__viewportScratch) this.__viewportScratch = [1, 0, 0, 1, 0, 0];
      const vm = this.__viewportScratch;
      vm[0] = vp.scale;
      vm[1] = 0;
      vm[2] = 0;
      vm[3] = vp.scale;
      vm[4] = vp.tx;
      vm[5] = vp.ty;
      world = vm;
    } else if (baseMatrix) {
      world = baseMatrix;
    }
    this.__activeWorldMatrix = world;

    if (baseMatrix || hasViewport) {
      //@perf: 复用 scratch 缓冲做 base/viewport · composed，避免每帧分配新数组。
      if (!this.__composeScratch) this.__composeScratch = [1, 0, 0, 1, 0, 0];
      const out = this.__composeScratch;
      //@ts-ignore
      mat2d.multiply(out, world || baseMatrix, matrix);
      this.__activeCtm = out;
      this.ctx.setTransform(out[0], out[1], out[2], out[3], out[4], out[5]);
    } else {
      this.__activeCtm = matrix;
      this.ctx.setTransform(...matrix);
    }
  }

  /**
   * 复原「本渲染通道的完整 CTM」（`base·composed` 或 `viewport·composed`）。
   *
   * 子类在 `super.doRender()` 之后需要重新拿到完整变换 —— 链上的 `ICEComponent.doRender()` 会
   * 把 CTM 换成「世界 → 设备」矩阵以绘制 debug 包围盒。
   *
   * **不要用 `applyTransformToCtx(null, true)` 代替**：那条路径无条件按主画布视口重算，
   * 在离屏位图通道里会把内容画到完全错误的位置（丢掉位图原点的平移），
   * 表现为「连线的箭头与标签在缓存位图里整块消失」——离屏缓存保真测试就是抓这个的。
   */
  protected applyActiveTransform(): void {
    const m = this.__activeCtm;
    if (!m) {
      this.applyTransformToCtx(null, true);
      return;
    }
    this.ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  }

  /**
   * 是否存在开启 `clipChildren` 的祖先（热路径用，命中检测与离屏缓存的门控都要问它）。
   * 顶层组件直接 O(1) 返回。
   */
  public hasClippingAncestor(): boolean {
    let node = this.parentNode;
    while (node && node.state) {
      if (node.state.clipChildren) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  /**
   * 有效不透明度 = 自身 `state.opacity` × 所有祖先的 `state.opacity`（默认 1）。
   *
   * 顶层组件直接返回（绝大多数组件没有祖先，热路径上不做遍历）；非法值按 1 处理。
   */
  /**
   * 有效不透明度 = 自身 `state.opacity` × 所有祖先的 `state.opacity`（默认 1）。
   *
   * 渲染把相乘的结果叠到 `ctx.globalAlpha` 上（祖先的 opacity 不会自动继承，组件是逐个绘制的）。
   * 公开出来是因为**离屏与 SVG 导出必须用同一口径**，否则导出的图会比画布亮/暗一截。
   */
  public getEffectiveOpacity(): number {
    const own = this.state.opacity;
    let alpha = own === undefined ? 1 : Number(own);
    if (!(alpha >= 0)) {
      alpha = 1;
    }
    let node = this.parentNode;
    while (node && node.state) {
      const parentAlpha = node.state.opacity === undefined ? 1 : Number(node.state.opacity);
      if (parentAlpha >= 0 && parentAlpha !== 1) {
        alpha *= parentAlpha;
      }
      node = node.parentNode;
    }
    return alpha;
  }

  /**
   * 世界坐标点是否落在某个「裁剪祖先」的盒子之外。
   *
   * 命中检测用它实现「滚出可视区的子组件点不到」—— 与渲染时的裁剪语义保持一致。
   */
  public isPointClippedOut(wx: number, wy: number): boolean {
    let node = this.parentNode;
    while (node && node.state) {
      if (node.state.clipChildren) {
        const box = node.__paintWorldBox();
        if (wx < box[0] || wx > box[2] || wy < box[1] || wy > box[3]) {
          return true;
        }
      }
      node = node.parentNode;
    }
    return false;
  }

  /**
   * 把「裁剪祖先」的盒子作为裁剪区应用到 ctx —— 在**设备空间**建立。
   *
   * 做法与脏矩形路径一致（见 CanvasRenderer 的局部重绘分支）：
   * `setTransform(单位矩阵) → rect → clip → 复原本组件 CTM`。clip 记录在 ctx 的裁剪状态里，
   * 之后组件自己 `setTransform` 不会清掉它；`restore()` 才移除。
   *
   * 祖先有旋转/缩放时按其世界 AABB 裁剪（保守，宁可多裁不可漏裁）。
   *
   * @returns 是否建立过裁剪（true 时调用方必须 `ctx.restore()`）
   */
  private __applyAncestorClips(): boolean {
    const parent = this.parentNode;
    if (!parent || !parent.state) {
      return false;
    }
    const ctx = this.ctx;
    if (!ctx || typeof ctx.clip !== 'function' || typeof ctx.rect !== 'function') {
      return false;
    }

    // 先收集（内 → 外），确认真的存在裁剪祖先再动 ctx
    let ancestors: any[] | null = null;
    let node = parent;
    while (node && node.state) {
      if (node.state.clipChildren) {
        (ancestors || (ancestors = [])).push(node);
      }
      node = node.parentNode;
    }
    if (!ancestors) {
      return false;
    }

    // 世界 → 设备：主画布通道是视口矩阵，离屏通道是位图 base 矩阵；都没有则是单位矩阵
    const m = this.__activeWorldMatrix || IDENTITY_MATRIX;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const box = ancestors[i].__paintWorldBox();
      // 四个角分别变换后取 AABB（旋转/斜切时保守裁剪）
      const ax = m[0] * box[0] + m[2] * box[1] + m[4];
      const ay = m[1] * box[0] + m[3] * box[1] + m[5];
      const bx = m[0] * box[2] + m[2] * box[1] + m[4];
      const by = m[1] * box[2] + m[3] * box[1] + m[5];
      const cx = m[0] * box[0] + m[2] * box[3] + m[4];
      const cy = m[1] * box[0] + m[3] * box[3] + m[5];
      const dx = m[0] * box[2] + m[2] * box[3] + m[4];
      const dy = m[1] * box[2] + m[3] * box[3] + m[5];
      const minX = Math.min(ax, bx, cx, dx);
      const minY = Math.min(ay, by, cy, dy);
      const maxX = Math.max(ax, bx, cx, dx);
      const maxY = Math.max(ay, by, cy, dy);
      ctx.beginPath();
      ctx.rect(minX, minY, maxX - minX, maxY - minY);
      ctx.clip();
    }
    // 裁剪已建立，把 CTM 换回本组件自己的（clip 不受影响）
    this.applyActiveTransform();
    return true;
  }

  /**
   * 把「世界 → 设备」矩阵应用到 ctx。
   * debug 包围盒的坐标本身就是世界坐标，不能套「本地 → 世界」的 composed 矩阵。
   */
  protected applyWorldTransform(): void {
    //@perf: 本方法每个组件每帧都会被调用一次，所以缩放直接在矩阵上取（引擎里「世界 → 设备」
    //       矩阵恒为「缩放 + 平移」—— 视口矩阵或缓存 base 矩阵，[0]/[3] 就是统一缩放），
    //       不做 sqrt(det) 那种更通用但更贵的计算，也不额外存字段。
    const m = this.__activeWorldMatrix;
    if (m) {
      this.ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      this.ctx.lineWidth = 1 / (Math.abs(m[0]) || Math.abs(m[3]) || 1);
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.lineWidth = 1;
    }
  }

  /**
   * 所有子类都应该提供具体的实现。
   * @method doRender
   */
  protected doRender(): void {
    // 边界盒坐标是「世界坐标」，所以这里套的是**本渲染通道的「世界 → 设备」矩阵**：
    // 主画布通道 = 视口矩阵；离屏位图通道 = 缓存位图的 base 矩阵。
    // （照着视口重算会在离屏通道里把框画到错误位置 —— 位图原点的平移被丢掉。）
    this.applyWorldTransform();

    if (this.state.showMinBoundingBox || this.state.showMaxBoundingBox) {
      const minBox = this.state.showMinBoundingBox ? this.getMinBoundingBox() : null;
      const maxBox = this.state.showMaxBoundingBox ? this.getMaxBoundingBox() : null;
      // 无旋转/错切时，最小包围盒与最大包围盒是同一个矩形；同时开启时若不跳过，
      // 两条边完全重叠会产生红蓝混色/双线，视觉上很怪。此时只保留一个干净的框。
      const same = minBox && maxBox && this.__areBoundingBoxesNearlyEqual(minBox, maxBox);

      if (minBox && !same) {
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

      if (maxBox) {
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
  }

  /** 判断两个边界盒是否在视觉上重合（用于避免重复绘制几乎相同的 min/max 框）。 */
  private __areBoundingBoxesNearlyEqual(a: any, b: any): boolean {
    const pts = [
      [a.tl, b.tl],
      [a.tr, b.tr],
      [a.bl, b.bl],
      [a.br, b.br],
    ];
    for (const [p, q] of pts) {
      if (Math.abs(p[0] - q[0]) > 1 || Math.abs(p[1] - q[1]) > 1) {
        return false;
      }
    }
    return true;
  }

  /**
   * 内部子组件是否为「由自身 state 派生」的。
   *
   * 复合组件（构造时按 state 建立内部子组件的组件，如「卡片 = 底框 + 标题」）应当返回 true：
   * 这些子组件在反序列化时会被构造函数重建，序列化它们只会造成**重复挂载**
   * （先由构造函数建一份、再由 Deserializer 挂一份）、并且子组件的自动 zIndex 每次都会变，
   * 让同一份数据的两次序列化结果不稳定。返回 true 后，Serializer / Deserializer 都会跳过
   * 该组件的 childNodes —— 只持久化它自己的 state（真相源），子组件视为派生结果。
   *
   * 默认为 false（普通容器/叶子组件的子节点是「真数据」，必须序列化）。
   */
  public hasDerivedChildren(): boolean {
    return false;
  }

  /**
   * 复合组件里**需要进文档的真实子节点**（可选实现）。
   *
   * 背景：`hasDerivedChildren() === true` 表示「子节点都是派生结果、不进文档」，
   * 但有一类组件**既是复合组件、又是容器** —— 典型是流程图 / BPMN 的节点与池：
   * 它自己按 state 派生形状（内框 / 角标 / 标题），同时又真的装着子节点（泳道、泳道里的节点）。
   * 只声明 `hasDerivedChildren()` 的话，序列化会把**真实子节点也一起跳过**，
   * 于是 `serialize() → load()` 之后池里的泳道和节点整套消失（实测：3 个元素只剩 1 个）。
   *
   * 实现这个方法的组件要返回「真实子节点」（通常 = `childNodes` 减去派生部件），
   * 引擎据此只序列化这些子节点；反序列化时构造函数仍会重建派生部件，不会重复。
   *
   * 不实现时行为**与以前完全一致**（复合组件一个子节点都不进文档）—— 默认不变，属增量能力。
   */
  public getSerializableChildren(): ICEComponent[] {
    return null as any;
  }

  /**
   * 获取组件的最小包围盒，此盒子的变换矩阵与组件自身完全相同。
   * 此方法需要在 render() 之后调用，组件没有渲染时无法计算最小包围盒。
   * @returns
   */
  public getMinBoundingBox(refresh: boolean = false): ICEBoundingBox {
    // 先刷新变换，再读派生状态：`localOrigin` 是由 `calcLocalOrigin()` 派生的，而它只在
    // `composeMatrix()` 内部被调用。旧实现先读 `state.localOrigin` 再 composeMatrix，
    // 导致「首次 refresh=true」读到的是尚未计算的初始值 (0,0)，与矩阵里的 origin 不一致
    // —— 盒子会偏一个原点（控制面板/连线插槽首次定位偏移的根因）。
    const matrix = refresh ? this.composeMatrix() : this.state.composedMatrix;

    //再基于组件本地坐标系进行计算（本地盒由 __localBox() 提供，与 __paintWorldBox() 同源）
    const originX = this.state.localOrigin[0];
    const originY = this.state.localOrigin[1];
    const lb = this.__localBox();
    const x0 = lb[0] - originX;
    const y0 = lb[1] - originY;
    const x1 = lb[2] - originX;
    const y1 = lb[3] - originY;
    let boundingBox = new ICEBoundingBox([x0, y0, x1, y0, x0, y1, x1, y1, 0, 0]);

    //再用 composedMatrix 进行变换
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
    const sizeChanged = this.__beforeStateMerge(newState);
    merge(this.state, newState);
    // state 变化无法廉价判断「是否影响派生参数」，因此保守地两者都置脏（与旧行为一致）。
    this.paramsDirty = true;
    this.dirty = true;
    if (this.ice) {
      this.ice.dirty = true;
    }
    this.__afterStateMerge(sizeChanged);
  }

  /**
   * `setState` 的**前置**钩子：必须在 `merge(this.state, newState)` 之前调用（要对比新旧值）。
   *
   * 覆盖 `setState` 的子类**必须**成对调用前后置钩子 —— `ICEGroup.setState` 是独立实现
   * （它自己 merge、且不调 `super.setState`），曾因此漏掉这两件事：
   * 「隐藏一个分组」不会让后代的可见性缓存失效、「分组改尺寸」不会触发父容器重排。
   *
   * @returns 尺寸是否变化（决定 `__afterStateMerge` 是否需要请求重排）
   */
  protected __beforeStateMerge(newState: any): boolean {
    const sizeChanged =
      !!newState &&
      ((newState.width !== undefined && newState.width !== this.state.width) ||
        (newState.height !== undefined && newState.height !== this.state.height));
    // display 变化会让自身与全部后代的「最终可见性」失效
    if (!!newState && newState.display !== undefined && newState.display !== this.state.display) {
      bumpVisibilityEpoch();
    }
    return sizeChanged;
  }

  /** `setState` 的**后置**钩子：尺寸变化时请求父容器重排（合并到下一帧，见 `ICEGroup.requestLayout`）。 */
  protected __afterStateMerge(sizeChanged: boolean): void {
    if (sizeChanged && this.parentNode && typeof this.parentNode.requestLayout === 'function') {
      this.parentNode.requestLayout();
    }
  }

  public set dirty(flag: boolean) {
    this.__dirty = flag;
  }

  public get dirty() {
    return this.__dirty;
  }

  /**
   * 按 `markDirty` 语义更新脏标记。
   *
   * `markDirty = false` 的含义是「这次操作**不要**主动把组件标记为要重绘」（批量挂载时的性能优化），
   * 而**不是**「把它强制置干净」：对从未绘制过的组件置干净会让几何缓存永不建立，首次上屏画不出
   * 自身的路径（`ICEPath.doRender` 只在 dirty 时调用 `createPathObject`）。
   *
   * 例：`UIButton` 构造函数里 `addChild(this.label, false)` 会把自己置干净，导致按钮的圆角矩形
   * 背景/边框在首帧是空路径 —— 页面上表现为「白底白字、完全看不见的按钮」。
   */
  protected __applyDirty(markDirty: boolean): void {
    this.dirty = markDirty || !this.__everRendered;
  }

  public set paramsDirty(flag: boolean) {
    this.__paramsDirty = flag;
  }

  public get paramsDirty() {
    return this.__paramsDirty;
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
    // 容器移动时，后代的**世界坐标同样变化**：递归派发 AFTER_MOVE，
    // 让订阅宿主事件的连线（ICEPolyLine 监听 AFTER_MOVE 做 followComponent）重新路由，
    // 否则拖动池/泳道时里面的图元走了、挂在它们上面的连线却停在原地。
    triggerSubtreeMove(this, { ...evt, left, top });
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
    // 子树不透明度叠写的是 globalAlpha，但它不在 style 键里（上面两轮扫描发现不了）
    if (this.__opacityApplied) {
      touched |= 1 << this.__leakyIndex('globalAlpha');
      this.__opacityApplied = false;
    }
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
   * @internal 渲染器专用：用「当前的 composedMatrix + __localBox() + localOrigin」计算世界轴对齐
   * 包围盒 [minX, minY, maxX, maxY]，零分配（手动 4 角变换，不复用 vec2 以免每帧分配）。
   * 前置条件：调用方已保证 composedMatrix 新鲜（render 之后 / composeMatrix 之后）。
   */
  public __paintWorldBox(out: any = [0, 0, 0, 0]): number[] {
    const m = this.state.composedMatrix;
    const origin = this.state.localOrigin;
    const ox = origin ? origin[0] : 0;
    const oy = origin ? origin[1] : 0;
    const lb = this.__localBox();
    const xs = [lb[0] - ox, lb[2] - ox];
    const ys = [lb[1] - oy, lb[3] - oy];
    out[0] = out[1] = Infinity;
    out[2] = out[3] = -Infinity;

    if (!m || m.length < 6) {
      // 未合成过矩阵：退回本地几何（此时若真上屏，render 会先合成）
      out[0] = xs[0];
      out[1] = ys[0];
      out[2] = xs[1];
      out[3] = ys[1];
      return out;
    }
    const a = m[0];
    const b = m[1];
    const c = m[2];
    const d = m[3];
    const e = m[4];
    const f = m[5];
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
  /**
   * `destory()` 的拼写修正别名。
   * 历史 API 拼写为 `destory`（已对外发布，不能直接改名），这里提供正确拼写作为等价入口。
   */
  public destroy(): void {
    this.destory();
  }

  public destory(): void {
    // 先摘除动画：否则动画管理器仍会每帧 setState 到这个已销毁的组件（内存与 CPU 双泄漏）。
    // 注意必须在清空 this.ice 之前做。
    if (this.ice && this.ice.animationManager) {
      this.ice.animationManager.remove(this);
    }

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
