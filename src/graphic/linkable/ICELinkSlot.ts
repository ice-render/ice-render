/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../../event/ICEEvent';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import { ICE_CONSTS } from '../../ICE_CONSTS';
import ICECircle from '../shape/ICECircle';

/**
 * @class ICELinkSlot
 *
 * 连接插槽
 *
 * - ICELinkSlot 与 ICELinkHook 是一对组件，用来把两个组件连接起来。
 * - ICELinkSlot 自身不进行任何 transform 。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICELinkSlot extends ICECircle {
  constructor(props: any = {}) {
    //position 有4个取值，T/R/B/L 分别位于宿主边界盒子的4个边上。
    super({ linkable: false, position: 'T', ...props });
  }

  protected initEvents() {
    super.initEvents();

    this.on('mouseover', this.mouseOverHandler, this);
    this.on('mouseup', this.mosueUpHandler, this);

    //由于 ICELinkSlot 默认不可见，实例的 display 为 false ，所以不会触发 AFTER_RENDER 事件，这里只能监听 BEFORE_RENDER
    //这里不能直接访问 this.evtBus ，因为对象在进入到渲染阶段时才会被设置 evtBus 实例，在 initEvents() 被调用时 this.evtBus 为空。 @see ICE.evtBus
    this.once(ICE_CONSTS.BEFORE_RENDER, this.afterAddHandler, this);
    this.once(ICE_CONSTS.BEFORE_REMOVE, this.beforeRemoveHandler, this);
  }

  protected afterAddHandler(evt: ICEEvent) {
    this.evtBus.on('hook-mousedown', this.hookMouseDownHandler, this);
    this.evtBus.on('hook-mouseup', this.hookMouseUpHandler, this);
  }

  protected beforeRemoveHandler(evt: ICEEvent) {
    this.evtBus.off('hook-mousedown', this.hookMouseDownHandler, this);
    this.evtBus.off('hook-mouseup', this.hookMouseUpHandler, this);
  }

  protected hookMouseDownHandler(evt: ICEEvent) {
    this.setState({
      display: true,
    });
  }

  protected hookMouseUpHandler(evt: ICEEvent) {
    let linkHook = evt.target;
    let slotBounding: ICEBoundingBox = this.getMaxBoundingBox();
    let hookBounding: ICEBoundingBox = linkHook.getMaxBoundingBox();
    if (slotBounding.isIntersect(hookBounding)) {
      // 如果 hook 与 slot 重叠，建立连接关系
      // 把连线上的起点或者终点设置为 ICELinkSlot 对应的实例
      // ICELinkHook 实例在 LinkControlPanel 中，全局只有2个实例，所有连接线都共享同一个 LinkControlPanel 实例。
      let linkLine = linkHook.parentNode.targetComponent;
      let position = linkHook.state.position;
      if (position === 'start') {
        linkLine.setstartSlot(this);
      } else if (position === 'end') {
        linkLine.setendSlot(this);
      }
    }

    this.setState({
      display: false,
    });
  }

  protected mouseOverHandler(evt: ICEEvent) {
    console.log('mouse over...');
  }

  protected mosueUpHandler(evt: ICEEvent) {
    console.log('mouse up...');
  }
}

export default ICELinkSlot;
