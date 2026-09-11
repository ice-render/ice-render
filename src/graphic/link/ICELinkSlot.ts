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
   * position 的取值：
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

  // 实时重算宿主的最小包围盒，遵循「嵌套矩阵铁律」：严禁读取可能过期的缓存
  // composedMatrix（宿主移动/缩放/旋转后若未重渲染，缓存仍是旧值，会导致插槽脱离宿主）。
  protected updatePosition() {
    const box = this._hostComponent.getMinBoundingBox(true);
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
    // 位置未变则不 setState：插槽挂在宿主的 AFTER_RENDER 上，每帧无条件置脏会让
    // 「只要有 linkable 组件，画面就永不空闲」（局部重绘/全量重绘被反复触发）。
    if (this.state.left === left && this.state.top === top) {
      return;
    }
    this.setState({ left, top });
  }

  /**
   * 宿主被移除时的处理。
   *
   * 与 TransformControlPanel 同一问题：旧实现用 `once(BEFORE_REMOVE, () => {...})`，
   * `once` 内部包裹后的回调无法被 `off`，反复切换宿主会在宿主上累积无法回收的监听。
   * 改为稳定引用 + `on`，由 setter 在切换时 `off`（`on` 对 (fn, scope) 幂等）。
   */
  private __onHostRemoved = () => {
    this._hostComponent = null;
    this.setState({
      display: false,
    });
  };

  public set hostComponent(component) {
    const prev = this._hostComponent;
    if (prev) {
      prev.off(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.updatePosition, this);
      prev.off(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, this.__onHostRemoved, this);
    }
    this._hostComponent = component;
    if (component) {
      component.on(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.updatePosition, this);
      component.on(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, this.__onHostRemoved, this);
      this.setState({
        display: true,
      });
    }
  }

  public get hostComponent() {
    return this._hostComponent;
  }
}

export default ICELinkSlot;
