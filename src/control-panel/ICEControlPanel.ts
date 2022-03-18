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
 * @class ICEControlPanel
 *
 * 控制面板
 *
 * FIXME:所有 ControlPanel 类型的组件都需要处理组件的 REMOVE 事件，当组件被删除时，清理关联关系。
 *
 * - ICEControlPanel 本身总是直接画在 canvas 上，不是任何组件的孩子。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default abstract class ICEControlPanel extends ICEGroup {
  protected _targetComponent: ICEComponent;

  constructor(props: any) {
    super({ ...props, linkable: false });
  }

  protected abstract initControls(): void;

  protected abstract initEvents(): void;

  protected abstract setControlPositions(): void;

  protected doRender(): void {
    super.doRender();
    this.setControlPositions();
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
