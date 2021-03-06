/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import isString from 'lodash/isString';
import AnimationManager from './animation/AnimationManager';
import componentTypeMap from './consts/COMPONENT_TYPE_MAPPING';
import ICE_EVENT_NAME_CONSTS from './consts/ICE_EVENT_NAME_CONSTS';
import ICEControlPanelManager from './control-panel/ICEControlPanelManager';
import root from './cross-platform/root.js';
import DOMEventDispatcher from './event/DOMEventDispatcher';
import DOMEventInterceptor from './event/DOMEventInterceptor.js';
import EventBus from './event/EventBus';
import FrameManager from './FrameManager';
import ICEComponent from './graphic/ICEComponent';
import ICELinkSlotManager from './graphic/link/ICELinkSlotManager';
import Deserializer from './persistence/Deserializer';
import Serializer from './persistence/Serializer';
import CanvasRenderer from './renderer/CanvasRenderer';
import ImageCache from './util/ImageCache';

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
  public evtBus: EventBus; //事件总线，每一个 ICE 实例上只能有一个 evtBus 实例
  public root; //在浏览器里面是 window 对象，在 NodeJS 环境里面是 global 对象
  public canvasEl; // canvas 标签元素
  public ctx; //CanvasRenderingContext2D, @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
  public canvasWidth: number = 0;
  public canvasHeight: number = 0;
  public canvasBoundingClientRect;
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
   */
  public init(ctx: any) {
    if (!ctx) {
      throw new Error('ICE.init() failed...');
    }
    if (this.ctx === ctx) {
      throw new Error('同一个 canvas 实例只能 init 一次...');
    }

    //把内置的类型映射拷贝到 typeMapping 上
    for (let p in componentTypeMap) {
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
    FrameManager.regitserEvtBus(this.evtBus);
    FrameManager.start();

    DOMEventInterceptor.regitserEvtBus(this.evtBus);
    DOMEventInterceptor.start();
    this.eventDispatcher = new DOMEventDispatcher(this).start();
    this.animationManager = new AnimationManager(this).start();
    this.controlPanelManager = new ICEControlPanelManager(this).start();
    this.renderer = new CanvasRenderer(this).start();
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
    if (this.childNodes.indexOf(tool) !== -1) return;

    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD, null, { component: tool });
    tool.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD);

    tool.ice = this;
    tool.ctx = this.ctx;
    tool.evtBus = this.evtBus;
    this.toolNodes.push(tool);
    this.dirty = true;

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
    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, null, { component: tool });
    tool.destory();
    this.toolNodes.splice(this.toolNodes.indexOf(tool), 1);
    this.dirty = true;
  }

  /**
   *
   * 调用 ICE.addChild() 方法，会直接把对象画在 canvas 上。
   * 如果需要在容器中画组件，参见 @see ICEGroup.addChild() 方法
   *
   * @param component
   */
  public addChild(component, markDirty: boolean = true) {
    if (this.childNodes.indexOf(component) !== -1) return;

    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD, null, { component: component });
    component.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD);

    component.ice = this;
    component.ctx = this.ctx;
    component.evtBus = this.evtBus;
    component.parentNode = null;
    this.childNodes.push(component);
    if (Object.keys(component.props.animations).length) {
      this.animationManager.add(component);
    }

    this.dirty = markDirty;

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
    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, null, { component: component });
    component.destory();
    this.childNodes.splice(this.childNodes.indexOf(component), 1);
    this.dirty = markDirty;
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
  public registerType(className: string, Clazz: Function) {
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
    let startTime = Date.now();

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

    let endTime = Date.now();
    console.log(`fromJSONString> ${endTime - startTime} ms`);
  }

  public fromJSONString(jsonStr: string) {
    const jsonObj = JSON.parse(jsonStr);
    this.fromJSONObject(jsonObj);
  }
}

export default ICE;
