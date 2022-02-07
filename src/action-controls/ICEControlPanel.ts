import ICEGroup from '../graphic/container/ICEGroup';
import ICEComponent from '../graphic/ICEComponent';

export default abstract class ICEControlPanel extends ICEGroup {
  protected _targetComponent: ICEComponent;

  constructor(props: any) {
    super(props);
  }

  protected abstract initControls(): void;

  protected abstract initEvents(): void;

  protected abstract setControlPositions(): void;

  protected renderChildren(): void {
    this.setControlPositions();
    super.renderChildren();
  }

  public moveGlobalPosition(tx: number, ty: number, evt?: any): void {
    super.moveGlobalPosition(tx, ty, evt);
    if (this._targetComponent) {
      this._targetComponent.moveGlobalPosition(tx, ty, evt);
    }
  }
}
