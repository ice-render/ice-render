/**
 * 按照指定的路径获取 Object 上的值
 */
export function getVal(object: any, path: string): any {
  return path.split('.').reduce((res: any, prop: string) => res[prop], object);
}

/**
 * @method flattenTree
 *
 * 把 tree 形结构拉平成数组结构。
 */
/**
 * 可见性「代际」：任何可能改变组件的最终可见性的操作都让它自增一次 ——
 * 目前是「自身 `display` 变化」与「树结构变化（addChild / removeChild）」。
 *
 * 存在的理由：`isEffectivelyVisible()` 每帧会被调用 **3~4 次/组件**（裁剪判定、render 守卫、
 * 快照捕获、risky 扫描），而组件通常多层嵌套，每次调用都要沿父链走到底。
 * 实测在 5000 图元场景里，这是约 **15% 的每帧开销**（对比实验：把它短路成只判自身即回到基线）。
 * 有了代际号，同一代内每个组件只真正走一次父链，其余退化为两次字段读取。
 *
 * 用「代际号 + 惰性比对」而不是「主动往所有后代传播失效」：后者在最坏情况下是 O(n) 的重复遍历，
 * 而惰性比对天然只对真正被查询的组件付代价，且不需要维护订阅关系。
 */
let VISIBILITY_EPOCH = 0;

/** 使所有组件的可见性缓存失效。display 变化与树结构变化时必须调用。 */
export function bumpVisibilityEpoch(): void {
  VISIBILITY_EPOCH++;
}

/** 当前可见性代际号（供 `ICEComponent` 做惰性缓存比对）。 */
export function getVisibilityEpoch(): number {
  return VISIBILITY_EPOCH;
}

/**
 * 组件是否「最终可见」：自身与**所有祖先**的 `display` 都为真。
 *
 * `state.display = false` 的语义是整棵子树都不渲染（见 `ICEComponent` 的 props 文档），
 * 但渲染队列是把树拉平后逐个入队的，只看组件自身会让「隐藏父容器」失效。
 *
 * 优先走组件上的 `isEffectivelyVisible()`（含父链遍历，顶层走 O(1) 快路径）；
 * 传入的是外部轻量对象（无该方法）时退化为只看自身，与 `DOMEventDispatcher`
 * 既有的鸭子类型契约（只需 `state` / `containsPoint`）保持一致。
 */
export function isEffectivelyVisible(component: any): boolean {
  if (component && typeof component.isEffectivelyVisible === 'function') {
    return component.isEffectivelyVisible();
  }
  return !!(component && component.state && component.state.display);
}

/**
 * 拉平「组件层 + 工具层」，得到全部组件的平铺数组（z 序未排）。
 *
 * 命中检测、无障碍快照、主题热切换、按 id 找组件都需要这一份全集，集中在这里避免各处重复
 * `flattenTree(childNodes).concat(flattenTree(toolNodes))`。
 *
 * 注意：**不**复用渲染器的 `componentQueue` 缓存 —— 它在「刚改结构、本帧尚未渲染」时是旧的
 * （首帧之前更是空的），而命中必须立刻反映最新结构。一次 flatten 远比点错目标便宜。
 */
export function flattenAllComponents(ice: any, result: any[] = []): any[] {
  flattenTree(result, ice.childNodes || []);
  flattenTree(result, ice.toolNodes || []);
  return result;
}

/**
 * 命中扫描：在**世界坐标** (wx, wy) 上找出最上层的可交互组件；无命中返回 null。
 *
 * 这是画布点击（`DOMEventDispatcher`）与应用层主动命中（`ICE.hitTest`）**唯一**的实现 ——
 * 以前有两份几乎相同的代码各自演化，容易出现「点得到但 hitTest 找不到」这类不一致。
 *
 * 语义：
 * - 按 zIndex 升序扫描、后者覆盖前者 → 命中 z 序最高的组件；
 * - 跳过 `isControlPanel`（控制面板本体是覆盖层，不作为命中目标）；
 * - 跳过 `interactive:false` 与「最终不可见」（祖先 display:false）的组件；
 * - 复用渲染快照的世界盒做 O(1) 预筛（含 paint pad 与容差）；无快照时不预筛，正确性优先。
 */
