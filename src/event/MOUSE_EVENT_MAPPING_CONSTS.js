/**
 * 原生 DOM 事件与 ICE 内部转发事件之间的对应关系
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const mouseEvents = [
  ['click', 'ICE_CLICK'],
  ['dbclick', 'ICE_DBCLICK'],
  ['mousedown', 'ICE_MOUSEDOWN'],
  ['mouseup', 'ICE_MOUSEUP'],
  ['mousemove', 'ICE_MOUSEMOVE'],
  ['mouseenter', 'ICE_MOUSEENTER'],
  ['mouseleave', 'ICE_MOUSELEAVE'],
  ['mouseout', 'ICE_MOUSEOUT'],
  ['mouseover', 'ICE_MOUSEOVER'],
  ['contextmenu', 'ICE_CONTEXTMENU'],
  ['mousewheel', 'ICE_MOUSEWHEEL'],
];

export default mouseEvents;
