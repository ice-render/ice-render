/**
 * 输入归一化：mouse / pointer / touch 三类原生输入收敛成统一字段。
 *
 * 锁定契约：
 * - 坐标一律由 clientX - canvasRect.left 得到（修掉全局监听下 offsetX 相对子元素、rect 过期的问题）
 * - movement 优先用原生值，touch 缺失时用「与上一次坐标的差」补算
 * - pointer/touch 事件名映射到既有鼠标语义名，保证上层零改动
 */
import {
  isTouchEvent,
  resolveClientPoint,
  normalizeInput,
  applyNormalizedInput,
  toLegacyMouseName,
} from '../../src/event/input-normalize';

const rect = { left: 100, top: 50 };

describe('isTouchEvent', () => {
  it('识别 touch 系事件', () => {
    expect(isTouchEvent({ type: 'touchstart' })).toBe(true);
    expect(isTouchEvent({ type: 'touchmove' })).toBe(true);
    expect(isTouchEvent({ type: 'touchend' })).toBe(true);
    expect(isTouchEvent({ type: 'pointerdown' })).toBe(false);
    expect(isTouchEvent({ type: 'mousedown' })).toBe(false);
    expect(isTouchEvent(null)).toBe(false);
  });
});

describe('resolveClientPoint', () => {
  it('鼠标/指针事件直接取 clientX/clientY', () => {
    expect(resolveClientPoint({ type: 'mousedown', clientX: 10, clientY: 20 })).toEqual({ clientX: 10, clientY: 20 });
    expect(resolveClientPoint({ type: 'pointermove', clientX: 3, clientY: 4 })).toEqual({ clientX: 3, clientY: 4 });
  });

  it('touch 事件从 touches[0] 取点', () => {
    const evt = { type: 'touchstart', touches: [{ clientX: 7, clientY: 8 }], changedTouches: [] };
    expect(resolveClientPoint(evt)).toEqual({ clientX: 7, clientY: 8 });
  });

  it('touchend 时 touches 为空，回退 changedTouches[0]', () => {
    const evt = { type: 'touchend', touches: [], changedTouches: [{ clientX: 9, clientY: 11 }] };
    expect(resolveClientPoint(evt)).toEqual({ clientX: 9, clientY: 11 });
  });

  it('键盘等无坐标事件返回 null', () => {
    expect(resolveClientPoint({ type: 'keydown', key: 'a' })).toBeNull();
    expect(resolveClientPoint(null)).toBeNull();
  });

  it('touch 但点列表为空时返回 null', () => {
    expect(resolveClientPoint({ type: 'touchmove', touches: [], changedTouches: [] })).toBeNull();
  });
});

describe('normalizeInput 坐标换算', () => {
  it('canvas 内坐标 = clientX - rect.left / clientY - rect.top', () => {
    const out = normalizeInput({ type: 'mousedown', clientX: 130, clientY: 90 }, rect);
    expect(out).not.toBeNull();
    expect(out!.x).toBe(30);
    expect(out!.y).toBe(40);
    expect(out!.clientX).toBe(130);
    expect(out!.clientY).toBe(90);
  });

  it('rect 缺失时按 (0,0) 处理', () => {
    const out = normalizeInput({ type: 'mousedown', clientX: 12, clientY: 34 }, null);
    expect(out!.x).toBe(12);
    expect(out!.y).toBe(34);
  });

  it('触摸事件的坐标同样换算到 canvas 坐标系（触摸拖拽可用）', () => {
    const evt = { type: 'touchmove', touches: [{ clientX: 150, clientY: 100 }], changedTouches: [] };
    const out = normalizeInput(evt, rect);
    expect(out!.x).toBe(50);
    expect(out!.y).toBe(50);
    expect(out!.isTouch).toBe(true);
    expect(out!.pointerType).toBe('touch');
  });

  it('键盘事件返回 null（不做坐标注入）', () => {
    expect(normalizeInput({ type: 'keydown', key: 'a' }, rect)).toBeNull();
  });
});

