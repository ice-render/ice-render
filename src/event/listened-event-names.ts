/**
 * **「这个事件名有没有人监听」的全局登记表**（2026-09-20）。
 *
 * 用途：一次原生指针输入会被派发**两个名字** —— 原生名（`pointermove`）+ 兼容名（`mousemove`，
 * 见 `DOMEventDispatcher` 的"兼容名派发"），而这两个名字里**通常只有一个有人听**：
 * 引擎自己的默认处理器挂在鼠标名上（`mousedown/mousemove/mouseup`），
 * 应用要么用鼠标名、要么（新代码）用指针名。没人听的那一次，整条"组件树冒泡 + 总线触发"
 * 都是白跑的（`ICEEventTarget.trigger` 里虽然会因没有监听者而早退，但**祖先链数组**与
 * 每层的调用已经付出去了）。指针移动是每帧级高频，这里省下的是热路径上的一半。
 *
 * ⚠️ **只增不减（单向登记，刻意为之）**：
 * - "减"的时机有 `off` / `purgeEvents` / `once` 自摘 / `signal.abort` 四条路径，漏掉任何一条都会
 *   造成"有人听却没有派发"的**正确性事故**（比性能退化严重得多）；
 * - "不减"的代价仅仅是：某个名字**曾经**被用过 → 之后每帧多一次空派发（幂等、无副作用）。
 * 用正确性换这点性能不划算，所以这里选单向。
 */
const LISTENED_EVENT_NAMES = new Set<string>();

/** 登记一个被监听的事件名（由 `ICEEventTarget.__register` 调用）。 */
export function markEventNameListened(eventName: string): void {
  if (eventName) {
    LISTENED_EVENT_NAMES.add(eventName);
  }
}

/** 这个名字有没有人听过（没人听 → 派发器可以整段早退）。 */
export function isEventNameListened(eventName: string): boolean {
  return LISTENED_EVENT_NAMES.has(eventName);
}

/** @internal 仅供测试：清空登记表（名字是全局累积的，用例之间要隔离）。 */
export function __resetListenedEventNames(): void {
  LISTENED_EVENT_NAMES.clear();
}
