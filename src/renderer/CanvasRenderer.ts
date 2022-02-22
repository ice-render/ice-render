/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
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

  private renderRecursively(component: ICEBaseComponent) {
    component.trigger(ICE_CONSTS.BEFORE_RENDER);

    if (component.state.isRendering) {
      return;
    }
    if (!component.state.display) {
      return;
    }

    //先渲染自己
    component.render();

    //如果有子节点，递归
    if (component.childNodes && component.childNodes.length) {
      component.childNodes.forEach((child: ICEBaseComponent) => {
        //子组件的 root/ctx/evtBus/ice 这4个属性总是和父组件保持一致
        child.root = component.root;
        child.ctx = component.ctx;
        child.evtBus = component.evtBus;
        child.ice = component.ice;
        this.renderRecursively(child);
      });
    }

    component.trigger(ICE_CONSTS.AFTER_RENDER);
  }

  public start() {
    this.ice.evtBus.on(ICE_CONSTS.ICE_FRAME_EVENT, (evt: ICEEvent) => {
      //FIXME:fix this when using increamental rendering
      //FIXME:动画有闪烁
      this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);
      if (!this.ice.childNodes || !this.ice.childNodes.length) return;

      //根据组件的 zIndex 升序排列，保证 zIndex 大的组件在后面绘制。
      let arr = Array.from(this.ice.childNodes);
      arr.sort((firstEl, secondEl) => {
        return firstEl.state.zIndex - secondEl.state.zIndex;
      });
      arr.forEach((component: ICEBaseComponent) => {
        this.renderRecursively(component);
      });
    });
    return this;
  }

  public stop(): void {
    throw new Error('Method not implemented.');
  }
}

export default CanvasRenderer;
