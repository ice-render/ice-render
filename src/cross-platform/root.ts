/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import PolyfillPath2D from './PolyfillPath2D';

/**
 * 兼容性封装
 * ! TODO: import https://www.npmjs.com/package/canvas for nodejs platform.
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const FPS = 60;
let root: any = null;
(() => {
  // 浏览器用 window，Node/小程序用 global，兜底空对象（typeof 守卫避免 Node 下 window 未定义报错）
  const g: any = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {};
  root = g || {};
  root.requestFrame =
    root.requestAnimationFrame ||
    root.webkitRequestAnimationFrame ||
    root.mozRequestAnimationFrame ||
    root.oRequestAnimationFrame ||
    root.msRequestAnimationFrame;
  // 创建路径对象：优先用运行时自带的 Path2D（浏览器/小程序基础库 2.11.0+），
  // 否则降级为 PolyfillPath2D（命令记录 + 渲染时重放），兼容小程序低版本 / Node。
  root.createPath2D = () => {
    if (typeof root.Path2D === 'function') {
      return new root.Path2D();
    }
    return new PolyfillPath2D();
  };
})();
export default root;
