/**
 * 「小程序形状」的测试环境：把浏览器 / Node 专有的全局全部摘掉，只留 `wx.*`。
 *
 * 为什么需要它：引擎的跨平台适配层（`src/cross-platform/root.ts`）在**模块加载时**读取全局对象，
 * 所以调用方必须「先 install、后 require 引擎」：
 *
 * ```ts
 * import { installMiniProgramEnv } from './env';
 * const env = installMiniProgramEnv();      // 1. 先搭环境
 * const engine = require('../../src');      // 2. 再加载引擎
 * ```
 *
 * 这里刻意不 import 任何 src 代码 —— 否则会把浏览器版本的适配层先拉进来。
 */

const BROWSER_GLOBALS = [
  'document',
  'window',
  'navigator',
  'Image',
  'FontFace',
  'Path2D',
  'OffscreenCanvas',
  'devicePixelRatio',
  'requestAnimationFrame',
  'webkitRequestAnimationFrame',
  'mozRequestAnimationFrame',
  'msRequestAnimationFrame',
];

/** 小程序 Canvas 2D 上下文实际提供的成员（引擎只能碰这些） */
const CANVAS_2D_METHODS = [
  'save',
  'restore',
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arc',
  'arcTo',
  'rect',
  'clip',
  'fill',
  'stroke',
  'clearRect',
  'fillRect',
  'strokeRect',
  'fillText',
  'strokeText',
  'drawImage',
  'setLineDash',
  'setTransform',
  'scale',
  'translate',
  'rotate',
  'transform',
  'resetTransform',
  'quadraticCurveTo',
  'bezierCurveTo',
  'ellipse',
  'createImageData',
  'getImageData',
  'putImageData',
  'isPointInPath',
];

/** 引擎会用 `typeof` 探测这些成员是否存在，不算越界调用 */
const PROBE_KEYS = [
  'getContext',
  'getBoundingClientRect',
  'then',
  'toJSON',
  'inspect',
  'constructor',
  'nodeType',
  'style',
  'parentNode',
  'ownerDocument',
  'createConicGradient',
  'createLinearGradient',
  'createRadialGradient',
  'createPattern',
];

export type FakeCanvasOptions = {
  /** 是否补 `getBoundingClientRect`（真实小程序 canvas 节点**没有**这个方法） */
  withRect?: boolean;
  /**
   * 模拟**老基础库**：`measureText()` 只返回 `width`，没有 `actualBoundingBoxAscent/Descent`。
   * 引擎遇到这种运行时会退到 DOM 量测，而小程序里没有 DOM —— 必须优雅降级。
   */
  legacyTextMetrics?: boolean;
};

export type MiniProgramEnv = {
  /** 记录所有创建过的 ctx（含离屏） */
  ctxs: any[];
  /** 统计：离屏 canvas / 字体加载 / 图片创建 */
  stats: { offscreen: number; fontLoad: number; image: number };
  makeCanvas(width?: number, height?: number, options?: FakeCanvasOptions): any;
  /** 所有 ctx 的命令并集 */
  allCalls(): string[];
  /** 引擎访问过的、不属于小程序子集的成员 */
  unknownAccesses(): string[];
  restore(): void;
};

export function installMiniProgramEnv(): MiniProgramEnv {
  const originals = new Map<string, { had: boolean; value: any }>();
  BROWSER_GLOBALS.forEach((key) => {
    originals.set(key, { had: key in (global as any), value: (global as any)[key] });
    try {
      Object.defineProperty(global, key, { value: undefined, configurable: true, writable: true });
    } catch (err) {
      /* 只读全局，忽略 */
    }
  });

  const ctxs: any[] = [];
  const stats = { offscreen: 0, fontLoad: 0, image: 0 };

  function makeCtx(options: FakeCanvasOptions = {}): any {
    const calls: string[] = [];
    const unknown: string[] = [];
    const ctx: any = {
      __calls: calls,
      __unknown: unknown,
      canvas: null,
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      font: '10px sans-serif',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      shadowBlur: 0,
      shadowColor: 'transparent',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      lineDashOffset: 0,
      measureText: (text: any) => {
        const width = String(text).length * 8;
        // 现代基础库 / Canvas 2D 规范：带字形墨迹上下界，引擎据此量测，不需要 DOM
        if (options.legacyTextMetrics) return { width };
        return { width, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 3 };
      },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      createPattern: () => ({}),
    };
    CANVAS_2D_METHODS.forEach((name) => {
      ctx[name] = function () {
        calls.push(name);
      };
    });
    return new Proxy(ctx, {
      get(target, key) {
        if (key in target) return target[key];
        if (typeof key === 'string') unknown.push(key);
        return undefined;
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    });
  }

  function makeCanvas(width = 750, height = 600, options: FakeCanvasOptions = {}): any {
    const ctx = makeCtx(options);
    // 真实小程序 canvas 节点：width / height / getContext —— 没有 getBoundingClientRect、style、addEventListener
    const canvas: any = { width, height, getContext: () => ctx };
    if (options.withRect) {
      canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width,
        height,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
      });
    }
    ctx.canvas = canvas;
    ctxs.push(ctx);
    return canvas;
  }

  (global as any).wx = {
    getSystemInfoSync: () => ({ pixelRatio: 2, platform: 'devtools' }),
    createOffscreenCanvas: ({ width, height }: any) => {
      stats.offscreen += 1;
      return makeCanvas(width, height);
    },
    loadFont: () => {
      stats.fontLoad += 1;
      return Promise.resolve('ok');
    },
    createImage: () => {
      stats.image += 1;
      return { src: '', width: 0, height: 0 };
    },
  };

  return {
    ctxs,
    stats,
    makeCanvas,
    allCalls: () => ctxs.reduce((acc: string[], ctx) => acc.concat(ctx.__calls), [] as string[]),
    unknownAccesses: () => {
      const all = ctxs.reduce((acc: string[], ctx) => acc.concat(ctx.__unknown), [] as string[]);
      return Array.from(new Set(all)).filter((key) => PROBE_KEYS.indexOf(key) < 0);
    },
    restore: () => {
      originals.forEach((original, key) => {
        if (original.had) {
          (global as any)[key] = original.value;
        } else {
          delete (global as any)[key];
        }
      });
      delete (global as any).wx;
      ctxs.length = 0;
    },
  };
}

/** 等到帧循环（无 rAF 时是定时器兜底）至少跑过一帧 */
export function waitFrames(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
