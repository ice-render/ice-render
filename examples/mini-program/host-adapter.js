/**
 * 小程序宿主适配层：把 `wx` 的 canvas 节点与触摸事件接到 ice-render 上。
 *
 * 引擎侧**不需要**假 DOM —— 没有 `getBoundingClientRect` 时它按画布自身尺寸兜底
 * （见 `ICE.readCanvasRect()` 与 `tests/mini-program/`）。所以这里只做两件事：
 *
 *   1. 用 `wx.createSelectorQuery()` 拿画布在页面里的位置；
 *   2. 把 `bindtouch*` 的坐标换算成**画布内坐标**，再以引擎总线的 `ICE_TOUCH*` 事件投递。
 *
 * 为什么必须换算：小程序触摸事件的 `clientX/clientY` 是相对**视口**的，而引擎（在没有
 * 原生 `getBoundingClientRect` 时）按「画布内坐标」解释输入。少这一步，命中会整体偏移。
 */

/** 读画布在页面里的矩形（position: boundingClientRect 拿到的就是 border-box） */
function measureCanvas(component, canvasId) {
  return new Promise((resolve) => {
    wx.createSelectorQuery()
      .in(component)
      .select('#' + canvasId)
      .boundingClientRect((rect) => resolve(rect || { left: 0, top: 0, width: 0, height: 0 }))
      .exec();
  });
}

/** 从 wx 触摸事件里取出第一个触点（touchend 只有 changedTouches） */
function firstTouch(evt) {
  const list = (evt.touches && evt.touches.length ? evt.touches : evt.changedTouches) || [];
  return list[0] || null;
}

/**
 * 建立宿主适配器。
 *
 * @param {object} options
 * @param {object} options.ice      已经 `init` 过的 ICE 实例
 * @param {object} options.component 页面/组件实例（`wx.createSelectorQuery().in()` 需要）
 * @param {string} options.canvasId 画布节点 id
 * @returns {{ refreshRect: Function, onTouch: Function, dispose: Function }}
 */
function createHostAdapter(options) {
  const ice = options.ice;
  const component = options.component;
  const canvasId = options.canvasId;
  let rect = { left: 0, top: 0, width: 0, height: 0 };

  // 位置会随页面滚动 / 布局变化而变：进页面时测一次，滚动或尺寸变化时再测
  function refreshRect() {
    return measureCanvas(component, canvasId).then((next) => {
      rect = next;
      return rect;
    });
  }

  function onTouch(type, evt) {
    const touch = firstTouch(evt);
    if (!touch) return;
    // 视口坐标 → 画布内坐标（引擎按画布内坐标解释输入）
    const point = {
      clientX: touch.clientX - rect.left,
      clientY: touch.clientY - rect.top,
      identifier: touch.identifier == null ? 0 : touch.identifier,
    };
    const isEnd = type === 'touchend' || type === 'touchcancel';
    ice.evtBus.trigger('ICE_' + type.toUpperCase(), {
      type,
      touches: isEnd ? [] : [point],
      changedTouches: [point],
      timeStamp: Date.now(),
    });
  }

  refreshRect();

  return {
    refreshRect,
    onTouch,
    onTouchStart: (evt) => onTouch('touchstart', evt),
    onTouchMove: (evt) => onTouch('touchmove', evt),
    onTouchEnd: (evt) => onTouch('touchend', evt),
    onTouchCancel: (evt) => onTouch('touchcancel', evt),
    dispose() {
      rect = { left: 0, top: 0, width: 0, height: 0 };
    },
  };
}

module.exports = { createHostAdapter, measureCanvas };
