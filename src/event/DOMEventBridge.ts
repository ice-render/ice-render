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
          componentCache = this.findTargetComponent(evt);
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
   * @method findTargetComponent
   *
   * 找到被点击的对象，用代码触发 click 事件。
   * 在点击状态下，每次只能点击一个对象，当前不支持 DOM 冒泡特性。
   *
   * @returns
   */
  private findTargetComponent(evt) {
    if (this._stopped) return null;

    let { offsetX, offsetY } = evt;
    let x = offsetX;
    let y = offsetY;

    //FIXME:由于组件之间的 tree 形结构，这里的 sort 操作可能会导致组件的点击顺序错乱。
    let arr = [...this.ice.toolNodes, ...this.ice.childNodes];
    arr.sort((a, b) => {
      return a.zIndex - b.zIndex;
    });

    for (let i = 0; i < arr.length; i++) {
      let component: any = arr[i];
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
