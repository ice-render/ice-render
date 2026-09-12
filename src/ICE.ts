/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { isString } from './util/lang';
import AnimationManager from './animation/AnimationManager';
import componentTypeMap from './consts/COMPONENT_TYPE_MAPPING';
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
import ImageCache from './util/ImageCache';
import { resolveTheme, getTheme, registerTheme, ICETheme, ICESemanticTheme } from './theme/ICETheme';
import { flattenAllComponents, hitTestComponents } from './util/data-util';
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

  public typeMapping = {}; //类型名称与构造函数之间的映射关系，在序列化和反序列化时需要根据此 mapping 来创建对应的类型的示例。
  /** 构造函数 → 类型名 的反查表（序列化用）。惰性构建，registerType/init 后失效重建。 */
  private __typeIdMapping: Map<any, string> | null = null;

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

  constructor() {}

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
   * @param ctx DOM id、HTMLCanvasElement 或 CanvasRenderingContext2D
   * @param options 渲染配置。renderMode: 'dirty-rect'(默认) | 'full'
   *
   * 幂等：同一个 ICE 实例重复 init 到同一个 canvas 时直接返回自身。
   * React StrictMode 下 effect 会被执行两次，幂等可以避免重复挂载 Manager / 重复绑定全局事件。
   * 若要换一个 canvas，请先调用 destroy()。
   */
  public init(ctx: any, options: { renderMode?: 'full' | 'dirty-rect'; dpr?: number } = {}) {
    if (!ctx) {
      throw new Error('ICE.init() failed...');
    }

    const canvasEl = this.__resolveCanvasEl(ctx);

    if (this.__initialized) {
      if (canvasEl && canvasEl === this.canvasEl) {
        return this;
      }
      throw new Error('同一个 ICE 实例已经绑定到其它 canvas，如需重新初始化请先调用 destroy()。');
    }

    //把内置的类型映射拷贝到 typeMapping 上
    for (const p in componentTypeMap) {
      this.typeMapping[p] = componentTypeMap[p];
    }
    this.__typeIdMapping = null;

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
      this.canvasBoundingClientRect = this.canvasEl.getBoundingClientRect();
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
    this.evtBus = new EventBus(); //后续所有 Manager 都依赖事件总线，所以 this.evtBus 需要最先初始化。
    FrameManager.registerEvtBus(this.evtBus);
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

    //3) 注销全局事件总线
    if (this.evtBus) {
      FrameManager.delEvtBus(this.evtBus);
      DOMEventInterceptor.delEvtBus(this.evtBus);
    }
    if (FrameManager.evtBuses.length === 0) {
      FrameManager.stop();
    }

    //4) 清空场景并释放引用（插件工具也一并摘下）
    if (this.plugins) {
      this.plugins.clear();
    }
    this.clearAll();
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
  }

  public get dirty() {
    return this.__dirty;
  }

  /**
   * @method registerType 注册组件类型
   *
   * - 需要在反序列化之前调用，否则无法反序列化。
   * - ICE 内置的类型已经自动注册，不需要手动注册。
   *
   * @param className
   * @param Clazz
   */
  public registerType(className: string, Clazz: new (...args: any[]) => any) {
    this.typeMapping[className] = Clazz;
    this.__typeIdMapping = null; // 反查表失效，下次序列化重建
  }

  /**
   * 由构造函数反查稳定的类型名（序列化用）。
   *
   * - 已注册的类型：返回注册名（与类的 JS 名解耦，压缩改名不影响已存数据）
   * - 未注册：返回 undefined，调用方回退到 `constructor.name`（保持既有行为）
   * - 同一个构造函数注册了多个名字时，**先注册的优先**（内置类型因此不会被别名顶掉）
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
   * @method getType 获取组件构造函数
   * @param className
   * @returns
   */
  public getType(className: string) {
    return this.typeMapping[className];
  }

  /**
   * 加载自定义字体（平台适配）：浏览器走 FontFace API，小程序走 wx.loadFont。
   * 加载后，在 ICEText 的 style.fontFamily 里引用该字体名即可。
   * @param family 字体族名（如 'MyFont'）
   * @param source 字体源（浏览器为 url/二进制，小程序为本地文件路径）
   */
  public loadFont(family: string, source: string): Promise<any> {
    return root.loadFont(family, source);
  }

  /**
   * 切换主题（string 按名切换 / object 浅合并 semantic），预设样式（preset）会自动跟随主题变量。
   * 热切换：已渲染的组件里用了 preset 的会重新 resolve（用户显式传的样式优先）。
   */
  public setTheme(theme: string | Partial<ICESemanticTheme>): this {
    // 实例级：不修改模块级默认主题，因此多个 ICE 实例可以有各自的主题（多品牌/多租户）
    this.theme = resolveTheme(theme, this.theme);
    this.__reapplyPresets();
    return this;
  }

  /**
   * 设置视口（视图缩放 + 平移）。
   *
   * 屏幕坐标 = 世界坐标 * scale + translate。这是「视图缩放」，不改变任何组件的 state，
   * 只影响渲染结果与命中检测的坐标换算。视口变化会让渲染器回退一次全量重绘并重建快照。
   */
  public setViewport(scale: number, tx: number = 0, ty: number = 0): this {
    const s = Number(scale);
    this.viewport = { scale: s > 0 ? s : 1, tx: Number(tx) || 0, ty: Number(ty) || 0 };
    this.dirty = true;
    if (this.renderer) {
      this.renderer.markQueueDirty();
    }
    return this;
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
      this.__contentBox = this.__readContentBox(this.canvasBoundingClientRect);
    }
    return this.canvasBoundingClientRect;
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

  /**
   * 注册命名主题（运行时注入，如多品牌 / 多租户 / 暗色主题）。
   */
  public registerTheme(name: string, theme: ICETheme): this {
    registerTheme(name, theme);
    return this;
  }

  /**
   * 获取当前主题对象（{ base, semantic }）。返回的是**本实例**的主题。
   */
  public getTheme(): ICETheme {
    return this.theme;
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
  }

  /**
   * 创建线性渐变对象，供组件 style.fillStyle/strokeStyle 使用。
   * 用法：const g = ice.createLinearGradient(0,0,100,0); g.addColorStop(0,'red'); g.addColorStop(1,'blue');
   *       new ICERect({ style: { fillStyle: g } })
   */
  public createLinearGradient(x0: number, y0: number, x1: number, y1: number): any {
    return this.ctx.createLinearGradient(x0, y0, x1, y1);
  }

  /**
   * 创建径向（圆形）渐变对象。
   */
  public createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): any {
    return this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  }

  /**
   * 创建锥形渐变（较新 API，Chrome 99+），不支持的环境返回 null。
   */
  public createConicGradient(startAngle: number, x: number, y: number): any {
    if (typeof this.ctx.createConicGradient === 'function') {
      return this.ctx.createConicGradient(startAngle, x, y);
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
      this.eventDispatcher.stopped = false;
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
