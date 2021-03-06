/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../event/ICEEvent';
import ICE from '../ICE';
import LineControlPanel from './link-controls/LineControlPanel';
import TransformControlPanel from './transform-controls/TransformControlPanel';

/**
 * @class ICEControlPanelManager
 *
 * 控制面板管理器
 *
 * - ICEControlPanelManager 负责管理所有类型的控制面板（ControlPanel）。
 * - ICEControlPanelManager 是全局单例的，一个 ICE 实例上只能有一个实例。
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
    this.ice.addTool(this.transformControlPanel);
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
    this.ice.addTool(this.lineControlPanel);
    this.lineControlPanel.disable(); //默认处于禁用状态
  }

  start() {
    this.ice.evtBus.on('mousedown', this.mouseDownHandler, this);
    return this;
  }

  stop() {
    this.ice.evtBus.off('mousedown', this.mouseDownHandler, this);
    return this;
  }

  private mouseDownHandler(evt: ICEEvent) {
    let component = evt.target as any;

    if (!component.ice || !component.state.interactive || !component.state.transformable) {
      this.lineControlPanel.disable();
      this.transformControlPanel.disable();
      return;
    }

    //只有 ICEControlPanel 和它内部的变换手柄才具备跟随鼠标移动的功能，其它组件都需要由 ICEControlPanel 驱动进行移动和变换。
    const isControlPanel =
      component && (component.isControlPanel || (component.parentNode && component.parentNode.isControlPanel));
    if (isControlPanel) {
      return;
    }

    this.ice.selectionList = [component];
    this.lineControlPanel.disable();
    this.transformControlPanel.disable();

    //线条型的组件变换工具与其它组件不同
    if (component.isLine) {
      this.lineControlPanel.targetComponent = component;
      this.lineControlPanel.enable();
    } else {
      this.transformControlPanel.targetComponent = component;
      this.transformControlPanel.enable();
    }
  }
}

export default ICEControlPanelManager;
