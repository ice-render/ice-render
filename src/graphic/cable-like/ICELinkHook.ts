/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../../event/ICEEvent';
import ICECircle from '../shape/ICECircle';

/**
 * @class ICELinkHook
 *
 * 连接插槽
 *
 * - ICELinkHook 永远直接放在 canvas 中，不是其它组件的孩子。
 * - ICELinkHook 自身不进行任何 transform 。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ICELinkHook extends ICECircle {
  constructor(props: any = {}) {
    super({ linkable: false, ...props });
  }

  protected initEvents() {
    super.initEvents();

    this.on('mousedown', this.mosueDownHandler, this);
    this.on('mouseup', this.mosueUpHandler, this);
    this.on('after-move', this.resizeEvtHandler, this);
  }

  /**
   *
   * 在 mousedown 事件处理器里面可以直接访问 this.evtBus ，因为能接收到 mousedown 事件说明组件已经渲染出来了。
   * 在 this.evtBus 上触发事件，相当于全局广播，所有监听了 hook-mousedown 事件的组件都会收到消息。
   *
   * @param evt
   */
  protected mosueDownHandler(evt: ICEEvent) {
    this.evtBus.trigger('hook-mousedown', new ICEEvent({ target: this }));
  }

  /**
   *
   * 在 mouseup 事件处理器里面可以直接访问 this.evtBus ，因为能接收到 mouseup 事件说明组件已经渲染出来了。
   * 在 this.evtBus 上触发事件，相当于全局广播，所有监听了 hook-mouseup 事件的组件都会收到消息。
   *
   * @param evt
   */
  protected mosueUpHandler(evt: ICEEvent) {
    this.evtBus.trigger('hook-mouseup', new ICEEvent({ target: this }));
  }

  protected resizeEvtHandler(evt) {
    if (!this.parentNode) {
      return;
    }
    let position = this.props.position;
    this.parentNode.trigger('before-resize', new ICEEvent(evt, { position }));
    this.parentNode.trigger('after-resize', new ICEEvent(evt, { position }));
  }
}
