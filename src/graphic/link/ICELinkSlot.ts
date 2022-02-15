import ICEEvent from '../../event/ICEEvent';
import { applyMixins } from '../../util/mixin-util';
import ICEAddons from '../ICEAddons';
import ICEComponent from '../ICEComponent';
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
export default class ICELinkSlot extends ICECircle implements ICEAddons {
  constructor(props: any = {}) {
    //position 有4个取值，T/R/B/L 分别位于宿主边界盒子的4个边上。
    super({ linkable: false, position: 'T', ...props });
    this.initEvents();
  }

  protected initEvents() {
    this.on('mouseover', this.mouseOverHandler, this);
    this.on('mouseup', this.mosueUpHandler, this);
  }

  protected mouseOverHandler(evt: ICEEvent) {
    console.log('mouse over...');
  }

  protected mosueUpHandler(evt: ICEEvent) {
    console.log('mouse up...');
  }

  hostComponent: ICEComponent = null;
  hostMoveHandler: (evt: ICEEvent) => void;
  setHostComponent: (component: ICEComponent) => void;
}

applyMixins(ICELinkSlot, [ICEAddons]);
