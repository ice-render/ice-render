/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import merge from 'lodash/merge';
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEComponent from '../ICEComponent';
import ICERect from '../shape/ICERect';

/**
 * @class ICEGroup 容器型组件
 *
 * - ICEGroup 可以带有子组件，所有容器型的组件都应该继承 ICEGroup
 * - ICEGroup 可以包含自身，利用此组件可以构造出树形的组件结构。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEGroup extends ICERect {
  public parentNode = null;
  public childNodes = [];

  constructor(props) {
    super(props);
  }

  protected initEvents(): void {
    super.initEvents();
    this.once(ICE_EVENT_NAME_CONSTS.AFTER_ADD, this.afterAddHandler, this);
  }

  /**
   * @method afterAddHandler 当 ICEGroup 被添加到 ICE 实例中后触发的事件
   * !注意：在调用 ICEGroup.addChild() 方法时， ICEGroup 自身可能还没有被添加到 ICE 实例中去。所以此时 child.ctx, child.evtBus 都可能为空。
   * !所以这里需要用事件来同步一次子节点的事件。
   */
  protected afterAddHandler(): void {
    for (let i = 0; i < this.childNodes.length; i++) {
      let child = this.childNodes[i];
      this.syncChildEvents(child);
    }
  }

  protected syncChildEvents(child): void {
    child.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD);
    child.ice = this.ice;
    child.ctx = this.ice.ctx;
    child.evtBus = this.ice.evtBus;
    child.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD);
  }

  /**
   * @method addChild 添加子节点
   *
   * 添加子节点有两种情况：
   * - 情况一：ICEGroup 自身已经被添加到了 ICE 实例中，此时可以直接调用 this.syncChildEvents(child); 来触发子节点上的事件。
   * - 情况二：ICEGroup 自身还没有被添加到 ICE 实例中，此时需要用 ICE_EVENT_NAME_CONSTS.AFTER_ADD 事件来触发子节点上的事件。
   * !注意：在调用 ICEGroup.addChild() 方法时， ICEGroup 自身可能还没有被添加到 ICE 实例中去。所以此时 child.ctx, child.evtBus 都可能为空。
   * @param child
   */
  public addChild(child: ICEComponent, markDirty: boolean = true): void {
    if (this.childNodes.indexOf(child) !== -1) return;

    child.parentNode = this;
    this.childNodes.push(child);

    this.dirty = markDirty;
    //如果 this.ice 不为空，说明当前的 Group 已经被添加到了 ICE 中
    if (this.ice) {
      this.syncChildEvents(child);
      this.ice.dirty = markDirty;
    }
  }

  public addChildren(arr: Array<ICEComponent>): void {
    for (let i = 0; i < arr.length; i++) {
      const child = arr[i];
      this.addChild(child, false);
    }
    this.dirty = true;
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  public removeChild(child: ICEComponent, markDirty: boolean = true) {
    child.destory();
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    this.dirty = markDirty;
    if (this.ice) {
      this.ice.dirty = markDirty;
    }
  }

  public removeChildren(arr: Array<ICEComponent>): void {
    for (let i = 0; i < arr.length; i++) {
      const child = arr[i];
      this.removeChild(child, false);
    }
    this.dirty = true;
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  /**
   * @overwrite
   * @method setState
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   * @param newState
   */
  public setState(newState: any) {
    merge(this.state, newState);
    this.dirty = true;

    //容器型组件自身的状态发生变化时，需要把所有层级上的子节点都标记为 dirty
    function setRecursively(component) {
      component.dirty = true;
      if (component.childNodes && component.childNodes.length) {
        for (let i = 0; i < component.childNodes.length; i++) {
          setRecursively(component.childNodes[i]);
        }
      }
    }
    setRecursively(this);

    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  /**
   * @overwrite
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