export function hitTestComponents(ice: any, wx: number, wy: number, tolerance: number): any {
  const renderer: any = ice.renderer;
  /**
   * 命中判定必须与**绘制顺序**同源（渲染顺序铁律，2026-09-17）：绘制顺序是
   * 「组件层（树序） → 工具层（树序）」，所以命中从后往前找时也是
   * **先扫工具层、再扫组件层**。
   *
   * 旧实现把两层**按 zIndex 混在一起排序** —— 那是"全局 zIndex"时代的产物：
   * 组件如果显式给了个很大的 zIndex（`BIG_ZINDEX_NUMBER` 那档），命中会把它当成
   * 比工具层更上层，但绘制上它其实被工具层盖着，于是"看着被遮住却点得到"。
   */
  if (renderer && typeof renderer.getOrderedQueues === 'function') {
    // 快路径：复用渲染器那份「已排序、且只在结构/zIndex 变化时重建」的队列，**倒序**扫描，
    // 第一个命中即 z 序最高者（与下面升序扫描「后者覆盖前者」等价）。
    // 去掉了每次命中的 flatten + sort（实测 1 万组件下 0.8ms → 0.1ms），
    // 也去掉了每次命中分配的那个上万元素数组（hover 类交互按 mousemove 调，GC 也省一份）。
    const q = renderer.getOrderedQueues();
    const comps: any[] = q.components || [];
    const tools: any[] = q.tools || [];
    const tryLayer = (nodes: any[]): any => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const component: any = nodes[i];
        if (component.isControlPanel) continue;
        if (!component.state.interactive || !isEffectivelyVisible(component)) continue;
        const box: any = renderer.getWorldBox(component);
        if (
          box &&
          (wx < box[0] - tolerance || wx > box[2] + tolerance || wy < box[1] - tolerance || wy > box[3] + tolerance)
        ) {
          continue;
        }
        if (component.containsPoint(wx, wy)) {
          // 被祖先裁剪掉的部分不该命中（例如滚动容器里滚出可视区的子组件）
          if (typeof component.isPointClippedOut === 'function' && component.isPointClippedOut(wx, wy)) {
            continue;
          }
          return component;
        }
      }
      return null;
    };
    // 工具层画在组件层之上 → 先扫工具层
    return tryLayer(tools) || tryLayer(comps);
  }

  // 回退路径：没有渲染器（headless 建树 / 未 init / 单测夹具）时，回到「展平 + 升序扫描」。
  // 语义与快路径逐条对齐，两条路径都必须给出同一个结果（回归用例逐点比对）。
  // `flattenAllComponents` 已经是「树序 + 兄弟按 zIndex」（见 `flattenTree`），**不要再全局排序**。
  const all = flattenAllComponents(ice);

  const canScreen = renderer && typeof renderer.getWorldBox === 'function';

  let found: any = null;
  for (let i = 0; i < all.length; i++) {
    const component: any = all[i];
    if (component.isControlPanel) continue;
    if (!component.state.interactive || !isEffectivelyVisible(component)) continue;
    if (canScreen) {
      const box: any = renderer.getWorldBox(component);
      if (
        box &&
        (wx < box[0] - tolerance || wx > box[2] + tolerance || wy < box[1] - tolerance || wy > box[3] + tolerance)
      ) {
        continue;
      }
    }
    if (component.containsPoint(wx, wy)) {
      // 被祖先裁剪掉的部分不该命中（例如滚动容器里滚出可视区的子组件）
      if (typeof component.isPointClippedOut === 'function' && component.isPointClippedOut(wx, wy)) {
        continue;
      }
      found = component;
    }
  }
  return found;
}

export function flattenTree(result: any[] = [], childNodes: any[] = [], level: number = 1, pid: any = null): any[] {
  /**
   * **渲染顺序铁律（2026-09-17，v2.13.0）：树序 + 兄弟按 zIndex。**
   *
   * 展平的顺序就是绘制顺序：**先父后子**，同一父容器下的兄弟按 `state.zIndex` 升序
   * （相等时保持加入顺序 —— `Array.prototype.sort` 自 ES2019 起稳定）。
   *
   * 为什么不再"全局按 zIndex 排序"：全局排序下，**父容器只要 zIndex 比子组件大**就会
   * 反超自己的子树 → **父把自己的子组件整个盖住**（画出来一片空白、且不报错）。
   * 树序下这种倒挂不可能发生：子永远画在父之上。
   *
   * 默认 `zIndex` 是 **`'auto'`（排序当 0 = `auto` 层，2026-09-19 起）**：同一层里没显式写过
   * zIndex 的兄弟彼此相等，次序由**加入顺序**决定 —— 于是"后加入的默认画在最上面"。
   * 显式写 `-n` 就是压到 `auto` 层之下（背景类），写 `+n` 就是抬到 `auto` 层之上（浮层类）。
   *
   * 注意：**只排兄弟**，且排的是**副本**（`childNodes` 本身保持加入顺序 ——
   * 调用方按 `childNodes[0]` 取"第一个子节点"是既有语义，不能被动过）。
   */
  // 顶层（ICE 的组件层 / 工具层）没有"容器自己的派生部件"这回事，直接按兄弟 zIndex 排。
  return flattenOrdered(result, sortSiblingsByZIndex(childNodes), level, pid);
}

