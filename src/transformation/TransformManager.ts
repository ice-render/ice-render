import ICE from '../ICE';
import TransformControl from './TransformControl';

/**
 * @class TransformManager
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class TransformManager {
  private ice: ICE;
  private transformControl: TransformControl;

  constructor(ice: ICE) {
    this.ice = ice;

    this.transformControl = new TransformControl({
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

    //在同一时刻，不可能同时出现多个 TransformControl 实例，这里默认构造一个，放在距离可见区域很远的位置？？？
    //FIXME:需要测试是否会影响 toDataURL 的输出结果。
    this.ice.addToDisplayMap(this.transformControl);
  }

  start() {
    this.ice.evtBus.on('select', this.selectEvtHandler, this);
    return this;
  }

  private selectEvtHandler(evt) {
    //NOTE: 如果 evt.target 是 TransformControl 自身，或者它内部的子组件，这里什么都不做，因为变换工具不能自己给自己做变换操作。
    if (evt.target && (evt.target instanceof TransformControl || evt.target.parentNode instanceof TransformControl)) {
      return;
    }

    //FIXME:支持多个组件的组合变换。
    //FIXME:当选中列表中只有 TransformControl 自己，或者只有它的子组件时，隐藏变换工具。
    let component = this.ice.selectionList[0];
    this.transformControl.targetComponent = component;
  }

  //FIXME:
  stop() {}
}

export default TransformManager;