describe('normalizeInput movement 补算', () => {
  it('优先使用原生 movementX/movementY', () => {
    const out = normalizeInput({ type: 'mousemove', clientX: 130, clientY: 90, movementX: 5, movementY: -7 }, rect);
    expect(out!.movementX).toBe(5);
    expect(out!.movementY).toBe(-7);
  });

  it('无原生 movement 且有上一次坐标时，用坐标差补算', () => {
    const prev = normalizeInput({ type: 'touchstart', touches: [{ clientX: 100, clientY: 50 }] }, rect);
    const cur = normalizeInput({ type: 'touchmove', touches: [{ clientX: 118, clientY: 44 }] }, rect, prev);
    expect(cur!.movementX).toBe(18);
    expect(cur!.movementY).toBe(-6);
  });

  it('首次事件无上一次坐标时 movement 为 0', () => {
    const out = normalizeInput({ type: 'touchstart', touches: [{ clientX: 100, clientY: 50 }] }, rect);
    expect(out!.movementX).toBe(0);
    expect(out!.movementY).toBe(0);
  });

  it('原生 movement 为 NaN 时回退到坐标差', () => {
    const prev = normalizeInput({ type: 'pointerdown', clientX: 100, clientY: 50 }, rect);
    const cur = normalizeInput(
      { type: 'pointermove', clientX: 110, clientY: 50, movementX: NaN, movementY: NaN },
      rect,
      prev
    );
    expect(cur!.movementX).toBe(10);
    expect(cur!.movementY).toBe(0);
  });
});

describe('normalizeInput 输入源标识', () => {
  it('mouse 事件 pointerType 为 mouse', () => {
    expect(normalizeInput({ type: 'mousedown', clientX: 1, clientY: 1 }, rect)!.pointerType).toBe('mouse');
  });

  it('pointer 事件保留原生 pointerType（pen 等）', () => {
    const out = normalizeInput(
      { type: 'pointerdown', clientX: 1, clientY: 1, pointerType: 'pen', pointerId: 7, isPrimary: true },
      rect
    );
    expect(out!.pointerType).toBe('pen');
    expect(out!.pointerId).toBe(7);
    expect(out!.isPrimary).toBe(true);
  });
});

describe('applyNormalizedInput 写回事件对象', () => {
  it('用 canvas 内坐标覆盖 offsetX/offsetY，并注入 movement 与输入源标识', () => {
    const evt: any = { type: 'mousemove' };
    const input = normalizeInput({ type: 'mousemove', clientX: 130, clientY: 90, movementX: 2, movementY: 3 }, rect)!;
    applyNormalizedInput(evt, input);
    expect(evt.offsetX).toBe(30);
    expect(evt.offsetY).toBe(40);
    expect(evt.clientX).toBe(130);
    expect(evt.movementX).toBe(2);
    expect(evt.movementY).toBe(3);
    expect(evt.pointerType).toBe('mouse');
    expect(evt.isTouchInput).toBe(false);
  });

  it('target 为空时安全返回', () => {
    expect(() => applyNormalizedInput(null, null as any)).not.toThrow();
  });
});

describe('toLegacyMouseName 事件名映射', () => {
  it('pointer/touch 的按下-移动-抬起映射到鼠标语义名', () => {
    expect(toLegacyMouseName('pointerdown')).toBe('mousedown');
    expect(toLegacyMouseName('pointermove')).toBe('mousemove');
    expect(toLegacyMouseName('pointerup')).toBe('mouseup');
    expect(toLegacyMouseName('pointercancel')).toBe('mouseup');
    expect(toLegacyMouseName('touchstart')).toBe('mousedown');
    expect(toLegacyMouseName('touchmove')).toBe('mousemove');
    expect(toLegacyMouseName('touchend')).toBe('mouseup');
    expect(toLegacyMouseName('touchcancel')).toBe('mouseup');
  });

  it('本身即语义名的事件不映射', () => {
    expect(toLegacyMouseName('mousedown')).toBeNull();
    expect(toLegacyMouseName('click')).toBeNull();
    expect(toLegacyMouseName('dblclick')).toBeNull();
    expect(toLegacyMouseName('contextmenu')).toBeNull();
    expect(toLegacyMouseName('wheel')).toBeNull();
    expect(toLegacyMouseName('keydown')).toBeNull();
  });
});
