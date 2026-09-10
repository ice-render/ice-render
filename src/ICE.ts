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
import root from './cross-platform/root';
import DOMEventDispatcher from './event/DOMEventDispatcher';
import DOMEventInterceptor from './event/DOMEventInterceptor';
import EventBus from './event/EventBus';
import FrameManager from './FrameManager';
import ICEComponent from './graphic/ICEComponent';
import ICELinkSlotManager from './graphic/link/ICELinkSlotManager';
import Deserializer from './persistence/Deserializer';
import Serializer from './persistence/Serializer';
import CanvasRenderer from './renderer/CanvasRenderer';
import ImageCache from './util/ImageCache';
import { setTheme, getTheme, registerTheme, ICETheme, ICESemanticTheme } from './theme/ICETheme';
import { flattenTree } from './util/data-util';

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
  public selectionList: Array<any> = []; //当前选中的组件列表，支持 Ctrl 键同时选中多个组件。
  public typeMapping = {}; //类型名称与构造函数之间的映射关系，在序列化和反序列化时需要根据此 mapping 来创建对应的类型的示例。

  public renderer: any; //渲染器实例
  public animationManager: AnimationManager;
  public eventDispatcher: DOMEventDispatcher;
  public controlPanelManager: ICEControlPanelManager;
  public linkSlotManager: ICELinkSlotManager;
  public serializer: Serializer;
  public deserializer: Deserializer;
  public imageCache: ImageCache;

  private __dirty: boolean = true; //如果此标志位为 true ，所有组件都会全部被重新绘制

  constructor() {}

  /**
   * @param ctx DOM id or CanvasContext
   * @param options 渲染配置。renderMode: 'dirty-rect'(默认) | 'full'
   */
  public init(ctx: any, options: { renderMode?: 'full' | 'dirty-rect' } = {}) {
    if (!ctx) {
      throw new Error('ICE.init() failed...');
    }
    if (this.ctx === ctx) {
      throw new Error('同一个 canvas 实例只能 init 一次...');
    }

    //把内置的类型映射拷贝到 typeMapping 上
    for (const p in componentTypeMap) {
      this.typeMapping[p] = componentTypeMap[p];
    }

    this.root = root;

    //FIXME:防止 init 方法被调用多次
    if (isString(ctx)) {
      this.canvasEl = this.root.document.getElementById(ctx);
      //禁用 canvas 元素上的原生右键菜单
      this.canvasEl.oncontextmenu = function (e) {
        e.preventDefault();
        e.stopPropagation();
      };
      this.canvasWidth = this.canvasEl.width;
      this.canvasHeight = this.canvasEl.height;
      this.canvasBoundingClientRect = this.canvasEl.getBoundingClientRect();
      this.ctx = this.canvasEl.getContext('2d');
    } else {
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
    this.linkSlotManager = new ICELinkSlotManager(this).start(); //linkSlotManager 内部会监听 renderer 上的事件，所以 linkSlotManager 需要在 renderer 后面实例化。
    this.serializer = new Serializer(this);
    this.deserializer = new Deserializer(this);
    this.imageCache = new ImageCache(this);

    return this;
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
    tool.destory();
    const index = this.toolNodes.indexOf(tool);
    if (index !== -1) this.toolNodes.splice(index, 1);
    this.__toolSet.delete(tool);
    this.dirty = true;
    if (this.renderer) this.renderer.markQueueDirty();
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
    component.destory();
    const index = this.childNodes.indexOf(component);
    if (index !== -1) this.childNodes.splice(index, 1);
    this.__childSet.delete(component);
    this.dirty = markDirty;
    if (this.renderer) this.renderer.markQueueDirty();
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

  public findComponent(id: string) {
    return this.childNodes.filter((item) => item.props.id === id)[0];
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
    setTheme(theme);
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
   * 命中检测：屏幕坐标（canvas 像素）→ 命中的最上层可交互组件；无命中返回 null。
   * 供应用层做「空白处拖拽平移 / 点击命中」等视口交互。
   */
  public hitTest(sx: number, sy: number): any {
    const [wx, wy] = this.screenToWorld(sx, sy);
    const all = flattenTree([], this.childNodes).concat(flattenTree([], this.toolNodes));
    all.sort((a: any, b: any) => a.state.zIndex - b.state.zIndex);
    for (let i = all.length - 1; i >= 0; i--) {
      const component = all[i];
      if (component.isControlPanel) continue;
      if (component.state.display !== false && component.state.interactive && component.containsPoint(wx, wy)) {
        return component;
      }
    }
    return null;
  }

  /**
   * 注册命名主题（运行时注入，如多品牌 / 多租户 / 暗色主题）。
   */
  public registerTheme(name: string, theme: ICETheme): this {
    registerTheme(name, theme);
    return this;
  }

  /**
   * 获取当前主题对象（{ base, semantic }）。
   */
  public getTheme(): ICETheme {
    return getTheme();
  }

  /**
   * 遍历组件树，对每个用了 preset 的组件重新 resolve preset（主题热切换）。
   */
  private __reapplyPresets(): void {
    const all = flattenTree([], this.childNodes);
    for (const comp of all) {
      if (typeof (comp as any).__reapplyPreset === 'function') {
        (comp as any).__reapplyPreset();
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
