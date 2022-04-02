/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { keyboardEvents, mouseEvents } from '../consts/DOM_EVENT_MAPPING_CONSTS';
import ICE from '../ICE';
import { flattenTree } from '../util/data-util';
import ICEEvent from './ICEEvent';

/**
 * @class DOMEventDispatcher
 *
 * - DOM 事件转发器，监听事件总线上的事件，转发给 canvas 内部指定的组件。
 * - 原生的鼠标和键盘事件都通过此工具类进行转发。
 *
 * @see {DOMEventInterceptor}
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class DOMEventDispatcher {
  private selectionCandidates: Array<any> = [];
  private ice: ICE;
  private _stopped: boolean = false;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    let componentCache = null; //缓存上次被点击的组件
    let domEvts = [...mouseEvents, ...keyboardEvents]; //鼠标事件和键盘事件合并在一起处理
    for (let i = 0; i < domEvts.length; i++) {
      const evtMapping = domEvts[i];
      const domEvtName = evtMapping[0];
      const iceEvtName = evtMapping[1];
      this.ice.evtBus.on(iceEvtName, (evt: ICEEvent) => {
        if (this._stopped) {
          return;
        }

        //! mousemove 事件的触发频率非常高，对于 mousemove 事件不执行 findTargetComponent() 操作。
        //! 键盘事件不需要执行 findTargetComponent() 操作，必须先选中一个组件，再把键盘事件派发给它才有意义。
        if (iceEvtName !== 'ICE_MOUSEMOVE' && iceEvtName.indexOf('KEY') === -1) {
          componentCache = this.findTargetComponent(evt); //FIXME: TransformControlPanel 会遮挡住组件，导致组件收不到鼠标事件，需要做一些处理。
        }

        if (componentCache) {
          evt.target = componentCache;
          componentCache.trigger(domEvtName, evt);
        } else {
          // console.warn('没有点中任何组件，不需要给组件派发事件...');
        }

        //this.ice.evtBus 本身一定会触发一次鼠标和键盘事件。
        this.ice.evtBus.trigger(domEvtName, evt, { component: componentCache });
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

    let arr1 = flattenTree([], this.ice.childNodes);
    let arr2 = flattenTree([], this.ice.toolNodes);
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

export default DOMEventDispatcher;
