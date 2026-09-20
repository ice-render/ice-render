/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * 圆角矩形的几何归一化（`CanvasPath.roundRect` 的规范口径）。
 *
 * 为什么要有这个文件：同一份「圆角矩形」有**两个消费者** ——
 * ① 运行时没有原生 `roundRect` 时，`Path2DRecorder` 要把它还原成一串
 *    `moveTo / lineTo / arcTo`（否则老运行时上直接少画一层圆角）；
 * ② `SvgExporter` 要把 `roundRect` 命令翻译成 SVG 的 `d`。
 * 两边各写一份三角函数，迟早会出现「画布上是圆角、导出成直角」这类静默漂移。规则只写一遍。
 *
 * 口径**逐条对齐原生**（`https://html.spec.whatwg.org/#dom-context-2d-roundrect`，2021 年进入规范）：
 *
 * - `radii` 可以是数字，也可以是 1 / 2 / 3 / 4 个值的数组，按 CSS `border-radius` 的补齐规则展开：
 *   `[a]` → 四角 `a`；`[a,b]` → 左上/右下 `a`、右上/左下 `b`；`[a,b,c]` → 右下取右上；`[a,b,c,d]` → 顺时针四项。
 *   数组长度不是 1~4 → 抛 `RangeError`（原生原话：`N radii provided. Between one and four radii are necessary.`）。
 * - 任一半径为负 → 抛 `RangeError`（原生同样抛）。
 * - 未给 / 全 0 → 等价于 `rect()`，由调用方决定退化成哪条命令。
 * - `NaN` / `Infinity` 半径 → 视作 0（真机实测：原生也是画成一个直角矩形，且不抛错）。
 * - **负宽 / 负高**：几何镜像，半径跟着换到「视觉上」对应的那个角 —— 原生就是这么画的
 *   （`roundRect(200,150,-150,-100,[10,20,30,40])` 与「翻转坐标 + 半径做 180° 换位」逐像素一致）。
 * - 半径之和超过边长时**等比缩放**（不是各自截断）：缩放系数取四条边里最紧的那个比值。
 *   非均匀半径下两者结果不同，例如 `[60,5,60,5]` 画在 `100x50` 上要整体缩到 `0.769`，不是把 60 截成 25。
 */
export type RoundRectRadii = number | ArrayLike<number> | null | undefined;

export type RoundRectGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 归一化后的四角半径，顺序恒为 `[左上, 右上, 右下, 左下]` */
  radii: [number, number, number, number];
  /** 四角都为 0（规范：这种 `roundRect` 与 `rect` 等价） */
  plain: boolean;
};

/**
 * 把 `roundRect` 的入参归一化成「可直接展开成命令」的几何。
 *
 * 只在**路径重建**时调用（不是每帧），因此返回新对象、不做缓冲复用。
 *
 * @param x 起始点横坐标
 * @param y 起始点纵坐标
 * @param width 宽（可为负，几何按视觉方向翻转）
 * @param height 高（可为负）
 * @param radii 半径：数字 / 1~4 元数组 / 空
 */
export function resolveRoundRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: RoundRectRadii
): RoundRectGeometry {
  let tl = 0;
  let tr = 0;
  let br = 0;
  let bl = 0;

  if (typeof radii === 'number') {
    tl = tr = br = bl = radii;
  } else if (radii != null) {
    const list = radii as ArrayLike<number>;
    const n = list.length || 0;
    if (n < 1 || n > 4) {
      throw new RangeError(`${n} radii provided. Between one and four radii are necessary.`);
    }
    const at = (i: number): number => Number(list[i]);
    tl = at(0);
    tr = n > 1 ? at(1) : tl;
    // 2 个值时右下取左上、左下取右上（CSS `border-radius: a b` 的语义，真机对照过）；
    // 3 个值时右下取第三个、左下仍取右上。写错这两行不会报错，只会「角是圆的但圆错了」。
    br = n > 2 ? at(2) : tl;
    bl = n > 3 ? at(3) : tr;
  }

  // NaN / Infinity → 0（与原生观感一致：画成直角矩形）
  tl = Number.isFinite(tl) ? tl : 0;
  tr = Number.isFinite(tr) ? tr : 0;
  br = Number.isFinite(br) ? br : 0;
  bl = Number.isFinite(bl) ? bl : 0;
  // 负数半径原生直接抛 RangeError，这里照抛 —— 静默画成直角会让调用方查很久
  if (tl < 0 || tr < 0 || br < 0 || bl < 0) {
    throw new RangeError(`Radius value ${Math.min(tl, tr, br, bl)} is negative.`);
  }

  let nx = x;
  let ny = y;
  let nw = width;
  let nh = height;
  if (nw < 0) {
    // 负宽：左边界移到 x+w，半径按视觉角换位（左上 ↔ 右上、左下 ↔ 右下）
    nx += nw;
    nw = -nw;
    const t = tl;
    tl = tr;
    tr = t;
    const u = bl;
    bl = br;
    br = u;
  }
  if (nh < 0) {
    // 负高：同理（左上 ↔ 左下、右上 ↔ 右下）
    ny += nh;
    nh = -nh;
    const t = tl;
    tl = bl;
    bl = t;
    const u = tr;
    tr = br;
    br = u;
  }

  if (tl !== 0 || tr !== 0 || br !== 0 || bl !== 0) {
    // 等比缩放：四条边各自算「这条边上的半径之和 vs 边长」，取最紧的比值（对齐 CSS border-radius）
    let scale = 1;
    const fit = (sum: number, side: number): void => {
      if (sum > 0) {
        const ratio = side / sum;
        if (ratio < scale) {
          scale = ratio;
        }
      }
    };
    fit(tl + tr, nw);
    fit(tr + br, nh);
    fit(br + bl, nw);
    fit(tl + bl, nh);
    if (scale < 1) {
      tl *= scale;
      tr *= scale;
      br *= scale;
      bl *= scale;
    }
  }

  return {
    x: nx,
    y: ny,
    width: nw,
    height: nh,
    radii: [tl, tr, br, bl],
    plain: tl === 0 && tr === 0 && br === 0 && bl === 0,
  };
}
