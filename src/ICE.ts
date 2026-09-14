/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { isString } from './util/lang';
import { rebindComponentTree } from './util/data-util';
import AnimationManager from './animation/AnimationManager';
import { componentTypeEntries } from './consts/COMPONENT_TYPE_MAPPING';
import ICE_EVENT_NAME_CONSTS from './consts/ICE_EVENT_NAME_CONSTS';
import ICEControlPanelManager from './control-panel/ICEControlPanelManager';
import AlignmentGuideManager from './control-panel/AlignmentGuideManager';
import root from './cross-platform/root';
import DOMEventDispatcher from './event/DOMEventDispatcher';
import DOMEventInterceptor from './event/DOMEventInterceptor';
import EventBus from './event/EventBus';
import FrameManager from './FrameManager';
import ICEComponent from './graphic/ICEComponent';
import ICELinkSlotManager from './graphic/link/ICELinkSlotManager';
import Deserializer from './persistence/Deserializer';
import Serializer from './persistence/Serializer';
import PluginHost, { ICEPlugin } from './plugin/PluginHost';
import { buildAccessibilityTree, ICEAccessibleNode, ICEAccessibilityOptions } from './a11y/accessibility';
import CanvasRenderer from './renderer/CanvasRenderer';
import { exportSvg, exportSvgResult } from './export/SvgExporter';
import type { SvgExportOptions, SvgExportResult } from './export/SvgExporter';
import ImageCache from './util/ImageCache';
import {
  resolveTheme,
  getTheme,
  registerTheme,
  getRegisteredTheme,
  DEFAULT_THEME,
  deepDiff,
  mergeThemes,
  registerPreset,
  validateTheme,
  type ICETheme,
  type ICESemanticTheme,
  type ICEThemePatch,
  type ICEChromeTheme,
  type ICEThemeInput,
} from './theme/ICETheme';
import { assertTypeId } from './util/type-id';
import { ICE_ERROR_CODES, iceError } from './util/errors';

/**
 * 一次主题变更的说明（`ice.onThemeChange(fn)` 的回调入参）。
 *
 * - `kind: 'theme'` —— 来自 `setTheme()`（语义色 / palette / motion 等整体变了）
 * - `kind: 'chrome'` —— 来自 `setChrome()`（只有交互外壳那组 token 变了）
 */
export interface ICEThemeChangeInfo {
  /** 变更**之后**的主题（就是此刻 `ice.getTheme()` 的那一份）。 */
  theme: ICETheme;
  /** 变更之前的主题。 */
  previous: ICETheme;
  kind: 'theme' | 'chrome';
}

/**
 * 给 `ctx.createXxxGradient()` 的产物挂一份**可序列化的描述**。
 *
 * 原生 `CanvasGradient` 是不透明的（拿不到颜色停靠点），于是「命令式创建的渐变」没法进快照、
 * 也没法导出 SVG —— 而声明式的 `style.fillGradient` 可以。这里在保留原生对象（画布照常用）
 * 的前提下，旁挂一份描述（`__iceGradient`，**不可枚举**，不影响 `state.style` 的遍历与序列化），
 * 并把 `addColorStop` 包一层，把停靠点同时记进描述里。
 *
 * 这样应用层怎么写渐变都能被导出/复用：`fillStyle: g`（命令式）与 `fillGradient: {...}`（声明式）
 * 在导出器眼里是同一件事。
 */
function tagGradient(native: any, desc: any): any {
  if (!native || typeof native.addColorStop !== 'function') {
    return native;
  }
  Object.defineProperty(native, '__iceGradient', { value: desc, enumerable: false, configurable: true });
  const addColorStop = native.addColorStop.bind(native);
  native.addColorStop = (offset: number, color: string) => {
    desc.stops.push([offset, color]);
    addColorStop(offset, color);
  };
  return native;
}
import { flattenAllComponents, hitTestComponents } from './util/data-util';
import { deepMerge } from './theme/ICETheme';
import { HIT_BOX_TOLERANCE } from './renderer/dirty-rect-util';

