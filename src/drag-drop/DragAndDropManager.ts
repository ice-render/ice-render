import ICEEvent from '../event/ICEEvent';
import ICE from '../ICE';

/**
 * FIXME:可以同时拖动多个对象
 * @class DragAndDropManager
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class DragAndDropManager {
  private ice: ICE;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    const that = this;

    function mouseDownHandler(evt: ICEEvent) {
      that.ice.evtBus.on('mousemove', mouseMoveHandler);
      that.ice.evtBus.on('mouseup', mouseUpHandler);
    }

    function mouseMoveHandler(evt: ICEEvent) {
      that.ice.selectionList.forEach((el) => {
        let tx = evt.movementX / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
        let ty = evt.movementY / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去

        //FIXME:为什么直接放在 canvas 上的组件不需要乘以逆矩阵？能否让处理方式保持一致，方便理解？
        if (el.parentNode) {
          let point = new DOMPoint(tx, ty);
          let matrix = el.state.absoluteLinearMatrix;
          matrix = matrix.inverse();
          point = point.matrixTransform(matrix);
          tx = point.x;
          ty = point.y;
        }

        el.trigger('before-move', { ...evt, tx, ty });
        el.movePosition(tx, ty);
        el.trigger('after-move', { ...evt, tx, ty });
      });
    }

    //FIXME:需要处理鼠标在 canvas 范围之外弹起的情况，把 mousemove/mouseup 两个事件放在 root 对象上，而不是内部组件上。
    //TODO:对于浏览器环境，事件直接挂在 window 上。
    function mouseUpHandler(evt: ICEEvent) {
      that.ice.evtBus.off('mousemove', mouseMoveHandler);
      that.ice.evtBus.off('mouseup', mouseUpHandler);
    }

    this.ice.evtBus.on('mousedown', mouseDownHandler);
    return this;
  }

  //FIXME:
  stop() {}
}

export default DragAndDropManager;
