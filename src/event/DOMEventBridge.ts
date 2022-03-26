/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import mouseEvents from '../consts/MOUSE_EVENT_MAPPING_CONSTS';
import ICE from '../ICE';
import { flattenTree } from '../util/data-util';
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
    let componentCache = null; //缓存上次被点击的组件

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

    let arr1 = flattenTree([], this.ice.toolNodes);
    let arr2 = flattenTree([], this.ice.childNodes);
    let arr = [...arr1, ...arr2];
    arr.sort((a, b) => {
      return a.state.zIndex - b.state.zIndex;
    });

    for (let i = 0; i < arr.length; i++) {
      let component: any = arr[i];
      let { interactive, display } = component.state;
      let flag = component.containsPoint(x, y);
      if (flag && interactive && display) {
        this.selectionCandidates.push(component);
      }
    }

    let component = this.selectionCandidates.pop();
    this.selectionCandidates = [];
    return component;
  }
}

export default DOMEventBridge;
