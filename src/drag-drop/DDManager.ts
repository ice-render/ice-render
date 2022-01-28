import ICEEvent from '../event/ICEEvent';
import ICE from '../ICE';

/**
 * FIXME:可以同时拖动多个对象
 * @class DDManager
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class DDManager {
  private ice: ICE;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  private mouseDownHandler(evt: ICEEvent) {
    this.ice.evtBus.on('mousemove', this.mouseMoveHandler, this);
    this.ice.evtBus.on('mouseup', this.mouseUpHandler, this);
  }

  private mouseMoveHandler(evt: ICEEvent) {
    this.ice.selectionList.forEach((component) => {
      let tx = evt.movementX / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
      let ty = evt.movementY / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去

      //FIXME:为什么直接放在 canvas 上的组件不需要乘以逆矩阵？能否让处理方式保持一致，方便理解？
      if (component.parentNode) {
        let point = new DOMPoint(tx, ty);
        let matrix = component.state.absoluteLinearMatrix;
        matrix = matrix.inverse();
        point = point.matrixTransform(matrix);
        tx = point.x;
        ty = point.y;
      }
      component.movePosition(tx, ty, evt);
      return true;
    });
  }

  /**
   * FIXME:需要处理鼠标在 canvas 范围之外弹起的情况，把 mousemove/mouseup 两个事件放在 root 对象上，而不是内部组件上。
   * TODO:对于浏览器环境，事件直接挂在 window 上。
   * @param evt
   */
  private mouseUpHandler(evt: ICEEvent) {
    this.ice.evtBus.off('mousemove', this.mouseMoveHandler, this);
    this.ice.evtBus.off('mouseup', this.mouseUpHandler, this);
  }

  start() {
    this.ice.evtBus.on('mousedown', this.mouseDownHandler, this);
    return this;
  }

  //FIXME:
  stop() {}
}

export default DDManager;
