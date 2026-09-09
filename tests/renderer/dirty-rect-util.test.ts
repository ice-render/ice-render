/**
 * dirty-rect-util 纯函数单测。
 * 覆盖：paint pad 估算、union/intersects/空盒/有限性、整像素对齐、区域占比。
 */
import {
  PAD_AA,
  stylePaintPad,
  unionBoxes,
  intersects,
  isFiniteBox,
  emptyBox,
  integerAlign,
  regionRatio,
  boxWidth,
  boxHeight,
  isOpaqueDrawing,
} from '../../src/renderer/dirty-rect-util';

describe('stylePaintPad', () => {
  test('默认无描边无阴影时仅保留 AA 兜底', () => {
    expect(stylePaintPad({ style: {} })).toBe(PAD_AA);
  });

  test('按线宽外扩（取整线宽）', () => {
    const pad = stylePaintPad({ style: { lineWidth: 6 } });
    expect(pad).toBe(PAD_AA + 6);
  });

  test('蚂蚁线管壁 lineBorderWidth 计入外扩', () => {
    const pad = stylePaintPad({ style: { lineWidth: 1 }, lineBorderWidth: 5 });
    expect(pad).toBe(PAD_AA + 5);
  });

  test('显式 shadowBlur + offset 外扩', () => {
    const pad = stylePaintPad({ style: { shadowBlur: 10, shadowOffsetX: 4, shadowOffsetY: 2 } });
    expect(pad).toBe(PAD_AA + 10 + 4);
  });

  test('shadow 简写 md 映射到 13', () => {
    expect(stylePaintPad({ style: { shadow: 'md' } })).toBe(PAD_AA + 13);
  });
});

describe('盒运算', () => {
  test('union 原地累加并返回 target', () => {
    const t = emptyBox();
    unionBoxes(t, [0, 0, 10, 10]);
    unionBoxes(t, [5, -2, 20, 8]);
    expect(Array.from(t)).toEqual([0, -2, 20, 10]);
  });

  test('union 从首个盒开始正确', () => {
    const t = emptyBox();
    unionBoxes(t, [1, 2, 3, 4]);
    expect(Array.from(t)).toEqual([1, 2, 3, 4]);
  });

  test('intersects 边界相触视为相交', () => {
    expect(intersects([0, 0, 10, 10], [10, 0, 20, 10])).toBe(true);
    expect(intersects([0, 0, 10, 10], [11, 0, 20, 10])).toBe(false);
  });

  test('isFiniteBox 识别 NaN/Infinity', () => {
    expect(isFiniteBox([0, 0, 10, 10])).toBe(true);
    expect(isFiniteBox([NaN, 0, 10, 10])).toBe(false);
    expect(isFiniteBox(emptyBox())).toBe(false);
  });

  test('boxWidth/Height', () => {
    expect(boxWidth([0, 1, 20, 21])).toBe(20);
    expect(boxHeight([0, 1, 20, 21])).toBe(20);
  });
});

describe('isOpaqueDrawing（局部重绘场景级门控判定）', () => {
  test('纯不透明颜色 / 渐变对象视为不透明', () => {
    expect(isOpaqueDrawing({ style: { fillStyle: '#10B981', strokeStyle: '#111827' } })).toBe(true);
    expect(isOpaqueDrawing({ style: { fillStyle: { _gradient: true } } })).toBe(true);
  });

  test('alpha 色 / rgba / 8位hex / transparent 视为非不透明', () => {
    expect(isOpaqueDrawing({ style: { fillStyle: 'rgba(0,0,0,0.5)' } })).toBe(false);
    expect(isOpaqueDrawing({ style: { fillStyle: '#10B98180' } })).toBe(false);
    expect(isOpaqueDrawing({ style: { fillStyle: 'transparent' } })).toBe(false);
    expect(isOpaqueDrawing({ style: { fillStyle: 'red', strokeStyle: 'hsla(0,0%,0%,0.2)' } })).toBe(false);
  });

  test('阴影 / globalAlpha / 合成模式视为非不透明', () => {
    expect(isOpaqueDrawing({ style: { shadow: 'md' } })).toBe(false);
    expect(isOpaqueDrawing({ style: { shadowBlur: 4 } })).toBe(false);
    expect(isOpaqueDrawing({ style: { globalAlpha: 0.8 } })).toBe(false);
    expect(isOpaqueDrawing({ style: { globalCompositeOperation: 'multiply' } })).toBe(false);
  });
});

describe('integerAlign 与区域占比', () => {
  test('整数对齐：min 向下、max 向上', () => {
    const box = [1.2, -0.7, 10.9, 12.1];
    integerAlign(box);
    expect(Array.from(box)).toEqual([1, -1, 11, 13]);
  });

  test('regionRatio 正常与除零保护', () => {
    expect(regionRatio([0, 0, 50, 50], 100, 100)).toBeCloseTo(0.25);
    expect(regionRatio([0, 0, 50, 50], 0, 0)).toBe(1);
  });
});
