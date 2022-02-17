/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICELinkSlot from '../link-line/ICELinkSlot';

/**
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
 */
export default class ICELinkable {
  linkSlots = [];
  slotRadius = 10;

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
    this.linkSlots = [slot_1, slot_2, slot_3, slot_4];
    this.addChildren([slot_1, slot_2, slot_3, slot_4]); //FIXME:点击了连接线之后再显示 LinkSlot ，默认不显示
  }

  setSlotPositions() {
    let width = this.state.width;
    let height = this.state.height;
    let halfWidth = width / 2;
    let halfHeight = height / 2;

    let positions = {
      T: {
        left: halfWidth - this.slotRadius,
        top: -this.slotRadius,
      },
      R: { left: width - this.slotRadius, top: halfHeight - this.slotRadius },
      B: { left: halfWidth - this.slotRadius, top: height - this.slotRadius },
      L: { left: -this.slotRadius, top: halfHeight - this.slotRadius },
    };

    this.linkSlots.forEach((slot) => {
      let { left, top } = positions[slot.state.position];
      slot.setState({ left, top });
    });
  }
}
