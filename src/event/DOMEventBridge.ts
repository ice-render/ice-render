/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE from '../ICE';
import ICEEvent from './ICEEvent';
import mouseEvents from './MOUSE_EVENT_MAPPING_CONSTS';

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

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    //FIXME:这里触发事件的频率太高，所有所有鼠标事件都会被触发出来。
    //FIXME:这里需要增加节流机制，防止触发事件的频率过高导致 CPU 飙升。
    mouseEvents.forEach((evtMapping) => {
      this.ice.evtBus.on(evtMapping[1], (evt: ICEEvent) => {
        const component = this.findTargetComponent(evt.clientX, evt.clientY); //FIXME:需要把 clientX/clientY 转换成 canvas 内部的坐标
        if (component) {
          evt.target = component;
          component.trigger(evtMapping[0], evt);
        }
        this.ice.evtBus.trigger(evtMapping[0], evt); //this.ice.evtBus 本身一定会触发一次事件。
      });
    });
    return this;
  }

  /**
   * 找到被点击的对象，用代码触发 click 事件。
   * 在点击状态下，每次只能点击一个对象，当前不支持 DOM 冒泡特性。
   * FIXME:这里需要进行优化，当存在大量对象时，每一个对象都进行比较会有性能问题。
   *
   * @param clientX
   * @param clientY
   * @returns
   */
  private findTargetComponent(clientX, clientY) {
    let x = clientX - this.ice.canvasBoundingClientRect.left;
    let y = clientY - this.ice.canvasBoundingClientRect.top;
    let components = Array.from(this.ice.childNodes);
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
   * 如果存在子组件，遍历。
   * @param x
   * @param y
   * @param component
   */
  private traverse(x, y, component): void {
    if (component.childNodes && component.childNodes.length) {
      component.childNodes.forEach((child) => {
        this.traverse(x, y, child);
      });
    }

    let flag = component.containsPoint(x, y);
    if (flag && component.state.interactive) {
      this.selectionCandidates.push(component);
    }
  }
}

export default DOMEventBridge;
