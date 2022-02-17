/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
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

  //TODO:增加更多缓动算法
};
export default Easing;
