import ICEEvent from '../event/ICEEvent';
import ICE from '../ICE';

/**
 * @class TransformManager
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class TransformManager {
  private ice: ICE;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    const that = this;

    function mouseDownHandler(evt: ICEEvent) {
      that.ice.evtBus.on('mouseup', mouseUpHandler);
    }

    function mouseUpHandler(evt: ICEEvent) {
      that.ice.evtBus.off('mouseup', mouseUpHandler);
      console.log('TransformManager mouseup...');
    }

    that.ice.evtBus.on('mousedown', mouseDownHandler);
    return this;
  }

  //FIXME:
  stop() {}
}

export default TransformManager;
