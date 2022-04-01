/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../event/ICEEvent';
import ICE from '../ICE';

/**
 * @class DDManager
 *
 *  拖拽管理器
 *
 * - ICE Render 中所有组件的拖动都由 DDManager 管理。
 * - 拖拽管理器是纯逻辑组件，没有外观。
 * - DDManager 只负责拖拽和移动位置，不进行其它操作。
 * - 全局单例，一个 ICE 实例上只能有一个 DDManager 实例。
 *
 * @see ICE
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class DDManager {
  private ice: ICE;
  private currentObj: any; //当前正在拖动的组件，FIXME:同时拖动多个组件？

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    this.ice.evtBus.on('mousedown', this.mouseDownHandler, this);
    return this;
  }

  stop() {
    this.ice.evtBus.off('mousedown', this.mouseDownHandler, this);
    this.ice.evtBus.off('mousemove', this.mouseMoveHandler, this);
    this.ice.evtBus.off('mouseup', this.mouseUpHandler, this);
    return this;
  }

  private mouseDownHandler(evt: ICEEvent) {
    let component = evt.target as any;
    //!TS instanceof 的问题 https://github.com/microsoft/TypeScript/issues/22585 ，这里通过对象上是否存在 ice 属性来判断事件目标是否是 ICE 组件。
    if (!component.ice) {
      console.warn('DDManager: 点击在 canvas 画布上，没有点击任何图形。');
      return;
    }

    if (!component.state.interactive || !component.state.draggable) {
      return;
    }

    this.currentObj = component;
    this.ice.evtBus.on('mousemove', this.mouseMoveHandler, this);
    this.ice.evtBus.on('mouseup', this.mouseUpHandler, this);
  }

  private mouseMoveHandler(evt: ICEEvent): boolean {
    // console.log('window.devicePixelRatio>', window.devicePixelRatio);
    // let tx = evt.movementX / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
    // let ty = evt.movementY / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
    //@ts-ignore
    let tx = evt.movementX;
    //@ts-ignore
    let ty = evt.movementY;
    this.currentObj.moveGlobalPosition(tx, ty, evt);
    return true;
  }

  private mouseUpHandler(evt: ICEEvent) {
    this.ice.evtBus.off('mousemove', this.mouseMoveHandler, this);
    this.ice.evtBus.off('mouseup', this.mouseUpHandler, this);
  }
}
