/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../../event/ICEEvent';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import { ICE_EVENT_NAME_CONSTS } from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICECircle from '../shape/ICECircle';
import ICELinkHook from './ICELinkHook';

/**
 * @class ICELinkSlot
 *
 * 连接插槽
 *
 * - ICELinkSlot 与 ICELinkHook 是一对组件，用来把两个组件连接起来。
 * - 一个插槽上面可以连多个钩子，ICELinkSlot 与 ICELinkHook 之间是一对多的关系。
 * - ICELinkSlot 不能独立存在，它必须附属在某个宿主组件上。逻辑附属，非真实的外观附属。
 * - ICELinkSlot 总是绘制在全局 canvas 中，它不是任何组件的子节点。
 * - ICELinkSlot 自身不进行任何 transform 。
 * - ICELinkSlot 的实例是由 ICELinkSlotManager 统一动态创建的，如果组件的 linkable 状态为 tue ，ICELinkSlotManager 会动态在组件上创建连接插槽。
 *
 * @see ICELinkHook
 * @see ICELinkSlotManager
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICELinkSlot extends ICECircle {
  //宿主组件。
  private _hostComponent;

  /**
   * position 有4个取值，分别位于宿主边界盒子的4个边的几何中点上：
   * - T: 顶部
   * - R: 右侧
   * - B: 底部
   * - L: 左侧
   *
   * 连接插槽自身不可拖拽、不可连接。
   * @param props
   */
  constructor(props: any = {}) {
    super({ linkable: false, draggable: false, position: 'T', ...props });
  }

  protected initEvents() {
    super.initEvents();

    //由于 ICELinkSlot 默认不可见，实例的 display 为 false ，所以不会触发 AFTER_RENDER 事件，这里只能监听 BEFORE_RENDER
    //这里不能直接访问 this.evtBus ，因为对象在进入到渲染阶段时才会被设置 evtBus 实例，在 initEvents() 被调用时 this.evtBus 为空。 @see ICE.evtBus
    this.once(ICE_EVENT_NAME_CONSTS.BEFORE_RENDER, this.afterAddHandler, this);
    this.once(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, this.beforeRemoveHandler, this);
  }

  protected afterAddHandler(evt: ICEEvent) {
    this.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEDOWN, this.hookMouseDownHandler, this);
    this.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
    this.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP, this.hookMouseUpHandler, this);
  }

  protected beforeRemoveHandler(evt: ICEEvent) {
    this.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEDOWN, this.hookMouseDownHandler, this);
    this.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
    this.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP, this.hookMouseUpHandler, this);
    this._hostComponent = null;
  }

  /**
   * 监听 EventBus 上连接钩子鼠标按下事件
   * @param evt
   */
  protected hookMouseDownHandler(evt: ICEEvent) {
    this.setState({
      display: true,
    });
  }

  /**
   * 监听 EventBus 上连接钩子鼠标移动事件，判断钩子是否与插槽发生了碰撞。
   * FIXME:这里需要更好的碰撞检测算法，与所有插槽进行比对的方式效率太低。
   * @param evt
   */
  protected hookMouseMoveHandler(evt: ICEEvent) {
    let linkHook = evt.target;
    if (this.isIntersectWithHook(linkHook)) {
      //FIXME:鼠标划过时的样式移动到配置项里面去
      this.setState({
        style: {
          fillStyle: '#fffb00',
        },
      });

      linkHook._currentAboveSlot = this;
      linkHook.setState({
        style: {
          fillStyle: '#fffb00',
        },
      });
    } else {
      this.setState({
        style: {
          fillStyle: '#3ce92c',
        },
      });

      if (linkHook._currentAboveSlot === this) {
        linkHook.setState({
          style: {
            fillStyle: '#3ce92c',
          },
        });
      }
    }
  }

  /**
   * 监听 EventBus 上连接钩子鼠标弹起事件
   * @param evt
   */
  protected hookMouseUpHandler(evt: ICEEvent) {
    let linkHook = evt.target;
    let linkLine = linkHook.parentNode.targetComponent;
    let position = linkHook.state.position;
    if (this.isIntersectWithHook(linkHook)) {
      // 如果 hook 与 slot 位置重叠，让连接线与 slot 所在的组件建立连接关系
      // 把连线上的起点或者终点坐标设置为当前发生碰撞的 ICELinkSlot 的坐标
      // ICELinkHook 实例在 LinkControlPanel 中，全局只有2个实例，所有连接线都共享同一个 LinkControlPanel 实例。
      linkLine && linkLine.setSlot(this, position);
    } else {
      //hook 没有与当前的 slot 重叠，让 hook 所在的连接线解除与当前 slot 之间的连接关系
      linkLine && linkLine.deleteSlot(this, position);
    }

    this.setState({
      display: false,
      style: {
        fillStyle: '#3ce92c',
      },
    });

    linkHook.setState({
      style: {
        fillStyle: '#3ce92c',
      },
    });
  }

  private isIntersectWithHook(linkHook: ICELinkHook) {
    let slotBounding: ICEBoundingBox = this.getMaxBoundingBox();
    let hookBounding: ICEBoundingBox = linkHook.getMaxBoundingBox();
    if (slotBounding.isIntersect(hookBounding)) {
      return true;
    }
    return false;
  }

  public set hostComponent(component) {
    this._hostComponent = component;
  }

  public get hostComponent() {
    return this._hostComponent;
  }
}

export default ICELinkSlot;