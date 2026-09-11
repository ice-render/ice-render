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
  // 无 rAF 的运行时兜底（Node / headless 出图 / 小程序低版本基础库）：
  // 否则 `FrameManager.start()` 会调用 undefined 直接抛错，引擎在这些环境里连启动都做不到。
  // 用定时器模拟一帧循环（浏览器早期 rAF polyfill 的经典做法）。
  // 注意：headless 出图通常只需手动渲染一次，这里只保证帧循环可用、不崩。
  if (typeof root.requestFrame !== 'function') {
    root.requestFrame = function (callback: any) {
      return setTimeout(function () {
        callback(Date.now());
      }, 16);
    };
  }
  // 创建路径对象：优先用运行时自带的 Path2D（浏览器/小程序基础库 2.11.0+），
  // 否则降级为 PolyfillPath2D（命令记录 + 渲染时重放），兼容小程序低版本 / Node。
  root.createPath2D = () => {
    if (typeof root.Path2D === 'function') {
      return new root.Path2D();
    }
    return new PolyfillPath2D();
  };
  // 字体加载：平台适配（浏览器 FontFace API / 小程序 wx.loadFont / 兜底空实现）。
  root.loadFont = (family: string, source: string) => {
    if (typeof root.FontFace === 'function' && root.document && root.document.fonts) {
      const face = new root.FontFace(family, source);
      root.document.fonts.add(face);
      return face.load();
    }
    if (root.wx && typeof root.wx.loadFont === 'function') {
      return root.wx.loadFont(source);
    }
    return Promise.resolve();
  };
  // 创建图片对象：优先用运行时自带的 Image（浏览器 window.Image），
  // 小程序走 wx.createImage，二者皆无则抛出明确错误（ImageCache 依赖此方法）。
  root.createImage = () => {
    if (typeof root.Image === 'function') {
      return new root.Image();
    }
    if (root.wx && typeof root.wx.createImage === 'function') {
      return root.wx.createImage();
    }
    throw new Error('当前运行时没有可用的 Image 构造器，无法加载图片。');
  };
  // 设备像素比：浏览器 window.devicePixelRatio，小程序 wx.getSystemInfoSync().pixelRatio，兜底 1。
  // 离屏缓存用它把逻辑尺寸换算成物理像素，避免高分屏位图发糊。
  if (typeof root.devicePixelRatio !== 'number' || !(root.devicePixelRatio > 0)) {
    root.devicePixelRatio = (() => {
      if (root.wx && typeof root.wx.getSystemInfoSync === 'function') {
        try {
          return root.wx.getSystemInfoSync().pixelRatio || 1;
        } catch (err) {
          return 1;
        }
      }
      return 1;
    })();
  }
  // 创建离屏 canvas（对象缓存用，与 Worker/OffscreenCanvas 无关，仍运行在当前线程）。
  // 浏览器用 document.createElement('canvas')，小程序用 wx.createOffscreenCanvas({type:'2d'})。
  root.createOffscreenCanvas = (width: number, height: number) => {
    if (root.wx && typeof root.wx.createOffscreenCanvas === 'function') {
      const canvas = root.wx.createOffscreenCanvas({ type: '2d', width, height });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('当前运行时无法创建 2d 离屏上下文。');
      return { canvas, ctx };
    }
    if (root.document && typeof root.document.createElement === 'function') {
      const canvas = root.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('当前运行时无法创建 2d 离屏上下文。');
      return { canvas, ctx };
    }
    throw new Error('当前运行时没有可用的离屏 canvas。');
  };
})();
export default root;
