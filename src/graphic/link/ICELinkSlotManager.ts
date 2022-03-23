/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { v4 as uuid } from '@lukeed/uuid';
import bigZIndexNum from '../../consts/BIG_ZINDEX_NUMBER';
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from '../../event/ICEEvent';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import ICE from '../../ICE';
import ICELinkSlot from './ICELinkSlot';

/**
 * @class ICELinkSlotManager
 *
 * - ICELinkSlotManager 连接插槽管理器，用于管理连接插槽，共4个，所有可连接的组件都复用这4个插槽的实例。
 * - ICELinkSlotManager 的实例是在 ICE 初始化时创建的。
 * - ICELinkSlotManager 是全局单例，同一个 ICE 实例上只能有一个 ICELinkSlotManager 实例。
 *
 * @see ICE
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */

export default class ICELinkSlotManager {
  private slotRadius = 10;
  private ice: ICE;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    this.createLinkSlots();
    this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.AFTER_ADD, this.afterAddHandler, this);
    return this;
  }

  stop() {
    this.ice.evtBus.off(ICE_EVENT_NAME_CONSTS.AFTER_ADD, this.afterAddHandler, this);
    return this;
  }

  private afterAddHandler(evt) {
    const component = evt.param.component;
    if (!component || !component.state.linkable) {
      return;
    }
    this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, component); //!作用域是 component
  }

  private hookMouseMoveHandler(evt: ICEEvent) {
    let linkHook = evt.target;
    let hookBounding: ICEBoundingBox = linkHook.getMaxBoundingBox();
    let slotBounding: ICEBoundingBox = this.getMaxBoundingBox();
    if (slotBounding.isIntersect(hookBounding)) {
      for (let i = 0; i < this.ice._linkSlots.length; i++) {
        this.ice._linkSlots[i].hostComponent = this;
      }
    }
  }

  /**
   * 创建连接插槽，插槽默认分布在组件最小边界盒子的4条边几何中点位置。
   * 有顺序，按照 TRBL 上右下左 创建，插槽的 ID 会被序列化。
   */
  protected createLinkSlots() {
    if (this.ice._linkSlots && this.ice._linkSlots.length) {
      return;
    }

    let slot_1 = new ICELinkSlot({
      id: 'ICE_' + uuid(),
      zIndex: bigZIndexNum,
      display: false,
      transformable: false,
      draggable: false,
      radius: this.slotRadius,
      position: 'T',
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
    });
    this.ice.addChild(slot_1);

    let slot_2 = new ICELinkSlot({
      id: 'ICE_' + uuid(),
      zIndex: bigZIndexNum,
      display: false,
      transformable: false,
      draggable: false,
      radius: this.slotRadius,
      position: 'R',
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
    });
    this.ice.addChild(slot_2);

    let slot_3 = new ICELinkSlot({
      id: 'ICE_' + uuid(),
      zIndex: bigZIndexNum,
      display: false,
      transformable: false,
      draggable: false,
      radius: this.slotRadius,
      position: 'B',
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
    });
    this.ice.addChild(slot_3);

    let slot_4 = new ICELinkSlot({
      id: 'ICE_' + uuid(),
      zIndex: bigZIndexNum,
      display: false,
      transformable: false,
      draggable: false,
      radius: this.slotRadius,
      position: 'L',
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
    });
    this.ice.addChild(slot_4);

    this.ice._linkSlots = [slot_1, slot_2, slot_3, slot_4];
  }
}
