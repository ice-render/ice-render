/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../event/ICEEvent';
import ICEEventTarget from '../event/ICEEventTarget';
import ICEBaseComponent from '../graphic/ICEBaseComponent';
import ICE from '../ICE';
import { ICE_CONSTS } from '../ICE_CONSTS';

/**
 * @class CanvasRenderer
 * Canvas 渲染器，全局单例。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class CanvasRenderer extends ICEEventTarget {
  private ice: ICE;
  private stopped: boolean = false;
  private cacheArr = [];

  constructor(ice: ICE) {
    super();
    this.ice = ice;
  }

  public start() {
    this.stopped = false;
    this.ice.evtBus.on(ICE_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
    return this;
  }

  public stop() {
    this.stopped = true;
    this.ice.evtBus.off(ICE_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
    return this;
  }

  //FIXME:fix this when using increamental rendering
  //FIXME:动画有闪烁
  //FIXME:当对象很多时，在一帧的时间内（最短16.67ms)渲染不完，这里需要进行处理。
  private frameEvtHandler(evt: ICEEvent) {
    this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);

    if (this.stopped) {
      this.cacheArr = [];
      return;
    }

    if (!this.ice.childNodes || !this.ice.childNodes.length) return;

    //根据组件的 zIndex 升序排列，保证 zIndex 大的组件在后面绘制。
    this.cacheArr = Array.from(this.ice.childNodes);
    this.cacheArr.sort((firstEl, secondEl) => {
      return firstEl.state.zIndex - secondEl.state.zIndex;
    });
    this.cacheArr.forEach((component: ICEBaseComponent) => {
      this.renderRecursively(component);
    });

    //完成一轮渲染时，在总线上触发一个 ROUND_FINISH 事件。
    this.ice.evtBus.trigger(ICE_CONSTS.ROUND_FINISH);
  }

  private renderRecursively(component: ICEBaseComponent) {
    if (this.stopped) {
      this.cacheArr = [];
      return;
    }

    this.trigger(ICE_CONSTS.BEFORE_RENDER, null, { component: component });
    component.trigger(ICE_CONSTS.BEFORE_RENDER);

    if (component.state.isRendering || !component.state.display) {
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

    component.trigger(ICE_CONSTS.AFTER_RENDER);
    this.trigger(ICE_CONSTS.AFTER_RENDER, null, { component: component });
  }
}

export default CanvasRenderer;
