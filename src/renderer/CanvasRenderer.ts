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

  private frameEvtHandler(evt: ICEEvent) {
    if (this.ice._dirty) {
      this.doRender();
    } else {
      console.log('没有需要渲染的组件...');
    }
  }

  private refreshRenderQueue() {
    this.renderQueue = [...this.ice.childNodes];
    //FIXME:树形结构会导致 zIndex 排序无效
    //FIXME:根据组件的 zIndex 升序排列，保证 zIndex 大的组件在后面绘制。
    this.renderQueue.sort((firstEl, secondEl) => {
      return firstEl.state.zIndex - secondEl.state.zIndex;
    });
  }

  private doRender() {
    const startTime = Date.now();

    this.refreshRenderQueue();
    console.log(`Render Queue length> ${this.renderQueue.length}`);

    //渲染组件
    this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);
    for (let i = 0; i < this.renderQueue.length; i++) {
      const component = this.renderQueue[i];
      this.renderRecursively(component);
    }

    console.log(`Tool length> ${this.ice.toolNodes.length}`);
    //渲染工具节点
    const tools = [...this.ice.toolNodes];
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      this.renderRecursively(tool);
    }

    //完成一轮渲染时，在总线上触发一个 ROUND_FINISH 事件。
    console.log(`Render time ${Date.now() - startTime} ms.`);
    this.ice._dirty = false;
    this.ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH);
  }

  /**
   * 如果有子组件，递归渲染。
   * @param component
   * @returns
   */
  private renderRecursively(component) {
    //先渲染自己
    component.render();

    //如果有子节点，递归
    if (component.childNodes && component.childNodes.length) {
      for (let i = 0; i < component.childNodes.length; i++) {
        const child = component.childNodes[i];
        //子组件的 root/ctx/evtBus/ice/renderer 总是和父组件保持一致
        child.root = component.root;
        child.ctx = component.ctx;
        child.evtBus = component.evtBus;
        child.ice = component.ice;
        child.parentNode = component;
        this.renderRecursively(child);
      }
    }
  }
}

export default CanvasRenderer;
