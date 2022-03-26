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
  private componentQueue = []; //等待渲染的组件队列，FIFO
  private toolsQueue = []; //等待渲染的工具组件队列，FIFO

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

  private refreshQueue() {
    this.componentQueue = CanvasRenderer.flattenTree([], this.ice.childNodes);
    this.componentQueue.sort((firstEl, secondEl) => {
      return firstEl.state.zIndex - secondEl.state.zIndex;
    });
    console.log(`Component Queue length> ${this.componentQueue.length}`);

    this.toolsQueue = CanvasRenderer.flattenTree([], this.ice.toolNodes);
    console.log(`Tool Queue length> ${this.ice.toolNodes.length}`);
  }

  private doRender() {
    const startTime = Date.now();

    this.refreshQueue();

    //渲染组件
    this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);
    for (let i = 0; i < this.componentQueue.length; i++) {
      const component = this.componentQueue[i];
      component.root = this.ice.root;
      component.ctx = this.ice.ctx;
      component.evtBus = this.ice.evtBus;
      component.ice = this.ice;
      component.render();
    }

    //渲染工具节点
    for (let i = 0; i < this.toolsQueue.length; i++) {
      const tool = this.toolsQueue[i];
      tool.root = this.ice.root;
      tool.ctx = this.ice.ctx;
      tool.evtBus = this.ice.evtBus;
      tool.ice = this.ice;
      tool.render();
    }

    //完成一轮渲染时，在总线上触发一个 ROUND_FINISH 事件。
    console.log(`Render time ${Date.now() - startTime} ms.`);
    this.ice._dirty = false;
    this.ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH);
  }

  /**
   * @static
   * @method flattenTree
   *
   * 把 tree 形结构拉平成数组结构。
   *
   * @param result
   * @param childNodes
   * @param level
   * @param pid
   * @returns
   */
  public static flattenTree(result = [], childNodes = [], level = 1, pid = null) {
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      node._level = level;
      node._pid = pid;
      result.push(node);
      CanvasRenderer.flattenTree(result, node.childNodes || [], level + 1, node.id);
    }
    return result;
  }
}

export default CanvasRenderer;
