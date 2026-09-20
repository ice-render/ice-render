/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import Path2DRecorder from './Path2DRecorder';
import { ICE_ERROR_CODES, iceError } from '../util/errors';

/**
 * 兼容性封装
 * ! TODO: import https://www.npmjs.com/package/canvas for nodejs platform.
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
let root: any = null;
(() => {
  /**
   * 取全局对象：**一律用 `globalThis`**。
   *
   * 三种宿主的 `globalThis` 分别是 window（浏览器）/ self（Web Worker）/ global（Node），
   * 而 `globalThis` 是 ES2020 的标准入口，三边都在。
   *
   * 改造前是 `typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {}`
   * —— 这个双探测里没有 **Web Worker** 的位置：worker 里既没有 `window` 也没有 `global`，
   * 于是取到的是那个兜底空对象 `{}`，引擎在里面连 `Path2D` / `OffscreenCanvas` / `devicePixelRatio`
   * 都看不见（`examples/performance/worker-min.js` 当年就是靠 `self.window = self` 先伪造全局才跑通的）。
   * 用 `globalThis` 之后，worker 作为**一等宿主**进来了，宿主不再需要给引擎打补丁。
   *
   * ⚠️ 空对象兜底仍然保留：极简测试桩可能把 `globalThis` 也摘掉，那时至少别在导入期就抛。
   */
  const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
  root = g || {};
  root.requestFrame =
    root.requestAnimationFrame ||
    root.webkitRequestAnimationFrame ||
    root.mozRequestAnimationFrame ||
    root.oRequestAnimationFrame ||
    root.msRequestAnimationFrame;
  // 无 rAF 的运行时兜底（Node / headless 出图）：
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
  // 创建路径对象：统一返回 Path2DRecorder —— 一边记录命令流、一边转发给运行时的原生 Path2D。
  // 没有原生 Path2D 的运行时（headless / 测试桩）退化为纯记录器：命令流照旧可用（导出、断言），
  // 但**不再自己重放命令去上屏**（"没有 Path2D 也要能画"的那条支路，2026-09-20 已删）。
  //
  // 之所以一律走记录器：原生 Path2D 不透明，导出（SVG/服务端出图）、命令重放、以及
  // 「断言形状生成了哪几条命令」都需要路径的几何描述，而不只是「能画出来」。
  root.createPath2D = () => {
    if (typeof root.Path2D === 'function') {
      return new Path2DRecorder(new root.Path2D());
    }
    return new Path2DRecorder();
  };
  // 字体加载：浏览器 FontFace API；没有则兜底空实现（headless / 测试桩）。
  root.loadFont = (family: string, source: string) => {
    if (typeof root.FontFace === 'function' && root.document && root.document.fonts) {
      const face = new root.FontFace(family, source);
      root.document.fonts.add(face);
      return face.load();
    }
    return Promise.resolve();
  };
  // 创建图片对象：用运行时自带的 Image（浏览器 window.Image / Node 里的实现），
  // 没有则抛出明确错误（ImageCache 依赖此方法）。
  root.createImage = () => {
    if (typeof root.Image === 'function') {
      return new root.Image();
    }
    throw iceError(ICE_ERROR_CODES.IMAGE_CONSTRUCTOR_MISSING, '当前运行时没有可用的 Image 构造器，无法加载图片。');
  };
  // 设备像素比：`window.devicePixelRatio`，兜底 1（headless / 测试桩）。
  // 离屏缓存用它把逻辑尺寸换算成物理像素，避免高分屏位图发糊。
  if (typeof root.devicePixelRatio !== 'number' || !(root.devicePixelRatio > 0)) {
    root.devicePixelRatio = 1;
  }
  // 创建离屏 canvas（对象缓存 / 静态层用，在当前线程内使用，不涉及跨线程）。
  /**
   * 把主画布的**文本绘制语言**镜像到离屏画布上。
   *
   * 为什么需要：同一个汉字有多种字形（简/繁/日/韩），Canvas 按元素的**语言**选字形
   * —— 也就是说 `lang="ja"` 与 `lang="zh-CN"` 画出来的「直 / 骨 / 海」不是同一批字形。
   * 而引擎对静态层/组件缓存承诺「与主画布**逐像素一致**」（脏矩形与离屏缓存都建立在这条上），
   * 主画布上显式写了 `lang` 而离屏层没有的话，两者的字形就会分叉 —— 这种差异在
   * 汉字上只有几个像素，肉眼极难发现，却会让像素回归在最不该红的时候红。
   *
   * 兼容性：`lang` 是 2025 年（Chrome 136）才进 CanvasTextDrawingStyles 的，
   * Safari 至今没有；`dir` 则一直都有。所以这里**只是把属性写上**，不支持它的运行时会忽略。
   */
  const mirrorTextLanguage = (canvas: any, sourceEl: any) => {
    if (!canvas || !sourceEl) {
      return canvas;
    }
    if (!canvas.lang && sourceEl.lang) {
      canvas.lang = sourceEl.lang;
    }
    if (!canvas.dir && sourceEl.dir) {
      canvas.dir = sourceEl.dir;
    }
    return canvas;
  };

  root.createOffscreenCanvas = (width: number, height: number, sourceEl?: any) => {
    if (root.document && typeof root.document.createElement === 'function') {
      const canvas = root.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      // 元素默认继承 document 的语言；这里显式跟随**主画布**，宿主在 canvas 上写 lang 时才有意义
      mirrorTextLanguage(canvas, sourceEl);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw iceError(ICE_ERROR_CODES.OFFSCREEN_CONTEXT_UNSUPPORTED, '当前运行时无法创建 2d 离屏上下文。');
      }
      return { canvas, ctx };
    }
    /**
     * 没有 DOM 但**有 `OffscreenCanvas`** 的宿主：Web Worker（以及将来的纯离屏宿主）。
     *
     * 顺序刻意是「document 优先」：浏览器主线程上，`<canvas>` 元素能带上 `lang` / `dir`
     * （见 `mirrorTextLanguage` —— 汉字的简/繁/日字形选择靠它，静态层与组件缓存对它的依赖
     * 写在那段注释里），而 `OffscreenCanvas` 没有这两个属性，换过去等于把字形口径弄丢。
     * worker 里则相反：没有 DOM 可选，`OffscreenCanvas` 是唯一出路。
     *
     * ⚠️ 已知边界（见 docs/architecture/10-worker-offscreen.md §2）：worker 里拿不到
     * 主画布的 `lang`，CJK 字形可能与主线程分叉；v0 的结论是"文本量测/字形口径留在主线程，
     * worker 只跑几何"。这里不阻止它，只是不假装等价。
     */
    if (typeof root.OffscreenCanvas === 'function') {
      const canvas = new root.OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw iceError(ICE_ERROR_CODES.OFFSCREEN_CONTEXT_UNSUPPORTED, '当前运行时无法创建 2d 离屏上下文。');
      }
      return { canvas, ctx };
    }
    throw iceError(ICE_ERROR_CODES.OFFSCREEN_CANVAS_UNSUPPORTED, '当前运行时没有可用的离屏 canvas。');
  };
})();
export default root;
