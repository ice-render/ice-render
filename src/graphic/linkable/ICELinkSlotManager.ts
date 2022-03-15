/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../../event/ICEEvent';
import ICE from '../../ICE';
import { ICE_CONSTS } from '../../ICE_CONSTS';
import ICELinkSlot from './ICELinkSlot';

/**
 * @class ICELinkSlotManager
 *
 * - ICELinkSlotManager 连接插槽管理器，用于管理所有可连接组件上的连接插槽。
 * - ICELinkSlotManager 监听 renderer 上的 BEFORE_RENDER 和 AFTER_RENDER 事件，如果发现组件的 linkable 状态为 true ，会动态在组件上创建用于连接的插槽 ICELinkSlot 。
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

  private beforeRenderHandler(evt) {}

  private afterRenderHandler(evt) {
    const component = evt.param.component;
    if (!component || !component.state.linkable) {
      return;
    }

    if (!component.hasListener(ICE_CONSTS.BEFORE_REMOVE, this.beforeRemoveHandler, this)) {
      component.once(ICE_CONSTS.BEFORE_REMOVE, this.beforeRemoveHandler, component);
    }

    if (!component.linkSlots || !component.linkSlots.length) {
      this.createLinkSlots(component);
    }

    //FIXME: 如果 slot 处于显示状态，则计算所有 slot 当前的位置。当 slot 处于隐藏状态时，不计算它们的位置，节约性能？？？
    this.setSlotPositions(component);
  }

  /**
   * 可连接的组件在自己被删除之前，需要把连接插槽全部删掉。
   * 此事件监听器只会执行一次。
   * FIXME:此方法需要测试
   * @param evt
   */
  private beforeRemoveHandler(evt: ICEEvent) {
    const component = evt.param.component;
    component.linkSlots.forEach((slot) => {
      slot.purgeEvents();
      this.ice.removeChild(slot);
    });
  }

  /**
   * 创建连接插槽，插槽默认分布在组件最小边界盒子的4条边几何中点位置。
   */
  protected createLinkSlots(component) {
    let slot_1 = new ICELinkSlot({
      display: false,
      transformable: false,
      radius: this.slotRadius,
      position: 'T',
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
    });
    slot_1.hostComponent = component;
    this.ice.addChild(slot_1);

    let slot_2 = new ICELinkSlot({
      display: false,
      transformable: false,
      radius: this.slotRadius,
      position: 'R',
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
    });
    slot_2.hostComponent = component;
    this.ice.addChild(slot_2);

    let slot_3 = new ICELinkSlot({
      display: false,
      transformable: false,
      radius: this.slotRadius,
      position: 'B',
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
    });
    slot_3.hostComponent = component;
    this.ice.addChild(slot_3);

    let slot_4 = new ICELinkSlot({
      display: false,
      transformable: false,
      radius: this.slotRadius,
      position: 'L',
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
    });
    slot_4.hostComponent = component;
    this.ice.addChild(slot_4);

    component.linkSlots = [slot_1, slot_2, slot_3, slot_4];
  }

  //FIXME:这里需要采用 TransformControlPanel 中的算法来计算插槽位置。
  protected setSlotPositions(component) {
    let box = component.getMinBoundingBox();
    component.linkSlots.forEach((slot) => {
      let left = 0;
      let top = 0;
      switch (slot.state.position) {
        case 'T':
          left = box.center.x - this.slotRadius;
          top = box.tl.y - this.slotRadius;
          break;
        case 'R':
          left = box.tr.x - this.slotRadius;
          top = box.center.y - this.slotRadius;
          break;
        case 'B':
          left = box.center.x - this.slotRadius;
          top = box.br.y - this.slotRadius;
          break;
        case 'L':
          left = box.bl.x - this.slotRadius;
          top = box.center.y - this.slotRadius;
          break;
        default:
          break;
      }
      slot.setState({ left, top });
    });
  }

  start() {
    this.ice.renderer.on(ICE_CONSTS.BEFORE_RENDER, this.beforeRenderHandler, this);
    this.ice.renderer.on(ICE_CONSTS.AFTER_RENDER, this.afterRenderHandler, this);
    return this;
  }

  //FIXME:
  stop() {}
}
