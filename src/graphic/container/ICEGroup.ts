/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { ICE_CONSTS } from '../../ICE_CONSTS';
import ICEBaseComponent from '../ICEBaseComponent';
import ICERect from '../shape/ICERect';

/**
 * @class ICEGroup
 * 容器型组件
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEGroup extends ICERect {
  public parentNode = null;
  public childNodes = [];

  constructor(props) {
    super(props);
  }

  /**
   * 注意，在调用 ICEGroup.addChild() 方法时， ICEGroup 自身可能还没有被添加到 ICE 实例中去。
   * 所以此时 child.root, child.ctx, child.evtBus 都可能为空。
   * @param child
   */
  public addChild(child: ICEBaseComponent): void {
    child.trigger(ICE_CONSTS.BEFORE_ADD);

    child.parentNode = this;
    this.childNodes.push(child);

    child.trigger(ICE_CONSTS.AFTER_ADD);
  }

  public addChildren(arr: Array<ICEBaseComponent>): void {
    arr.forEach((child) => {
      this.addChild(child);
    });
  }

  public removeChild(child: ICEBaseComponent) {
    child.trigger(ICE_CONSTS.BEFORE_REMOVE);

    child.parentNode = null;
    child.root = null;
    child.ctx = null;
    child.evtBus = null;
    child.ice = null;

    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    //FIXME:destory child???

    child.trigger(ICE_CONSTS.AFTER_REMOVE);
  }

  public removeChildren(arr: Array<ICEBaseComponent>): void {
    arr.forEach((child) => {
      this.removeChild(child);
    });
  }

  //FIXME:这里需要重构，所有组件的 render 方法都交给 Renderer 统一进行调度。
  protected renderChildren(): void {
    this.childNodes.forEach((child) => {
      child.root = this.root;
      child.ctx = this.ctx;
      child.evtBus = this.evtBus;
      child.ice = this.ice;

      child.trigger(ICE_CONSTS.BEFORE_RENDER);
      if (child.state.isRendering) {
        return;
      }
      if (!child.state.display) {
        return;
      }
      child.render();
      child.trigger(ICE_CONSTS.AFTER_RENDER);
    });
  }

  /**
   * 先渲染自己，再渲染子组件。
   */
  public render(): void {
    super.render();
    this.renderChildren();
  }
}

export default ICEGroup;
