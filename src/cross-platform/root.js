/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * 兼容性封装
 * ! TODO: import https://www.npmjs.com/package/canvas for nodejs platform.
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const FPS = 60;
let root = null;
(() => {
  root = window || global || {};
  root.requestFrame =
    root.requestAnimationFrame ||
    root.webkitRequestAnimationFrame ||
    root.mozRequestAnimationFrame ||
    root.oRequestAnimationFrame ||
    root.msRequestAnimationFrame;

  // ||
  // function (callback) {
  //   root.setTimeout(callback, 1000 / FPS);
  // };
})();
export default root;
