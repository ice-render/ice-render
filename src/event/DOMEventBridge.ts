/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import mouseEvents from '../consts/MOUSE_EVENT_MAPPING_CONSTS';
import ICE from '../ICE';
import ICEEvent from './ICEEvent';

/**
 * @class DOMEventBridge
 *
 * 事件桥接器，把原生 DOM 事件转发给 canvas 内部的组件。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class DOMEventBridge {
  private selectionCandidates: Array<any> = [];
  private ice: ICE;
  private _stopped: boolean = false;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    let componentCache = null; //缓存上次位于鼠标位置的组件

    for (let i = 0; i < mouseEvents.length; i++) {
      const evtMapping = mouseEvents[i];
      const iceEvtName = evtMapping[1];
      const originEvtName = evtMapping[0];
      this.ice.evtBus.on(iceEvtName, (evt: ICEEvent) => {
        if (this._stopped) {
          return;
        }

        //! mousemove 事件的触发频率非常高，对于 mousemove 事件不执行 findTargetComponent() 操作
        if (iceEvtName !== 'ICE_MOUSEMOVE') {
          componentCache = this.findTargetComponent(evt.clientX, evt.clientY); //FIXME:需要把 clientX/clientY 转换成 canvas 内部的坐标
        }

        if (componentCache) {
          evt.target = componentCache;
          componentCache.trigger(originEvtName, evt);
        }
        this.ice.evtBus.trigger(originEvtName, evt); //this.ice.evtBus 本身一定会触发一次事件。
      });
    }

    return this;
  }

  public set stopped(flag: boolean) {
    this._stopped = flag;
  }

  public get stopped() {
    return this._stopped;
  }

  /**
   * 找到被点击的对象，用代码触发 click 事件。
   * 在点击状态下，每次只能点击一个对象，当前不支持 DOM 冒泡特性。
   *
   * @param clientX
   * @param clientY
   * @returns
   */
  private findTargetComponent(clientX, clientY) {
    if (this._stopped) return null;

    let x = clientX - this.ice.canvasBoundingClientRect.left;
    let y = clientY - this.ice.canvasBoundingClientRect.top;

    let components = this.ice.childNodes;
    for (let i = 0; i < components.length; i++) {
      let component: any = components[i];
      this.traverse(x, y, component);
    }

    this.selectionCandidates.sort((a, b) => {
      return a.zIndex - b.zIndex;
    });

    let component = this.selectionCandidates[0];
    this.selectionCandidates = [];
    return component;
  }

  /**
   * @param x
   * @param y
   * @param component
   */
  private traverse(x, y, component): void {
    if (this._stopped) return;

    if (component.childNodes && component.childNodes.length) {
      for (let i = 0; i < component.childNodes.length; i++) {
        const child = component.childNodes[i];
        this.traverse(x, y, child);
      }
    }

    //不可交互的组件、没有渲染的组件，不派发事件。
    let { interactive, display } = component.state;
    let flag = component.containsPoint(x, y);
    if (flag && interactive && display) {
      this.selectionCandidates.push(component);
    }
  }
}

export default DOMEventBridge;
