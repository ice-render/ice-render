/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEGroup from '../graphic/container/ICEGroup';
import ICEComponent from '../graphic/ICEComponent';

/**
 * @class ICEControlPanel 控制面板
 *
 * - ICEControlPanel 用来辅助用户操作图形，控制面板可以控制图形的属性，比如组件的属性，线条的属性，文本的属性等等。
 * - ICEControlPanel 本身总是直接画在 canvas 上，不是任何组件的孩子。
 * - ICEControlPanel 本身不会被序列化。
 * - ICEControlPanel 的 zIndex 总是大于其它组件，当 ICEControlPanel 显示时，总是会优先判定为被选中的组件，会导致对应的 _targetComponent 收不到鼠标和键盘事件，所以 ICEControlPanel 的实现类需要自己考虑是否需要进行事件转发。
 * - 控制面板的所有实例都在 ICEControlPanelManager 中创建和管理。
 *
 * @see ICEControlPanelManager
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default abstract class ICEControlPanel extends ICEGroup {
  /**
   * 类型标识
   * 用来解决 TypeScript 的 instanceof 兼容性问题， https://github.com/microsoft/TypeScript/issues/22585
   * 仅供内部使用，业务代码不可依赖此属性
   */
  public isControlPanel = true;

  protected _targetComponent: ICEComponent;

  constructor(props: any) {
    super({ ...props, linkable: false });
  }

  protected abstract initControls(): void;

  protected abstract updateControlPositions(): void;

  protected doRender(): void {
    super.doRender();
    this.updateControlPositions();
  }

  public moveGlobalPosition(tx: number, ty: number, evt?: any): void {
    super.moveGlobalPosition(tx, ty, evt);
    if (this._targetComponent) {
      this._targetComponent.moveGlobalPosition(tx, ty, evt);
    }
  }

  public abstract enable();

  public abstract disable();
}
