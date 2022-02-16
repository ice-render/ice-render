import ICEEvent from '../../event/ICEEvent';
import ICE from '../../ICE';
import ICELinkHook from './ICELinkHook';
import ICELinkSlot from './ICELinkSlot';

/**
 * @see ICE
 */
export default class ICELinkManager {
  private ice: ICE;
  private hooks = new Map();
  private slots = new Map();
  private currentObj: any;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  private mouseDownHandler(evt: ICEEvent) {
    let component = evt.target;
    if (!(component instanceof ICELinkHook)) {
      return;
    }

    this.currentObj = component;
    console.log('link manager-->', component);
    this.ice.evtBus.on('mousemove', this.mouseMoveHandler, this);
    this.ice.evtBus.on('mouseup', this.mouseUpHandler, this);
  }

  private mouseMoveHandler(evt: ICEEvent): boolean {
    console.log('link manager-->', this.currentObj);
    return true;
  }

  private mouseUpHandler(evt: ICEEvent) {
    console.log('link manager-->', this.currentObj);
  }

  start() {
    this.ice.evtBus.on('mousedown', this.mouseDownHandler, this);
    return this;
  }

  //FIXME:
  stop() {}

  public registerHook(hook: ICELinkHook): void {
    this.hooks.set(hook.state.id, hook);
  }

  public deleteHook(hook: ICELinkHook): void {
    this.hooks.delete(hook.state.id);
  }

  public registerSlot(slot: ICELinkSlot): void {
    this.slots.set(slot.state.id, slot);
  }

  public deleteSlot(slot: ICELinkSlot): void {
    this.slots.delete(slot.state.id);
  }
}
