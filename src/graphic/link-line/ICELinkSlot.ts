import ICEEvent from '../../event/ICEEvent';
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

    //FIXME:向 ICELinkManager 注册自己，并监听事件总线上的事件
    //当 LinkHook 派发 mouseup 事件时， LinkSlot 决定是否要产生连接关系
  }

  protected initEvents() {
    super.initEvents();
    this.on('mouseover', this.mouseOverHandler, this);
    this.on('mouseup', this.mosueUpHandler, this);
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
