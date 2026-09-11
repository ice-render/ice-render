/**
 * 原生 DOM 事件与 ICE 内部转发事件之间的对应关系。
 * 原生 DOM 事件的名称在 ICE 中不变，ICE 自定义事件名仅仅用来在事件总线中进行转发。
 *
 * 输入通道策略（见 docs/architecture/05-event-system.md）：
 * - 运行时支持 PointerEvent → 只监听 pointer*（统一覆盖鼠标 / 触控笔 / 触摸），
 *   并额外监听没有 pointer 对应事件的 click / dblclick / contextmenu。
 * - 否则（老浏览器 / 小程序）→ 监听 mouse* + touch*，touch 通道由派发器
 *   归一化后以鼠标语义名转发，上层组件无需区分。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */

/** 指针输入通道（鼠标 / 触控笔 / 触摸统一） */
export const pointerEvents: Array<[string, string]> = [
  ['pointerdown', 'ICE_POINTERDOWN'],
  ['pointermove', 'ICE_POINTERMOVE'],
  ['pointerup', 'ICE_POINTERUP'],
  ['pointercancel', 'ICE_POINTERCANCEL'],
];

/**
 * 鼠标输入通道。在支持 PointerEvent 的运行时只保留「没有 pointer 对应事件」的那几个，
 * 避免 pointer 与 mouse 兼容事件双重触发。
 */
export const mouseEvents: Array<[string, string]> = [
  ['mousedown', 'ICE_MOUSEDOWN'],
  ['mouseup', 'ICE_MOUSEUP'],
  ['mousemove', 'ICE_MOUSEMOVE'],
  ['click', 'ICE_CLICK'],
  ['dblclick', 'ICE_DBCLICK'],
  ['contextmenu', 'ICE_CONTEXTMENU'],
];

/** PointerEvent 世界下仍需单独监听的鼠标事件（无 pointer 等价物）。 */
export const nonPointerMouseEvents: Array<[string, string]> = [
  ['click', 'ICE_CLICK'],
  ['dblclick', 'ICE_DBCLICK'],
  ['contextmenu', 'ICE_CONTEXTMENU'],
];

/** 触摸输入通道（无 PointerEvent 的运行时使用，如小程序）。 */
export const touchEvents: Array<[string, string]> = [
  ['touchstart', 'ICE_TOUCHSTART'],
  ['touchmove', 'ICE_TOUCHMOVE'],
  ['touchend', 'ICE_TOUCHEND'],
  ['touchcancel', 'ICE_TOUCHCANCEL'],
];

/** 滚轮通道（视口缩放等，由应用层消费）。 */
export const wheelEvents: Array<[string, string]> = [['wheel', 'ICE_WHEEL']];

/**
 * 原生 DOM 键盘事件与 ICE 内部转发事件之间的对应关系。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export const keyboardEvents: Array<[string, string]> = [
  ['keydown', 'ICE_KEYDOWN'],
  ['keyup', 'ICE_KEYUP'],
];

/** 高频「移动」类 ICE 事件名：派发器对其跳过命中检测（避免每次移动都全量扫描组件树）。 */
export const MOVE_ICE_EVENTS = ['ICE_MOUSEMOVE', 'ICE_POINTERMOVE', 'ICE_TOUCHMOVE'];

/**
 * 按运行时能力构建待监听的 DOM 事件表。
 * @param hasPointerEvent 运行时是否存在 PointerEvent 构造器
 */
export function buildDomEventList(hasPointerEvent: boolean): Array<[string, string]> {
  const list: Array<[string, string]> = [];
  if (hasPointerEvent) {
    list.push(...pointerEvents, ...nonPointerMouseEvents);
  } else {
    list.push(...mouseEvents, ...touchEvents);
  }
  list.push(...wheelEvents, ...keyboardEvents);
  return list;
}