/**
 * 与 `flattenTree` 同语义，但**输入已经排好序**：递归专用。
 *
 * 为什么必须分开：`paintOrderChildrenOf` 会把一层的子节点排成「派生部件在前、真实子节点在后」，
 * 这个次序**不是** zIndex 升序，再洗一次就散了 —— 子层的分组（容器的底在内容之下）会静默失效。
 */
function flattenOrdered(result: any[], ordered: any[], level: number, pid: any): any[] {
  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i];
    node._level = level;
    node._pid = pid;
    result.push(node);
    // 注意：真实组件的 id 定义在 props 上（旧实现取 node.id 恒为 undefined，父子关系丢失）；
    // 同时兼容「普通对象 + 顶层 id」的调用方式（如单测夹具、外部把扁平数据当树用的场景）。
    const childPid = node.props && node.props.id !== undefined ? node.props.id : node.id;
    flattenOrdered(result, paintOrderChildrenOf(node), level + 1, childPid);
  }
  return result;
}

/**
 * 一个容器**子节点的绘制次序**：先「容器自己的派生部件」、再「真实子节点」，两组内部各自按
 * `state.zIndex` 升序（相等保持加入顺序）。
 *
 * 为什么要有这条：复合组件（`hasDerivedChildren() === true`）把自己的底 / 标题 / 角标也挂在
 * `childNodes` 里（形状由子组件绘制，这样才能画菱形、事件圆、圆角框），而 `getSerializableChildren()`
 * 明确指出"哪些才是真实子节点"。**这是 CSS 的背景语义**：元素自己的背景永远画在自己的内容之下。
 *
 * 不这么做的后果（2026-09 在 BPMN / 状态机示例上真实发生）：容器的底与容器里的内容是同层兄弟，
 * 底的 zIndex 一旦排在内容之后（默认 `'auto'` 就很容易），整段内容会被**自己的底色**盖住 ——
 * BPMN 案例里任务矩形全部消失、状态机案例里复合状态变成一个空框。应用为了绕开它只能给底写一个
 * 「比内容更低」的魔数，而"多低才算够低"取决于应用自己的分层约定，引擎给不出保证。
 *
 * 没有 `getSerializableChildren()` 的组件（普通容器 / 纯图形）行为**逐字不变**：
 * 全部子节点视为真实子节点，只按 zIndex 排一次。
 *
 * 引擎内部三处同源（渲染队列 `flattenTree` / SVG 导出 `SvgExporter.collectOrdered` /
 * 命中检测复用渲染队列）；对外导出是为了让应用与测试能**在无头环境断言真实绘制次序**
 * （与 `sortSiblingsByZIndex` / `zIndexOf` 同属"排序口径"的公开出口）。
 */
export function paintOrderChildrenOf(container: any): any[] {
  const all: any[] = (container && container.childNodes) || [];
  if (all.length < 2) {
    return all;
  }
  const real = typeof container.getSerializableChildren === 'function' ? container.getSerializableChildren() : null;
  // 没有声明真实子节点（全是派生部件，如流程图的普通节点）或全都是真实子节点：
  // 没有"分组"可言，保持原来的整体排序。⚠️ 这里也必须返回**排好序**的新数组：
  // 调用方（flattenTree / SvgExporter）拿到的是最终次序，不会（也不能）再排一次。
  if (!Array.isArray(real) || real.length === 0 || real.length === all.length) {
    return sortSiblingsByZIndex(all);
  }
  const realSet = new Set(real);
  const derived: any[] = [];
  for (let i = 0; i < all.length; i++) {
    if (!realSet.has(all[i])) {
      derived.push(all[i]);
    }
  }
  return sortSiblingsByZIndex(derived).concat(sortSiblingsByZIndex(real));
}

/**
 * **同层重排（`bringToFront` / `sendToBack` / `moveUp` / `moveDown`）的作用域**：
 * 容器的**真实子节点**（`getSerializableChildren()` 声明的那些）。
 *
 * 派生部件不是文档内容：四个 z 序 API 的重编号会把它们的 `zIndex` 一起改写 ——
 * 而派生部件的 zIndex 由容器自己的构造决定（例如"池的底要比泳道低"），被重排洗一遍就会
 * 把容器内容盖掉；而且它们根本不进文档，改了也留不下来（组件重建即复位），属于纯噪声。
 *
 * 与 `paintOrderChildrenOf` 一样，没有 `getSerializableChildren()` 的容器行为不变。
 *
 * @internal 供 `ICEComponent.__siblingList` 使用。
 */
export function siblingScopeOf(container: any): any[] {
  const all: any[] = (container && container.childNodes) || [];
  if (typeof container.getSerializableChildren !== 'function') {
    return all;
  }
  const real = container.getSerializableChildren();
  return Array.isArray(real) ? real : all;
}

