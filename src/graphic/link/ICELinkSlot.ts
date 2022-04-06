/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICECircle from '../shape/ICECircle';

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
   * - T: 宿主边界盒子的顶边中点
   * - R: 宿主边界盒子的右边中点
   * - B: 宿主边界盒子的底边中点
   * - L: 宿主边界盒子的左边中点
   * - C: 宿主边界盒子的几何中心点
   *
   * 连接插槽自身不可拖拽、不可连接。
   * @param props
   */
  constructor(props: any = {}) {
    super({ linkable: false, draggable: false, position: 'T', ...props });
  }

  /**
   * @overwrite
   * @method keyboardEvtHandler 键盘事件处理
   * !ICELinkSlot 不响应键盘事件，覆盖成空实现。
   * @see {ICEComponent.keyboardEvtHandler}
   * @param evt
   * @returns
   */
  protected keyboardEvtHandler(evt: any) {}

  public destory(): void {
    this.hostComponent = null;
    super.destory();
  }

  //FIXME:这里位置计算有问题
  //FIXME:这里需要采用 TransformControlPanel 中的算法来计算插槽位置。
  protected updatePosition() {
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
      case 'C':
        left = box.center[0] - this.state.radius;
        top = box.center[1] - this.state.radius;
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
