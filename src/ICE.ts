/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import isString from 'lodash/isString';
import AnimationManager from './animation/AnimationManager';
import ICE_EVENT_NAME_CONSTS from './consts/ICE_EVENT_NAME_CONSTS';
import DDManager from './control-panel/DDManager';
import ICEControlPanel from './control-panel/ICEControlPanel';
import ICEControlPanelManager from './control-panel/ICEControlPanelManager';
import root from './cross-platform/root.js';
import DOMEventBridge from './event/DOMEventBridge';
import EventBus from './event/EventBus';
import MouseEventInterceptor from './event/MouseEventInterceptor.js';
import FrameManager from './FrameManager';
import ICEComponent from './graphic/ICEComponent';
import ICELinkHook from './graphic/link/ICELinkHook';
import ICELinkSlot from './graphic/link/ICELinkSlot';
import ICELinkSlotManager from './graphic/link/ICELinkSlotManager';
import Deserializer from './persistence/Deserializer';
import Serializer from './persistence/Serializer';
import CanvasRenderer from './renderer/CanvasRenderer';
import ImageCache from './util/ImageCache';

/**
 * @class ICE
 *
 * ICE: Interactive Canvas Engine ， 交互式 canvas 渲染引擎。
 *
 * - ICE 是整个引擎的主入口类。
 * - 同一个 &lt;canvas&gt; 标签上只能初始化一个 ICE 实例。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICE {
  public childNodes = []; //所有直接添加到 canvas 的对象都在此结构中
  public evtBus: EventBus; //事件总线，每一个 ICE 实例上只能有一个 evtBus 实例
  public root; //在浏览器里面是 window 对象，在 NodeJS 环境里面是 global 对象
  public canvasEl; // canvas 标签元素
  public ctx; //CanvasRenderingContext2D, @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
  public canvasWidth: number = 0;
  public canvasHeight: number = 0;
  public canvasBoundingClientRect;
  public selectionList: Array<any> = []; //当前选中的组件列表，支持 Ctrl 键同时选中多个组件。

  public renderer: any;
  public animationManager: AnimationManager;
  public eventBridge: DOMEventBridge;
  public ddManager: DDManager;
  public controlPanelManager: ICEControlPanelManager;
  public linkSlotManager: ICELinkSlotManager;
  public serializer: Serializer;
  public deserializer: Deserializer;
  public imageCache: ImageCache;

  public _dirty: boolean = true; //如果此标志位为 true ，所有组件都会全部被重新绘制

  constructor() {}

  /**
   * @param ctx DOM id or CanvasContext
   */
  public init(ctx: any) {
    if (!ctx) {
      throw new Error('ICE.init() failed...');
    }
    if (this.ctx === ctx) {
      //FIXME:
      throw new Error('同一个 canvas 实例只能 init 一次...');
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

    //启动当前 ICE 实例上的所有 Manager
    this.evtBus = new EventBus(); //后续所有 Manager 都依赖事件总线，所以 this.evtBus 需要最先初始化。
    FrameManager.regitserEvtBus(this.evtBus);
    FrameManager.start();

    MouseEventInterceptor.regitserEvtBus(this.evtBus);
    MouseEventInterceptor.start();
    this.eventBridge = new DOMEventBridge(this).start();
    this.animationManager = new AnimationManager(this).start();
    this.ddManager = new DDManager(this).start();
    this.controlPanelManager = new ICEControlPanelManager(this).start();
    this.renderer = new CanvasRenderer(this).start();
    this.linkSlotManager = new ICELinkSlotManager(this).start(); //linkSlotManager 内部会监听 renderer 上的事件，所以 linkSlotManager 需要在 renderer 后面实例化。
    this.serializer = new Serializer(this);
    this.deserializer = new Deserializer(this);
    this.imageCache = new ImageCache(this);

    return this;
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
    component.root = this.root;
    component.ctx = this.ctx;
    component.evtBus = this.evtBus;
    component.renderer = this.renderer;
    this.childNodes.push(component);
    if (Object.keys(component.props.animations).length) {
      this.animationManager.add(component);
    }

    this._dirty = markDirty;

    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD, null, { component: component });
    component.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD);
  }

  public addChildren(arr: Array<ICEComponent>): void {
    for (let i = 0; i < arr.length; i++) {
      this.addChild(arr[i], false);
    }
    this._dirty = true;
  }

  public removeChild(component: ICEComponent, markDirty: boolean = true) {
    if (
      component instanceof ICEControlPanel ||
      component.parentNode instanceof ICEControlPanel ||
      component instanceof ICELinkSlot ||
      component instanceof ICELinkHook
    ) {
      console.warn('控制手柄类型的组件不能删除...', component);
      return;
    }

    this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, null, { component: component });
    component.destory();
    this.childNodes.splice(this.childNodes.indexOf(component), 1);
    this._dirty = markDirty;
  }

  public removeChildren(arr: Array<ICEComponent>): void {
    for (let i = 0; i < arr.length; i++) {
      this.removeChild(arr[i], false);
    }
    this._dirty = true;
  }

  public clearAll() {
    this.removeChildren([...this.childNodes]);
  }

  public findComponent(id: string) {
    return this.childNodes.filter((item) => item.props.id === id)[0];
  }

  /**
   * 把对象序列化成 JSON 字符串：
   * - 容器型组件需要负责子节点的序列化操作
   * - 如果组件不需要序列化，需要返回 null
   * @returns JSONObject
   */
  public toJSON(): string {
    return this.serializer.toJSON();
  }

  //FIXME:从 JSON 数据反序列化需要的处理时间可能会比较长，需要防止 fromJSON() 方法被高频调用导致的问题。
  public fromJSON(jsonStr: string) {
    let startTime = Date.now();

    //先停止关键的管理器
    FrameManager.stop();
    this.renderer.stop();
    this.eventBridge.stopped = true;
    this.animationManager.stop();
    this.ddManager.stop();
    this.controlPanelManager.stop();
    this.linkSlotManager.stop();

    this.clearAll();
    //反序列化，创建组件实例
    this.deserializer.fromJSON(jsonStr);

    //重新启动关键管理器
    FrameManager.start();
    this.renderer.start();
    this.animationManager.start();
    this.ddManager.start();
    this.controlPanelManager.start();
    this.linkSlotManager.start();
    setTimeout(() => {
      this.eventBridge.stopped = false;
    }, 300);

    let endTime = Date.now();
    console.log(`fromJSON> ${endTime - startTime} ms`);
  }
}

export default ICE;
