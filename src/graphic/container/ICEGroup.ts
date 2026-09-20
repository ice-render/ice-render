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
import { bumpVisibilityEpoch, rebindComponentTree } from '../../util/data-util';
import ICERect from '../shape/ICERect';
import type ICELayoutManager from '../../layout/ICELayoutManager';
import { notifyChildAdded, notifyChildRemoved, notifyStateChange } from '../../worker/mirror-hooks';

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
  /** 挂起的重排请求（一帧内合并；`doRender` 时消费）。 */
  private __layoutRequested = false;
  /**
   * 布局是否失效（自己的尺寸变了 → 自己的布局要重跑）。
   *
   * 对齐 Swing 的 `Container.invalidate()` / `validateTree()`：失效只标自己，
   * 重排由**持有者自顶向下**触发（见 `doLayout()` 末尾的校验趟），
   * 不再靠「父容器把策略灌给子容器」来让子容器重排。
   */
  private __layoutInvalid = false;
  /** 正在执行布局：期间子项的位置/尺寸变化不再反向请求重排，避免自激循环。 */
  private __layingOut = false;
  /**
   * 布局接管时是否禁用后代的手动变换 / 拖动（默认 true，保持历史行为）。
   *
   * **这是独立的一维策略，不是布局的附属品**：`setLayout(manager, { lockInteraction: false })`
   * 只排位置、不锁交互；`setInteractionLock(true/false)` 也能在没有布局的情况下单独切换。
   * 编辑器类场景（位置是数据、必须能拖）适合关掉它；纯 UI 外壳适合打开。
   * `disableTransform` 是旧名字，仍然接受。
   */
  private __layoutDisablesTransform = true;
  /**
   * 交互锁改过哪些子项、改之前是什么值 —— 解锁时按原值还原。
   *
   * 为什么必须记：锁是**有副作用**的（写子项的 `transformable/draggable`）。只锁不还原，
   * "布局撤销后子项再也拖不动了"就成了不可逆的坑（组件库当年就是因为这个把布局机制放着不用）。
   */
  private __interactionLockBackup: Map<any, { transformable: any; draggable: any }> | null = null;

  constructor(props) {
    super(props);
  }

  /**
   * 容器默认**不画自己的盒子**（透明）。
   *
   * 为什么：`ICEGroup` 继承自 `ICERect`，也就继承了「画自己的矩形」。历史上默认样式是
   * `red/blue`，于是任何没显式给 style 的容器都会画一个红块 —— 叠层示例里 4 个半透明图层
   * 下面垫着的不透明红块就是这么来的，肉眼看起来像"混合出了紫色"。
   * 容器的正确定位是布局与分组：要背景 / 边框就显式给 style 或用 `preset: 'card' | 'panel'`
   * （预设里会显式给样式），默认则保持透明。
   */
  protected __defaultStyleFor(): any {
    return { fillStyle: 'rgba(0,0,0,0)', strokeStyle: 'rgba(0,0,0,0)', lineWidth: 1 };
  }

  /**
   * 设置布局策略（对齐 Swing 的 container.setLayout）。
   *
   * 设置后立即执行一次布局。**不把策略传播给子容器** —— 对齐 Swing：
   * `Container.setLayout()` 只写自己的字段，父布局只负责给子容器摆位置，
   * 子容器用自己的策略排自己的子项（子容器要自动排布就自己 `setLayout()`）。
   * 旧实现会递归下灌策略，等于把父容器的排版规则套进子组件内部（按钮文字、
   * 输入框前后缀都会被重摆），这是组件库用不了布局机制的直接原因。
   *
   * @param options.disableTransform 布局接管时是否禁用后代的手动变换 / 拖动（默认 `true`，
   *   与历史行为一致）。传 `false` 时布局照常摆位置，但用户仍可拖动 —— 适用于"布局打底 + 允许微调"
   *   的场景；注意拖完之后下次重排会把子项拉回布局算出的位置。
   */
  public setLayout(
    manager: ICELayoutManager | null,
    options: { lockInteraction?: boolean; disableTransform?: boolean } = {}
  ): void {
    if (options && options.lockInteraction !== undefined) {
      this.__layoutDisablesTransform = options.lockInteraction !== false;
    } else if (options && options.disableTransform !== undefined) {
      // 旧名字（等价于 lockInteraction），保留以免破坏既有调用点
      this.__layoutDisablesTransform = options.disableTransform !== false;
    }

    if (!manager) {
      // 撤销布局：位置交回调用方，并把交互锁**还原**（否则子项会永久动不了）
      this.layoutManager = null;
      this.setInteractionLock(false);
      this.__layoutInvalid = true;
      this.__layoutRequested = false;
      this.dirty = true;
      if (this.ice) {
        this.ice.dirty = true;
      }
      return;
    }

    this.layoutManager = manager;
    this.doLayout();
    // 布局接管：设定了具体 layout 后，内部所有后代组件默认禁止手动变换（transformable=false），位置由代码接管
    if (this.__layoutDisablesTransform) {
      this.setInteractionLock(true);
    }
  }

  /** 当前布局策略（没设过就是 `null`）。 */
  public getLayout(): ICELayoutManager | null {
    return this.layoutManager;
  }

  /** 交互锁当前是否打开（见 `setInteractionLock`）。 */
  public getInteractionLock(): boolean {
    return this.__layoutDisablesTransform;
  }

  /**
   * 独立切换「后代是否可手动变换 / 拖动」，与有没有布局无关。
   *
   * 打开时记下每个后代的 `transformable/draggable` 原值；关闭时**按原值还原**，
   * 所以 `setLayout(null)` / `setInteractionLock(false)` 之后，子项回到布局接管之前的状态。
   *
   * 与 `setLayout(manager, { lockInteraction })` 的分工：前者是"随时切"，后者是"设布局时顺带定"。
   */
  public setInteractionLock(locked: boolean): this {
    this.__layoutDisablesTransform = locked !== false;
    if (this.__layoutDisablesTransform) {
      for (let i = 0; i < this.childNodes.length; i++) {
        this.__lockSubtree(this.childNodes[i]);
      }
    } else {
      this.__restoreInteraction();
    }
    return this;
  }

  /**
   * 递归禁用一棵子树的手动变换（transformable=false），并记录原值。
   * 一旦设定了具体 layout，子组件位置由布局代码决定，用户不可再手动变换。
   */
  private __lockSubtree(component): void {
    if (!component || !component.state) {
      return;
    }
    if (!this.__interactionLockBackup) {
      this.__interactionLockBackup = new Map();
    }
    if (!this.__interactionLockBackup.has(component)) {
      this.__interactionLockBackup.set(component, {
        transformable: component.state.transformable,
        draggable: component.state.draggable,
      });
    }
    component.state.transformable = false;
    component.state.draggable = false; // 布局接管后也不能拖动（位置由代码决定）
    if (component.childNodes) {
      for (let i = 0; i < component.childNodes.length; i++) {
        this.__lockSubtree(component.childNodes[i]);
      }
    }
  }

  /** 把交互锁改过的子项按原值还原。 */
  private __restoreInteraction(): void {
    const backup = this.__interactionLockBackup;
    if (!backup) {
      return;
    }
    backup.forEach((previous, child) => {
      if (child && child.state) {
        child.state.transformable = previous.transformable;
        child.state.draggable = previous.draggable;
      }
    });
    backup.clear();
    this.__interactionLockBackup = null;
  }

  /**
   * 批量挂载/删除期间抑制逐次布局（避免 O(n²)），结束后统一排一次。
   */
  private __inBatch = false;

  /**
   * 执行布局：**先自底向上测量，再自顶向下摆位，最后自顶向下校验子树**。
   *
   * ① 测量趟：对每个子项 `measure()`（布局读的是 `state.width/height`，而它们要等首次渲染
   *    才算出来，文本更要量测字形）；子容器会借 `getPreferredSize()` 把自己的「内容尺寸」
   *    报上来 —— 所以父布局嵌一个子容器时能拿到**自然尺寸**，而不是它当前那个空盒子。
   * ② 排布趟：本容器的策略落位（只摆位置；子容器用什么策略是它自己的事）。
   * ③ `fitContent`：容器可选择按内容自适应 —— 摆完之后把自身尺寸设成
   *    `layoutManager.getPreferredSize()`（尺寸真的变了才写，避免每帧抖动）。
   * ④ 校验趟（**对齐 Swing 的 `Container.validateTree()`**）：继续向下，谁失效（被改了尺寸 /
   *    请求过重排）就把谁重排一遍并递归它的子树，没失效的子树整棵跳过；中间层容器即使没有
   *    自己的布局也要穿过去（它的后代可能失效）。
   *
   * 本容器没有布局策略时，退化为只做第 ④ 步的向下校验。
   */
  public doLayout(): void {
    if (this.__layingOut) {
      return; // 布局期间的重入交给当前这一趟统一处理，避免自激
    }
    this.__layingOut = true;
    try {
      if (this.layoutManager) {
        for (let i = 0; i < this.childNodes.length; i++) {
          const child: any = this.childNodes[i];
          if (typeof child.measure === 'function') {
            child.measure();
          }
          // 自底向上：`fitContent` 的子容器先把自己量成"内容尺寸"（它自己的子项也会被排好），
          // 于是下面这一趟布局读到的就是它的自然尺寸，而不是未定的空盒子。
          if (
            child &&
            child.layoutManager &&
            child.state &&
            child.state.fitContent &&
            typeof child.doLayout === 'function'
          ) {
            child.doLayout();
          }
        }
        this.layoutManager.layoutContainer(this);
        this.__fitContent();
      }
      this.__layoutRequested = false;
      this.__layoutInvalid = false;
      // 自顶向下校验：只沿失效路径下潜（Swing validateTree 的代价模型）
      for (let i = 0; i < this.childNodes.length; i++) {
        const child: any = this.childNodes[i];
        if (child instanceof ICEGroup && (child.__layoutInvalid || child.__layoutRequested)) {
          child.doLayout();
        }
      }
    } finally {
      this.__layingOut = false;
    }
  }

  /**
   * 按内容自适应尺寸（`props.fitContent: true`）。
   *
   * 只监听"内容尺寸"，不覆盖调用方显式设的 padding：`getPreferredSize()` 里各布局已经把
   * padding / margin 算进去了，这里取的是最终外框。
   */
  private __fitContent(): void {
    if (!this.state.fitContent || !this.layoutManager) {
      return;
    }
    const [w, h] = this.layoutManager.getPreferredSize(this);
    const width = Math.max(0, Math.round(w));
    const height = Math.max(0, Math.round(h));
    if (!(width > 0) && !(height > 0)) {
      return; // 布局没实现 getPreferredSize → 不动调用方给的尺寸
    }
    const changed =
      Math.abs((Number(this.state.width) || 0) - width) > 0.5 ||
      Math.abs((Number(this.state.height) || 0) - height) > 0.5;
    if (!changed) {
      return;
    }
    // 尺寸变化会让父容器重排（走 requestLayout 的下一帧合并），这里直接写值即可
    this.setState({ width, height });
  }

  /**
   * `setState` 后置钩子：**自己的尺寸变了 → 自己的布局失效**。
   *
   * 对齐 Swing 的 `Container.setBounds()` → `invalidate()`：尺寸变化让本容器的布局失效，
   * 但它不自己重排（重排由持有者下一次 `doLayout()` 的自顶向下校验趟触发，
   * 见 `doLayout()` ④），也不覆盖父链向上冒泡的那条路径（`super` 里会请求父容器重排）。
   */
  protected __afterStateMerge(sizeChanged: boolean): void {
    if (sizeChanged) {
      this.__layoutInvalid = true;
    }
    super.__afterStateMerge(sizeChanged);
  }

  /**
   * 请求重排：**下一帧执行**，一帧内多次请求合并成一次。
   *
   * 语义对齐 Swing 的 `Component.invalidate()`：把自己标成失效，并**沿父链向上冒泡**
   * （Swing 走 `invalidateParent` 一直标到 validate root）。真正的重排发生在下一次渲染前的
   * `doLayout()`，它自顶向下只排「失效」的那条路径，没失效的子树整棵跳过。
   *
   * 触发来源是「子项改了 width/height」—— 布局结果依赖子项尺寸，尺寸变了必须重排，
   * 否则会出现「改了某个子项的大小，兄弟节点还停在老位置」。
   *
   * 合并到下一帧是因为：逐个 setState 立刻重排会退化成 O(n²)（布局本身又要 setState 子项位置）。
   */
  public requestLayout(): void {
    if (this.__layingOut) {
      return;
    }
    this.__layoutInvalid = true;
    this.__layoutRequested = true;
    // 向上冒泡：让持有者知道自己这条路径失效了（中间层没有布局也要把请求传上去）
    const parent: any = this.parentNode;
    if (parent && typeof parent.requestLayout === 'function') {
      parent.requestLayout();
    }
    if (this.layoutManager) {
      this.dirty = true;
      if (this.ice) {
        this.ice.dirty = true;
      }
    }
  }

  /**
   * 容器内容的首选尺寸（设计思想同 Swing 的 `preferredLayoutSize`）。
   *
   * - `setPreferredSize()` 声明过 → 就报这个值（Swing 的 `isPreferredSizeSet()` 分支）；
   * - 否则设了布局 → **问策略要内容尺寸**（对齐 Swing `Container.getPreferredSize()`：
   *   它有布局管理器时返回 `layoutMgr.preferredLayoutSize(this)`，与当前边界无关）；
   * - 都没有 → 回到基类的盒子（Swing 的 `getSize()` 兜底）。
   *
   * `props.fitContent: true` 的容器会用它把自己的尺寸调成内容大小，见 `doLayout()`。
   */
  public getPreferredSize(): [number, number] {
    if (this.isPreferredSizeSet()) {
      return super.getPreferredSize();
    }
    return this.layoutManager ? this.layoutManager.getPreferredSize(this) : super.getPreferredSize();
  }

  /**
   * 最小尺寸：声明过 → 声明值；有布局 → 问策略（`getMinimumSize`）；都没有 → 没有下限。
   * 与 `getPreferredSize()` 同构，父布局的收缩计算因此能一层层问到最里面。
   */
  public getMinimumSize(): [number, number] {
    if (this.isMinimumSizeSet()) {
      return super.getMinimumSize();
    }
    return this.layoutManager ? this.layoutManager.getMinimumSize(this) : super.getMinimumSize();
  }

  protected doRender(): void {
    // 渲染前先把挂起的重排做掉（父容器先于子项渲染，所以本帧子项位置就是新的）。
    // 本容器没有布局策略时也要走这一趟：它要负责把校验继续传给失效的后代。
    if (this.__layoutRequested || this.__layoutInvalid) {
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
    // （`setLayout(manager, { disableTransform: false })` 时不接管交互，只摆位置）
    if (this.layoutManager && this.__layoutDisablesTransform) {
      this.__lockSubtree(child);
    }

    // 注意：markDirty=false 只表示「不要主动置脏」，不能把从未渲染过的容器强制置干净，
    // 否则它自身的路径缓存永远不会建立（详见 ICEComponent.__applyDirty）。
    this.__applyDirty(markDirty);
    //如果 this.ice 不为空，说明当前的 Group 已经被添加到了 ICE 中
    if (this.ice) {
      this.syncChildEvents(child);
      // `markDirty=false` 只是"别主动置脏"，不能把实例上已有的待重绘清掉（见 ICE.addChild 的说明）
      if (markDirty) this.ice.dirty = true;
      if (this.ice.renderer) this.ice.renderer.markQueueDirty();
    }
    // 布局接管：新加入的子组件必须立即参与重排。
    // 旧实现只在 setLayout() 时排一次，之后 addChild 不重排 → 加进去的子组件位置全错。
    // 注意：**不**给子容器继承本容器的策略（对齐 Swing 的 Container.setLayout：父布局只摆位置，
    // 子容器用自己的策略排自己的子项），因此这里不再有 __propagateLayout 那套下灌逻辑。
    if (this.layoutManager && !this.__inBatch) {
      this.doLayout();
    }
    // 镜像钩子：容器内结构变更（v1 只标记"需要全量重同步"）
    notifyChildAdded(this, child);
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

  /**
   * 把某个组件迁移到本容器下（**不销毁**它）。
   *
   * 为什么需要单独的 API：`removeChild()` 末尾会调用 `child.destory()`（清事件、清子节点），
   * 所以「先 removeChild 再 addChild」式的重父级会把组件连同内部子树一起毁掉
   * （BPMN 池/泳道里嵌节点时就踩到这个坑：标题、角标全没了）。
   * 本方法只从旧父级的 childNodes / 去重集合里摘除，再挂到本容器，组件本体与子树保持完好。
   * **坐标不换算**：调用方若要保持世界位置，请自行换算 left/top。
   */
  public adoptChild(child: ICEComponent, markDirty: boolean = true): void {
    if (!child || child === this) {
      return;
    }
    const oldParent: any = child.parentNode;
    if (oldParent && oldParent !== this && oldParent.childNodes) {
      const index = oldParent.childNodes.indexOf(child);
      if (index !== -1) {
        oldParent.childNodes.splice(index, 1);
      }
      if (oldParent.__childSet && typeof oldParent.__childSet.delete === 'function') {
        oldParent.__childSet.delete(child);
      }
      child.parentNode = null;
      if (oldParent.ice && oldParent.ice.renderer && typeof oldParent.ice.renderer.markQueueDirty === 'function') {
        oldParent.ice.renderer.markQueueDirty();
      }
    } else if (!oldParent) {
      // 根级组件（ICE.addChild 会把 parentNode 置为 null）：从 ice 的 childNodes 上摘除
      const ice: any = this.ice || child.ice;
      if (ice && Array.isArray(ice.childNodes)) {
        const rootIndex = ice.childNodes.indexOf(child);
        if (rootIndex !== -1) {
          ice.childNodes.splice(rootIndex, 1);
        }
        if (ice.__childSet && typeof ice.__childSet.delete === 'function') {
          ice.__childSet.delete(child);
        }
        if (ice.renderer && typeof ice.renderer.markQueueDirty === 'function') {
          ice.renderer.markQueueDirty();
        }
      }
    }
    this.addChild(child, markDirty);
    // 嵌套重父级：子树整体切到本容器的实例（addChild 只直接绑 child 本身，
    // 而 AFTER_ADD 的递归同步是 once —— 对"已经挂过"的容器不会再触发）。
    if (this.ice) {
      rebindComponentTree(child, this.ice);
    }
  }

  public removeChild(child: ICEComponent, markDirty: boolean = true) {
    if (!this.__childSet.has(child)) return;
    /**
     * 镜像钩子：**必须在这里**（摘除之前）。
     *
     * 两个约束叠在一起：① 要在 `destory()` 之前（它会把 child.ice 摘掉）；
     * ② 要在这个孩子还在 `childNodes` / 真实子节点列表里的时候 —— 桥要判断"这次增删是不是
     * 文档内容"（见 `isMirroredComponent`），而真实子节点的判定（`getSerializableChildren()`）
     * 是**现算 childNodes** 的：摘除之后再问，真实子节点与派生部件长得一模一样，
     * 于是"真子节点被删掉"会被误判成"容器内部重建"，镜像就再也不会重同步了。
     */
    notifyChildRemoved(this, child);
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
      // 同上：只置真、不置假
      if (markDirty) this.ice.dirty = true;
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
  public setState(newState: any, options?: { paramsDirty?: boolean }) {
    const sizeChanged = this.__beforeStateMerge(newState);
    merge(this.state, newState);
    // 容器**自身**的 state 变了 → 自身派生参数可能变（尺寸等），**默认**两个标志都置；
    // 动画/高频写值可以显式传 `{ paramsDirty: false }`（见 ICEComponent.ANIMATION_SAFE_KEYS）。
    if (!options || options.paramsDirty !== false) {
      this.paramsDirty = true;
    }
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
    /**
     * 镜像钩子：**这里必须自己调一次**。
     *
     * `ICEGroup.setState` 是**完全覆盖**（语义不同：容器自身 state 一变，要把整棵子树的 `dirty`
     * 都置上），因此不会经过 `ICEComponent.setState` 里那个钩子。漏了它的症状很隐蔽：
     * **容器型组件的状态永远不同步到 worker**（2026-09-20 由 ice-entity-designer 的流程图抓出来 ——
     * IED 的 `FlowNode extends ICEGroup`，拖节点、改标题全都不进镜像，而"没报错、画面没动"最难查）。
     * 守卫：`tests/worker/mirror-hooks-guard.test.ts` 会扫源码，任何 `setState` 覆盖要么调 `super`、
     * 要么自己调这个钩子。
     */
    notifyStateChange(this, newState);
    // 与 ICEComponent.setState 保持同一套后置处理（尺寸变化 → 请求父容器重排）
    this.__afterStateMerge(sizeChanged);
  }

  /**
   * @overwrite
   * @method destory
   * 销毁组件
   * - 先递归销毁子节点（每个子节点各自从动画管理器摘除），再走父类的销毁流程
   * - 需要清理绑定的事件
   * - 带有子节点的组件需要先销毁子节点，然后再销毁自身。
   */
  public destory(): void {
    this.removeChildren(this.childNodes);
    super.destory();
  }
}

export default ICEGroup;
