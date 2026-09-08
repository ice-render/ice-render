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
import { flattenTree } from '../util/data-util';

/**
 * @class CanvasRenderer Canvas 渲染器
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
  //@perf: 渲染队列缓存。组件树结构未变化时，跳过递归 flattenTree + sort，仅做 O(n) 的 zIndex 稳
  // 定性比对，避免每帧重建队列（zIndex 仅在顺序真的改变时才重新排序）。
  private __queueDirty: boolean = true;
  private __zSnap: number[] = []; //复用的 zIndex 快照，与 componentQueue+toolsQueue 顺序一致

  constructor(ice: ICE) {
    super();
    this.ice = ice;
  }

  /**
   * @method markQueueDirty 标记组件树结构已变化，下一次渲染需重建渲染队列。
   * 由 ICE / ICEGroup 在 addChild / removeChild 等结构性变更时调用。
   */
  public markQueueDirty(): void {
    this.__queueDirty = true;
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
    if (this.ice.dirty) {
      this.doRender();
    }
  }

  private refreshQueue() {
    if (this.__queueDirty) {
      this.__rebuildQueue();
      return;
    }
    //结构未变：仅检查 zIndex 是否真的发生变化（O(n) 整数比对，无数组分配）。
    // 仅当顺序确实改变时才重新排序，否则直接复用上一次的队列。
    if (this.__zOrderChanged()) {
      const compareZ = (a: any, b: any) => a.state.zIndex - b.state.zIndex;
      this.componentQueue.sort(compareZ);
      this.toolsQueue.sort(compareZ);
      this.__snapshotZ();
    }
  }

  private __rebuildQueue() {
    const compareZ = (a: any, b: any) => a.state.zIndex - b.state.zIndex;
    this.componentQueue = flattenTree([], this.ice.childNodes);
    this.componentQueue.sort(compareZ);
    this.toolsQueue = flattenTree([], this.ice.toolNodes);
    this.toolsQueue.sort(compareZ);
    this.__queueDirty = false;
    this.__snapshotZ();
  }

  /**
   * 把当前 componentQueue + toolsQueue 的 zIndex 顺序快照到复用的 __zSnap 数组，
   * 供下一帧做稳定性比对，避免每帧分配新数组。
   */
  private __snapshotZ() {
    const total = this.componentQueue.length + this.toolsQueue.length;
    if (this.__zSnap.length !== total) this.__zSnap = new Array(total);
    let idx = 0;
    for (let i = 0; i < this.componentQueue.length; i++) {
      this.__zSnap[idx++] = this.componentQueue[i].state.zIndex;
    }
    for (let i = 0; i < this.toolsQueue.length; i++) {
      this.__zSnap[idx++] = this.toolsQueue[i].state.zIndex;
    }
  }

  /**
   * 对比当前队列的 zIndex 与上次快照，任一不同（或长度变化）即认为顺序已变。
   */
  private __zOrderChanged(): boolean {
    const total = this.componentQueue.length + this.toolsQueue.length;
    if (this.__zSnap.length !== total) return true;
    let idx = 0;
    for (let i = 0; i < this.componentQueue.length; i++) {
      if (this.__zSnap[idx++] !== this.componentQueue[i].state.zIndex) return true;
    }
    for (let i = 0; i < this.toolsQueue.length; i++) {
      if (this.__zSnap[idx++] !== this.toolsQueue[i].state.zIndex) return true;
    }
    return false;
  }

  private doRender() {
    const startTime = Date.now();

    this.refreshQueue();

    //渲染组件
    this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);
    for (let i = 0; i < this.componentQueue.length; i++) {
      const component = this.componentQueue[i];
      //@perf: 仅在引用不一致时才重新注入（首帧 / 跨 ICE 切换），稳态下跳过 4 次属性写入
      if (component.ctx !== this.ice.ctx || component.ice !== this.ice) {
        component.root = this.ice.root;
        component.ctx = this.ice.ctx;
        component.evtBus = this.ice.evtBus;
        component.ice = this.ice;
      }
      component.render();
    }

    //渲染工具节点
    for (let i = 0; i < this.toolsQueue.length; i++) {
      const tool = this.toolsQueue[i];
      if (tool.ctx !== this.ice.ctx || tool.ice !== this.ice) {
        tool.root = this.ice.root;
        tool.ctx = this.ice.ctx;
        tool.evtBus = this.ice.evtBus;
        tool.ice = this.ice;
      }
      tool.render();
    }

    //完成一轮渲染时，在总线上触发一个 ROUND_FINISH 事件。
    this.ice.dirty = false;
    this.ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH);
  }
}

export default CanvasRenderer;
