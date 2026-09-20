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
 * v1 里**结构变更不产生增量 op**，只把桥标成"需要全量重同步"（见 `MirrorBridge.recordStructureChange`）。
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
 * 找到这次结构变更归属的桥。
 *
 * 父组件可能是 `ICE` 本身（顶层增删，`ice.ice` 不存在），也可能是组件的 `ice`；
 * 被增删的子树自己也可能带 `ice`（从别处移过来）。三个来源依次取，够用且不用遍历。
 */
function findBridge(parent: any, child: any): any {
  const ice = (parent && parent.ice) || (parent && parent.evtBus ? parent : null) || (child && child.ice);
  return ice && ice.__mirrorBridge;
}
