/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../event/ICEEvent';
import ICE from '../ICE';
import { token } from '../theme/ICETheme';
import LineControlPanel from './link-controls/LineControlPanel';
import TransformControlPanel from './transform-controls/TransformControlPanel';
import { notifyToolTarget } from '../worker/mirror-hooks';

/**
 * 控制面板的可配置项（宿主通过 `ICE.init(ctx, { controlPanel })` 传入）。
 *
 * 全部可选，缺省即历史行为；非法值（0 / 负数 / NaN）在面板里退回默认。
 */
export interface ControlPanelOptions {
  /** 变换手柄（8 个缩放控点）的边长，默认 16 */
  resizeControlSize?: number;
  /** 旋转手柄的半径，默认 8 */
  rotateControlSize?: number;
  /** 旋转手柄离包围盒顶边的距离，默认 60 */
  rotateControlOffsetY?: number;
  /** 线条端点手柄（`ICELinkHook`）的边长，默认 16 */
  lineControlSize?: number;
}

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
  public transformControlPanel: TransformControlPanel;
  public lineControlPanel: LineControlPanel;

  constructor(ice: ICE, options: ControlPanelOptions = {}) {
    this.ice = ice;

    this.transformControlPanel = new TransformControlPanel({
      left: 500,
      top: 100,
      width: 100,
      height: 100,
      // 手柄尺寸：宿主没传就是各面板自己的默认值（历史行为）
      resizeControlSize: options.resizeControlSize,
      rotateControlSize: options.rotateControlSize,
      rotateControlOffsetY: options.rotateControlOffsetY,
      // 主题引用（paint 时解析）：setTheme / setChrome 之后外壳跟着换，不用重建组件
      style: {
        strokeStyle: token('chrome.selection.stroke'),
        fillStyle: token('chrome.selection.fill'),
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
      controlSize: options.lineControlSize,
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
    const component = evt.target as any;

    // `target` 可能为空：点在空白处、或宿主环境里没有 DOM 事件目标（合成的事件对象
    // 就没有 `target`）。浏览器下 `evt.target` 恰好是 canvas 元素，所以这个空值一直没暴露。
    if (!component || !component.ice || !component.state.interactive) {
      this.applySelection(null);
      return;
    }

    // 「变换手柄」（旋转 / 缩放）与「端点手柄」（拖动连线端点改连接）是两件事，门控也分开：
    //
    // - 非线条组件：看 `transformable`（原语义不变）；
    // - 线条型组件：看 `linkEditable`（默认开）。应用层常为了「记法不可变换」把连线设成
    //   `transformable: false` —— 那是"不要旋转/缩放手柄"，**不该**连带禁掉端点手柄，
    //   否则用户点连线看不到 hook、也没法把线拖到别的组件上改连接关系
    //   （ice-entity-designer 的 8 个域包就是这个症状，2026-09-13 修）。
    const panelEnabled = component.isLine ? component.state.linkEditable !== false : !!component.state.transformable;
    if (!panelEnabled) {
      this.applySelection(null);
      return;
    }

    //只有 ICEControlPanel 和它内部的变换手柄才具备跟随鼠标移动的功能，其它组件都需要由 ICEControlPanel 驱动进行移动和变换。
    const isControlPanel =
      component && (component.isControlPanel || (component.parentNode && component.parentNode.isControlPanel));
    if (isControlPanel) {
      return;
    }

    // 统一选中入口：写 selectionList 并同步插件工具；返回「排他」插件工具是否命中
    const exclusiveMatched = this.ice.setSelection([component]);
    this.applySelection(component, exclusiveMatched);
  }

  /**
   * 按「选中了谁」显示对应的控制面板（**幂等**，可以反复调用）。
   *
   * 抽成公开入口的原因：控制面板不是插件注册的，是这里**直接**挂上去的
   * —— 于是"在别处选中一个组件"（例如 worker 镜像里按主线程推来的 id 选中）就没法复用这套判定。
   * 现在 `mouseDownHandler` 与镜像同步都走这一条：
   *
   * - `exclusiveMatched` = 排他插件工具命中时由插件接管，屏蔽内置面板；
   * - 线条型看 `linkEditable`、其余看 `transformable`（门控语义见 `mouseDownHandler` 的长注释）。
   *
   * @param component 目标组件（null/不合法 → 隐藏全部面板）
   * @param exclusiveMatched 插件是否已排他接管（不传则按 `selectionList` 判定失败来隐藏）
   */
  public applySelection(component: any, exclusiveMatched: boolean = false): void {
    this.lineControlPanel.disable();
    this.transformControlPanel.disable();

    // 排他插件工具命中：由插件接管该组件的交互，屏蔽内置变换/连线面板
    if (exclusiveMatched) {
      notifyToolTarget(this.ice, null); // 面板没显示（插件接管）→ 镜像也要跟着隐藏
      return;
    }
    if (!component || !component.state) {
      notifyToolTarget(this.ice, null);
      return;
    }
    const panelEnabled = component.isLine ? component.state.linkEditable !== false : !!component.state.transformable;
    if (!panelEnabled) {
      notifyToolTarget(this.ice, null);
      return;
    }

    //线条型的组件变换工具与其它组件不同
    if (component.isLine) {
      this.lineControlPanel.targetComponent = component;
      this.lineControlPanel.enable();
    } else {
      this.transformControlPanel.targetComponent = component;
      this.transformControlPanel.enable();
    }
    /**
     * 镜像钩子：把「**面板现在显示给谁**」推给 worker。
     *
     * 镜像的为什么是它、而不是 `selectionList`：点空白处时引擎只**隐藏面板**、并不清空选中
     * （选中列表是应用自己管的状态）—— 镜像如果只跟选中列表走，就会出现"主线程手柄没了、
     * worker 画面里还挂着"，正是那种最容易被忽略的半个状态。
     */
    notifyToolTarget(this.ice, component);
  }
}

export default ICEControlPanelManager;
