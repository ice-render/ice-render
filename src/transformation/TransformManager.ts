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

    //在同一时刻，不可能同时出现多个 TransformControl 实例，这里默认构造一个，放在距离可见区域很远的位置。
    //FIXME:需要测试是否会影响 toDataURL 的输出结果。
    this.transformControl = new TransformControl({
      left: 10,
      top: 10,
      width: 100,
      height: 100,
      style: {
        strokeStyle: '#8b0000',
        fillStyle: '#99FFFF',
        lineWidth: 1,
      },
    });
    this.ice.addToRenderMap(this.transformControl);
  }

  start() {
    //FIXME:支持多个组件的组合变换
    this.ice.evtBus.on('select', (evt) => {
      let component = this.ice.selectionList[0];
      this.transformControl.targetComponent = component;
    });
    return this;
  }

  //FIXME:
  stop() {}
}

export default TransformManager;
