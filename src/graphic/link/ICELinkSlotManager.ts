/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import bigZIndexNum from '../../consts/BIG_ZINDEX_NUMBER';
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from '../../event/ICEEvent';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import ICE from '../../ICE';
import ICELinkSlot from './ICELinkSlot';
import ICEPolyLine from './ICEPolyLine';

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
    this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
    this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP, this.hookMouseUpHandler, this);
    this.ice.evtBus.on('mouseup', this.globalMouseUpHandler, this);
    return this;
  }

  stop() {
    this.ice.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
    this.ice.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP, this.hookMouseUpHandler, this);
    this.ice.evtBus.off('mouseup', this.globalMouseUpHandler, this);
    return this;
  }

  private hookMouseMoveHandler(evt: ICEEvent) {
    let linkHook = evt.target as any;
    let hookBounding: ICEBoundingBox = linkHook.getMaxBoundingBox();

    //连接钩子是否碰到了某个可连接组件的边缘
    let collision = null;
    const childNodes = [...this.ice.childNodes];
    for (let i = 0; i < childNodes.length; i++) {
      const component = childNodes[i];
      if (!component || !component.state.linkable) {
        continue;
      }
      let componentBounding: ICEBoundingBox = component.getMaxBoundingBox();
      if (componentBounding.isIntersect(hookBounding)) {
        collision = component;
        break;
      }
    }

    if (!collision) {
      return;
    }

    //@ts-ignore
    for (let i = 0; i < this.ice._linkSlots.length; i++) {
      //@ts-ignore
      let slot = this.ice._linkSlots[i];
      if (slot.hostComponent !== collision) {
        slot.hostComponent = collision;
      }

      slot.setState({
        display: true,
        style: {
          fillStyle: '#3ce92c',
        },
      });

      linkHook.setState({
        style: {
          fillStyle: '#3ce92c',
        },
      });

      //判断连接钩子是否碰到了某个 linkSlot
      let slotBox: ICEBoundingBox = slot.getMaxBoundingBox();
      if (slotBox.isIntersect(hookBounding)) {
        slot.setState({
          style: {
            fillStyle: '#fffb00',
          },
        });

        linkHook.setState({
          style: {
            fillStyle: '#fffb00',
          },
        });
      }
    }
  }

  private hookMouseUpHandler(evt: ICEEvent) {
    let linkHook = evt.target as any;
    let position: string = linkHook.state.position;
    let linkLine: ICEPolyLine = linkHook.parentNode.targetComponent;
    let hookBounding: ICEBoundingBox = linkHook.getMaxBoundingBox();

    let isIntersect = false;
    //@ts-ignore
    for (let i = 0; i < this.ice._linkSlots.length; i++) {
      //@ts-ignore
      let slot = this.ice._linkSlots[i];
      //判断连接钩子是否碰到了某个 linkSlot
      let slotBox: ICEBoundingBox = slot.getMaxBoundingBox();
      if (slotBox.isIntersect(hookBounding)) {
        isIntersect = true;
        //建立连接关系
        let param = {};
        param[position] = {
          id: slot.hostComponent.state.id,
          position: slot.state.position,
        };
        linkLine && linkLine.setState({ links: param });
      }

      slot.setState({
        display: false,
        style: {
          fillStyle: '#3ce92c',
        },
      });
    }

    //如果钩子与所有插槽都没有发生碰撞，则删掉对应线条上的连接关系
    if (!isIntersect) {
      let param = {};
      param[position] = null;
      linkLine && linkLine.setState({ links: param });
    }
  }

  protected globalMouseUpHandler(evt?: ICEEvent) {
    //@ts-ignore
    for (let i = 0; i < this.ice._linkSlots.length; i++) {
      //@ts-ignore
      let slot = this.ice._linkSlots[i];
      slot.setState({
        display: false,
        style: {
          fillStyle: '#3ce92c',
        },
      });
    }
  }

  /**
   * 创建连接插槽，插槽默认分布在组件最小边界盒子的4条边几何中点位置。
   * 有顺序，按照 TRBL 上右下左 创建，插槽的 ID 会被序列化。
   */
  protected createLinkSlots() {
    //@ts-ignore
    if (this.ice._linkSlots && this.ice._linkSlots.length) {
      return;
    }

    let slot_1 = new ICELinkSlot({
      zIndex: bigZIndexNum + 10,
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
    this.ice.addTool(slot_1);

    let slot_2 = new ICELinkSlot({
      zIndex: bigZIndexNum + 11,
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
    this.ice.addTool(slot_2);

    let slot_3 = new ICELinkSlot({
      zIndex: bigZIndexNum + 12,
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
    this.ice.addTool(slot_3);

    let slot_4 = new ICELinkSlot({
      zIndex: bigZIndexNum + 13,
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
    this.ice.addTool(slot_4);
    //@ts-ignore
    this.ice._linkSlots = [slot_1, slot_2, slot_3, slot_4];
  }
}
