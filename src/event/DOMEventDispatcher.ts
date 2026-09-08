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
    const domEvts = [...mouseEvents, ...keyboardEvents]; //鼠标事件和键盘事件合并在一起处理
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

    const { offsetX, offsetY } = evt;
    const x = offsetX;
    const y = offsetY;

    const arr1 = flattenTree([], this.ice.childNodes);
    const arr2 = flattenTree([], this.ice.toolNodes);
    const arr = [...arr1, ...arr2];
    arr.sort((a, b) => {
      return a.state.zIndex - b.state.zIndex;
    });

    for (let i = 0; i < arr.length; i++) {
      const component: any = arr[i];
      // 控制面板本体是覆盖在目标组件之上的工具层，不作为命中目标；否则面板(zIndex 最高)会
      // 遮挡住被选组件及其子组件，导致 N 层嵌套下点击子组件无法命中。面板的子手柄(ResizeControl/
      // RotateControl)不是 isControlPanel，仍会参与命中，保证缩放/旋转可用。
      if (component.isControlPanel) continue;
      const { interactive, display } = component.state;
      const flag = component.containsPoint(x, y);
      if (flag && interactive && display) {
        this.selectionCandidates.push(component);
      }
    }

    const component = this.selectionCandidates.pop();
    this.selectionCandidates = [];
    return component;
  }
}

export default DOMEventDispatcher;
