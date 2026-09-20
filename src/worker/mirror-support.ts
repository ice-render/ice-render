/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import root from '../cross-platform/root';
import { MIRROR_PROTOCOL_VERSION } from './mirror-protocol';

/** 镜像渲染需要、而某些运行时缺一项就跑不起来的能力。 */
export type MirrorCapability = 'worker' | 'offscreenCanvas' | 'imageBitmap';

export type MirrorSupport = {
  /** 全部必要条件齐备（缺一项就该走主线程渲染，而不是"启动了才发现画不出来"）。 */
  supported: boolean;
  /** 缺失的能力清单（空数组 = 支持）。顺序固定，便于宿主日志与断言。 */
  missing: MirrorCapability[];
  /**
   * 逐项能力（**只读**；不参与 supported 判定的项也列在这里，方便宿主上报）。
   *
   * `bitmapRenderer` 不算必要条件：没有它时 `MirrorHost` 会用 2d `drawImage` 合成，
   * 多一次拷贝、但功能不缺（见 `MirrorHost.__composite`）。
   */
  caps: {
    worker: boolean;
    offscreenCanvas: boolean;
    imageBitmap: boolean;
    bitmapRenderer: boolean;
  };
  /** 协议版本（宿主上报/排查用）。 */
  protocolVersion: number;
};

/**
 * 探测"这台运行时能不能上 worker 镜像渲染"。
 *
 * 三条都是**必要条件**，判定刻意保守 —— 宁可回退到主线程渲染（功能不缺，只是没有额外帧预算），
 * 也不要在不支持的环境里启动了再冻屏：
 *
 * - `worker`：`Worker` 构造器存在。⚠️ 存在**不代表能用**：CSP 的 `worker-src` 策略、`file://`、
 *   企业策略都会让 `new Worker()` 直接抛 —— 那一层由 `MirrorHost.start()` 的 try/catch 兜；
 * - `offscreenCanvas`：`OffscreenCanvas` + `transferToImageBitmap`。worker 里就是靠它画的，
 *   缺了等于整个机制没有落点（Safari 16.4 之前只有部分实现）；
 * - `imageBitmap`：`createImageBitmap` / `ImageBitmap` 存在。位图要跨线程 transfer、主线程要能
 *   合成它（这条在实现完整的浏览器上恒真，留着是为了把"残缺的 OffscreenCanvas 实现"筛出去）。
 *
 * @param options.canvas 仅保留签名兼容：**探测不使用它**（在那块画布上 `getContext` 会让
 *   `transferControlToOffscreen` 永久失败，见 `hasBitmapRenderer` 的说明）。
 */
export function detectMirrorSupport(options: { canvas?: any } = {}): MirrorSupport {
  const caps = {
    worker: root.workerSupported === true,
    offscreenCanvas: root.offscreenCanvasSupported === true,
    imageBitmap: root.imageBitmapSupported === true,
    bitmapRenderer: hasBitmapRenderer(),
  };
  const missing: MirrorCapability[] = [];
  if (!caps.worker) {
    missing.push('worker');
  }
  if (!caps.offscreenCanvas) {
    missing.push('offscreenCanvas');
  }
  if (!caps.imageBitmap) {
    missing.push('imageBitmap');
  }
  return { supported: missing.length === 0, missing, caps, protocolVersion: MIRROR_PROTOCOL_VERSION };
}

/**
 * 运行时有没有 `bitmaprenderer` 上下文（零拷贝合成路径；没有则退回 2d `drawImage`）。
 *
 * ⚠️ **绝不在调用方那块画布上探测**（所以这里刻意不用 `options.canvas`）：
 * `canvas.getContext()` 只要被调用过一次，那块画布就再也 `transferControlToOffscreen()` 不出去
 * （"Cannot transfer control from a canvas that has a rendering context"）——
 * 探测本身把直绘模式废掉，是 2026-09-20 实测踩到的坑。改成在一块临时画布上问"这个运行时支不支持"。
 */
function hasBitmapRenderer(): boolean {
  const scratch = createScratchCanvas();
  if (!scratch || typeof scratch.getContext !== 'function') {
    return false;
  }
  try {
    return !!scratch.getContext('bitmaprenderer');
  } catch (e) {
    // 少数宿主对未知上下文名直接抛（而不是返回 null）——探测**绝不允许**把宿主带崩
    return false;
  }
}

/** 一块**临时**画布：只用来问运行时能力，不碰调用方的任何对象。 */
function createScratchCanvas(): any {
  try {
    if (root.document && typeof root.document.createElement === 'function') {
      const canvas = root.document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas;
    }
    if (typeof root.OffscreenCanvas === 'function') {
      return new root.OffscreenCanvas(1, 1);
    }
  } catch (e) {
    /* 拿不到就拿不到：bitmapRenderer 非致命，保守为 false */
  }
  return null;
}

/** 把 `missing` 渲染成一句人能读的原因（日志/回退回调里用）。 */
export function describeMirrorSupport(support: MirrorSupport): string {
  if (support.supported) {
    return support.caps.bitmapRenderer ? '支持（零拷贝合成）' : '支持（2d 合成路径）';
  }
  const names: Record<MirrorCapability, string> = {
    worker: 'Worker',
    offscreenCanvas: 'OffscreenCanvas/transferToImageBitmap',
    imageBitmap: 'ImageBitmap',
  };
  return `缺少 ${support.missing.map((key) => names[key]).join('、')}`;
}
