import ICEEvent from '../event/ICEEvent';
import ICEBaseComponent from '../graphic/ICEBaseComponent';
import ICE from '../ICE';
import { ICE_CONSTS } from '../ICE_CONSTS';
import IRenderer from './IRenderer';

/**
 * @class CanvasRenderer
 * Canvas 渲染器，全局单例。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class CanvasRenderer implements IRenderer {
  private ice: ICE;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    this.ice.evtBus.on(ICE_CONSTS.ICE_FRAME_EVENT, (evt: ICEEvent) => {
      //FIXME:fix this when using increamental rendering
      //FIXME:动画有闪烁
      this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);
      if (this.ice.displayMap && this.ice.displayMap.size) {
        //根据组件的 zIndex 升序排列，保证 zIndex 大的组件在后面绘制。
        let arr = Array.from(this.ice.displayMap, ([name, value]) => value);
        arr.sort((firstEl, secondEl) => {
          return firstEl.state.zIndex - secondEl.state.zIndex;
        });
        arr.forEach((component: ICEBaseComponent) => {
          !component.isRendering && component.render();
        });
      }
    });
    return this;
  }

  stop(): void {
    throw new Error('Method not implemented.');
  }
}

export default CanvasRenderer;
