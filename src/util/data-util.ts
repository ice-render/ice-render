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
  const all = flattenAllComponents(ice);
  all.sort((a: any, b: any) => a.state.zIndex - b.state.zIndex);

  const renderer: any = ice.renderer;
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
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    node._level = level;
    node._pid = pid;
    result.push(node);
    // 注意：真实组件的 id 定义在 props 上（旧实现取 node.id 恒为 undefined，父子关系丢失）；
    // 同时兼容「普通对象 + 顶层 id」的调用方式（如单测夹具、外部把扁平数据当树用的场景）。
    const childPid = node.props && node.props.id !== undefined ? node.props.id : node.id;
    flattenTree(result, node.childNodes || [], level + 1, childPid);
  }
  return result;
}
