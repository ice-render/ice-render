/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * 一组缓动工具函数
 *
 * 本文件有两层：
 *
 * ① `EasingProgress`：**归一化进度函数**，定义域 [0,1]（时间占比），值域通常为 [0,1]，
 *    弹簧这类缓动会短暂越过 1（过冲）。纯函数、不读时钟 —— 关键帧的**段内缓动**
 *    需要一个可按任意局部进度求值的函数，用它才能避免「合成 startTime」式的硬凑。
 *
 * ② `Easing`：对外保持历史上的**值**语义签名 `(from, to, duration, startTime)`，
 *    内部自读 `Date.now()`。其中 9 个函数是与既有实现逐字一致的转写（刻意不改），
 *    `tests/animation/easing-progress.test.ts` 在网格上锁定它们与 `EasingProgress`
 *    的等价关系（实测最大偏差 < 1e-12），防止两层实现漂移。
 *
 * 原始来源：https://github.com/AndrewRayCode/easing-utils/blob/master/src/easing.js
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */

/** 归一化进度函数：t 为时间占比（0 → 起点，1 → 终点），返回进度（弹簧类可 > 1 表示过冲）。 */
export type EasingProgress = (t: number) => number;

/**
 * 弹簧（阻尼谐振子）进度工厂。
 *
 * 用欠阻尼弹簧从「偏移 -1」回到平衡位置的解析解（ω₀ 归一化为 1）：
 *
 *   p(t) = 1 - e^(-ζ·t·span)·[cos(ω_d·t·span) + (ζ/ω_d)·sin(ω_d·t·span)]，ω_d = √(1-ζ²)
 *
 * `span` 把归一化时间拉伸到「能收敛」的区间，各预设经数值标定，使 p(1) 与 1 的偏差 < 2e-3
 * （到点后由动画管理器精确落到终点值，不留残差）。ζ 越小过冲越明显。
 *
 * 注意：正因为中途会 > 1（值越过终点再回落），动画管理器判定「是否结束」必须按**时间**
 * 而不是「值是否越过 to」，否则第一帧过冲就会被误判成结束。
 */
function springProgress(zeta: number, span: number): EasingProgress {
  const decay = zeta; // ω₀ = 1
  const wd = Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  return (t: number) => {
    const s = Math.max(0, t) * span;
    return 1 - Math.exp(-decay * s) * (Math.cos(wd * s) + (decay / wd) * Math.sin(wd * s));
  };
}

export const EasingProgress: { [name: string]: EasingProgress } = {
  linear: (t) => t,

  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * Math.pow(1 - t, 4)),

  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  // 弹簧类：ζ 与 span 的组合决定手感（过冲峰值实测约 1.13 / 1.03 / 1.25）
  spring: springProgress(0.55, 12),
  springSoft: springProgress(0.75, 14),
  springSnappy: springProgress(0.4, 9),
};

const Easing: { [name: string]: (from: number, to: number, duration: number, startTime: number) => number } = {
  /**
   * 线性变化
   * @param from 起始值
   * @param to  终止值
   * @param duration 持续时间，ms
   * @param startTime 动画开始时间
   */
  linear: function (from: number, to: number, duration: number, startTime: number) {
    const deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    return from + (deltaValue / duration) * deltaT;
  },

  easeInQuad: function (from: number, to: number, duration: number, startTime: number) {
    const deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    return from + (deltaValue / duration) * (deltaT / duration) * deltaT;
  },

  easeOutQuad: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    return -deltaValue * (deltaT /= duration) * (deltaT - 2) + from;
  },

  easeInOutQuad: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    if ((deltaT /= duration / 2) < 1) return (deltaValue / 2) * deltaT * deltaT + from;
    return (-deltaValue / 2) * (--deltaT * (deltaT - 2) - 1) + from;
  },

  easeInQuart: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    return deltaValue * (deltaT /= duration) * deltaT * deltaT * deltaT + from;
  },

  easeOutQuart: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    return -deltaValue * ((deltaT = deltaT / duration - 1) * deltaT * deltaT * deltaT - 1) + from;
  },

  easeInOutQuart: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    if ((deltaT /= duration / 2) < 1) return (deltaValue / 2) * deltaT * deltaT * deltaT * deltaT + from;
    return (-deltaValue / 2) * ((deltaT -= 2) * deltaT * deltaT * deltaT - 2) + from;
  },

  easeInCubic: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    return deltaValue * (deltaT /= duration) * deltaT * deltaT + from;
  },

  easeOutCubic: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    return deltaValue * ((deltaT = deltaT / duration - 1) * deltaT * deltaT + 1) + from;
  },

  easeInOutCubic: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    const deltaValue = to - from;
    if ((deltaT /= duration / 2) < 1) return (deltaValue / 2) * deltaT * deltaT * deltaT + from;
    return (deltaValue / 2) * ((deltaT -= 2) * deltaT * deltaT + 2) + from;
  },

  /**
   * 弹簧类缓动：`duration` 语义为「标称收敛时长」。
   * 与上面 9 个不同，这几个是对 `EasingProgress` 的适配（进度函数才是唯一实现），
   * 因此天然带过冲 —— 值可能越过 `to` 再回落。
   */
  spring: function (from: number, to: number, duration: number, startTime: number) {
    return from + (to - from) * EasingProgress.spring((Date.now() - startTime) / duration);
  },

  springSoft: function (from: number, to: number, duration: number, startTime: number) {
    return from + (to - from) * EasingProgress.springSoft((Date.now() - startTime) / duration);
  },

  springSnappy: function (from: number, to: number, duration: number, startTime: number) {
    return from + (to - from) * EasingProgress.springSnappy((Date.now() - startTime) / duration);
  },
};
export default Easing;