/**
 * @class ICE
 *
 * - ICE 是整个引擎的主入口类。
 * - 同一个 canvas 标签上只能初始化一个 ICE 实例。
 * - 同一个页面上可以存在多幅图。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICE {
  public childNodes = []; //直接渲染在 canvas 上的组件集合
  public toolNodes = []; //工具组件集合，如变换工具，这些组件不会被序列化，并且在整个生命周期中不会被删除。
  //@perf: 用 WeakSet 做 O(1) 去重，避免 addChild/addTool 每组件 indexOf 导致的 O(n^2)（批量挂载热路径）。
  private __childSet = new WeakSet<any>();
  private __toolSet = new WeakSet<any>();
  public evtBus: EventBus; //事件总线，每一个 ICE 实例上只能有一个 evtBus 实例
  public root; //在浏览器里面是 window 对象，在 NodeJS 环境里面是 global 对象
  public canvasEl; // canvas 标签元素
  public ctx; //CanvasRenderingContext2D, @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
  public canvasWidth: number = 0;
  public canvasHeight: number = 0;
  public canvasBoundingClientRect;
  /** 视口变换（视图缩放/平移）：屏幕 = 世界 * scale + translate。默认单位视口，不影响既有行为。 */
  public viewport: { scale: number; tx: number; ty: number } = { scale: 1, tx: 0, ty: 0 };
  /**
   * 设备像素比。默认 1（不改变既有行为）。
   *
   * 传 >1 时（`ICE.init(el, { dpr: 2 })`）：引擎把 canvas 的 backing store 放大到 cssSize*dpr，
   * 渲染变换乘以 dpr，从而在高分屏上不发虚。**交互侧（命中/拖拽/吸附）仍用 CSS 像素语义**，
   * 因为鼠标/触摸坐标本身就是 CSS 像素，所以 screenToWorld 不参与 dpr。
   */
  public dpr: number = 1;
  /** 渲染用视口缓存（= dpr · viewport），避免每组件每帧分配对象。 */
  private __renderVp: any = null;
  /**
   * canvas 内容盒（绘制区）相对视口的偏移与尺寸。
   *
   * `getBoundingClientRect()` 返回的是 **border-box**，而 canvas 的绘制区是**内容盒**：
   * 画布带 border / padding 时，若直接用 rect.left/top 换算鼠标坐标会整体偏移（差一个边框宽），
   * backing store 尺寸也会被边框撑大。这里在刷新 rect 时一并读取 computedStyle 补偿。
   */
  private __contentBox: any = null;
  /** 上次用于「位移增量」的矩形快照（不持有 DOMRect 引用，见 __rememberInputRect）。 */
  private __inputRectSnapshot: { left: number; top: number; width: number; height: number } | null = null;
  public selectionList: Array<any> = []; //当前选中的组件列表，支持 Ctrl 键同时选中多个组件。
  /** 插件宿主：组件 / 渲染 / 交互工具三层注册点，见 `src/plugin/PluginHost.ts`。 */
  public plugins: PluginHost = new PluginHost(this);
  /**
   * 当前实例持有的主题（**实例级**，互不污染）。
   *
   * 初始值取模块级默认主题；`setTheme()` 只改本实例。
   * 组件构造时若用了 `preset`，会在加入本实例时按这里的主题重新解析一次
   * （见 `addChild` / `addTool` 中的 `__reapplyPreset`）。
   */
  public theme: ICETheme = getTheme();
  /** 主题版本号：每次 setTheme / setChrome 递增，组件的作用域主题缓存据此失效。 */
  public __themeRevision = 0;
  /** 命名主题名（快照用；对象形式的部分主题不改它）。 */
  private __themeName: string | null = null;
  /** 快照的基线主题名：主题补丁是叠在它上面的（默认 default）。 */
  private __themeBaseName = 'default';
  /** 有没有动过主题（没动过就不往快照里写 theme 字段）。 */
  private __themeTouched = false;
  /** 订阅者抛错的提示只打一次（见 __warnThemeListenerOnce）。 */
  private __themeListenerWarned = false;
  /** 累积的主题补丁（内部记录；快照实际写的是 diff，见 themeSnapshot()）。 */
  private __themePatch: any = null;
  private __interactionStatesEnabled = false;
  private __hoveredComponent: any = null;

  /**
   * 类型名（canonical typeId，`namespace:Type`）与构造函数之间的映射关系。
   *
   * 序列化时由构造函数反查类型名，反序列化时由类型名取出构造函数。
   * 用**无原型对象**承载：否则 `getType('constructor')` / `getType('toString')`
   * 这类历史脏数据会命中 `Object.prototype` 上的成员，拿到一个非构造函数的东西。
   */
  public typeMapping: Record<string, any> = Object.create(null);
  /** 构造函数 → 类型名 的反查表（序列化用）。惰性构建，registerType/init 后失效重建。 */
  private __typeIdMapping: Map<any, string> | null = null;

  /**
   * 文档级元信息（当前只有 `createTime`）。
   *
   * 语义：**首次创建时间跨「打开 → 再保存」保留**。
   * - `Deserializer` 读到合法 `createTime` 时写在这里（归一化成 ISO 8601 UTC）；
   * - `Serializer` 写出时优先用它，`lastModifyTime` 才是"这一次写出的时刻"；
   * - `clearAll()` 清空场景时一并清掉（清空后新建的内容属于新文档，不该继承旧文档的创建时间）；
   * - 因此"打开 A → 编辑 → 保存"里 `createTime` 稳定不变，只有 `lastModifyTime` 前进。
   */
  public documentMeta: { createTime?: string } = {};

  public renderer: any; //渲染器实例
  public animationManager: AnimationManager;
  public eventDispatcher: DOMEventDispatcher;
  public controlPanelManager: ICEControlPanelManager;
  public alignmentGuide: AlignmentGuideManager;
  public linkSlotManager: ICELinkSlotManager;
  public serializer: Serializer;
  public deserializer: Deserializer;
  public imageCache: ImageCache;

  private __dirty: boolean = true; //如果此标志位为 true ，所有组件都会全部被重新绘制

  constructor() {
    // 内置类型在构造时注册，保证任何 ICE 实例从创建起就有完整、稳定的注册表。
    for (let i = 0; i < componentTypeEntries.length; i++) {
      const entry = componentTypeEntries[i];
      this.registerType(entry.typeId, entry.ctor);
    }
  }

  /** 是否已经完成初始化（用于 init 幂等 / destroy 配对） */
  private __initialized = false;

  /**
   * 从 init 入参解析出 canvas 元素。
   * 支持：HTMLCanvasElement、CanvasRenderingContext2D；解析不出则返回 null。
   */
  private __resolveCanvasEl(ctx: any): any {
    if (ctx && typeof ctx.getContext === 'function') {
      return ctx; //HTMLCanvasElement
    }
    if (ctx && ctx.canvas && typeof ctx.canvas.getContext === 'function') {
      return ctx.canvas; //CanvasRenderingContext2D
    }
    return null;
  }

  /**
   * 读画布矩形（border-box）。
   *
   * **小程序 / 无 DOM 的运行时没有 `getBoundingClientRect`**：那里的 canvas 节点只有
   * `width` / `height` / `getContext`，尺寸要自己用 `wx.createSelectorQuery()` 拿。
   * 这种情况下退回「原点在 (0,0)、尺寸取画布自身尺寸」的矩形 —— 正好对上小程序触摸事件
   * 的坐标语义（`touch.x/y` 就是相对画布的），输入换算与内容盒计算因此有确定输入，
   * 宿主不需要再包一层假 DOM。
   *
   * 有原生实现的运行时（浏览器、jsdom）行为完全不变。
   */
  public readCanvasRect(el: any = this.canvasEl): any {
    if (el && typeof el.getBoundingClientRect === 'function') {
      return el.getBoundingClientRect();
    }
    const width = (el && el.width) || 0;
    const height = (el && el.height) || 0;
    return { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 };
  }

  /**
   * @param ctx DOM id、HTMLCanvasElement 或 CanvasRenderingContext2D
   * @param options 渲染配置。renderMode: 'dirty-rect'(默认) | 'full'
   *
   * 幂等：同一个 ICE 实例重复 init 到同一个 canvas 时直接返回自身。
   * React StrictMode 下 effect 会被执行两次，幂等可以避免重复挂载 Manager / 重复绑定全局事件。
   * 若要换一个 canvas，请先调用 destroy()。
   */
  public init(ctx: any, options: { renderMode?: 'full' | 'dirty-rect'; dpr?: number } = {}) {
    if (!ctx) {
      throw iceError(ICE_ERROR_CODES.INIT_TARGET_REQUIRED, 'ICE.init() failed...');
    }

    const canvasEl = this.__resolveCanvasEl(ctx);

    if (this.__initialized) {
      if (canvasEl && canvasEl === this.canvasEl) {
        return this;
      }
      throw iceError(
        ICE_ERROR_CODES.INIT_ALREADY_BOUND,
        '同一个 ICE 实例已经绑定到其它 canvas，如需重新初始化请先调用 destroy()。'
      );
    }

    // 内置类型已在构造函数中注册；这里不再拷贝映射，避免重复注册。

    this.root = root;

    if (isString(ctx)) {
      this.canvasEl = this.root.document.getElementById(ctx);
    } else if (canvasEl) {
      //直接接收 HTMLCanvasElement / CanvasRenderingContext2D
      this.canvasEl = canvasEl;
    }

    // 设备像素比：仅在显式传入 >1 时启用，默认 1 完全不改变既有行为。
    if (options && typeof options.dpr === 'number' && options.dpr > 0) {
      this.dpr = options.dpr;
    }

    if (this.canvasEl) {
      //禁用 canvas 元素上的原生右键菜单
      this.canvasEl.oncontextmenu = function (e) {
        // 注意：**不能 stopPropagation** —— 事件必须继续冒泡到 window，
        // DOMEventInterceptor 才能把它转发给组件（否则 canvas 上的右键
        // 永远收不到 contextmenu，右键菜单/插旗这类交互直接失效）。
        e.preventDefault();
      };
      this.canvasWidth = this.canvasEl.width;
      this.canvasHeight = this.canvasEl.height;
      this.canvasBoundingClientRect = this.readCanvasRect();
      this.__rememberInputRect(this.canvasBoundingClientRect);
      this.__contentBox = this.__readContentBox(this.canvasBoundingClientRect);
      this.ctx = this.canvasEl.getContext('2d');
      // 触摸输入必需：阻止浏览器把手势解释为页面滚动/缩放，否则触摸拖拽会被浏览器抢走。
      // 应用层若确实需要页面滚动，可自行覆盖该样式。
      if (this.canvasEl.style) {
        this.canvasEl.style.touchAction = 'none';
      }
      // 高分屏：把 backing store 放大到 cssSize*dpr，并把 CSS 尺寸固定为逻辑尺寸。
      if (this.dpr !== 1) {
        this.__applyDevicePixelRatio();
      }
    } else {
      //裸 context 兜底
      this.ctx = ctx;
    }

    //启动当前 ICE 实例上的所有 Manager，有顺序
    // 后续所有 Manager 都依赖事件总线，所以 this.evtBus 需要最先初始化。
    // `||` 是给「init 之前就订阅过」的场景留的：订阅事件先建了总线（见 __themeBus），
    // 这里再 new 一个会把订阅悄悄丢掉。
    this.evtBus = this.evtBus || new EventBus();
    FrameManager.registerEvtBus(this.evtBus, this);
    FrameManager.start();

    DOMEventInterceptor.registerEvtBus(this.evtBus);
    DOMEventInterceptor.start();
    this.eventDispatcher = new DOMEventDispatcher(this).start();
    this.animationManager = new AnimationManager(this).start();
    this.controlPanelManager = new ICEControlPanelManager(this).start();
    this.renderer = new CanvasRenderer(this, options).start();
    this.alignmentGuide = new AlignmentGuideManager(this); // 默认禁用，应用层显式 enable 才启用
    this.linkSlotManager = new ICELinkSlotManager(this).start(); //linkSlotManager 内部会监听 renderer 上的事件，所以 linkSlotManager 需要在 renderer 后面实例化。
    this.serializer = new Serializer(this);
    this.deserializer = new Deserializer(this);
    this.imageCache = new ImageCache(this);

    this.__initialized = true;
    return this;
  }

  /**
   * @method destroy 销毁当前实例
   *
   * 与 init() 配对：停止所有 Manager、解绑 canvas 上的原生事件、注销全局事件总线（FrameManager / DOMEventInterceptor 都是全局单例，必须显式注销）。
   * 销毁之后可以再次 init（例如 React 组件重新挂载），不会累积监听或帧循环。
   */
  public destroy(): void {
    if (!this.__initialized) {
      return;
    }

    //1) 停止各 Manager
    const managers = [this.renderer, this.animationManager, this.controlPanelManager, this.linkSlotManager];
    for (let i = 0; i < managers.length; i++) {
      const manager: any = managers[i];
      if (manager && typeof manager.stop === 'function') {
        manager.stop();
      }
    }
    if (this.eventDispatcher) {
      this.eventDispatcher.stopped = true;
    }

    //2) 解绑 canvas 上的原生事件
    if (this.canvasEl && this.canvasEl.oncontextmenu) {
      this.canvasEl.oncontextmenu = null;
    }

    //4) 清空场景并释放引用（插件工具也一并摘下）
    //
    // 注意顺序：**先清场景、后注销总线**。clearAll → removeChild 会把 `ice.dirty` 置真，
    // 而 `dirty = true` 会 `FrameManager.wake()`（空闲停帧的唤醒路径）——若此时已经注销完总线，
    // 这一次 wake 会把刚停下的帧循环又拉起来，destroy 之后 `FrameManager.stopped` 就不是 true 了
    //（既有回归用例正是断言这一点）。放在最后注销，终态才是"没有总线 → 停帧"。
    if (this.plugins) {
      this.plugins.clear();
    }
    this.clearAll();

    //3) 注销全局事件总线
    if (this.evtBus) {
      FrameManager.delEvtBus(this.evtBus);
      DOMEventInterceptor.delEvtBus(this.evtBus);
    }
    if (FrameManager.evtBuses.length === 0) {
      FrameManager.stop();
    }
    this.renderer = null;
    this.animationManager = null;
    this.controlPanelManager = null;
    this.linkSlotManager = null;
    this.eventDispatcher = null;
    this.alignmentGuide = null;
    this.serializer = null;
    this.deserializer = null;
    this.imageCache = null;
    this.ctx = null;
    this.canvasEl = null;
    this.canvasBoundingClientRect = null;
    this.dpr = 1;
    this.__renderVp = null;
    this.__contentBox = null;
    this.__inputRectSnapshot = null;

    //5) 分层渲染的连接：本实例销毁后不再接受同步；同时也断开它作为 source 的跟随者，
    //   避免别的实例继续往一个已销毁的实例上推视口。
    this.__inputPassthrough = false;
    if (this.__viewportFollowers) {
      this.__viewportFollowers.clear();
      this.__viewportFollowers = null;
    }

    this.__initialized = false;
  }

  /**
   * @method addChild
   * 添加交互工具组件。
   * 工具组件不触发事件，不产生动画效果。
   * @param {ICEComponent} tool
   */
  public addTool(tool: ICEComponent) {
    if (this.__toolSet.has(tool)) return;

    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD, null, { component: tool });
    tool.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD);

    tool.ice = this;
    tool.ctx = this.ctx;
    tool.evtBus = this.evtBus;
    this.toolNodes.push(tool);
    this.__toolSet.add(tool);
    this.dirty = true;
    if (this.renderer) this.renderer.markQueueDirty();

    // 实例级主题：组件构造时按模块级默认主题解析了 preset，加入本实例时按本实例主题再解析一次
    if (tool && typeof tool.__reapplyPreset === 'function') {
      tool.__reapplyPreset(this.theme);
    }

    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD, null, { component: tool });
    tool.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD);
  }

  /**
   * @methos removeTool
   * 删除交互工具组件。
   * 工具组件不触发事件，不产生动画效果。
   * @param tool
   */
  public removeTool(tool: ICEComponent) {
    if (!this.__toolSet.has(tool)) return;
    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, null, { component: tool });
    tool.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE);
    const index = this.toolNodes.indexOf(tool);
    if (index !== -1) this.toolNodes.splice(index, 1);
    this.__toolSet.delete(tool);
    // AFTER_REMOVE 必须在 destory() 之前触发：destory() 会 purgeEvents，之后再触发就没监听者了
    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE, null, { component: tool });
    tool.trigger(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE);
    this.dirty = true;
    if (this.renderer) this.renderer.markQueueDirty();
    tool.destory();
  }

  /**
   *
   * 调用 ICE.addChild() 方法，会直接把对象画在 canvas 上。
   * 如果需要在容器中画组件，参见 @see ICEGroup.addChild() 方法
   *
   * @param component
   */
  public addChild(component, markDirty: boolean = true) {
    if (this.__childSet.has(component)) return;

    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD, null, { component: component });
    component.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD);

    component.ice = this;
    component.ctx = this.ctx;
    component.evtBus = this.evtBus;
    component.parentNode = null;
    this.childNodes.push(component);
    this.__childSet.add(component);
    //@perf: 用 for...in 探测是否有动画，避免 Object.keys 每组件分配一个数组（批量挂载热路径）。
    let hasAnimations = false;
    const animations = component.props.animations;
    if (animations) {
      for (const key in animations) {
        hasAnimations = true;
        break;
      }
    }
    if (hasAnimations) {
      this.animationManager.add(component);
    }

    this.dirty = markDirty;
    if (this.renderer) this.renderer.markQueueDirty();

    // 实例级主题：同步一次 preset（见 addTool 中的说明）
    if (component && typeof component.__reapplyPreset === 'function') {
      component.__reapplyPreset(this.theme);
    }

    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD, null, { component: component });
    component.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD);
  }

  public addChildren(arr: Array<ICEComponent>): void {
    for (let i = 0; i < arr.length; i++) {
      this.addChild(arr[i], false);
    }
    this.dirty = true;
  }

  public removeChild(component: ICEComponent, markDirty: boolean = true) {
    if (!this.__childSet.has(component)) return;
    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, null, { component: component });
    component.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE);
    const index = this.childNodes.indexOf(component);
    if (index !== -1) this.childNodes.splice(index, 1);
    this.__childSet.delete(component);
    // AFTER_REMOVE 必须在 destory() 之前触发（destory 会 purgeEvents），否则组件级监听收不到
    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE, null, { component: component });
    component.trigger(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE);
    this.dirty = markDirty;
    if (this.renderer) this.renderer.markQueueDirty();
    component.destory();
  }

  public removeChildren(arr: Array<ICEComponent>): void {
    for (let i = 0; i < arr.length; i++) {
      this.removeChild(arr[i], false);
    }
    this.dirty = true;
  }

  public clearAll() {
    this.removeChildren([...this.childNodes]);
    // 清空即"新文档"：不继承旧文档的创建时间（`Deserializer` 载入时会把读到的 createTime 重新写回来）
    this.documentMeta = {};
  }

  /**
   * 按 id 查找组件。
   *
   * 查找范围：**先查顶层 `childNodes`**（同 id 时顶层优先，保持既有优先级），再深度优先递归整棵
   * 子树。「连线连接嵌套子组件」依赖本方法（`ICEPolyLine.syncConnections` → 本方法）。
   *
   * **工具层 `toolNodes` 不参与查找**：工具是 UI 覆盖层（变换/连线手柄等），不应成为连线端点。
   *
   * 历史：早期只搜第一层，嵌套场景连线会静默失效；中途曾尝试放开递归但被回退 ——
   * 当时表现为 `dirty-rect-pixel` 富场景 step1 约 900 px 差异，看起来像「连线端点推导与局部重绘
   * 冲突」，实际根因是**折线的包围盒是退化的**（`state.width ≈ 0`），导致 dirty-rect 按快照盒
   * 挑选重画对象时漏掉折线（擦除区域内的折线笔迹丢失）。该根因已修（见 `ICEComponent.__localBox`
   * 与 `ICEPolyLine.calcComponentParams`），因此递归可以放开。
   */
  public findComponent(id: string) {
    if (!id) {
      return undefined;
    }
    const top = this.childNodes.filter((item) => item.props.id === id)[0];
    return top || this.__findComponentInTree(this.childNodes, id);
  }

  /** 深度优先查找子树（不含工具层）。 */
  private __findComponentInTree(nodes: any[], id: string): any {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.props && node.props.id === id) {
        return node;
      }
      if (node.childNodes && node.childNodes.length) {
        const hit = this.__findComponentInTree(node.childNodes, id);
        if (hit) {
          return hit;
        }
      }
    }
    return undefined;
  }

  public set dirty(flag: boolean) {
    this.__dirty = flag;
    // 置脏 = "这一帧有事要做"：空闲停帧之后必须把帧循环唤醒，否则画面永远不更新。
    // 循环已经在跑时 wake() 只是一次布尔判断（可安全挂在 setState 这类高频路径上）。
    if (flag) {
      FrameManager.wake();
    }
  }

  public get dirty() {
    return this.__dirty;
  }

  /**
   * 「帧需求」：这一帧还需要继续跑吗（`FrameManager` 空闲停帧靠它判断）。
   *
   * 有脏要重绘、或有动画在推进 → 需要；否则可以停帧省电。
   * 应用层若自己监听 `ICE_FRAME_EVENT` 做每帧计算（时钟、呼吸灯…），
   * 调 `ice.setContinuousFrames(true)` 让本实例永远报"需要帧"。
   */
  public needsFrame(): boolean {
    if (this.__continuousFrames) {
      return true;
    }
    if (this.__dirty) {
      return true;
    }
    const manager: any = this.animationManager;
    if (manager && typeof manager.hasActiveAnimations === 'function') {
      return !!manager.hasActiveAnimations();
    }
    return false;
  }

  /** 是否永远需要帧（见 {@link ICE.needsFrame}）；默认 false = 允许空闲停帧。 */
  private __continuousFrames = false;

  /**
   * 让本实例永远需要帧（应用层自己按帧做计算时用；默认关闭 = 空闲停帧省电）。
   * 打开后会立刻唤醒帧循环。
   */
  public setContinuousFrames(enabled: boolean): this {
    this.__continuousFrames = !!enabled;
    if (this.__continuousFrames) {
      FrameManager.wake();
    }
    return this;
  }

  /** 当前是否"永远需要帧"（见 {@link ICE.setContinuousFrames}）。 */
  public isContinuousFrames(): boolean {
    return this.__continuousFrames;
  }

  /**
   * 显式覆盖「减少动态效果」（默认取系统偏好 `prefers-reduced-motion`，见 `AnimationManager.reducedMotion`）。
   *
   * 为 true 时动画不播放过程、直接落终点（无障碍上最保守的语义）。应用层也可以把它接到自己的
   * 偏好设置里（比如"我的设置 → 降低动效"），而不必改系统设置。
   */
  public setReducedMotion(enabled: boolean): this {
    if (this.animationManager) {
      this.animationManager.reducedMotion = !!enabled;
    }
    return this;
  }

  /** 当前是否处于「减少动态效果」（见 {@link ICE.setReducedMotion}）。 */
  public isReducedMotion(): boolean {
    return !!(this.animationManager && this.animationManager.reducedMotion);
  }

  /**
   * @method registerType 注册组件类型
   *
   * 类型标识必须使用 `namespace:Type` 格式（例：`ice-render:Rect`、`my-app:Badge`）。
   *
   * 冲突策略（全部**明确抛错**，绝不静默覆盖）：
   * - 同一 typeId + 同一构造函数：幂等，不抛错（多入口 / 热更新会重复调用）；
   * - 同一 typeId + 不同构造函数：抛错；
   * - 同一构造函数注册第二个 typeId：抛错（否则 getTypeId 反查歧义，写出哪个名字取决于注册顺序）。
   *
   * 类型名**只有 canonical 一种形式**：引擎不做「旧的无 namespace 类名」兼容
   * （ICE 家族仍在发布初期，用旧的只有自己的示例与测试，直接改名比养一套别名简单）。
   */
  public registerType(typeId: string, Clazz: new (...args: any[]) => any): void {
    assertTypeId(typeId, 'registerType 的 typeId');
    if (typeof Clazz !== 'function') {
      throw iceError(ICE_ERROR_CODES.TYPE_CTOR_INVALID, `registerType("${typeId}") 失败：Clazz 必须是构造函数。`, {
        typeId,
      });
    }

    const existing = this.typeMapping[typeId];
    if (existing) {
      if (existing === Clazz) {
        return;
      }
      throw iceError(
        ICE_ERROR_CODES.TYPE_ID_CONFLICT,
        `typeId "${typeId}" 已注册为 ${existing.name || '匿名构造函数'}，不能再注册 ${Clazz.name || '匿名构造函数'}。`,
        { typeId, registered: existing.name || 'anonymous', incoming: Clazz.name || 'anonymous' }
      );
    }

    const existingTypeId = this.getTypeId(Clazz);
    if (existingTypeId && existingTypeId !== typeId) {
      throw iceError(
        ICE_ERROR_CODES.TYPE_CTOR_CONFLICT,
        `构造函数 ${Clazz.name || '匿名构造函数'} 已注册为 "${existingTypeId}"，不能同时注册为 "${typeId}"（反查会歧义）。`,
        { typeId, existingTypeId }
      );
    }

    this.typeMapping[typeId] = Clazz;
    this.__typeIdMapping = null; // 反查表失效，下次序列化重建
  }

  /** 是否注册了某个 canonical typeId。 */
  public hasType(typeId: string): boolean {
    return typeof typeId === 'string' && !!this.typeMapping[typeId];
  }

  /** 当前实例的 canonical typeId 列表（快照）。 */
  public getRegisteredTypeIds(): string[] {
    return Object.keys(this.typeMapping);
  }

  /**
   * 由构造函数反查稳定的类型名（序列化用）。
   *
   * - 已注册的类型：返回 canonical typeId（`namespace:Type`，与类的 JS 名解耦，压缩改名不影响已存数据）
   * - 未注册：返回 undefined，调用方回退到 `constructor.name`（保持既有行为）
   * - 一个构造函数只可能有一个 canonical typeId（重复注册会抛错，见 registerType）
   */
  public getTypeId(Clazz: new (...args: any[]) => any): string | undefined {
    if (!Clazz) {
      return undefined;
    }
    let mapping = this.__typeIdMapping;
    if (!mapping) {
      mapping = new Map<any, string>();
      for (const key in this.typeMapping) {
        const C = this.typeMapping[key];
        if (typeof C === 'function' && !mapping.has(C)) {
          mapping.set(C, key);
        }
      }
      this.__typeIdMapping = mapping;
    }
    return mapping.get(Clazz);
  }

  /**
   * 注册插件（幂等：同名插件重复调用直接返回，不重复 setup）。
   *
   * 插件可提供三层扩展点：`components`（自定义图元类型）、`render`（每帧绘制回调）、
   * `tools`（按选中组件匹配的交互工具）。详见 `src/plugin/PluginHost.ts`。
   *
   * @returns 是否本次真的注册（同名已存在时为 false）
   */
  public use(plugin: ICEPlugin): boolean {
    return this.plugins.use(plugin);
  }

  /**
   * 注销插件：撤销其渲染回调与交互工具，并调用 `teardown`。
   * 注意：`components` 里注册的类型**保留**（反序列化可能仍依赖，且撤销会让已存数据失效）。
   */
  public unuse(name: string): boolean {
    return this.plugins.unuse(name);
  }

  /** 已注册插件名（只读快照）。 */
  public getPlugins(): string[] {
    return this.plugins.names;
  }

  /**
   * 更新选中集合的**统一入口**：写 `selectionList` 并同步插件工具。
   * 约定：目前插件工具按「首个选中组件」匹配（引擎当前也仅支持单选）。
   *
   * @returns 是否有「排他」插件工具命中 —— 调用方据此禁用内置变换/连线面板
   */
  public setSelection(components: Array<any> | any | null): boolean {
    if (components == null) {
      this.selectionList = [];
    } else {
      this.selectionList = Array.isArray(components) ? components : [components];
    }
    if (!this.plugins) {
      return false;
    }
    return this.plugins.syncTools(this.selectionList[0] || null);
  }

  /**
   * 无障碍：取「可访问节点快照」，供应用层渲染隐藏 DOM 镜像（screen reader / 键盘导航）。
   *
   * 引擎**不**自建 DOM 镜像层 —— 镜像的 DOM 结构、ARIA 属性、文案与焦点环高度依赖具体产品语义。
   * 引擎负责给出：id / 角色建议 / 可读名称 / **屏幕坐标盒（CSS 像素）** / 层级 / tab 顺序 / 选中态；
   * 应用层据此渲染 `<div role="img" aria-label=... style="position:absolute; ...">` 之类的镜像元素，
   * 并用 `setFocusedComponent()` 把 DOM 焦点映射回组件。
   *
   * 不含未上屏（无有效变换矩阵）的组件，也不会修改任何组件 state。
   */
  public getAccessibilityTree(options?: ICEAccessibilityOptions): ICEAccessibleNode[] {
    return buildAccessibilityTree(this, options);
  }

  /**
   * 设置键盘事件的焦点组件（无障碍 / 键盘导航原语）。
   *
   * 未设置时维持既有行为：键盘事件派发给「上次点击命中的组件」。
   * 传入 id 字符串或组件实例；传 null / undefined 清除焦点。
   */
  public setFocusedComponent(component: any | string | null): this {
    let target = component;
    if (typeof component === 'string') {
      const all = flattenAllComponents(this);
      target = all.filter((c: any) => c.props && c.props.id === component)[0] || null;
    }
    if (this.eventDispatcher) {
      this.eventDispatcher.focusedComponent = target || null;
    }
    return this;
  }

  /** 当前键盘焦点组件（未设置时为 null）。 */
  public getFocusedComponent(): any {
    return this.eventDispatcher ? this.eventDispatcher.focusedComponent : null;
  }

  /**
   * 根据类型名取构造函数（反序列化用）。
   *
   * 类型名**只有 canonical 一种形式**（`namespace:Type`）：注册表里没有的名字一律返回
   * undefined（`Deserializer` 会把该节点记入 `unknownTypes` 并跳过）。因此引擎不做
   * 「旧的无 namespace 类名」兼容 —— 那是另一条迟早要还的技术债。
   *
   * @method getType 获取组件构造函数
   * @param typeId canonical typeId（`namespace:Type`）
   * @returns 构造函数；未注册时返回 undefined
   */
  public getType(typeId: string) {
    if (typeof typeId !== 'string' || !typeId) {
      return undefined;
    }
    return this.typeMapping[typeId];
  }

  /**
   * 加载自定义字体（平台适配）：浏览器走 FontFace API，小程序走 wx.loadFont。
   * 加载后，在 ICEText 的 style.fontFamily 里引用该字体名即可。
   *
   * **字体就绪后会重新量测已挂载的文本**（`remeasureTexts()`）：首帧通常还没拿到自定义字体，
   * 用回退字体量出的宽高与换行会残留 —— 这是 i18n 场景（中文字体按需加载）最容易踩的坑。
   * @param family 字体族名（如 'MyFont'）
   * @param source 字体源（浏览器为 url/二进制，小程序为本地文件路径）
   */
  public loadFont(family: string, source: string): Promise<any> {
    return Promise.resolve(root.loadFont(family, source)).then((result: any) => {
      this.remeasureTexts();
      return result;
    });
  }

  /**
   * 把所有已挂载的文本组件标记为「需要重新量测」（字体加载完成、主题换字号等度量前提变化时用）。
   *
   * 只标脏、不立即量测：真正的重算发生在各自的 render 里（`paramsDirty → calcComponentParams → measureText`），
   * 因此零副作用、任何时候都能调（组件还没挂到画布上也安全）。
   */
  public remeasureTexts(): this {
    const all = flattenAllComponents(this);
    let touched = false;
    for (let i = 0; i < all.length; i++) {
      const component: any = all[i];
      if (component && typeof component.remeasureText === 'function') {
        component.remeasureText();
        touched = true;
      }
    }
    if (touched) {
      this.dirty = true;
    }
    return this;
  }

  /**
   * 切换主题。
   *
   * 入参三种形态（都支持热切换，不用重建场景）：
   * - 命名主题：`ice.setTheme('dark')`
   * - 部分主题（深合并）：`ice.setTheme({ primary: '#f00' })`（平铺 semantic，兼容旧写法）
   *   或 `ice.setTheme({ base: { radius: { md: 6 } }, motion: { duration: { fast: 50 } } })`
   * - 完整主题对象：`ice.setTheme(registeredTheme)`
   *
   * 热切换覆盖两条路径：
   *   ① 样式里写了**主题引用**（`token('primary')` / `'$primary'`）的：paint 时解析，标脏即可；
   *   ② 用了 `preset` 与「没写 style」的：重新 resolve 一次默认值。
   */
  public setTheme(theme: ICEThemeInput): this {
    const previous = this.theme;
    // 实例级：不修改模块级默认主题，因此多个 ICE 实例可以有各自的主题（多品牌/多租户）
    this.theme = resolveTheme(theme, this.theme);
    this.__themeTouched = true;
    if (typeof theme === 'string') {
      // 命名主题：整份替换；补丁与基线都重置到它
      this.__themeName = theme;
      this.__themeBaseName = theme;
      this.__themePatch = null;
    } else if (theme && typeof theme === 'object') {
      // 部分主题：叠在当前主题之上，基线（命名主题）不变
      this.__themePatch = this.__themePatch ? deepMerge(this.__themePatch, theme) : { ...(theme as any) };
    }
    // 主题版本号：组件的作用域主题缓存靠它失效
    this.__themeRevision++;
    this.__reapplyPresets();
    this.__notifyThemeChange(previous, 'theme');
    return this;
  }

  /**
   * 只改**交互外壳**（选中框 / 手柄 / 插槽 / 引导线 / 连线标签 / 选区 / 阴影颜色 / 调试框）。
   *
   * 与 `setTheme` 的关系：外壳是主题里的一组 token（`semantic.chrome`），
   * 这个方法就是「只覆盖这一组」的语法糖 —— 应用层想保留主题的其余部分、只换品牌色手柄时用它。
   *
   * ```ts
   * ice.setChrome({ handle: { fill: '#0d6efd', stroke: '#0d6efd' } });
   * ```
   */
  public setChrome(patch: Partial<ICEChromeTheme>): this {
    if (!patch || typeof patch !== 'object') return this;
    const previous = this.theme;
    this.theme = mergeThemes(this.theme, { semantic: { chrome: patch } as any });
    this.__themeTouched = true;
    const patchRecord: any = { chrome: patch };
    this.__themePatch = this.__themePatch ? deepMerge(this.__themePatch, patchRecord) : patchRecord;
    this.__themeRevision++;
    this.__reapplyPresets();
    this.__notifyThemeChange(previous, 'chrome');
    return this;
  }

  /** 当前采用的主题（含设置的 chrome / 作用域之外的实例主题）。 */
  public getTheme(): ICETheme {
    return this.theme;
  }

  /**
   * 订阅**主题变更**（`setTheme` / `setChrome` 应用完成之后触发）。
   *
   * 为什么需要它：`setTheme` 以前不发任何信号，应用层只有"自己是调用方"时才知道主题变了。
   * 被动跟随的场景（图表 `theme:'auto'` 跟随引擎明暗、设计器外壳从引擎主题派生、
   * 自己维护一套画布配色）因此只能等下一次重建 —— 这是"引擎换了主题、上层纹丝不动"的根因。
   *
   * ```ts
   * const off = ice.onThemeChange(({ theme, previous, kind }) => {
   *   if (kind !== 'theme') return;      // 'chrome' 只代表交互外壳变了
   *   repaintChrome(theme.semantic.primary);
   * });
   * off();                              // 退订
   * ```
   *
   * 约定：
   * - 通知发生在**主题已经应用、缓存已经失效**之后，所以回调里读 `ice.getTheme()` 拿到的是新值；
   * - **每个订阅者互相隔离**：某个回调抛异常会被忽略并 `console.warn` 一次，不影响主题应用、也不影响其它订阅者；
   * - 订阅者若自己再调 `setChrome`（例如按新主题重算外壳），会收到一条 `kind:'chrome'` 的通知 ——
   *   按 kind 过滤即可，不会互相打架。
   */
  public onThemeChange(listener: (info: ICEThemeChangeInfo) => void, scope: any = this): () => void {
    const bus: any = this.__themeBus();
    const guard = (evt: any) => {
      const info: ICEThemeChangeInfo = (evt && evt.param) || { theme: this.theme, previous: this.theme, kind: 'theme' };
      try {
        listener.call(scope, info);
      } catch (err) {
        this.__warnThemeListenerOnce(err);
      }
    };
    bus.on(ICE_EVENT_NAME_CONSTS.THEME_CHANGE, guard, scope);
    return () => bus.off(ICE_EVENT_NAME_CONSTS.THEME_CHANGE, guard, scope);
  }

  /**
   * 广播主题变更。
   *
   * 兜一层 try/catch 是为了"主题应用已经完成"这个不变量：订阅者（哪怕是绕过 `onThemeChange`
   * 直接挂在 evtBus 上的）抛异常，也不该让 `setTheme` 半路炸掉、把调用方搞懵。
   */
  private __notifyThemeChange(previous: ICETheme, kind: 'theme' | 'chrome'): void {
    const bus: any = this.__themeBus();
    try {
      bus.trigger(ICE_EVENT_NAME_CONSTS.THEME_CHANGE, null, { theme: this.theme, previous, kind });
    } catch (err) {
      this.__warnThemeListenerOnce(err);
    }
  }

  /**
   * 主题通知用的总线：**懒建**。
   *
   * `evtBus` 原本只在 `init()` 里创建，于是 `new ICE()` → `onThemeChange(fn)` → `init()` 这条
   * 常见顺序会把订阅静默丢掉。这里按需建一条，`init()` 里改成复用已有的那条。
   */
  private __themeBus(): any {
    if (!this.evtBus) this.evtBus = new EventBus();
    return this.evtBus;
  }

  /** 订阅者抛错只提示一次，避免每帧 / 每次切主题刷屏。 */
  private __warnThemeListenerOnce(err: unknown): void {
    if (this.__themeListenerWarned) return;
    this.__themeListenerWarned = true;
    console.warn('[ICE] onThemeChange 订阅者抛异常，已忽略（不影响主题应用）：', err);
  }

  /**
   * 主题快照（给 Serializer 用）：`{ name, patch? }`。
   *
   * patch 是**相对命名主题的真实差异**（`deepDiff`），所以「当初怎么设置主题的」
   * （整份对象 / 部分补丁 / setChrome）都不影响存下来的内容 —— 只存改过的那几处。
   * 没动过主题返回 null（旧快照格式不受影响）。
   */
  public themeSnapshot(): { name: string; patch?: any } | null {
    if (!this.__themeTouched) return null;
    const name = this.__themeBaseName || 'default';
    const base = getRegisteredTheme(name) || DEFAULT_THEME;
    const patch = deepDiff(base, this.theme);
    return patch ? { name, patch } : { name };
  }

  /** 校验当前实例主题（未知 token / 类型不对 / 对比度不足），返回结构化诊断。 */
  public validateTheme(): ReturnType<typeof validateTheme> {
    return validateTheme(this.theme);
  }

  /** 注册组件样式预设（不允许覆盖内置；应用层预设建议带 `app:` 命名空间）。 */
  public registerPreset(name: string, factory: any): this {
    registerPreset(name, factory);
    return this;
  }

  /**
   * 打开「交互状态自动驱动」：鼠标移动时对命中的组件自动设置 `hover` 状态、
   * 按下时设置 `active` 状态（抬起清除），配合 `props.states` 就能做出 hover / active 反馈。
   *
   * 默认关闭：引擎的 mousemove 刻意不做命中检测（高频事件 + 脏矩形渲染，
   * 每帧对全场景做命中测试是实打实的开销）。需要 hover 反馈的场景显式打开；
   * 数据流 / 大场景可以只对需要的组件手写 `setInteractionState()`。
   */
  public enableInteractionStates(): this {
    this.__interactionStatesEnabled = true;
    return this;
  }

  public disableInteractionStates(): this {
    this.__interactionStatesEnabled = false;
    return this;
  }

  public get interactionStatesEnabled(): boolean {
    return this.__interactionStatesEnabled;
  }

  /**
   * 让「鼠标当前命中的组件」进入 hover 状态（由 DOMEventDispatcher 在移动事件里调用）。
   * 返回是否发生了变化（调用方据此决定要不要重绘）。
   */
  public updateHoverState(component: any): boolean {
    if (!this.__interactionStatesEnabled) return false;
    if (this.__hoveredComponent === component) return false;
    const previous: any = this.__hoveredComponent;
    this.__hoveredComponent = component || null;
    if (previous && typeof previous.setInteractionState === 'function') {
      previous.setInteractionState('hover', false);
    }
    if (component && typeof component.setInteractionState === 'function') {
      component.setInteractionState('hover', true);
    }
    return true;
  }

  /**
   * 设置视口（视图缩放 + 平移）。
   *
   * 屏幕坐标 = 世界坐标 * scale + translate。这是「视图缩放」，不改变任何组件的 state，
   * 只影响渲染结果与命中检测的坐标换算。视口变化会让渲染器回退一次全量重绘并重建快照。
   */
  public setViewport(scale: number, tx: number = 0, ty: number = 0): this {
    const s = Number(scale);
    const next = { scale: s > 0 ? s : 1, tx: Number(tx) || 0, ty: Number(ty) || 0 };
    const prev = this.viewport;
    const unchanged = !!prev && prev.scale === next.scale && prev.tx === next.tx && prev.ty === next.ty;
    this.viewport = next;
    this.dirty = true;
    // 视口**没变**时不要回退全量：`markQueueDirty()` 会重建渲染队列、清掉上屏快照与静态层，
    // 而平移/缩放驱动里重复调用 `setViewport(同值)` 很常见（钳制边界、视口跟随同步），
    // 每帧白打掉一次队列就等于每帧丢一次静态层（实测这类调用下静态层每帧重建，反而慢 35%）。
    if (this.renderer && !unchanged) {
      this.renderer.markQueueDirty();
    }
    this.__notifyViewportFollowers();
    return this;
  }

  // ===================== 分层渲染原语 =====================

  /**
   * 视口跟随者（分层渲染用）：本实例的 `setViewport` / `zoomAt` 会同步给它们。
   * 用 Set 存放（同一 follower 只同步一次），`unlink` 时删除。
   */
  private __viewportFollowers: Set<ICE> | null = null;
  /** 正在做视口同步：防止「A→B→A」无限回环（链式/双向连接时必需）。 */
  private __syncingViewport = false;
  /** 覆盖层是否处于「输入穿透」状态（`setInputPassthrough`）。 */
  private __inputPassthrough = false;

  /**
   * 双向绑定两个实例的视口（分层渲染：静态层 + 动画层必须缩放/平移一致）。
   *
   * 任一侧的 `setViewport` / `zoomAt` / 应用层基于视口的交互都会同步到另一侧；
   * 返回 `unlink()` 解绑（`destroy()` 会自动解绑本实例身上的连接）。
   *
   * @returns 解绑函数
   */
  public static linkViewport(a: ICE, b: ICE): () => void {
    if (!a || !b || a === b) {
      return () => undefined;
    }
    const unlinkA = a.followViewport(b);
    const unlinkB = b.followViewport(a);
    return () => {
      unlinkA();
      unlinkB();
    };
  }

  /**
   * 单向跟随：`this` 的视口跟随 `source`（source 变 → this 跟着变；this 自己变**不**回流）。
   * 分层场景里通常两层用 {@link ICE.linkViewport} 双向绑定；单向跟随适合「缩略图跟随主视图」这类。
   *
   * @returns 解绑函数
   */
  public followViewport(source: ICE): () => void {
    if (!source || source === this) {
      return () => undefined;
    }
    if (!source.__viewportFollowers) {
      source.__viewportFollowers = new Set<ICE>();
    }
    source.__viewportFollowers.add(this);
    // 立刻对齐一次，避免「先建层、后链接」时两侧从不同视口起步
    const vp = source.viewport;
    this.setViewport(vp.scale, vp.tx, vp.ty);
    return () => {
      if (source.__viewportFollowers) {
        source.__viewportFollowers.delete(this);
      }
    };
  }

  /** 把本实例的视口推给所有跟随者（`setViewport` 内部调用；带防回环标记）。 */
  private __notifyViewportFollowers(): void {
    const followers = this.__viewportFollowers;
    if (!followers || followers.size === 0 || this.__syncingViewport) {
      return;
    }
    const vp = this.viewport;
    this.__syncingViewport = true;
    try {
      for (const follower of followers) {
        // 销毁过的实例已在 destroy() 里把自己从各 source 的 followers 中移除；
        // 这里只做最小防御（setViewport 本身对 null renderer / 未初始化实例是安全的）。
        if (follower && typeof follower.setViewport === 'function') {
          follower.setViewport(vp.scale, vp.tx, vp.ty);
        }
      }
    } finally {
      this.__syncingViewport = false;
    }
  }

  /**
   * 覆盖层「输入穿透」：把本层 canvas 设为 `pointer-events: none`，指针事件直接落到下层。
   *
   * 分层渲染（静态层 + 动画层）里，动画层往往只是展示、不需要交互 —— 若不给它穿透，
   * 它会吃掉整屏指针事件，下层的选择/拖拽立刻失效。
   *
   * 关闭时把内联样式**还原为空**（而不是写 `auto`），避免覆盖应用自己的 CSS。
   */
  public setInputPassthrough(enabled: boolean): this {
    this.__inputPassthrough = !!enabled;
    const el: any = this.canvasEl;
    if (el && el.style) {
      el.style.pointerEvents = this.__inputPassthrough ? 'none' : '';
    }
    return this;
  }

  /** 当前是否处于输入穿透（见 {@link ICE.setInputPassthrough}）。 */
  public isInputPassthrough(): boolean {
    return this.__inputPassthrough;
  }

  /**
   * 把组件从本实例的树上**摘除但不销毁**（迁移 / 暂存专用）。
   *
   * 与 `removeChild()` 的唯一区别：**不调用 `destory()`** —— 组件自身的事件监听、内部子树、
   * 动画配置都保持完好。跨实例迁移（{@link ICE.moveComponentTo}）与"重父级"都需要这个语义，
   * 用 `removeChild` 会把组件连同子树一起清空（BPMN 池/泳道曾踩过这个坑）。
   *
   * @returns 是否真的摘除了（组件不属于本实例时返回 false）
   */
  public detachChild(component: any, markDirty: boolean = true): boolean {
    if (!component || component.ice !== this) {
      return false;
    }
    // 1) 从动画管理器摘除：否则本实例每帧还会 setState 到一个已经不在树里的组件
    if (this.animationManager) {
      this.animationManager.remove(component);
    }
    // 2) 从旧父链上剪掉（嵌套 → 剪父容器的 childNodes；顶层 → 剪本实例的 childNodes）
    const parent: any = component.parentNode;
    if (parent && Array.isArray(parent.childNodes)) {
      const index = parent.childNodes.indexOf(component);
      if (index !== -1) {
        parent.childNodes.splice(index, 1);
      }
      if (parent.__childSet && typeof parent.__childSet.delete === 'function') {
        parent.__childSet.delete(component);
      }
    } else {
      const index = this.childNodes.indexOf(component);
      if (index !== -1) {
        this.childNodes.splice(index, 1);
      }
      if (this.__childSet && typeof this.__childSet.delete === 'function') {
        this.__childSet.delete(component);
      }
    }
    component.parentNode = null;
    if (markDirty) {
      this.dirty = true;
      if (this.renderer) {
        this.renderer.markQueueDirty();
      }
    }
    return true;
  }

  /**
   * 把组件（连同整棵子树）迁移到另一个 `ICE` 实例 —— 分层渲染里"拖拽期间把元素提升到动画层、
   * 松手放回"这类交互的引擎原语（见 18 · 动画机制 §3.1）。
   *
   * 契约：
   * - **保持世界坐标**：迁移前后组件 origin 的绝对坐标不变（两边的祖先矩阵/视口可能不同，
   *   因此按矩阵换算，而不是照抄 `left/top`）；
   * - **不销毁**：组件自身的事件监听、内部子树与动画配置都保留（用 `detachChild` 而非 `removeChild`）；
   * - **子树整体切换**：后代的 `ice/ctx/evtBus` 递归指向目标实例（经 `addChild` 的 AFTER_ADD 链）；
   * - **目标实例接管**：动画注册迁到目标实例的 AnimationManager；选中态从本实例移除并落到目标实例；
   * - 两个实例的**视口**是否同步由调用方决定（分层场景用 `ICE.linkViewport`）——
   *   本方法只保证*世界坐标*不变，与视口无关。
   *
   * @param component    要迁移的组件（必须属于本实例）
   * @param targetIce    目标实例
   * @param targetParent 目标父级（可选；必须是目标实例树上的容器，缺省挂到目标实例根）
   * @returns 是否迁移成功（参数非法 / 同实例 / 目标父级不属于目标实例 → false，且不改动任何状态）
   */
  public moveComponentTo(component: any, targetIce: ICE, targetParent: any = null): boolean {
    if (!component || !targetIce || targetIce === this || component.ice !== this) {
      return false;
    }
    if (targetParent && targetParent.ice !== targetIce) {
      return false;
    }
    // 世界坐标快照：`calcAbsoluteOrigin()` 复用自己的 scratch 数组，必须立刻拷走
    const before = component.calcAbsoluteOrigin();
    const worldX = before[0];
    const worldY = before[1];

    if (!this.detachChild(component, true)) {
      return false;
    }
    const parent: any = targetParent || targetIce;
    parent.addChild(component, true);
    // 子树整体重绑：`ICEGroup` 的 AFTER_ADD 同步钩子是 once（只首次挂载触发），
    // 迁移时必须显式把后代切到目标实例，否则它们仍把事件发到旧实例。
    rebindComponentTree(component, targetIce);

    // 保持世界坐标：用"新旧绝对位置的差"做全局位移（内部会抵消新父链的线性变换）
    const after = component.calcAbsoluteOrigin();
    const dx = worldX - after[0];
    const dy = worldY - after[1];
    if (dx !== 0 || dy !== 0) {
      component.moveGlobalPosition(dx, dy);
    }
    component.dirty = true;

    // 选中态：旧实例摘掉（避免控制面板指着一个已经不在它树里的组件），目标实例接管
    if (this.selectionList && this.selectionList.indexOf(component) !== -1) {
      const rest = this.selectionList.filter((item: any) => item !== component);
      this.setSelection(rest.length ? rest : null);
    }
    if (targetIce.selectionList.indexOf(component) === -1) {
      targetIce.setSelection([component]);
    }
    return true;
  }

  /** 屏幕坐标（canvas 像素）→ 世界坐标（受视口逆变换）。 */
  public screenToWorld(sx: number, sy: number): [number, number] {
    const vp = this.viewport;
    return [(sx - vp.tx) / vp.scale, (sy - vp.ty) / vp.scale];
  }

  /** 世界坐标 → 屏幕坐标（canvas 像素）。 */
  public worldToScreen(wx: number, wy: number): [number, number] {
    const vp = this.viewport;
    return [wx * vp.scale + vp.tx, wy * vp.scale + vp.ty];
  }

  /**
   * 刷新 canvas 的 getBoundingClientRect 缓存并返回。
   *
   * 输入事件用它把屏幕坐标换算成 canvas 内坐标；页面滚动 / 布局变化后必须刷新，
   * 否则命中检测会整体偏移（旧实现只在 init 时取一次，滚动后即失效）。
   * 高频的移动类事件复用缓存，见 DOMEventDispatcher.__resolveCanvasRect。
   */
  /**
   * 渲染用视口 = dpr · viewport（仅「往画布上画」这一侧需要乘 dpr）。
   * dpr === 1 时**直接返回 viewport 本身**：零分配、且与既有行为逐字节一致。
   */
  public getRenderViewport(): { scale: number; tx: number; ty: number } {
    const vp = this.viewport;
    if (this.dpr === 1) {
      return vp;
    }
    let out = this.__renderVp;
    if (!out) {
      out = this.__renderVp = { scale: 1, tx: 0, ty: 0, __d: 1, __s: 1, __tx: 0, __ty: 0 };
    }
    if (out.__d !== this.dpr || out.__s !== vp.scale || out.__tx !== vp.tx || out.__ty !== vp.ty) {
      out.__d = this.dpr;
      out.__s = vp.scale;
      out.__tx = vp.tx;
      out.__ty = vp.ty;
      out.scale = vp.scale * this.dpr;
      out.tx = vp.tx * this.dpr;
      out.ty = vp.ty * this.dpr;
    }
    return out;
  }

  /**
   * 把 canvas 的 backing store 放大到 cssSize * dpr，并把 CSS 尺寸固定为逻辑尺寸。
   * 只有传了 dpr>1 才会调用。
   */
  private __applyDevicePixelRatio(): void {
    const el: any = this.canvasEl;
    if (!el) {
      return;
    }
    const box = this.__readContentBox(
      typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
    );
    // 内容盒尺寸（排除 border/padding）：直接用 border-box 会被边框撑大（示例页画布带 1px 边框）
    const cssW = box.width || el.width;
    const cssH = box.height || el.height;
    el.width = Math.round(cssW * this.dpr);
    el.height = Math.round(cssH * this.dpr);
    if (el.style) {
      el.style.width = cssW + 'px';
      el.style.height = cssH + 'px';
    }
    this.canvasWidth = el.width;
    this.canvasHeight = el.height;
    this.updateCanvasBoundingRect();
  }

  public updateCanvasBoundingRect(): any {
    if (this.canvasEl && typeof this.canvasEl.getBoundingClientRect === 'function') {
      this.canvasBoundingClientRect = this.canvasEl.getBoundingClientRect();
      this.__rememberInputRect(this.canvasBoundingClientRect);
      this.__contentBox = this.__readContentBox(this.canvasBoundingClientRect);
    }
    return this.canvasBoundingClientRect;
  }

  /** 记下上次用于「位移增量」的矩形快照。
   *
   * 不能直接复用 `canvasBoundingClientRect` 做差：某些运行时（桩 / 小程序）返回的是
   * **同一个可变对象**，此时 `rect === prev`，增量恒为 0，内容盒就再也不会跟着走。
   */
  private __rememberInputRect(rect: any): void {
    if (!rect) return;
    const snapshot = this.__inputRectSnapshot || (this.__inputRectSnapshot = { left: 0, top: 0, width: 0, height: 0 });
    snapshot.left = rect.left || 0;
    snapshot.top = rect.top || 0;
    snapshot.width = rect.width || 0;
    snapshot.height = rect.height || 0;
  }

  /**
   * 输入路径的**轻量**刷新：只重读一次 `getBoundingClientRect()`，尺寸没变时把已缓存的
   * 内容盒按位移平移，跳过一次 `getComputedStyle`（border/padding 不会每帧变）。
   *
   * 为什么移动事件必须每帧重读：页面滚动、画布上方插入内容（提示条 / 错误信息 / 广告位）
   * 都会让缓存整体过期，过期期间 `clientX - rect.left` 恒定偏移 —— 命中检测、悬停、
   * 拖拽全部错位，而移动事件恰恰是唯一高频入口，不刷新就没人来纠正它。
   *
   * 尺寸变化（窗口缩放、布局改动导致画布变大变小）时退回完整刷新，保证 border/padding 补偿正确。
   */
  public refreshInputRect(): any {
    const el: any = this.canvasEl;
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      return this.canvasBoundingClientRect;
    }
    const rect = el.getBoundingClientRect();
    const prev = this.__inputRectSnapshot;
    // 先取值再覆盖快照：快照对象是原地复用的，直接拿引用做差会得到 0（自己踩过）
    const hadPrev = !!prev;
    const prevLeft = hadPrev ? prev.left : 0;
    const prevTop = hadPrev ? prev.top : 0;
    const prevWidth = hadPrev ? prev.width : 0;
    const prevHeight = hadPrev ? prev.height : 0;
    this.canvasBoundingClientRect = rect;
    this.__rememberInputRect(rect);
    const box = this.__contentBox;
    const sameSize =
      hadPrev && !!box && Math.abs(rect.width - prevWidth) < 0.01 && Math.abs(rect.height - prevHeight) < 0.01;
    if (sameSize) {
      // 只挪了位置：内容盒跟着平移（width/height 不变），省掉 computedStyle 读取
      box.left += rect.left - prevLeft;
      box.top += rect.top - prevTop;
    } else {
      this.__contentBox = this.__readContentBox(rect);
    }
    return rect;
  }

  /**
   * 读取 canvas 内容盒：把 border-box 的 rect 补偿成「绘制区」的偏移与尺寸。
   * 无 getComputedStyle 的运行时（如小程序）补偿为 0，退回 rect 原值。
   */
  private __readContentBox(rect: any): any {
    const el: any = this.canvasEl;
    let bl = 0;
    let br = 0;
    let bt = 0;
    let bb = 0;
    let pl = 0;
    let pr = 0;
    let pt = 0;
    let pb = 0;
    const g: any =
      this.root && typeof this.root.getComputedStyle === 'function' && el ? this.root.getComputedStyle(el) : null;
    if (g) {
      //@perf: parseFloat 容错，缺字段按 0 处理
      const num = (v: any): number => {
        const n = parseFloat(v);
        return isFinite(n) ? n : 0;
      };
      bl = num(g.borderLeftWidth);
      br = num(g.borderRightWidth);
      bt = num(g.borderTopWidth);
      bb = num(g.borderBottomWidth);
      pl = num(g.paddingLeft);
      pr = num(g.paddingRight);
      pt = num(g.paddingTop);
      pb = num(g.paddingBottom);
    }
    const left = (rect && rect.left) || 0;
    const top = (rect && rect.top) || 0;
    const w = (rect && rect.width) || 0;
    const h = (rect && rect.height) || 0;
    return {
      left: left + bl + pl,
      top: top + bt + pt,
      width: Math.max(0, w - bl - br - pl - pr),
      height: Math.max(0, h - bt - bb - pt - pb),
    };
  }

  /**
   * 供输入派发器做坐标换算的矩形：**内容盒左上角**。
   * 这样 `clientX - left` 就落在绘制区坐标里，与旧实现（offsetX）语义一致，不受 border/padding 影响。
   */
  public getInputRect(): any {
    if (!this.__contentBox) {
      this.updateCanvasBoundingRect();
    }
    return this.__contentBox || this.canvasBoundingClientRect || { left: 0, top: 0, width: 0, height: 0 };
  }

  /**
   * 以屏幕点为锚点缩放视口（滚轮缩放 / 双指缩放可用的引擎原语）。
   *
   * 保持锚点下的世界坐标在缩放前后落在同一屏幕位置：先取锚点对应的世界坐标，
   * 换算新 scale 后反解 translate。只改视口状态，**不修改任何组件的 state**
   * （与 setViewport 同一约束）。
   *
   * 用法（应用层接滚轮，一行即可）：
   * ```js
   * ice.evtBus.on('wheel', (e) => {
   *   ice.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
   * });
   * ```
   *
   * @param screenX 锚点屏幕 x（canvas 像素，通常是鼠标 / 触摸位置）
   * @param screenY 锚点屏幕 y
   * @param factor  缩放倍数，>1 放大、<1 缩小；非正数或非有限值直接忽略
   * @param minScale 最小 scale（默认 0.05）
   * @param maxScale 最大 scale（默认 20）
   */
  public zoomAt(
    screenX: number,
    screenY: number,
    factor: number,
    minScale: number = 0.05,
    maxScale: number = 20
  ): this {
    const f = Number(factor);
    if (!isFinite(f) || f <= 0) {
      return this;
    }
    const [wx, wy] = this.screenToWorld(screenX, screenY);
    const current = this.viewport.scale;
    const lo = Math.min(minScale, maxScale);
    const hi = Math.max(minScale, maxScale);
    const next = Math.min(hi, Math.max(lo, current * f));
    if (next === current) {
      return this;
    }
    // 反解平移：让世界点 (wx, wy) 缩放后仍映射到 (screenX, screenY)
    return this.setViewport(next, screenX - wx * next, screenY - wy * next);
  }

  /**
   * 命中检测：屏幕坐标（canvas 像素）→ 命中的最上层可交互组件；无命中返回 null。
   * 供应用层做「空白处拖拽平移 / 点击命中」等视口交互。
   */
  public hitTest(sx: number, sy: number): any {
    const [wx, wy] = this.screenToWorld(sx, sy);
    return hitTestComponents(this, wx, wy, HIT_BOX_TOLERANCE);
  }

  /** 递归清除组件子树上的主题作用域缓存（主题变化后必须失效）。 */
  private __invalidateThemeCacheDeep(component: any): void {
    if (!component) return;
    if (typeof component.invalidateThemeCache === 'function') {
      component.invalidateThemeCache();
    } else if (typeof component.__reapplyPreset === 'function') {
      component.__reapplyPreset(this.theme);
    }
    const children: any[] = (component && component.childNodes) || [];
    for (const child of children) {
      this.__invalidateThemeCacheDeep(child);
    }
  }

  /**
   * 注册命名主题（运行时注入，如多品牌 / 多租户 / 暗色主题）。
   */
  public registerTheme(name: string, theme: ICETheme, options: { overwrite?: boolean } = {}): this {
    registerTheme(name, theme, options);
    return this;
  }

  /**
   * 遍历组件树，对每个用了 preset 的组件重新 resolve preset（主题热切换）。
   */
  private __reapplyPresets(): void {
    const all = flattenAllComponents(this);
    for (const comp of all) {
      if (typeof (comp as any).__reapplyPreset === 'function') {
        (comp as any).__reapplyPreset(this.theme);
      }
    }
    // 工具层（控制面板 / 插槽 / 引导线）也要跟着主题走
    const tools: any[] = (this as any).toolNodes || [];
    for (const tool of tools) {
      this.__invalidateThemeCacheDeep(tool);
    }
    // 主题变了就是整帧都要重画：颜色可能出现在任何位置，脏矩形算不准 ——
    // 把整棵树标脏，让渲染器自行合并脏区（合并预算挡下时它本来就会回退全量）
    const all2 = flattenAllComponents(this);
    for (const comp of all2) {
      (comp as any).dirty = true;
    }
    for (const tool of tools) {
      if (tool) tool.dirty = true;
    }
    this.dirty = true;
  }

  /**
   * 创建线性渐变对象，供组件 style.fillStyle/strokeStyle 使用。
   * 用法：const g = ice.createLinearGradient(0,0,100,0); g.addColorStop(0,'red'); g.addColorStop(1,'blue');
   *       new ICERect({ style: { fillStyle: g } })
   */
  public createLinearGradient(x0: number, y0: number, x1: number, y1: number): any {
    return tagGradient(this.ctx.createLinearGradient(x0, y0, x1, y1), {
      type: 'linear',
      from: [x0, y0],
      to: [x1, y1],
      stops: [],
    });
  }

  /**
   * 创建径向（圆形）渐变对象。
   */
  public createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): any {
    return tagGradient(this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1), {
      type: 'radial',
      center: [x1, y1],
      radius: r1,
      stops: [],
    });
  }

  /**
   * 创建锥形渐变（较新 API，Chrome 99+），不支持的环境返回 null。
   */
  public createConicGradient(startAngle: number, x: number, y: number): any {
    if (typeof this.ctx.createConicGradient === 'function') {
      return tagGradient(this.ctx.createConicGradient(startAngle, x, y), {
        type: 'conic',
        startAngle,
        center: [x, y],
        stops: [],
      });
    }
    return null;
  }

  /**
   * 创建图案填充（用图片平铺），供 style.fillStyle/strokeStyle 使用。
   * @param image 图片源（HTMLImageElement/canvas 等）
   * @param repetition 'repeat'|'repeat-x'|'repeat-y'|'no-repeat'
   */
  public createPattern(image: any, repetition: string): any {
    return this.ctx.createPattern(image, repetition);
  }

  /**
   * 读取画布指定区域的像素数据（取色、滤镜、橡皮擦等）。
   */
  public getImageData(x: number, y: number, w: number, h: number): any {
    return this.ctx.getImageData(x, y, w, h);
  }

  /**
   * 写入像素数据到画布。
   */
  public putImageData(imageData: any, x: number, y: number): void {
    this.ctx.putImageData(imageData, x, y);
  }

  public createImageData(w: number, h: number): any {
    return this.ctx.createImageData(w, h);
  }

  /**
   * 把画布导出为 dataURL（默认 PNG）。type 如 'image/png'/'image/jpeg'，quality 0~1（jpeg）。
   */
  public toDataURL(type?: string, quality?: number): string {
    return this.canvasEl.toDataURL(type, quality);
  }

  /**
   * 把画布导出为 Blob（回调接收）。
   */
  public toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void {
    this.canvasEl.toBlob(callback, type, quality);
  }

  /**
   * 把当前场景导出为 **SVG 矢量图**。
   *
   * 与 `toDataURL()` / `toBlob()` 的区别：那是画布的**光栅快照**（分辨率写死、缩放后糊），
   * 这是从组件树 + 路径命令流重新生成的**矢量描述** —— 可以任意放大、丢进 Illustrator/Figma、
   * 直接进打印/PDF 流程，也能在 Node 里生成（不需要 canvas）。
   *
   * 口径与画布渲染一致（顺序、矩阵、样式合并、有效透明度、祖先裁剪），细节与限制见
   * `export/SvgExporter.ts` 的文件头。
   *
   * ```js
   * const svg = ice.toSvg();                                  // 内容自适应、透明背景
   * const svg = ice.toSvg({ background: '#fff', padding: 16 }); // 白底 + 留白
   * const svg = ice.toSvg({ area: 'viewport' });               // 当前视口所见即所得
   * ```
   */
  public toSvg(options: SvgExportOptions = {}): string {
    return exportSvg(this, options);
  }

  /**
   * 创建一个**不依赖 canvas 的 ICE 实例**：服务端出图 / 无头批处理的入口。
   *
   * 它和 `init()` 出来的实例共用同一套组件树、矩阵、样式与导出逻辑，只是没有渲染器、
   * 没有输入派发、也没有 rAF 帧循环 —— 因此能在 Node 里 `new` 完就 `addChild` + `toSvg()`。
   *
   * ```js
   * const ice = ICE.headless();
   * ice.addChild(new ICERect({ width: 100, height: 50, style: { fillStyle: '#4f46e5' } }));
   * const svg = ice.toSvg();
   * ```
   *
   * 注意：没有渲染循环，意味着**派生几何**（折线的点、文本的换行行）由导出器在导出时刷新
   * （见 SvgExporter 里的 refreshParams/ensurePathBuilt），而不是靠帧循环。
   */
  public static headless(): ICE {
    const ice = new ICE();
    ice.childNodes = [];
    ice.toolNodes = [];
    ice.evtBus = new EventBus();
    ice.dirty = true;
    return ice;
  }

  /** 同 `toSvg()`，但额外返回计算出的画布尺寸（写文件 / 布局预览要用的宽高） */
  public toSvgResult(options: SvgExportOptions = {}): SvgExportResult {
    return exportSvgResult(this, options);
  }

  /**
   * 把对象序列化成 JSON 字符串：
   * - 容器型组件需要负责子节点的序列化操作
   * - 如果组件不需要序列化，需要返回 null
   * @returns Object
   */
  public toJSONString(): string {
    return this.serializer.toJSONString();
  }

  /**
   * 把对象序列化成 JSON 对象：
   * - 容器型组件需要负责子节点的序列化操作
   * - 如果组件不需要序列化，需要返回 null
   * @returns Object
   */
  public toJSONObject(): object {
    return this.serializer.toJSONObject();
  }

  public fromJSONObject(jsonObject) {
    const startTime = Date.now();

    //先停止关键的管理器
    FrameManager.stop();
    this.renderer.stop();
    this.eventDispatcher.stopped = true;
    this.animationManager.stop();
    this.controlPanelManager.stop();
    this.linkSlotManager.stop();

    this.clearAll();
    //反序列化，创建组件实例
    this.deserializer.fromJSONObject(jsonObject);

    //重新启动关键管理器
    FrameManager.start();
    this.renderer.start();
    this.animationManager.start();
    this.controlPanelManager.start();
    this.linkSlotManager.start();
    setTimeout(() => {
      // 实例可能在 300ms 内被 destroy()（eventDispatcher 置空）——定时器里再取用就是
      // 未捕获异常，在小程序里表现为白屏。这里必须判空。
      if (this.eventDispatcher) {
        this.eventDispatcher.stopped = false;
      }
    }, 300);

    const endTime = Date.now();
    console.log(`fromJSONString> ${endTime - startTime} ms`);
  }

  public fromJSONString(jsonStr: string) {
    const jsonObj = JSON.parse(jsonStr);
    this.fromJSONObject(jsonObj);
  }
}

export default ICE;
