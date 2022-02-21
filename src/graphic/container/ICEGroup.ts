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
 *
 * 容器型组件
 *
 * ICEGroup 可以包含自身，利用此组件可以构造出树形的对象结构。
 *
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

    child.trigger(ICE_CONSTS.AFTER_REMOVE);
  }

  public removeChildren(arr: Array<ICEBaseComponent>): void {
    arr.forEach((child) => {
      this.removeChild(child);
    });
  }
}

export default ICEGroup;
