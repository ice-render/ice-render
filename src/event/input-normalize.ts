/**
 * 输入归一化：把 mouse / pointer / touch 三类原生输入统一成引擎内部消费的字段。
 *
 * 背景：
 * - 组件、拖拽、变换手柄、对齐吸附、命中检测都只读 `evt.offsetX/offsetY/movementX/movementY`。
 * - 触摸事件（TouchEvent）上没有 offsetX/offsetY/movementX，PointerEvent 上 movementX 在部分
 *   运行时也不可靠；并且全局监听下 `offsetX` 是相对「事件目标元素」而非 canvas。
 *
 * 因此：在事件边界（DOMEventDispatcher）统一归一化一次，上层代码零改动即可同时支持
 * 鼠标 / 触控笔 / 触摸；坐标一律由 `clientX - canvasRect.left` 得到，滚动/缩放后仍正确。
 *
 * 本模块只含纯函数，不依赖 DOM 与引擎实例，便于 jest 直接单测。
 */

/** 归一化后的输入点（坐标单位：canvas 逻辑像素，尚未扣除视口）。 */
export interface NormalizedInput {
  /** canvas 内 x（= clientX - rect.left） */
  x: number;
  /** canvas 内 y（= clientY - rect.top） */
  y: number;
  clientX: number;
  clientY: number;
  /** 屏幕像素位移；原生 movementX/Y 优先，缺失时用「与上一次坐标的差」 */
  movementX: number;
  movementY: number;
  pointerType: string;
  pointerId: number;
  button: number;
  buttons: number;
  isPrimary: boolean;
  isTouch: boolean;
}

export interface RectLike {
  left: number;
  top: number;
}

/** 是否为 touch* 事件（TouchEvent 系）。 */
export function isTouchEvent(evt: any): boolean {
  return !!evt && typeof evt.type === 'string' && evt.type.indexOf('touch') === 0;
}

/**
 * 从任意原生事件解出「屏幕坐标点」。
 * - touch*：取 touches[0]，touchend 时 touches 为空则回退 changedTouches[0]
 * - pointer/mouse：直接用 clientX/clientY
 * - 键盘等无坐标事件：返回 null
 */
export function resolveClientPoint(evt: any): { clientX: number; clientY: number } | null {
  if (!evt) return null;
  if (isTouchEvent(evt)) {
    const list = (evt.touches && evt.touches.length ? evt.touches : evt.changedTouches) || null;
    const t = list && list[0];
    if (!t || typeof t.clientX !== 'number') return null;
    return { clientX: t.clientX, clientY: t.clientY };
  }
  if (typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
    return { clientX: evt.clientX, clientY: evt.clientY };
  }
  return null;
}

/**
 * 归一化一次输入事件。
 *
 * @param evt  原生事件（mouse / pointer / touch）
 * @param rect canvas 的 getBoundingClientRect()（缺失时按 (0,0) 处理）
 * @param prev 上一次归一化结果，用于在缺少原生 movement 时补算位移
 * @returns 归一化结果；无坐标的事件（键盘等）返回 null
 */
export function normalizeInput(evt: any, rect: RectLike | null, prev?: NormalizedInput | null): NormalizedInput | null {
  const point = resolveClientPoint(evt);
  if (!point) return null;

  const left = rect && typeof rect.left === 'number' ? rect.left : 0;
  const top = rect && typeof rect.top === 'number' ? rect.top : 0;
  const x = point.clientX - left;
  const y = point.clientY - top;

  // 原生 movement 优先；touch 没有该字段（或为 NaN）时用坐标差补算。
  let mx = Number(evt.movementX);
  let my = Number(evt.movementY);
  if (!isFinite(mx) || !isFinite(my)) {
    if (prev) {
      mx = x - prev.x;
      my = y - prev.y;
    } else {
      mx = 0;
      my = 0;
    }
  }

  const touch = isTouchEvent(evt);
  return {
    x,
    y,
    clientX: point.clientX,
    clientY: point.clientY,
    movementX: mx,
    movementY: my,
    // TouchEvent 没有 pointerType；按语义补成 'touch'，便于上层区分输入源。
    pointerType: evt.pointerType || (touch ? 'touch' : 'mouse'),
    pointerId: typeof evt.pointerId === 'number' ? evt.pointerId : -1,
    button: typeof evt.button === 'number' ? evt.button : 0,
    buttons: typeof evt.buttons === 'number' ? evt.buttons : 0,
    isPrimary: evt.isPrimary !== false,
    isTouch: touch,
  };
}

/**
 * 把归一化结果写回事件对象（ICEEvent 是普通对象，可直接写）。
 *
 * - `offsetX/offsetY` 沿用旧字段名，值改为「canvas 内坐标」，修掉全局监听下
 *   相对子元素、以及滚动后 rect 过期导致的命中偏移。
 * - `movementX/movementY` 统一为屏幕像素位移，触摸拖拽因此可用。
 */
export function applyNormalizedInput(target: any, input: NormalizedInput): void {
  if (!target || !input) return;
  target.offsetX = input.x;
  target.offsetY = input.y;
  target.clientX = input.clientX;
  target.clientY = input.clientY;
  target.movementX = input.movementX;
  target.movementY = input.movementY;
  target.pointerType = input.pointerType;
  target.pointerId = input.pointerId;
  target.isTouchInput = input.isTouch;
}

/**
 * 原生事件名 → 组件层沿用的「鼠标语义」事件名。
 * pointer/touch 通道要映射成 mouse 名，既有组件与控制面板才能零改动复用。
 * 返回 null 表示无需映射（click/dblclick/contextmenu/wheel/keyboard 等本身即语义名）。
 */
export function toLegacyMouseName(nativeType: string): string | null {
  switch (nativeType) {
    case 'pointerdown':
    case 'touchstart':
      return 'mousedown';
    case 'pointermove':
    case 'touchmove':
      return 'mousemove';
    case 'pointerup':
    case 'touchend':
    case 'pointercancel':
    case 'touchcancel':
      return 'mouseup';
    default:
      return null;
  }
}
