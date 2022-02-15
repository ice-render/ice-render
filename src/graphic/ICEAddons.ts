import ICEEvent from '../event/ICEEvent';
import ICEComponent from './ICEComponent';

/**
 * @class ICEAddons
 *
 * 附加组件
 *
 * - 附加组件一般用来装饰其它组件，附加组件必须依附在某个宿主组件上，不能单独存在。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ICEAddons {
  hostComponent: ICEComponent;

  hostMoveHandler(evt: ICEEvent): void {
    console.log('host moving...');
    //FIXME:宿主发生移动之后，插槽更新自己的位置
  }

  setHostComponent(component: ICEComponent): void {
    this.hostComponent = component;
    if (this.hostComponent) {
      this.hostComponent.on('after-move', this.hostMoveHandler, this);
    } else {
      this.hostComponent.off('after-move', this.hostMoveHandler, this);
    }
  }
}