/**
 * 取组件用于**排序**的 zIndex 数值 —— 全引擎唯一的取数口径。
 *
 * 默认值是 `'auto'`（`Z_INDEX_AUTO`，与 CSS 的 `z-index: auto` 同义，**排序当 0 用**）：
 * 没显式写过 zIndex 的兄弟彼此相等，次序退化为**加入顺序**。
 * **只有有限数字算数，其余（`'auto'` 哨兵 / 缺字段 / `NaN` / 字符串）一律当 0** ——
 * 避免"一个脏值把整层排序变成 NaN 比较"这种静默事故（`Array.sort` 的 NaN 比较恒为 false，
 * 结果是次序原地不动、看着像没生效）。
 */
export function zIndexOf(component: any): number {
  const raw = component && component.state ? component.state.zIndex : 0;
  // 只认有限数字：字符串（含历史上的 'auto'）一律 0，不做 Number() 解析 ——
  // 这条在排序热路径上，`typeof + isFinite` 比 `Number()`（会走字符串解析）快得多。
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/**
 * **同层重编号**的编码口径：把"绘制次序"（0 = 最下 → n-1 = 最上）编码成 zIndex。
 *
 * 编码成 **`-(n-1) … 'auto'`**（最上面那个是 `'auto'` = 0 那一档）而不是 `0 … n-1`，
 * 是为了让最上层继续落在**默认值所在的 auto 层**：
 * - 被置顶的组件落在 `auto` 层（0），**之后新加入的组件仍然排在它上面**
 *   （同层相等 → 按加入顺序，新加入的最后画）—— "新建的图元永远在最上层"这条不会被重排 API 破坏；
 * - 被压下去的兄弟落成负数，正好表达"在 `auto` 层之下"，与 CSS 的负 z-index 同义。
 *
 * 用法与口径只有一处：`ICEComponent.__applySiblingOrder`（四个 z 序 API 都走它）。
 */
export function zIndexForPaintRank(paintRank: number, count: number): number | 'auto' {
  const value = paintRank - (count - 1);
  // 最上面那个写回 `'auto'`（而不是显式 0）：它语义上就是"auto 层里最靠上的那个"，
  // 也让 state / 文档里只出现「auto」与「非 0 的钉子」两种取值，读起来不歧义。
  return value === 0 ? 'auto' : value;
}

/**
 * 兄弟节点按 `zIndex` 升序排序（稳定）。**长度 < 2 时不复制**，直接返回原数组 ——
 * 绝大多数容器只有 0~1 个子节点，这条快路径让"每次展平都复制一份 childNodes"的开销归零。
 *
 * 另一条快路径：**整组都在 auto 层（取值全是 0 / `'auto'`）时直接跳过排序** ——
 * 排序键全相等，稳定排序的结果就是原顺序（加入顺序）。2026-09-19 把默认值改成 `'auto'` 之后
 * 这是绝大多数容器的真实形态，跳过之后 `refreshQueue` 重建比改之前还快；
 * 也避免了在"全 auto"场景里为一堆恒等的键白跑一趟比较器（那是要处理字符串哨兵的，比较器不再廉价）。
 */
export function sortSiblingsByZIndex(childNodes: any[]): any[] {
  if (!childNodes || childNodes.length < 2) {
    return childNodes || [];
  }
  const copy = childNodes.slice();
  let needSort = false;
  for (let i = 0; i < copy.length; i++) {
    const node: any = copy[i];
    const raw: any = node && node.state ? node.state.zIndex : 0;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw !== 0) {
      needSort = true;
      break;
    }
  }
  if (!needSort) {
    return copy;
  }
  copy.sort((a: any, b: any) => zIndexOf(a) - zIndexOf(b));
  return copy;
}

/**
 * 把组件**连同整棵子树**重新绑定到指定 `ICE` 实例（`ice/ctx/evtBus/root`）。
 *
 * 为什么需要单独一个工具：`ICEGroup` 的子树同步钩子是 `once(AFTER_ADD, afterAddHandler)` ——
 * 只在**首次挂载**时同步一次；跨实例迁移 / 嵌套重父级（`moveComponentTo` / `adoptChild`）时，
 * 已经添加过的容器不会再触发它，后代就会把事件发到旧实例上（表现为"搬过去之后点不动/动画不动"）。
 *
 * 迭代实现（不用递归，深树也不会爆栈）；幂等，可安全重复调用。
 */
export function rebindComponentTree(component: any, ice: any): void {
  if (!component || !ice) {
    return;
  }
  const stack: any[] = [component];
  while (stack.length) {
    const node = stack.pop();
    node.ice = ice;
    node.ctx = ice.ctx;
    node.evtBus = ice.evtBus;
    node.root = ice.root;
    const children = node.childNodes;
    if (children && children.length) {
      for (let i = 0; i < children.length; i++) {
        stack.push(children[i]);
      }
    }
  }
}
