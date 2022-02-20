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
import { ICE_CONSTS } from './ICE_CONSTS';
import CanvasRenderer from './renderer/CanvasRenderer';
import IRenderer from './renderer/IRenderer';

/**
 * @class ICE
 *
 * ICE: Interactive Canvas Engine ， 交互式 canvas 渲染引擎。
 *
 * 同一个 &lt;canvas&gt; 标签上只能初始化一个 ICE 实例。
 *
 * FIXME:使用 TS 的 namespance 机制进行改造
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICE {
  public version = pkg.version;
  //所有需要在 canvas 中渲染的对象都在此结构中 TODO:为了支持 zIndex 特性，需要改成数组，有堆叠顺序
  public displayMap = new Map();
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

  private animationManager: AnimationManager;
  private eventBridge: DOMEventBridge;
  private ddManager: DDManager;
  private controlPanelManager: ICEControlPanelManager;
  private renderer: IRenderer;

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
    this.evtBus = new EventBus();
    FrameManager.regitserEvtBus(this.evtBus);
    FrameManager.start();

    MouseEventInterceptor.regitserEvtBus(this.evtBus);
    MouseEventInterceptor.start();
    this.animationManager = new AnimationManager(this).start();
    this.eventBridge = new DOMEventBridge(this).start();
    this.ddManager = new DDManager(this).start();
    this.controlPanelManager = new ICEControlPanelManager(this).start();
    this.renderer = new CanvasRenderer(this).start();

    return this;
  }

  public addChild(component) {
    component.trigger(ICE_CONSTS.BEFORE_ADD);

    component.ice = this;
    component.root = this.root;
    component.ctx = this.ctx;
    component.evtBus = this.evtBus;

    this.displayMap.set(component.props.id, component);

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

  public removeChild(component) {
    component.trigger(ICE_CONSTS.BEFORE_REMOVE);

    component.ice = null;
    component.ctx = null;
    component.root = null;
    component.evtBus = null;

    this.displayMap.delete(component.props.id);

    //FIXME:如果被移除的是容器型组件，先移除并清理其子节点，然后再移除容器自身
    //FIXME:立即停止组件上的所有动画效果
    //FIXME:清理所有事件监听，然后再从结构中删除

    component.trigger(ICE_CONSTS.AFTER_REMOVE);
  }

  public removeChildren(arr: Array<ICEBaseComponent>): void {
    arr.forEach((child) => {
      this.removeChild(child);
    });
  }

  public clearRenderMap() {
    //FIXME:停止所有对象的动画效果
    //FIXME:清理所有事件监听，然后再从结构中删除
  }

  public toJSON(): string {
    return '{}';
  }

  public fromJSON(jsonStr: string): object {
    return {};
  }

  //FIXME:实现销毁 ICE 实例的过程
  public destory(): void {}
}

export default ICE;
