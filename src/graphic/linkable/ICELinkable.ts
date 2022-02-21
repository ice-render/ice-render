/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import ICEEvent from '../../event/ICEEvent';
import { ICE_CONSTS } from '../../ICE_CONSTS';
import ICEBaseComponent from '../ICEBaseComponent';
import ICELinkSlot from './ICELinkSlot';

/**
 *
 * 泛型工厂函数，把普通的图形类转换成可连接的图形类。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html#constrained-mixins
 *
 */
type Constructor<T> = new (...args: any[]) => T;

function ICELinkable<T extends Constructor<ICEBaseComponent>>(Base: T) {
  return class Scaling extends Base {
    private linkSlots = [];
    private slotRadius = 10;

    constructor(...args: any[]) {
      super(args && args.length ? args[0] : {});
    }

    protected initEvents(): void {
      this.once(ICE_CONSTS.BEFORE_REMOVE, this.beforeRemoveHandler, this);
    }

    /**
     * 可连接的组件在自己被删除之前，需要把连接插槽全部删掉。
     * 此事件监听器只会执行一次。
     * @param evt
     */
    private beforeRemoveHandler(evt: ICEEvent) {
      this.linkSlots.forEach((slot) => {
        slot.purgeEvents();
        this.ice.removeChild(slot);
      });
    }

    protected doRender(): void {
      super.doRender();
      if (this.state.linkable) {
        if (!this.linkSlots.length) {
          this.createLinkSlots();
        }
        this.setSlotPositions();
      }
    }

    /**
     * 创建连接插槽，插槽默认分布在组件最小边界盒子的4条边几何中点位置。
     */
    protected createLinkSlots() {
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
      slot_2.hostComponent = this;
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
      slot_3.hostComponent = this;
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
      slot_4.hostComponent = this;
      this.ice.addChild(slot_4);

      this.linkSlots = [slot_1, slot_2, slot_3, slot_4];
    }

    protected setSlotPositions() {
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
  };
}

export default ICELinkable;
