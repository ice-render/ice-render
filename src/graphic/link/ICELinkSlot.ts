/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from '../../event/ICEEvent';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import ICEPolyLine from './ICEPolyLine';
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
    //不能在 initEvents() 方法中访问 this.evtBus ，在 initEvents() 被调用时 this.evtBus 为空，因为对象在进入到渲染阶段时才会被设置 evtBus 实例。 @see ICE.evtBus
    this.once(ICE_EVENT_NAME_CONSTS.BEFORE_RENDER, this.beforeRenderHandler, this);
    this.once(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, this.beforeRemoveHandler, this);
  }

  protected beforeRenderHandler(evt: ICEEvent) {
    this.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEDOWN, this.hookMouseDownHandler, this);
    this.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
    this.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP, this.hookMouseUpHandler, this);
    this.evtBus.on('mouseup', this.globalMouseUpHandler, this);
  }

  protected beforeRemoveHandler(evt: ICEEvent) {
    this.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEDOWN, this.hookMouseDownHandler, this);
    this.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
    this.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP, this.hookMouseUpHandler, this);
    this.evtBus.off('mouseup', this.globalMouseUpHandler, this);
    this._hostComponent = null;
  }

  /**
   * 只要鼠标弹起，连接插槽总是变成不可见状态。
   */
  protected globalMouseUpHandler() {
    this.setState({
      display: false,
    });
  }

  /**
   * 监听 EventBus 上连接钩子鼠标按下事件
   * @param evt
   */
  protected hookMouseDownHandler(evt: ICEEvent) {
    console.log('linkslot, hook mousedown event...');

    if (!this._hostComponent) {
      return;
    }
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
    let linkHook = evt.target as any;
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
   * 处理 EventBus 上连接钩子鼠标弹起事件
   * @param evt
   */
  protected hookMouseUpHandler(evt: ICEEvent) {
    if (!this._hostComponent) {
      return;
    }

    let linkHook: ICELinkHook = evt.target as any;
    let linkLine: ICEPolyLine = linkHook.parentNode.targetComponent;
    let position: string = linkHook.state.position;
    if (this.isIntersectWithHook(linkHook)) {
      linkLine && linkLine.setLink(position, this._hostComponent, this.props.position);
    } else {
      linkLine && linkLine.removeLink(position, this._hostComponent, this.props.position);
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

  //FIXME:这里位置计算有问题
  //FIXME:这里需要采用 TransformControlPanel 中的算法来计算插槽位置。
  protected updatePosition() {
    console.log('link slot update position ...');

    let box = this._hostComponent.getMinBoundingBox();
    let left = 0;
    let top = 0;
    switch (this.state.position) {
      case 'T':
        left = box.tc[0] - this.state.radius;
        top = box.tc[1] - this.state.radius;
        break;
      case 'R':
        left = box.rc[0] - this.state.radius;
        top = box.rc[1] - this.state.radius;
        break;
      case 'B':
        left = box.bc[0] - this.state.radius;
        top = box.bc[1] - this.state.radius;
        break;
      case 'L':
        left = box.lc[0] - this.state.radius;
        top = box.lc[1] - this.state.radius;
        break;
      default:
        break;
    }
    this.setState({ left, top });
  }

  public set hostComponent(component) {
    this._hostComponent && this._hostComponent.off(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.updatePosition, this);
    this._hostComponent = component;
    this._hostComponent && this._hostComponent.on(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.updatePosition, this);
    this._hostComponent &&
      this._hostComponent.once(
        ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE,
        () => {
          this._hostComponent = null;
          this.setState({
            display: false,
          });
        },
        this
      );
    this._hostComponent &&
      this.setState({
        display: true,
      });
  }

  public get hostComponent() {
    return this._hostComponent;
  }
}

export default ICELinkSlot;
