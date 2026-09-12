/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { merge } from '../../util/lang';
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEComponent from '../ICEComponent';
import { bumpVisibilityEpoch } from '../../util/data-util';
import ICERect from '../shape/ICERect';
import type ICELayoutManager from '../../layout/ICELayoutManager';

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
  //@perf: O(1) 去重，避免 addChild 每子组件 indexOf 导致的 O(n^2)。
  private __childSet = new WeakSet<any>();
  public layoutManager: ICELayoutManager = null; //布局策略（借鉴 Swing 的策略模式，setLayout 持有）
  private __layoutExplicit = false; //是否显式设置了布局（用于区分「显式设置」与「从父层继承」）
  /** 挂起的重排请求（一帧内合并；`doRender` 时消费）。 */
  private __layoutRequested = false;
  /** 正在执行布局：期间子项的位置/尺寸变化不再反向请求重排，避免自激循环。 */
  private __layingOut = false;

  constructor(props) {
    super(props);
  }

  /**
   * 设置布局策略（对齐 Swing 的 container.setLayout）。
   * 设置后立即执行一次布局，并把布局传播给「未显式设置布局」的容器型子组件（子容器默认继承父层布局）。
   */
  public setLayout(manager: ICELayoutManager): void {
    this.layoutManager = manager;
    this.__layoutExplicit = true;
    if (manager) {
      this.doLayout();
      // 布局接管：设定了具体 layout 后，内部所有后代组件禁止手动变换（transformable=false），位置由代码接管
      this.__disableTransformRecursively(this);
    }
    this.__propagateLayout(manager);
  }

  /**
   * 递归禁用所有后代组件的手动变换（transformable=false）。
   * 一旦设定了具体 layout，子组件位置由布局代码决定，用户不可再手动变换。
   */
  private __disableTransformRecursively(component): void {
    if (!component || !component.childNodes) {
      return;
    }
    for (const child of component.childNodes) {
      child.state.transformable = false;
      child.state.draggable = false; // 布局接管后也不能拖动（位置由代码决定）
      this.__disableTransformRecursively(child);
    }
  }

  /**
   * 把布局策略传播给「未显式设置布局」的容器型后代：
   * - 直接/间接子容器若没有显式布局，则继承当前布局并递归向下传播；
   * - 遇到显式设置了布局的子容器则跳过（它的后代由它自己 setLayout 时传播）。
   */
  private __propagateLayout(manager: ICELayoutManager): void {
    for (const child of this.childNodes) {
      if (child instanceof ICEGroup && !child.__layoutExplicit) {
        child.layoutManager = manager;
        child.doLayout();
        child.__propagateLayout(manager);
      }
    }
  }

  /**
   * 批量挂载/删除期间抑制逐次布局（避免 O(n²)），结束后统一排一次。
   */
  private __inBatch = false;

  /**
   * 执行布局：先测量子组件，再交给布局策略排布。
   *
   * 测量这一步是必要的：布局策略读的是 `child.state.width/height`，而它们要等首次渲染
   * 才算出来（文本更是要量测字形）。旧实现不做测量，于是「首次布局拿到的全是 0/哨兵值」。
   */
  public doLayout(): void {
    if (!this.layoutManager) {
      return;
    }
    this.__layingOut = true;
    try {
      for (let i = 0; i < this.childNodes.length; i++) {
        const child: any = this.childNodes[i];
        if (typeof child.measure === 'function') {
          child.measure();
        }
      }
      this.layoutManager.layoutContainer(this);
    } finally {
      this.__layingOut = false;
      this.__layoutRequested = false;
    }
  }

  /**
   * 请求重排：**下一帧执行**，一帧内多次请求只排一次。
   *
   * 触发来源是「子项改了 width/height」—— 布局结果依赖子项尺寸，尺寸变了必须重排，
   * 否则会出现「改了某个子项的大小，兄弟节点还停在老位置」。
   * 旧实现只在 `setLayout()` / `addChild()` 时排一次，子项尺寸变化完全不会触发重排。
   *
   * 合并到下一帧是因为：逐个 setState 立刻重排会退化成 O(n²)（布局本身又要 setState 子项位置）。
   */
  public requestLayout(): void {
    if (!this.layoutManager || this.__layingOut) {
      return;
    }
    this.__layoutRequested = true;
    this.dirty = true;
    if (this.ice) {
      this.ice.dirty = true;
    }
  }

  /** 容器内容的首选尺寸（转发布局策略；未设置布局时返回 [0,0]）。 */
  public getPreferredSize(): [number, number] {
    return this.layoutManager ? this.layoutManager.getPreferredSize(this) : [0, 0];
  }

  protected doRender(): void {
    // 渲染前先把挂起的重排做掉（父容器先于子项渲染，所以本帧子项位置就是新的）
    if (this.__layoutRequested) {
      this.doLayout();
    }
    super.doRender();
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
      const child = this.childNodes[i];
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
    if (this.__childSet.has(child)) return;

    child.parentNode = this;
    this.childNodes.push(child);
    this.__childSet.add(child);
    // 挂到新父链下：整棵子树的「最终可见性」可能改变 → 让可见性缓存失效
    bumpVisibilityEpoch();

    // 布局接管：父容器已设定 layout 时，新加入的子组件（及其后代）禁止手动变换和拖动
    if (this.layoutManager) {
      child.state.transformable = false;
      child.state.draggable = false;
      this.__disableTransformRecursively(child);
    }

    // 注意：markDirty=false 只表示「不要主动置脏」，不能把从未渲染过的容器强制置干净，
    // 否则它自身的路径缓存永远不会建立（详见 ICEComponent.__applyDirty）。
    this.__applyDirty(markDirty);
    //如果 this.ice 不为空，说明当前的 Group 已经被添加到了 ICE 中
    if (this.ice) {
      this.syncChildEvents(child);
      this.ice.dirty = markDirty;
      if (this.ice.renderer) this.ice.renderer.markQueueDirty();
    }
    // 布局接管：新加入的子组件必须立即参与重排。
    // 旧实现只在 setLayout() 时排一次，之后 addChild 不重排 → 加进去的子组件位置全错。
    if (this.layoutManager) {
      // 新增的容器型子组件若没有显式布局，继承父层布局（与 setLayout 的传播规则一致），
      // 否则它内部的子组件不会被排布。
      if (child instanceof ICEGroup && !child.__layoutExplicit) {
        child.layoutManager = this.layoutManager;
      }
      if (!this.__inBatch) {
        this.doLayout();
      }
    }
  }

  public addChildren(arr: Array<ICEComponent>): void {
    this.__inBatch = true;
    try {
      for (let i = 0; i < arr.length; i++) {
        this.addChild(arr[i], false);
      }
    } finally {
      this.__inBatch = false;
    }
    this.dirty = true;
    if (this.ice) {
      this.ice.dirty = true;
    }
    // 批量结束后统一排一次（避免逐个 addChild 触发 O(n²) 重排）
    this.doLayout();
  }

  public removeChild(child: ICEComponent, markDirty: boolean = true) {
    if (!this.__childSet.has(child)) return;
    child.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE);
    const index = this.childNodes.indexOf(child);
    if (index !== -1) this.childNodes.splice(index, 1);
    this.__childSet.delete(child);
    // 脱离父链：可见性缓存同样要失效
    bumpVisibilityEpoch();
    // AFTER_REMOVE 必须在 destory() 之前触发（destory 会 purgeEvents）
    child.trigger(ICE_EVENT_NAME_CONSTS.AFTER_REMOVE);
    this.__applyDirty(markDirty);
    if (this.ice) {
      this.ice.dirty = markDirty;
      if (this.ice.renderer) this.ice.renderer.markQueueDirty();
    }
    child.destory();
    // 删除后同样需要重排，否则会留下空位
    if (this.layoutManager && !this.__inBatch) {
      this.doLayout();
    }
  }

  public removeChildren(arr: Array<ICEComponent>): void {
    this.__inBatch = true;
    try {
      for (let i = 0; i < arr.length; i++) {
        this.removeChild(arr[i], false);
      }
    } finally {
      this.__inBatch = false;
    }
    this.dirty = true;
    if (this.ice) {
      this.ice.dirty = true;
    }
    this.doLayout();
  }

  /**
   * @overwrite
   * @method setState
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   * @param newState
   */
  public setState(newState: any) {
    const sizeChanged = this.__beforeStateMerge(newState);
    merge(this.state, newState);
    // 容器**自身**的 state 变了 → 自身派生参数可能变（尺寸等），两个标志都置
    this.paramsDirty = true;
    this.dirty = true;

    // 容器型组件自身的状态发生变化时，需要把所有层级上的子节点都标记为 dirty。
    //
    // 注意：这里**只置 `dirty`（要重绘），不置 `paramsDirty`**。
    // 后代的绝对矩阵确实变了（父矩阵变了）→ 必须重绘；但后代的派生参数（点集 / 文本量测）
    // 只取决于自身 state，与祖先变换无关 → 不应连带重量测。这正是 dirty/paramsDirty 拆分的目的。
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
    // 与 ICEComponent.setState 保持同一套后置处理（尺寸变化 → 请求父容器重排）
    this.__afterStateMerge(sizeChanged);
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
