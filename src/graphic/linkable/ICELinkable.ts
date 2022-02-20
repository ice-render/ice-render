/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICELinkSlot from './ICELinkSlot';

/**
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
 */
export default class ICELinkable {
  linkSlots = [];
  slotRadius = 10;

  /**
   * 创建连接插槽，插槽默认分布在组件最小边界盒子的4条边几何中点位置。
   * FIXME:插槽需要添加到显示列表中去。
   */
  createLinkSlots() {
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
    slot_1.hostComponent = this;

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
    slot_2.hostComponent = this;

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
    slot_3.hostComponent = this;

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
    slot_4.hostComponent = this;

    this.linkSlots = [slot_1, slot_2, slot_3, slot_4];
  }

  setSlotPositions() {
    let box = this.getMinBoundingBox();
    this.linkSlots.forEach((slot) => {
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
}
