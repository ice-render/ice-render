import ICEEvent from '../event/ICEEvent';
import ICELine from '../graphic/line/ICELine';
import ICE from '../ICE';
import ICEControlPanel from './ICEControlPanel';
import LineControlPanel from './line-controls/LineControlPanel';
import TransformControlPanel from './transform-controls/TransformControlPanel';

/**
 * @class ICEControlManager 用户操作管理器
 *
 * - 负责管理所有类型的 ControlPanel 。
 * - 全局单例，一个 ICE 实例上只能有一个 ICEControlManager 实例。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEControlManager {
  private ice: ICE;
  //FIXME:这里需要重构，不同类型的组件需要展现不同的操作工具，操作工具可能会有 N 种，需要进一步抽象操作工具相关的逻辑。
  private transformControlPanel: TransformControlPanel;
  private lineControlPanel: LineControlPanel;
  private currentDraggingObj: any; //当前正在拖动的组件

  constructor(ice: ICE) {
    this.ice = ice;

    this.transformControlPanel = new TransformControlPanel({
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
    //在同一时刻，不可能同时出现多个 TransformControlPanel 实例，这里默认构造一个，放在距离可见区域很远的位置？？？
    //FIXME:需要测试是否会影响 toDataURL 的输出结果。
    this.ice.addToDisplayMap(this.transformControlPanel);

    this.lineControlPanel = new LineControlPanel({
      left: 700,
      top: 50,
      width: 100,
      height: 100,
      style: {
        strokeStyle: 'rgba(255, 255, 49, 0)',
        fillStyle: 'rgba(255, 255, 49, 0)',
        lineWidth: 1,
      },
    });
    this.ice.addToDisplayMap(this.lineControlPanel);
  }

  //FIXME:先取消选中列表中的原有对象的选中状态?
  //FIXME:ICEControlPanel 需要根据情况决定自己的外观和状态。
  private mouseDownHandler(evt: ICEEvent) {
    let component = evt.target;
    console.log(component);

    if (!component.state.interactive) {
      //TODO:隐藏 ICEControlPanel
      //FIXME:需要清理事件
      this.ice.rmFromDisplayMap(this.transformControlPanel);
      this.ice.rmFromDisplayMap(this.lineControlPanel);
      return;
    }

    //只有 ICEControlPanel 和它内部的变换手柄才具备跟随鼠标移动的功能，其它组件都需要由 ICEControlPanel 驱动进行移动和变换。
    const isControlPanel =
      component && (component instanceof ICEControlPanel || component.parentNode instanceof ICEControlPanel);
    if (!isControlPanel) {
      //被点击的对象不是 ICEControlPanel 的实例，也不是 ICEControlPanel 内部的组件，说明点击了普通的组件。
      if (evt.ctrlKey) {
        this.ice.selectionList.push(component);
      } else {
        this.ice.selectionList = [component];
      }

      if (component instanceof ICELine) {
        this.lineControlPanel.targetComponent = component;
      } else {
        //FIXME:处理多选的情况，如果实现多选机制，会导致 N 层重叠的对象的处理出现麻烦。
        this.transformControlPanel.targetComponent = component;
      }
    }

    if (component instanceof ICELine) {
      this.currentDraggingObj = this.lineControlPanel;
    } else {
      this.currentDraggingObj = this.transformControlPanel;
    }

    if (component.parentNode instanceof ICEControlPanel) {
      //点击了 ICEControlPanel 内部的变换手柄
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

export default ICEControlManager;
