import ICEEvent from '../event/ICEEvent';
import ICE from '../ICE';
import TransformPanel from './TransformPanel';

/**
 * @class TransformManager
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class TransformManager {
  private ice: ICE;
  private transformPanel: TransformPanel;
  private currentDraggingObj: any; //当前正在操作的对象

  constructor(ice: ICE) {
    this.ice = ice;

    this.transformPanel = new TransformPanel({
      left: 400,
      top: 100,
      width: 100,
      height: 100,
      style: {
        strokeStyle: '#8b0000',
        fillStyle: '#99FFFF',
        lineWidth: 1,
      },
      transform: {
        rotate: 45,
      },
    });

    //在同一时刻，不可能同时出现多个 TransformPanel 实例，这里默认构造一个，放在距离可见区域很远的位置？？？
    //FIXME:需要测试是否会影响 toDataURL 的输出结果。
    this.ice.addToDisplayMap(this.transformPanel);
  }

  //FIXME:先取消选中列表中的原有对象的选中状态?
  //FIXME:TransformPanel 需要根据情况决定自己的外观和状态。
  private mouseDownHandler(evt: ICEEvent) {
    let component = evt.target;
    console.log(component);
    if (!component.state.interactive) {
      return;
    }

    //NOTE: 只有 TransformPanel 和它内部的子组件才具备跟随鼠标移动的功能，其它组件都需要借助于 TransformPanel 进行移动和变换。
    const isTransformPanel =
      component && (component instanceof TransformPanel || component.parentNode instanceof TransformPanel);

    if (!isTransformPanel) {
      if (evt.ctrlKey) {
        this.ice.selectionList.push(component);
      } else {
        this.ice.selectionList = [component];
      }
      this.transformPanel.targetComponent = component; //FIXME:处理多选的情况
    } else {
      this.currentDraggingObj = component;
      //FIXME:鼠标移动太快会脱离组件，这里的事件需要挂在到 root 上。
      this.ice.evtBus.on('mousemove', this.mouseMoveHandler, this);
      this.ice.evtBus.on('mouseup', this.mouseUpHandler, this);
    }
  }

  private mouseMoveHandler(evt: ICEEvent): boolean {
    if (evt.target && evt.target === this.currentDraggingObj) {
      let tx = evt.movementX / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
      let ty = evt.movementY / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去

      //FIXME:为什么直接放在 canvas 上的组件不需要乘以逆矩阵？能否让处理方式保持一致，方便理解？
      //   if (this.currentDraggingObj.parentNode) {
      //     let point = new DOMPoint(tx, ty);
      //     let matrix = this.currentDraggingObj.state.absoluteLinearMatrix;
      //     matrix = matrix.inverse();
      //     point = point.matrixTransform(matrix);
      //     tx = point.x;
      //     ty = point.y;
      //   }
      this.currentDraggingObj.movePosition(tx, ty, evt);
      return true;
    }
    return false;
  }

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

export default TransformManager;
