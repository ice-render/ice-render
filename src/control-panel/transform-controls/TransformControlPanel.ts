/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { mat2d, vec2 } from 'gl-matrix';
import { applyAspectLock } from './constraints';
import bigZIndexNum from '../../consts/BIG_ZINDEX_NUMBER';
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEComponent from '../../graphic/ICEComponent';
import ICEControlPanel from '../ICEControlPanel';
import ResizeControl from './ResizeControl';
import RotateControl from './RotateControl';

/**
 * @class TransformControlPanel
 *
 * 变换控制面板
 *
 * - TransformControlPanel 本身总是直接画在 canvas 上，不是任何组件的孩子。
 * - TransformControlPanel 是全局单例，在任意时刻，不可能同时出现多个 TransformControlPanel 的实例，因为在图形化的用户交互模式下，用户无法同时操控多个控制面板。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class TransformControlPanel extends ICEControlPanel {
  private rotateControlInstance;
  private rotateControlSize: number = 8; //TODO:改成可配置参数
  private rotateControlOffsetY: number = 60; //TODO:改成可配置参数
  private resizeControlInstanceCache = [];
  private resizeControlSize: number = 16; //TODO:改成可配置参数

  constructor(props) {
    super({
      ...props,
      zIndex: bigZIndexNum + 1,
      linkable: false,
      showMinBoundingBox: false,
      showMaxBoundingBox: false,
    });
    this.initControls();
  }

  /**
   * @method initControls
   * 添加尺寸和旋转变换手柄，初始化时添加在内部的[0,0]位置，此方法只创建对象实例，不执行渲染操作。
   * 创建 8 个 ResizeControl
   * 计算手柄位于父组件的哪一个象限中，有以下取值：
   *  - 1: 第1象限；
   *  - 2: 第2象限；
   *  - 3: 第3象限；
   *  - 4: 第4象限；
   *  - 5: 位于X轴上方，y值为负，不属于任何象限；
   *  - 6: 位于X轴下方，y值为正，不属于任何象限；
   *  - 7: 位于Y轴左侧，x值为负，不属于任何象限；
   *  - 8: 位于Y轴右侧，x值为正，不属于任何象限；
   * 默认创建顺序，从左上角开始顺时针：tl:2/t:5/tr:1/r:8/rb:4/b:6/lb:3/l:7
   * 第1和第3象限可以交换位置
   * 第2和第4象限可以交换位置
   * X 轴正负可以交换位置
   * Y 轴正负可以交换位置
   * TODO:添加斜切手柄？
   */
  protected initControls(): void {
    const width = this.state.width;
    const height = this.state.height;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfControlSize = this.resizeControlSize / 2;
    const resizeControlConfig: Array<any> = [
      {
        direction: 'xy', //可以移动的坐标轴
        quadrant: 2, //在组件本地坐标轴中的象限 @see ResizeControl
        position: [-halfControlSize, -halfControlSize],
      },
      {
        direction: 'y',
        quadrant: 5,
        position: [halfWidth - halfControlSize, -halfControlSize],
      },
      {
        direction: 'xy',
        quadrant: 1,
        position: [width - halfControlSize, -halfControlSize],
      },
      {
        direction: 'x',
        quadrant: 8,
        position: [width - halfControlSize, halfHeight - halfControlSize],
      },
      {
        direction: 'xy',
        quadrant: 4,
        position: [width - halfControlSize, height - halfControlSize],
      },
      {
        direction: 'y',
        quadrant: 6,
        position: [halfWidth - halfControlSize, height - halfControlSize],
      },
      {
        direction: 'xy',
        quadrant: 3,
        position: [-halfControlSize, height - halfControlSize],
      },
      {
        direction: 'x',
        quadrant: 7,
        position: [-halfControlSize, halfHeight - halfControlSize],
      },
    ];

    this.resizeControlInstanceCache = [];
    for (let i = 0; i < resizeControlConfig.length; i++) {
      const controlConfig = resizeControlConfig[i];
      const handleInstance = new ResizeControl({
        zIndex: bigZIndexNum + 2,
        display: false,
        left: controlConfig.position[0],
        top: controlConfig.position[1],
        width: this.resizeControlSize,
        height: this.resizeControlSize,
        //TODO: style 放到 props 中去变成可配置的参数
        style: {
          strokeStyle: '#8b0000',
          fillStyle: '#CC3300',
          lineWidth: 1,
        },
        direction: controlConfig.direction,
        quadrant: controlConfig.quadrant,
      });

      this.addChild(handleInstance);
      this.resizeControlInstanceCache.push(handleInstance);
    }

    // 创建 1 个 RotateControl
    const left = this.state.width / 2 - this.rotateControlSize;
    const top = -this.rotateControlOffsetY;
    this.rotateControlInstance = new RotateControl({
      zIndex: bigZIndexNum + 3,
      display: false,
      left: left,
      top: top,
      radius: this.rotateControlSize,
      //TODO: style 放到 props 中去变成可配置的参数
      style: {
        strokeStyle: '#8b0000',
        fillStyle: '#CC3300',
        lineWidth: 1,
      },
    });
    this.addChild(this.rotateControlInstance);
  }

  protected initEvents(): void {
    super.initEvents();
    this.on(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE, this.resizeEvtHandler, this);
    this.on(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE, this.rotateEvtHandler, this);
    this.on('keydown', this.keyboardEvtHandler, this);
    this.on('keyup', this.keyboardEvtHandler, this);
  }

  public enable() {
    this.rotateControlInstance.setState({ display: true });
    for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
      const item = this.resizeControlInstanceCache[i];
      item.setState({ display: true });
    }
    this.setState({ display: true });
    this.resume(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE);
    this.resume(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE);
    this.resume('keydown');
    this.resume('keyup');
  }

  public disable() {
    this.rotateControlInstance.setState({ display: false });
    for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
      const item = this.resizeControlInstanceCache[i];
      item.setState({ display: false });
    }
    this.setState({ display: false });
    this.suspend(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE);
    this.suspend(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE);
    this.suspend('keydown');
    this.suspend('keyup');
  }

  /**
   * @overwrite
   * @method keyboardEvtHandler 键盘事件处理
   * !ICEControlPanel 的 zIndex 总是大于其它组件，当 ICEControlPanel 显示时，总是会优先判定为被选中的组件，会导致对应的 _targetComponent 收不到鼠标和键盘事件，所以 ICEControlPanel 的实现类需要自己考虑是否需要进行事件转发。
   * !如果当前的 targetComponent 不为空，转发键盘事件。
   * @see {ICEControlPanel}
   * @see {ICEComponent}
   * @param evt
   * @returns
   */
  protected keyboardEvtHandler(evt: any) {
    if (!this.targetComponent) {
      return;
    }
    this.targetComponent.trigger(evt.type, evt, { component: this.targetComponent });
  }

  private rotateEvtHandler(evt?: any) {
    if (!this.targetComponent) {
      return;
    }
    const { rotate } = this.state.transform;
    this.targetComponent.setGlobalRotate(rotate);
    this.targetComponent.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE);
    // 旋转会改变目标的包围盒宽高，必须重新从目标推导面板，否则连续 resize→rotate→resize 会漂移
    this.updatePanel();
  }

  private resizeEvtHandler(evt: any) {
    if (!this.targetComponent) {
      return;
    }

    const { quadrant } = evt;
    let movementX = evt.movementX;
    let movementY = evt.movementY;
    const targetState = this.targetComponent.state;
    let newLeft = targetState.left;
    let newTop = targetState.top;
    let newWidth = targetState.width;
    let newHeight = targetState.height;
    //@ts-ignore
    const matrix = mat2d.invert([], this.targetComponent.calcAbsoluteLinearMatrix());
    //@ts-ignore
    const point = vec2.transformMat2d([], [movementX, movementY], matrix);
    movementX = point[0];
    movementY = point[1];

    switch (quadrant) {
      case 1:
        newLeft -= movementX;
        newTop += movementY;
        newWidth += 2 * movementX;
        newHeight -= 2 * movementY;
        break;
      case 2:
        newLeft += movementX;
        newTop += movementY;
        newWidth -= 2 * movementX;
        newHeight -= 2 * movementY;
        break;
      case 3:
        newLeft += movementX;
        newTop -= movementY;
        newWidth -= 2 * movementX;
        newHeight += 2 * movementY;
        break;
      case 4:
        newLeft -= movementX;
        newTop -= movementY;
        newWidth += 2 * movementX;
        newHeight += 2 * movementY;
        break;
      case 5:
        newTop += movementY;
        newHeight -= 2 * movementY;
        break;
      case 6:
        newTop -= movementY;
        newHeight += 2 * movementY;
        break;
      case 7:
        newLeft += movementX;
        newWidth -= 2 * movementX;
        break;
      case 8:
        newLeft -= movementX;
        newWidth += 2 * movementX;
        break;
      default:
        break;
    }

    // Shift：等比缩放（约束必须加在这里 —— 尺寸是从目标重算的，ResizeControl 上的面板盒子不参与计算）。
    // 手柄缩放是围绕中心对称进行的（见上面的 case 分支），按比例改完宽高后把中心补回去即可。
    // 基准取目标**当前**的本地宽高：每次锁定后比例都严格保持，因此逐帧基准不会漂移。
    if (evt && evt.shiftKey) {
      const locked = applyAspectLock(targetState.width, targetState.height, newWidth, newHeight);
      const cx = newLeft + newWidth / 2;
      const cy = newTop + newHeight / 2;
      newLeft = cx - locked.width / 2;
      newTop = cy - locked.height / 2;
      newWidth = locked.width;
      newHeight = locked.height;
    }

    this.targetComponent.setState({
      left: newLeft,
      top: newTop,
      width: Math.abs(newWidth),
      height: Math.abs(newHeight),
    });
    this.targetComponent.trigger(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE);
    // resize 改变了目标的局部宽高，其包围盒（面板应贴合的对象）也随之变化，重新从目标推导面板
    this.updatePanel();
  }

  /**
   * @overwrite
   * @method updateControlPositions 更新内部控制手柄的位置
   *
   * 控制面板每次重绘时，会在 doRender() 方法内部会调用 updateControlPositions() 来 更新控制手柄的位置。
   * @see ICEConrolPanel.doRender()
   */
  protected updateControlPositions() {
    //重新计算所有 ResizeControl 的位置，共8个
    const width = this.state.width;
    const height = this.state.height;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfControlSize = this.resizeControlSize / 2;

    for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
      const resizeControl = this.resizeControlInstanceCache[i];
      const quadrant = resizeControl.state.quadrant;
      let point = [0, 0];
      switch (quadrant) {
        case 1:
          point = [width - halfControlSize, -halfControlSize];
          break;
        case 2:
          point = [-halfControlSize, -halfControlSize];
          break;
        case 3:
          point = [-halfControlSize, height - halfControlSize];
          break;
        case 4:
          point = [width - halfControlSize, height - halfControlSize];
          break;
        case 5:
          point = [halfWidth - halfControlSize, -halfControlSize];
          break;
        case 6:
          point = [halfWidth - halfControlSize, height - halfControlSize];
          break;
        case 7:
          point = [-halfControlSize, halfHeight - halfControlSize];
          break;
        case 8:
          point = [width - halfControlSize, halfHeight - halfControlSize];
          break;
        default:
          break;
      }
      resizeControl.setState({
        left: point[0],
        top: point[1],
      });
    }

    //重新计算 RotateControl 的位置
    const left = this.state.width / 2 - this.rotateControlSize;
    const top = -this.rotateControlOffsetY;
    this.rotateControlInstance.setState({ left, top });
  }

  protected updatePanel() {
    if (!this.targetComponent) {
      return;
    }
    const angle = this.targetComponent.getRotateAngle(true);
    const { left, top, width, height } = this.targetComponent.getLocalLeftTop(true);
    this.setState({
      left,
      top,
      width,
      height,
      transform: {
        rotate: angle,
      },
    });
  }

  /**
   * 目标被移除时的处理。
   *
   * 必须是**稳定引用**：旧实现用 `once(BEFORE_REMOVE, () => {...})`，而 `once` 内部会把回调
   * 再包一层，导致这个箭头函数永远无法被 `off` —— 反复选中组件会在每个组件上累积
   * 无法回收的监听（内存泄漏 + 幽灵回调）。这里改为具名属性 + `on`，
   * 由 setter 负责在切换目标时 `off` 掉（`on` 本身对 (fn, scope) 幂等，也不会重复注册）。
   */
  private __onTargetRemoved = () => {
    this.targetComponent = null;
    this.disable();
  };

  public set targetComponent(component: ICEComponent) {
    const prev = this._targetComponent;
    if (prev) {
      prev.off(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.updatePanel, this);
      prev.off(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, this.__onTargetRemoved, this);
    }
    this._targetComponent = component;
    if (component) {
      component.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.updatePanel, this);
      component.on(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, this.__onTargetRemoved, this);
    }
    this.updatePanel();
  }

  public get targetComponent(): ICEComponent {
    return this._targetComponent;
  }

  /**
   * 交换两个 Control 的象限
   * @param control
   * @param quadrant
   */
  public toggleControlQuadrant(control, oldQuadrant: number, newQuadrant: number): void {
    // 被拖拽手柄从 oldQuadrant 跨到 newQuadrant：原来占据 newQuadrant 的手柄顶替到 oldQuadrant，
    // 两者互换象限，保证 8 个手柄的象限始终唯一。此前用「对角固定映射」(1↔3/2↔4)，
    // 在手柄跨到「相邻」象限(如 1→2)时会产出重复象限，导致两个手柄重叠、看起来消失一个。
    for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
      const item = this.resizeControlInstanceCache[i];
      if (item.state.quadrant === newQuadrant) {
        item.setState({
          quadrant: oldQuadrant,
        });
      }
    }

    control.setState({ quadrant: newQuadrant });
  }
}
