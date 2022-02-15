import ICEEvent from '../../event/ICEEvent';
import ICE from '../../ICE';
import ICELinkHook from './ICELinkHook';
import ICELinkSlot from './ICELinkSlot';

export default class ICELinkManager {
  private ice: ICE;
  private hooks = new Map();
  private slots = new Map();

  constructor(ice: ICE) {
    this.ice = ice;
  }

  private mouseDownHandler(evt: ICEEvent) {
    let component = evt.target;
    if (!(component instanceof ICELinkHook)) {
      return;
    }
    console.log('link manager-->', component);
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
