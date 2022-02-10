import ICEEvent from '../../event/ICEEvent';
import ICECircle from '../../graphic/shape/ICECircle';

/**
 * @class LineControl
 *
 * TODO: 补全 props 配置项
 */
export default class LineControl extends ICECircle {
  constructor(props) {
    super(props);
    this.on('after-move', this.resizeEvtHandler, this);
  }

  private resizeEvtHandler(evt) {
    if (!this.parentNode) {
      return;
    }
    let position = this.props.position;
    this.parentNode.trigger('before-resize', new ICEEvent(evt, { position }));
    this.parentNode.trigger('after-resize', new ICEEvent(evt, { position }));
  }
}
