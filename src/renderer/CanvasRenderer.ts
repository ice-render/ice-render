/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE_EVENT_NAME_CONSTS from '../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from '../event/ICEEvent';
import ICEEventTarget from '../event/ICEEventTarget';
import ICEComponent from '../graphic/ICEComponent';
import ICE from '../ICE';

/**
 * @class CanvasRenderer
 *
 * Canvas 渲染器
 *
 * - 一个 ICE 实例上，只能有一个渲染器实例。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class CanvasRenderer extends ICEEventTarget {
  private ice: ICE;
  private stopped: boolean = false;
  private renderQueue = []; //等待渲染的组件队列，FIFO

  static readonly MAX_QUE_LENGTH = 5000000; //队列最大长度，超长忽略，不能进入队列。
  static readonly FRAME_TIME = 16; //每帧最大用时 16ms ，超过此时间放到下一帧继续渲染。

  constructor(ice: ICE) {
    super();
    this.ice = ice;
  }

  public start() {
    this.stopped = false;
    this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
    return this;
  }

  public stop() {
    this.stopped = true;
    this.ice.evtBus.off(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
    return this;
  }

  /**
   * 判断是否需要刷新
   * @returns
   */
  private needUpdate(): boolean {
    if (!this.ice.childNodes || !this.ice.childNodes.length) return false;
    return this.ice._dirty;
  }

  private frameEvtHandler(evt: ICEEvent) {
    if (this.needUpdate()) {
      this.doRender();
    }
  }

  private doRender() {
    const startTime = Date.now();

    this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);
    this.renderQueue = Array.from(this.ice.childNodes);
    this.renderQueue.sort((firstEl, secondEl) => {
      //根据组件的 zIndex 升序排列，保证 zIndex 大的组件在后面绘制。
      return firstEl.state.zIndex - secondEl.state.zIndex;
    });
    this.renderQueue.forEach((component: ICEComponent) => {
      this.renderRecursively(component);
    });

    //完成一轮渲染时，在总线上触发一个 ROUND_FINISH 事件。
    this.ice._dirty = false;
    this.ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH);

    const endTime = Date.now();
    console.log(` Render time ${endTime - startTime} ms.`);
  }

  /**
   * 如果有子组件，递归渲染。
   * @param component
   * @returns
   */
  private renderRecursively(component: ICEComponent) {
    this.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_RENDER, null, { component: component });
    component.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_RENDER);

    if (!component.state.display) {
      return;
    }

    //先渲染自己
    component.render();

    //如果有子节点，递归
    if (component.childNodes && component.childNodes.length) {
      component.childNodes.forEach((child) => {
        //子组件的 root/ctx/evtBus/ice/renderer 总是和父组件保持一致
        child.root = component.root;
        child.ctx = component.ctx;
        child.evtBus = component.evtBus;
        child.ice = component.ice;
        child.parentNode = component;
        this.renderRecursively(child);
      });
    }

    component.trigger(ICE_EVENT_NAME_CONSTS.AFTER_RENDER);
    this.trigger(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, null, { component: component });
  }
}

export default CanvasRenderer;
