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

    //FIXME:向 ICELinkManager 注册自己，并监听事件总线上的事件
  }

  protected initEvents() {
    super.initEvents();
    this.on('mouseover', this.mouseOverHandler, this);
    this.on('mousedown', this.mosueDownHandler, this);
    this.on('mouseup', this.mosueUpHandler, this);
    this.on('after-move', this.resizeEvtHandler, this);
  }

  protected mouseOverHandler(evt: ICEEvent) {
    console.log('mouse over...');
  }

  protected mosueDownHandler(evt: ICEEvent) {
    console.log('mouse up...');
  }

  protected mosueUpHandler(evt: ICEEvent) {
    console.log('mouse up...');
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
