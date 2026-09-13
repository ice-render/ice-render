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
  /**
   * 端点手柄与插槽中心的**吸附距离**（世界坐标 px）：超出它就不算"靠近"，
   * 插槽不进入可落点状态、松手也不建立连接。
   *
   * 取值依据：插槽半径 10 + 端点手柄半径 8 + 少量余量 —— 与旧实现「手柄包围盒与插槽包围盒相交」
   * 的判定范围基本一致（略宽松一点点），不会让原本能连的落点变连不上。
   */
  private snapDistance = 24;
  /** 当前吸附的插槽（拖拽中唯一显示出来的那个），松手时只认它。 */
  private snapSlot: ICELinkSlot | null = null;

  /** 插槽实例池（引擎内部字段：5 个共享实例，挂在 T/R/B/L/C 五个位置）。 */
  private get slots(): ICELinkSlot[] {
    //@ts-ignore 引擎内部字段，仅本管理器使用
    return this.ice._linkSlots || [];
  }

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
    // 强制刷新包围盒：钩子/插槽的位置都在同一帧里刚被改过，读缓存会得到"上一帧的位置"，
    // 于是"是否已吸附"会比画面晚一拍（实测落点已经压住插槽了、吸附判定却还是旧的）。
    const hookBounding: ICEBoundingBox = linkHook.getMaxBoundingBox(true);

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
      this.snapSlot = null;
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

    /**
     * 只显示**离钩子最近的那一个**插槽。
     *
     * 为什么不再把 5 个都显示出来：插槽是工具层组件，一屏之内同一时刻只有一个可能被连上，
     * 另外 4 个既不会被选中、又要参与每帧的擦除与重绘（插槽越多，脏区越大）。
     * 就近的那一个：贴近到吸附距离内标黄（可以松手建立连接），否则标绿（提示"这里有插槽"）。
     */
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.hostComponent !== this.collision) {
        slot.hostComponent = this.collision;
      }
    }
    const nearest = this.__nearestSlot(hookBounding);
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const isNearest = !!nearest && slot === nearest.slot;
      slot.setState({
        display: isNearest,
        style: {
          fillStyle: isNearest && nearest.distance <= this.snapDistance ? '#fffb00' : '#3ce92c',
        },
      });
    }
    this.snapSlot = nearest && nearest.distance <= this.snapDistance ? nearest.slot : null;
    linkHook.setState({
      style: {
        fillStyle: this.snapSlot ? '#fffb00' : '#3ce92c',
      },
    });
  }

  /** 找出离钩子包围盒中心最近的插槽（含中心距），供"只显示一个 + 松手只认它"使用。 */
  private __nearestSlot(hookBounding: ICEBoundingBox): { slot: ICELinkSlot; distance: number } | null {
    const hookCenter = hookBounding.center;
    let best: { slot: ICELinkSlot; distance: number } | null = null;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.hostComponent) {
        continue;
      }
      const center = slot.getMaxBoundingBox(true).center;
      const distance = Math.sqrt((center[0] - hookCenter[0]) ** 2 + (center[1] - hookCenter[1]) ** 2);
      if (!best || distance < best.distance) {
        best = { slot, distance };
      }
    }
    return best;
  }

  private hookMouseUpHandler(evt: ICEEvent) {
    const linkHook = evt.target as any;
    const position: string = linkHook.state.position;
    const linkLine: ICEPolyLine = linkHook.parentNode.targetComponent;

    // 只认"当前吸附的那个插槽"（= 拖拽中唯一显示出来的那一个）：
    // 它在吸附距离内就建立连接，否则按未命中处理 —— 用户看到的插槽就是实际会连上的插槽。
    const slot = this.snapSlot;
    const param: any = {};
    if (slot && slot.hostComponent) {
      param[position] = { id: slot.hostComponent.state.id, position: slot.state.position };
    } else {
      param[position] = null;
    }
    linkLine && linkLine.setState({ links: param });

    // 收尾：隐藏全部插槽、把手柄样式复位（建立连接后手柄自身也隐藏，与旧行为一致）
    //@ts-ignore
    for (let i = 0; i < this.ice._linkSlots.length; i++) {
      //@ts-ignore
      this.ice._linkSlots[i].setState({ display: false, style: { fillStyle: '#3ce92c' } });
    }
    if (slot) {
      linkHook.setState({ display: false, style: { fillStyle: '#3ce92c' } });
    } else {
      linkHook.setState({ style: { fillStyle: '#3ce92c' } });
    }

    this.snapSlot = null;
    this.collision = null;
  }

  protected globalMouseUpHandler(evt?: ICEEvent) {
    this.snapSlot = null;
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
