import ICELinkSlot from '../link-line/ICELinkSlot';

/**
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
 */
export default class ICELinkable {
  linkSlots = [];
  slotRadius = 10;

  createLinkSlots() {
    let slot_1 = new ICELinkSlot({
      transformable: false,
      radius: this.slotRadius,
      position: 'T',
    });
    let slot_2 = new ICELinkSlot({
      transformable: false,
      radius: this.slotRadius,
      position: 'R',
    });
    let slot_3 = new ICELinkSlot({
      transformable: false,
      radius: this.slotRadius,
      position: 'B',
    });
    let slot_4 = new ICELinkSlot({
      transformable: false,
      radius: this.slotRadius,
      position: 'L',
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

  showLinkSlots() {}

  hideLinkSlots() {}
}
