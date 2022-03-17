/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * 来源：https://github.com/AndrewRayCode/easing-utils/blob/master/src/easing.js
 * 一组缓动工具函数
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const Easing = {
  /**
   * 线性变化
   * @param from 起始值
   * @param to  终止值
   * @param duration 持续时间，ms
   * @param startTime 动画开始时间
   */
  linear: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    return from + (deltaValue / duration) * deltaT;
  },

  easeInQuad: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    return from + (deltaValue / duration) * (deltaT / duration) * deltaT;
  },

  easeOutQuad: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    return -deltaValue * (deltaT /= duration) * (deltaT - 2) + from;
  },

  easeInOutQuad: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    if ((deltaT /= duration / 2) < 1) return (deltaValue / 2) * deltaT * deltaT + from;
    return (-deltaValue / 2) * (--deltaT * (deltaT - 2) - 1) + from;
  },

  easeInQuart: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    return deltaValue * (deltaT /= duration) * deltaT * deltaT * deltaT + from;
  },

  easeOutQuart: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    return -deltaValue * ((deltaT = deltaT / duration - 1) * deltaT * deltaT * deltaT - 1) + from;
  },

  easeInOutQuart: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    if ((deltaT /= duration / 2) < 1) return (deltaValue / 2) * deltaT * deltaT * deltaT * deltaT + from;
    return (-deltaValue / 2) * ((deltaT -= 2) * deltaT * deltaT * deltaT - 2) + from;
  },

  easeInCubic: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    return deltaValue * (deltaT /= duration) * deltaT * deltaT + from;
  },

  easeOutCubic: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    return deltaValue * ((deltaT = deltaT / duration - 1) * deltaT * deltaT + 1) + from;
  },

  easeInOutCubic: function (from: number, to: number, duration: number, startTime: number) {
    let deltaT = Date.now() - startTime;
    let deltaValue = to - from;
    if ((deltaT /= duration / 2) < 1) return (deltaValue / 2) * deltaT * deltaT * deltaT + from;
    return (deltaValue / 2) * ((deltaT -= 2) * deltaT * deltaT + 2) + from;
  },

  //TODO:增加更多缓动算法
};
export default Easing;
