/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { ICE_EVENT_NAME_CONSTS } from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEComponent from '../ICEComponent';
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
  public addChild(child: ICEComponent): void {
    child.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD);
    this.childNodes.push(child);
    child.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD);
  }

  public addChildren(arr: Array<ICEComponent>): void {
    arr.forEach((child) => {
      this.addChild(child);
    });
  }

  public removeChild(child: ICEComponent) {
    child.destory();
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
  }

  public removeChildren(arr: Array<ICEComponent>): void {
    arr.forEach((child) => {
      this.removeChild(child);
    });
  }

  /**
   * @override
   * @method destory
   * 销毁组件
   * - FIXME:立即停止组件上的所有动画效果
   * - 需要清理绑定的事件
   * - 带有子节点的组件需要先销毁子节点，然后再销毁自身。
   */
  public destory(): void {
    this.removeChildren(this.childNodes);
    super.destory();
  }
}

export default ICEGroup;
