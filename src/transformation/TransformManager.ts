import ICEEvent from '../event/ICEEvent';
import ICE from '../ICE';
import TransformPanel from './TransformPanel';

/**
 * @class TransformManager 变换管理器
 *
 * - 所有组件的位移、旋转、缩放，都通过此管理器进行。
 * - 全局单例，一个 ICE 实例上只能有一个 TransformManager 实例。
 * - 借助于 TransformPanel 进行图形化交互
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class TransformManager {
  private ice: ICE;
  private transformPanel: TransformPanel;
  private currentDraggingObj: any; //当前正在操作的对象

  constructor(ice: ICE) {
    this.ice = ice;

    this.transformPanel = new TransformPanel({
      left: 500,
      top: 100,
      width: 100,
      height: 100,
      style: {
        strokeStyle: '#8b0000',
        fillStyle: 'rgba(255, 255, 49, 0.2)',
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
      //TODO:隐藏 TransformPanel
      return;
    }

    //只有 TransformPanel 和它内部的变换手柄才具备跟随鼠标移动的功能，其它组件都需要由 TransformPanel 驱动进行移动和变换。
    const isTransformPanel =
      component && (component instanceof TransformPanel || component.parentNode instanceof TransformPanel);

    if (!isTransformPanel) {
      if (evt.ctrlKey) {
        this.ice.selectionList.push(component);
      } else {
        this.ice.selectionList = [component];
      }
      //FIXME:处理多选的情况，如果实现多选机制，会导致 N 层重叠的对象的处理出现麻烦。
      this.transformPanel.targetComponent = component;
    }

    this.currentDraggingObj = this.transformPanel;
    if (component.parentNode instanceof TransformPanel) {
      //点击了 TransformPanel 内部的变换手柄
      this.currentDraggingObj = component;
    }

    this.ice.evtBus.on('mousemove', this.mouseMoveHandler, this);
    this.ice.evtBus.on('mouseup', this.mouseUpHandler, this);
  }

  private mouseMoveHandler(evt: ICEEvent): boolean {
    let tx = evt.movementX / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
    let ty = evt.movementY / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
    this.currentDraggingObj.moveGlobalPosition(tx, ty, evt);
    return true;
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
