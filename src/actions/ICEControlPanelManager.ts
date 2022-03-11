/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../event/ICEEvent';
import ICEBaseComponent from '../graphic/ICEBaseComponent';
import ICEPolyLine from '../graphic/line/ICEPolyLine';
import ICE from '../ICE';
import ICEControlPanel from './ICEControlPanel';
import LineControlPanel from './line-controls/LineControlPanel';
import TransformControlPanel from './transform-controls/TransformControlPanel';

/**
 * @class ICEControlPanelManager
 *
 * 控制面板管理器
 *
 * - ICEControlPanelManager 负责管理所有类型的控制面板（ControlPanel）。
 * - ICEControlPanelManager 是全局单例的，一个 ICE 实例上只能有一个实例。
 * - ICEControlPanelManager 只需要设置 targetComponent 即可，拖拽移位操作由  DDManager 完成。
 * - ICEControlPanelManager 是纯逻辑组件，没有外观。
 *
 * @see ICE
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEControlPanelManager {
  private ice: ICE;
  //FIXME:这里需要重构，不同类型的组件需要展现不同的操作工具，操作工具可能会有 N 种，需要进一步抽象操作工具相关的逻辑。
  private transformControlPanel: TransformControlPanel;
  private lineControlPanel: LineControlPanel;

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
    this.ice.addChild(this.transformControlPanel);
    this.transformControlPanel.disable(); //默认处于禁用状态

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
    this.ice.addChild(this.lineControlPanel);
    this.lineControlPanel.disable(); //默认处于禁用状态
  }

  private mouseDownHandler(evt: ICEEvent) {
    let component = evt.target;

    if (!(component instanceof ICEBaseComponent) || !component.state.interactive || !component.state.transformable) {
      this.lineControlPanel.disable();
      this.transformControlPanel.disable();
      return;
    }

    //只有 ICEControlPanel 和它内部的变换手柄才具备跟随鼠标移动的功能，其它组件都需要由 ICEControlPanel 驱动进行移动和变换。
    const isControlPanel =
      component && (component instanceof ICEControlPanel || component.parentNode instanceof ICEControlPanel);
    if (isControlPanel) {
      return;
    }

    this.ice.selectionList = [component];
    this.lineControlPanel.disable();
    this.transformControlPanel.disable();
    //线条型的组件变换工具与其它组件不同
    if (component instanceof ICEPolyLine) {
      this.lineControlPanel.targetComponent = component;
      this.lineControlPanel.enable();
    } else {
      this.transformControlPanel.targetComponent = component;
      this.transformControlPanel.enable();
    }
  }

  start() {
    this.ice.evtBus.on('mousedown', this.mouseDownHandler, this);
    return this;
  }

  //FIXME:
  stop() {}
}

export default ICEControlPanelManager;
