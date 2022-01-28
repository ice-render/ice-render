import isString from 'lodash/isString';
import pkg from '../package.json';
import AnimationManager from './animation/AnimationManager';
import FrameManager from './animation/FrameManager';
import DDManager from './drag-drop/DDManager';
import DOMEventBridge from './event/DOMEventBridge';
import EventBus from './event/EventBus';
import MouseEventInterceptor from './event/MouseEventInterceptor.js';
import root from './nodejs-support/root.js';
import CanvasRenderer from './renderer/CanvasRenderer';
import IRenderer from './renderer/IRenderer';
import TransformManager from './transformation/TransformManager';

FrameManager.start();

/**
 * ICE: interactive canvas engine.
 * 全局单例
 * FIXME:使用 TS 的 namespance 机制进行改造
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICE {
  public version = pkg.version;
  //所有需要在 canvas 中渲染的对象都在此结构中 TODO:为了支持 zIndex 特性，需要改成数组，有堆叠顺序
  public displayMap = new Map();
  public evtBus: EventBus;
  //在浏览器里面是 window 对象，在 NodeJS 环境里面是 global 对象
  public root;
  public ctx;
  public canvasEl;
  public canvasWidth: number = 0;
  public canvasHeight: number = 0;
  public canvasBoundingClientRect;
  //当前选中的组件列表，支持 Ctrl 键同时选中多个组件。
  public selectionList: Array<any> = [];

  private animationManager: AnimationManager;
  private eventBridge: DOMEventBridge;
  private ddManager: DDManager;
  private transformManager: TransformManager;
  private renderer: IRenderer;

  constructor() {}

  /**
   * @param ctx DOM id or CanvasContext
   */
  init(ctx: any) {
    if (!ctx) {
      throw new Error('init() failed...');
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
    MouseEventInterceptor.regitserEvtBus(this.evtBus);
    MouseEventInterceptor.start();
    this.animationManager = new AnimationManager(this).start();
    this.eventBridge = new DOMEventBridge(this).start();
    this.ddManager = new DDManager(this).start();
    this.transformManager = new TransformManager(this).start();
    this.renderer = new CanvasRenderer(this).start();

    return this;
  }

  //FIXME:实现销毁 ICE 实例的过程
  destory() {}

  addToDisplayMap(component) {
    component.ctx = this.ctx;
    component.root = this.root;

    this.displayMap.set(component.props.id, component);
    if (Object.keys(component.props.animations).length) {
      this.animationManager.add(component);
    }
  }

  rmFromDisplayMap(component) {
    this.displayMap.delete(component.props.id);
    component.ctx = null;
    component.root = null;
    //TODO:停止动画效果
    //TODO:停止变换
    //TODO:清理所有事件监听，然后再从结构中删除
  }

  clearRenderMap() {
    //TODO:停止所有对象的动画效果
    //TODO:停止变换
    //TODO:清理所有事件监听，然后再从结构中删除
  }

  toJSON(): string {
    return '{}';
  }

  fromJSON(jsonStr: string): object {
    return {};
  }
}

export default ICE;
