import { applyMixins } from '../../util/mixin-util';
import ICECircle from '../shape/ICECircle';
import ICELinkable from './ICELinkable';

//FIXME:测试完功能之后重新命名，把其它可连接的组件删掉。
class ICELinkableCircle extends ICECircle implements ICELinkable {
  constructor(props) {
    super(props);
  }

  //for Mixins...
  linkSlots = [];
  slotRadius = 10;
}

//@see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
applyMixins(ICELinkableCircle, [ICELinkable]);

export default ICELinkableCircle;
