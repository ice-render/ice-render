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
import ICEComponent from '../ICEComponent';
import ICELinkSlot from './ICELinkSlot';
import ICEPolyLine from './ICEPolyLine';
import { flattenTree, isEffectivelyVisible } from '../../util/data-util';

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
  private collision: ICEComponent; //用来缓存鼠标移动过程中碰撞到的组件，鼠标弹起之后会清空

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
    const linkHook = evt.target as any;
    const hookBounding: ICEBoundingBox = linkHook.getMaxBoundingBox();

    //连接钩子是否碰到了某个可连接组件的边缘。
    // 逐次移动都要**重新计算**（下面的 !collision 分支靠它来隐藏插槽）：旧实现只在命中时赋值、
    // 从不重置，一旦碰到过就会一直粘在那个组件上。
    // 用拉平后的全集而不是只看顶层：嵌套组件（如卡片里的实体）也要能被连线命中。
    // 命中语义与点击一致 —— z 序最高者胜出，否则父容器会一直盖住它的子组件。
    const all = flattenTree([], this.ice.childNodes);
    all.sort((a: any, b: any) => a.state.zIndex - b.state.zIndex);
    this.collision = null;
    for (let i = 0; i < all.length; i++) {
      const component: any = all[i];
      if (!component || !component.state.linkable || !isEffectivelyVisible(component)) {
        continue;
      }
      const componentBounding: ICEBoundingBox = component.getMaxBoundingBox();
      if (componentBounding.isIntersect(hookBounding)) {
        this.collision = component;
      }
    }

    if (!this.collision) {
      //@ts-ignore
      for (let i = 0; i < this.ice._linkSlots.length; i++) {
        //@ts-ignore
        const slot = this.ice._linkSlots[i];
        slot.setState({
          display: false,
          style: {
            fillStyle: '#3ce92c',
          },
        });
      }

      linkHook.setState({
        style: {
          fillStyle: '#3ce92c',
        },
      });
      return;
    }

    let isIntersect = false;
    //@ts-ignore
    for (let i = 0; i < this.ice._linkSlots.length; i++) {
      //@ts-ignore
      const slot = this.ice._linkSlots[i];
      if (slot.hostComponent !== this.collision) {
        slot.hostComponent = this.collision;
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
      const slotBox: ICEBoundingBox = slot.getMaxBoundingBox();
      if (slotBox.isIntersect(hookBounding)) {
        isIntersect = true;
        slot.setState({
          style: {
            fillStyle: '#fffb00',
          },
        });
      }
    }
    if (isIntersect) {
      linkHook.setState({
        style: {
          fillStyle: '#fffb00',
        },
      });
    }
  }

  private hookMouseUpHandler(evt: ICEEvent) {
    const linkHook = evt.target as any;
    const position: string = linkHook.state.position;
    const linkLine: ICEPolyLine = linkHook.parentNode.targetComponent;
    const hookBounding: ICEBoundingBox = linkHook.getMaxBoundingBox();

    let isIntersect = false;
    if (this.collision) {
      //@ts-ignore
      for (let i = 0; i < this.ice._linkSlots.length; i++) {
        //@ts-ignore
        const slot = this.ice._linkSlots[i];
        slot.setState({
          display: false,
          style: {
            fillStyle: '#3ce92c',
          },
        });

        //判断连接钩子是否碰到了某个 linkSlot
        const slotBox: ICEBoundingBox = slot.getMaxBoundingBox();
        if (slotBox.isIntersect(hookBounding)) {
          isIntersect = true;
          //建立连接关系
          const param = {};
          param[position] = {
            id: slot.hostComponent.state.id,
            position: slot.state.position,
          };
          linkLine && linkLine.setState({ links: param });
          break;
        }
      }
    }

    //如果钩子与所有插槽都没有发生碰撞，则删掉对应线条上的连接关系
    if (!isIntersect) {
      const param = {};
      param[position] = null;
      linkLine && linkLine.setState({ links: param });
    } else {
      linkHook.setState({
        display: false,
        style: {
          fillStyle: '#3ce92c',
        },
      });
    }

    this.collision = null;
  }

  protected globalMouseUpHandler(evt?: ICEEvent) {
    //@ts-ignore
    for (let i = 0; i < this.ice._linkSlots.length; i++) {
      //@ts-ignore
      const slot = this.ice._linkSlots[i];
      slot.setState({
        display: false,
        style: {
          fillStyle: '#3ce92c',
        },
      });
    }
  }

  /**
   * @method createLinkSlots
   * 创建5个连接插槽，插槽默认分布在组件最小边界盒子的4条边中点和几何中心点。
   */
  protected createLinkSlots() {
    //@ts-ignore
    if (this.ice._linkSlots && this.ice._linkSlots.length) {
      return;
    }

    const slot_1 = new ICELinkSlot({
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

    const slot_2 = new ICELinkSlot({
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

    const slot_3 = new ICELinkSlot({
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

    const slot_4 = new ICELinkSlot({
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

    const slot_5 = new ICELinkSlot({
      zIndex: bigZIndexNum + 14,
      display: false,
      transformable: false,
      draggable: false,
      radius: this.slotRadius,
      position: 'C',
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#3ce92c',
        lineWidth: 1,
      },
    });
    this.ice.addTool(slot_5);

    //缓存一份，方便操作
    //@ts-ignore
    this.ice._linkSlots = [slot_1, slot_2, slot_3, slot_4, slot_5];
  }
}
