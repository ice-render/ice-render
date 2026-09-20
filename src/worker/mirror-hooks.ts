/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * 引擎内部的**镜像钩子**（主线程采集状态变更的唯一入口）。
 *
 * 为什么钩子长这样：镜像桥只在宿主显式 `new MirrorBridge(ice)` 时存在（记在 `ice.__mirrorBridge`），
 * 因此**没装桥的进程一个字段读都不多付**——这三行代码在普通渲染热路径上的成本是
 * 「一次属性读 + 一次判空」。反过来，桥装上了以后，引擎的每一次状态写入与结构变更都会被采集，
 * 宿主不需要自己去重写/包裹 `setState`（包裹式采集会漏掉动画写值通道：`AnimationManager` 写的也是
 * `setState` —— 见 `src/animation/AnimationManager.ts`）。
 *
 * 采集点只有四处（改动引擎时别把它们拆散）：
 * 1. `ICEComponent.setState()` —— 状态（含动画每帧写值）
 * 2. `ICE.addChild()` / `ICE.removeChild()` —— 顶层结构
 * 3. `ICEGroup.addChild()` / `ICEGroup.removeChild()` —— 容器内结构
 *
 * v2 里结构变更也走**增量 op**（`add` / `remove`）；只有"拿不到可寻址信息"这类情况才退回
 * 全量重同步（见 `MirrorBridge.recordStructureChange`）。
 */
export function notifyStateChange(component: any, patch: any): void {
  const ice = component && component.ice;
  const bridge = ice && ice.__mirrorBridge;
  if (bridge) {
    bridge.recordStateChange(component, patch);
  }
}

export function notifyChildAdded(parent: any, child: any): void {
  const bridge = findBridge(parent, child);
  if (bridge) {
    bridge.recordStructureChange('add', parent, child);
  }
}

export function notifyChildRemoved(parent: any, child: any): void {
  const bridge = findBridge(parent, child);
  if (bridge) {
    bridge.recordStructureChange('remove', parent, child);
  }
}

/**
 * 工具层"显示给谁"变了（`ICEControlPanelManager.applySelection`）。
 *
 * 镜像的为什么是它、而不是工具层本身：控制面板 / 手柄由 `ICEControlPanelManager` 按目标**自己造**
 *（`toolNodes` 明确不序列化），worker 侧的引擎有同一套管理者 —— 把"给谁显示"推过去，
 * 它就会用**自己的**面板画出同一套手柄，既不用序列化工具、也不会出现"两套面板"。
 *
 * 也正因为镜像的是这个（而不是 `selectionList`）：点空白处时引擎只**隐藏面板**、不清空选中列表，
 * 只跟选中列表走就会留下"主线程手柄没了、worker 还挂着"的半个状态。
 *
 * @param component 面板的目标组件；null = 隐藏（worker 侧同样隐藏）
 */
export function notifyToolTarget(ice: any, component: any): void {
  const bridge = ice && ice.__mirrorBridge;
  if (bridge) {
    bridge.recordSelectionChange(component ? [component] : []);
  }
}

/**
 * 渲染视口变了（`ICE.setViewport` / `zoomAt`）。
 *
 * 为什么必须镜像：视口一变，主线程与 worker 的"可见区域 + 栅格"就分叉了 ——
 * 编辑器里缩放/平移是最常见的重型操作，分叉的表现是"缩放了但镜像里还是老视口"。
 */
export function notifyViewportChange(ice: any, viewport: any): void {
  const bridge = ice && ice.__mirrorBridge;
  if (bridge) {
    bridge.recordViewportChange(viewport);
  }
}

/**
 * 这个组件**在镜像树里能被寻址吗**（= 它在序列化文档里吗）？
 *
 * 为什么要有这条判定：镜像树的形状**就是序列化文档的形状**（`MirrorTarget.applyScene` 走的是
 * 引擎自己的反序列化器）。而复合组件的**派生部件**（`hasDerivedChildren()` 为真时按 state 重建的
 * 底 / 标题 / 角标，见 `ICEComponent.hasDerivedChildren`）**不进文档** —— 主线程给它们写的状态
 * 补丁带着一个 worker 侧根本不存在的 id 发过去，worker 只能回 `missing`，于是每一批补丁都变成
 * 一次**全量重同步**（真实应用实测：200 节点 / 473KB 的场景，每改一次节点就把整份文档重发一遍，
 * 还会顺手清掉同批已排队的补丁）。这类写入正确的处理是**不镜像**：派生部件由容器按 state 重建，
 * 镜像侧会在重放容器的补丁时自己重算（见 `MirrorTarget.applyOps`）。
 *
 * 判定与 `Serializer` / `Deserializer` 同源，逐层向上：
 * - 祖先声明了 `hasDerivedChildren()`：
 *   - 它没声明 `getSerializableChildren()` → 这个孩子是派生部件；
 *   - 它声明了（"既是复合组件、又是容器"，如 IED 的节点 / 池）→ 孩子在**真实子节点**里就继续
 *     往上查，不在就是派生部件；
 * - 一路查到根都没有派生祖先 → 它自己就是文档内容。
 *
 * 与 `ICEVisioLink` 里那条类似的向上遍历**不是一回事**：那条更严（派生容器的所有后代都不算障碍），
 * 这里只问"它自己在不在文档里"，因为镜像要的正是文档。
 */
export function isMirroredComponent(component: any): boolean {
  if (!component) {
    return false;
  }
  let child: any = component;
  let parent: any = component.parentNode;
  while (parent) {
    if (typeof parent.hasDerivedChildren === 'function' && parent.hasDerivedChildren()) {
      const real = typeof parent.getSerializableChildren === 'function' ? parent.getSerializableChildren() : null;
      if (!Array.isArray(real) || real.indexOf(child) === -1) {
        return false;
      }
    }
    child = parent;
    parent = parent.parentNode;
  }
  return true;
}

/** 把宿主下发的图片位图登记到实例上（`ImageCache.setImage()` 会先查它）。 */
export function registerMirrorImage(ice: any, key: string, bitmap: any): void {
  if (!ice || !key || !bitmap) {
    return;
  }
  if (!ice.__mirrorImages) {
    ice.__mirrorImages = new Map<string, any>();
  }
  ice.__mirrorImages.set(key, bitmap);
}

/**
 * 渲染用到了一张图片。
 *
 * 主线程：桥把 URL 交给宿主 → 宿主解码成 `ImageBitmap` → `images` 消息下发（见 `MirrorHost`）。
 * worker：没有桥，什么都不做 —— worker 侧的 `ImageCache` 会先看"下发过没有"，没下发就返回未加载
 *（等下一次下发后重画），不再抛 "没有 Image 构造器"。
 */
export function notifyImageRequest(ice: any, url: string): void {
  const bridge = ice && ice.__mirrorBridge;
  if (bridge && url) {
    bridge.recordImageRequest(url);
  }
}

/**
 * 找到这次结构变更归属的桥。
 *
 * 父组件可能是 `ICE` 本身（顶层增删，`ice.ice` 不存在），也可能是组件的 `ice`；
 * 被增删的子树自己也可能带 `ice`（从别处移过来）。三个来源依次取，够用且不用遍历。
 */
function findBridge(parent: any, child: any): any {
  const ice = (parent && parent.ice) || (parent && parent.evtBus ? parent : null) || (child && child.ice);
  return ice && ice.__mirrorBridge;
}
