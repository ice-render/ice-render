/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import isString from 'lodash/isString';
import pkg from '../package.json';
import DDManager from './actions/DDManager';
import ICEControlPanelManager from './actions/ICEControlPanelManager';
import AnimationManager from './animation/AnimationManager';
import FrameManager from './animation/FrameManager';
import root from './cross-platform/root.js';
import DOMEventBridge from './event/DOMEventBridge';
import EventBus from './event/EventBus';
import MouseEventInterceptor from './event/MouseEventInterceptor.js';
import ICEBaseComponent from './graphic/ICEBaseComponent';
import ICELinkSlotManager from './graphic/linkable/ICELinkSlotManager';
import { ICE_CONSTS } from './ICE_CONSTS';
import Deserializer from './persistence/Deserializer';
import Serializer from './persistence/Serializer';
import CanvasRenderer from './renderer/CanvasRenderer';

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
  public version = pkg.version;
  //所有直接添加到 canvas 的对象都在此结构中
  public childNodes = [];
  //事件总线，每一个 ICE 实例上只能有一个 evtBus 实例
  public evtBus: EventBus;
  //在浏览器里面是 window 对象，在 NodeJS 环境里面是 global 对象
  public root;
  //&lt;canvas&gt; tag
  public canvasEl;
  //CanvasRenderingContext2D, @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
  public ctx;
  public canvasWidth: number = 0;
  public canvasHeight: number = 0;
  public canvasBoundingClientRect;
  //当前选中的组件列表，支持 Ctrl 键同时选中多个组件。
  public selectionList: Array<any> = [];

  public renderer: any;
  public animationManager: AnimationManager;
  public eventBridge: DOMEventBridge;
  public ddManager: DDManager;
  public controlPanelManager: ICEControlPanelManager;
  public linkSlotManager: ICELinkSlotManager;
  public serializer: Serializer;
  public deserializer: Deserializer;

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

    return this;
  }

  /**
   *
   * 调用 ICE.addChild() 方法，会直接把对象画在 canvas 上。
   * 如果需要在容器中画组件，参见 @see ICEGroup.addChild() 方法
   *
   * @param component
   */
  public addChild(component) {
    if (this.childNodes.indexOf(component) !== -1) return;

    component.trigger(ICE_CONSTS.BEFORE_ADD);
    component.ice = this;
    component.root = this.root;
    component.ctx = this.ctx;
    component.evtBus = this.evtBus;
    this.childNodes.push(component);
    if (Object.keys(component.props.animations).length) {
      this.animationManager.add(component);
    }
    component.trigger(ICE_CONSTS.AFTER_ADD);
  }

  public addChildren(arr: Array<ICEBaseComponent>): void {
    arr.forEach((child) => {
      this.addChild(child);
    });
  }

  public removeChild(component: ICEBaseComponent) {
    component.destory();
    this.childNodes.splice(this.childNodes.indexOf(component), 1);
  }

  public removeChildren(arr: Array<ICEBaseComponent>): void {
    arr.forEach((child) => {
      this.removeChild(child);
    });
  }

  public clearRenderMap() {
    this.removeChildren(this.childNodes);
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

  public fromJSON(jsonStr: string) {
    //先停止关键的管理器
    this.eventBridge.stopped = true;
    this.animationManager.stop();
    this.ddManager.stop();
    this.controlPanelManager.stop();
    this.linkSlotManager.stop();

    //反序列化，创建组件实例
    this.deserializer.fromJSON(jsonStr);

    //重新启动关键管理器
    this.eventBridge.stopped = false;
    this.animationManager.start();
    this.ddManager.start();
    this.controlPanelManager.start();
    this.linkSlotManager.start();
  }
}

export default ICE;
