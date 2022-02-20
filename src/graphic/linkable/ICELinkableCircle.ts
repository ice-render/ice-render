import ICEEvent from '../../event/ICEEvent';
import { ICE_CONSTS } from '../../ICE_CONSTS';
import { applyMixins } from '../../util/mixin-util';
import ICECircle from '../shape/ICECircle';
import ICELinkable from './ICELinkable';

//FIXME:测试完功能之后重新命名，把其它可连接的组件删掉。
class ICELinkableCircle extends ICECircle {
  constructor(props) {
    super(props);
  }

  protected initEvents(): void {
    super.initEvents();

    this.once(ICE_CONSTS.BEFORE_REMOVE, this.beforeRemoveHandler, this);
  }

  /**
   * 可连接的组件在自己被删除之前，需要把连接插槽全部删掉。
   * 此事件监听器只会执行一次。
   * @param evt
   */
  private beforeRemoveHandler(evt: ICEEvent) {
    this.linkSlots.forEach((slot) => {
      slot.purgeEvents();
      this.ice.removeChild(slot);
    });
  }

  protected doRender(): void {
    super.doRender();
    if (this.state.linkable && !this.linkSlots.length) {
      this.createLinkSlots();
    }
    this.setSlotPositions();
  }

  //for Mixins...
  // linkSlots = [];
  // slotRadius = 10;
}

//@see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
applyMixins(ICELinkableCircle, [ICELinkable]);

export default ICELinkableCircle;
