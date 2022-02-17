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
import { applyMixins } from '../../util/mixin-util';
import ICEAddonComponent from '../ICEAddonComponent';
import ICECircle from '../shape/ICECircle';

/**
 * @class ICELinkSlot
 *
 * 连接插槽
 *
 * - ICELinkSlot 永远直接放在 canvas 中，不是其它组件的孩子。
 * - ICELinkSlot 自身不进行任何 transform 。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICELinkSlot extends ICECircle implements ICEAddonComponent {
  constructor(props: any = {}) {
    //position 有4个取值，T/R/B/L 分别位于宿主边界盒子的4个边上。
    super({ linkable: false, position: 'T', ...props });
  }

  protected initEvents() {
    super.initEvents();

    this.on('mouseover', this.mouseOverHandler, this);
    this.on('mouseup', this.mosueUpHandler, this);

    //由于 ICELinkSlot 默认不可见，实例的 display 为 false ，所以不会触发 AFTER_RENDER 事件，这里只能监听 BEFORE_RENDER
    //这里不能直接在 this.evtBus 上添加监听器，因为对象在进入到渲染阶段时才会被设置 evtBus 实例，在 initEvents() 被调用时 this.evtBus 为空。 @see ICE.evtBus
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
    let slotBounding: ICEBoundingBox = this.getMaxBoundingBox();
    let hookBounding: ICEBoundingBox = evt.target.getMaxBoundingBox();
    if (slotBounding.isIntersect(hookBounding)) {
      //FIXME:如果 hook 与 slot 重叠，建立连接关系
      //FIXME:直接设置 hook 的位置，让中心点重叠，产生“磁吸”效果
      console.log('存在交叉部分，建立连接关系...');
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

  //for Mixins...
  hostComponent: any;
}

//@see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
applyMixins(ICELinkSlot, [ICEAddonComponent]);

export default ICELinkSlot;
