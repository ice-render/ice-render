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
  mapBoxToRender,
  mergeBox,
  coalesceRegions,
  regionsAreaRatio,
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

describe('mapBoxToRender（世界盒 → 渲染坐标盒）', () => {
  test('单位视口 + dpr=1：恒等映射', () => {
    const out = mapBoxToRender([10, 20, 30, 40], { scale: 1, tx: 0, ty: 0 });
    expect(out).toEqual([10, 20, 30, 40]);
  });

  test('非单位视口：世界坐标乘以 scale 并加平移', () => {
    const out = mapBoxToRender([10, 20, 30, 40], { scale: 2, tx: 100, ty: 50 });
    expect(out).toEqual([120, 90, 160, 130]);
  });

  test('dpr 已乘进渲染视口：传入 2 倍视口即得物理像素坐标', () => {
    // 渲染视口 = dpr · viewport，两个因子一起体现
    const out = mapBoxToRender([10, 20, 30, 40], { scale: 1.5 * 2, tx: 0, ty: 0 });
    expect(out).toEqual([30, 60, 90, 120]);
  });

  test('向外取整：映射后的区域不小于真实脏区（避免缩放后边缘接缝）', () => {
    const out = mapBoxToRender([10.4, 20.6, 30.2, 40.9], { scale: 1.3, tx: 7.5, ty: -3.25 });
    // 世界 10.4 → 10.4*1.3+7.5 = 21.02 → floor 21；世界 30.2 → 46.76 → ceil 47
    expect(out[0]).toBe(21);
    expect(out[2]).toBe(47);
    expect(out[0]).toBeLessThanOrEqual(10.4 * 1.3 + 7.5);
    expect(out[2]).toBeGreaterThanOrEqual(30.2 * 1.3 + 7.5);
  });

  test('可复用外部数组（零分配路径）', () => {
    const scratch = [0, 0, 0, 0];
    const out = mapBoxToRender([1, 2, 3, 4], { scale: 1, tx: 0, ty: 0 }, scratch);
    expect(out).toBe(scratch);
    expect(scratch).toEqual([1, 2, 3, 4]);
  });
});

describe('mergeBox', () => {
  test('取并集且不修改入参', () => {
    const a = [10, 10, 20, 20];
    const b = [15, 5, 30, 12];
    expect(mergeBox(a, b)).toEqual([10, 5, 30, 20]);
    expect(a).toEqual([10, 10, 20, 20]);
  });
});

describe('coalesceRegions', () => {
  test('相交或相接的盒并成一块', () => {
    const out = coalesceRegions([
      [0, 0, 10, 10],
      [10, 0, 20, 10], // 与上一块相接
      [0, 10, 10, 20], // 与第一块相接
    ]);
    expect(out).toEqual([[0, 0, 20, 20]]);
  });

  test('分离的盒各成一块（不并成大盒）', () => {
    const out = coalesceRegions([
      [0, 0, 10, 10],
      [500, 400, 510, 410],
    ]);
    expect(out.length).toBe(2);
    expect(out).toEqual(
      expect.arrayContaining([
        [0, 0, 10, 10],
        [500, 400, 510, 410],
      ])
    );
  });

  test('链式相接：合并后产生的新相接关系也要收敛', () => {
    // 中间块把左右两块连起来 → 最终应合成一块
    const out = coalesceRegions([
      [0, 0, 10, 10],
      [9, 0, 30, 10],
      [29, 0, 40, 10],
    ]);
    expect(out).toEqual([[0, 0, 40, 10]]);
  });

  test('超出上限时合并「面积增量最小」的两块', () => {
    const boxes = [];
    for (let i = 0; i < 8; i++) {
      boxes.push([i * 100, 0, i * 100 + 10, 10]);
    }
    const out = coalesceRegions(boxes, 3);
    expect(out.length).toBe(3);
    // 合并后的各块仍互不相接
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        const disjoint = a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];
        expect(disjoint).toBe(true);
      }
    }
  });

  test('忽略非法（NaN/Infinity）盒', () => {
    expect(
      coalesceRegions([
        [NaN, 0, 10, 10],
        [0, 0, 5, 5],
      ])
    ).toEqual([[0, 0, 5, 5]]);
  });

  test('空输入返回空数组', () => {
    expect(coalesceRegions([])).toEqual([]);
  });
});

describe('regionsAreaRatio', () => {
  test('各块面积相加后除以画布面积', () => {
    expect(
      regionsAreaRatio(
        [
          [0, 0, 10, 10],
          [100, 100, 110, 110],
        ],
        100,
        100
      )
    ).toBeCloseTo(0.02, 6);
  });

  test('画布尺寸为 0 时返回 1（保守回退）', () => {
    expect(regionsAreaRatio([[0, 0, 10, 10]], 0, 0)).toBe(1);
  });
});
