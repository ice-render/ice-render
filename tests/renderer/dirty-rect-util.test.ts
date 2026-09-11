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
  boxArea,
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

  test('划算的合并会一直做到 maxRegions 以内', () => {
    // 5 个 100x100 的盒，间距只有 1px —— 合并的「浪费」极小（比值 ≈ 1.005），属于划算的合并
    const boxes: number[][] = [];
    for (let i = 0; i < 5; i++) {
      boxes.push([i * 101, 0, i * 101 + 100, 100]);
    }
    const out = coalesceRegions(boxes, 2);
    expect(out.length).toBe(2);
  });

  /**
   * 契约变更（2026-09-11）：`maxRegions` 从**硬上限**改成**软上限**。
   *
   * 原来的语义是「区数必须 ≤ maxRegions，为此不惜强行合并」。但那样会把细长盒串联成
   * 一个整屏大盒 —— 于是面积阈值把局部重绘永远挡在门外（编辑器里实测 100% 回退全量）。
   * 现在：只合并划算的；没有划算的合并时就多留几块（每块区只是一遍 O(组件数) 的 AABB 过滤），
   * 区数超过 24 才塌缩成一个并集盒、交给面积阈值回退全量。
   */
  test('上限是软上限：没有划算的合并时宁可多留几块（不把脏区撑成整屏）', () => {
    const boxes: number[][] = [];
    for (let i = 0; i < 8; i++) {
      boxes.push([i * 100, 0, i * 100 + 10, 10]);
    }
    const out = coalesceRegions(boxes, 3);
    const total = out.reduce((a, b) => a + boxArea(b), 0);
    // 强行合并到 3 块的话，会得到 ~[0,0,710,10] 这种大盒（面积 7100）；
    // 保留 8 块的总面积只有 800，便宜得多。
    expect(boxArea([0, 0, 710, 10])).toBeGreaterThan(total * 8);
    expect(out.length).toBe(8);
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

  /**
   * 实测自 ice-entity-designer（2026-09-11）：拖动一个实体时 22 个脏盒里含 8 条**横跨画布的
   * 关系连线**，它们的旧/新盒互相交叉 —— 原来的「相交就合并」会把 22 个盒串成一个**整屏大盒**
   * （实测面积占比 1.004），于是永远撞上 0.35 的面积阈值回退全量，
   * 局部重绘在这个编辑器里 100% 失效。而 22 个盒的**实际面积之和**只有画布的 6%。
   */
  test('交叉的细长盒不该被串成一整块（编辑器里 8 条横跨连线的情形）', () => {
    const boxes: number[][] = [];
    for (let i = 0; i < 8; i++) {
      // 一条横跨画布的细长连线（世界盒）：长 2780、宽 30；8 条横的 + 8 条竖的互相交叉
      boxes.push([20, 200 * i + 20, 2800, 200 * i + 50]);
      boxes.push([200 * i + 20, 20, 200 * i + 50, 1600]);
    }
    const sumOfBoxes = boxes.reduce((a, b) => a + boxArea(b), 0);
    const out = coalesceRegions(boxes, 6);
    const total = out.reduce((a, b) => a + boxArea(b), 0);
    // 串成一整块的话面积会是 [20,20,2800,1600]=4.39M，约等于「各盒面积之和」的 4.2 倍；
    // 正确的做法是保留几块「细长」的区域，总面积与各盒面积之和同量级。
    expect(boxArea([20, 20, 2800, 1600])).toBeGreaterThan(sumOfBoxes * 4);
    expect(total).toBeLessThan(sumOfBoxes * 2);
    // 区数上限是**软**的：没有划算的合并时就多留几块（多跑几遍便宜的 AABB 过滤），
    // 但仍然必须有界。
    expect(out.length).toBeLessThanOrEqual(24);
  });

  test('真正相邻/嵌套的盒仍然照并（护栏不能把正常合并也挡住）', () => {
    expect(
      coalesceRegions([
        [0, 0, 100, 100],
        [10, 10, 20, 20], // 完全嵌套
      ])
    ).toEqual([[0, 0, 100, 100]]);
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
