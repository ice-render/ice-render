/**
 * 分层渲染的**位图合成**：把多张分层 canvas 按顺序叠成一张图（导出 PNG / 截图 / 缩略图）。
 *
 * 背景：分层（静态层 + 动画层）是**多张 canvas 元素**，浏览器把它们合成给用户看，
 * 但 `ice.toDataURL()` 只拿得到**自己那一层**。要导出"用户看到的整张图"，必须按层序叠一次。
 *
 * 与 `exportSvg([layers])` 的分工：SVG 走矢量（引擎重新描述命令流），本模块走**光栅**
 * （把各层 canvas 的像素 `drawImage` 叠加）—— 前者清晰可缩放，后者与屏幕所见逐像素一致。
 *
 * 跨运行时：依赖 `root.createOffscreenCanvas`（浏览器 / 小程序 / Node 由各平台的 root 提供）；
 * 运行时没有离屏画布能力时抛 `ICE_UNSUPPORTED_RUNTIME`（稳定错误码，便于应用层兜底）。
 */
import root from '../cross-platform/root';
import { ICE_ERROR_CODES, iceError } from '../util/errors';

export type ComposeLayersOptions = {
  /** 输出类型（`toDataURL` 的 MIME），默认 `image/png` */
  type?: string;
  /** 有损格式的质量 0~1（`image/jpeg` / `image/webp` 用） */
  quality?: number;
  /** 背景色（如 `'#ffffff'`）。缺省不铺背景 → 保留透明度（分层图通常需要透明背景） */
  background?: string | null;
  /** 输出尺寸（缺省 = 各层 canvas 中最大的那一份，单位：**设备像素**） */
  width?: number;
  height?: number;
};

/** 取一层的 canvas 元素与它的设备像素尺寸。 */
function layerCanvas(layer: any): { canvas: any; width: number; height: number } | null {
  const el: any = layer && layer.canvasEl;
  if (!el || typeof el.width !== 'number' || typeof el.height !== 'number') {
    return null;
  }
  return { canvas: el, width: el.width, height: el.height };
}

/**
 * 把多层 canvas 叠到一张离屏画布上（按数组顺序，第一层在最下面）。
 *
 * @returns `{ canvas, ctx, width, height }`；运行时没有离屏画布能力时抛 `ICE_UNSUPPORTED_RUNTIME`。
 */
export function composeLayersToCanvas(
  layers: any[],
  options: ComposeLayersOptions = {}
): { canvas: any; ctx: any; width: number; height: number } {
  const list = Array.isArray(layers) ? layers : [layers];
  const sources: Array<{ canvas: any; width: number; height: number }> = [];
  for (let i = 0; i < list.length; i++) {
    const entry = layerCanvas(list[i]);
    if (entry) {
      sources.push(entry);
    }
  }
  const width = Math.max(
    1,
    Math.floor(
      Number(options.width) > 0 ? Number(options.width) : Math.max.apply(null, sources.map((s) => s.width).concat([0]))
    )
  );
  const height = Math.max(
    1,
    Math.floor(
      Number(options.height) > 0
        ? Number(options.height)
        : Math.max.apply(null, sources.map((s) => s.height).concat([0]))
    )
  );

  if (typeof (root as any).createOffscreenCanvas !== 'function') {
    throw iceError(
      ICE_ERROR_CODES.OFFSCREEN_CANVAS_UNSUPPORTED,
      'composeLayersToCanvas 需要离屏画布能力（root.createOffscreenCanvas）'
    );
  }
  const { canvas, ctx } = (root as any).createOffscreenCanvas(width, height);
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, width, height);
  }
  for (let i = 0; i < sources.length; i++) {
    ctx.drawImage(sources[i].canvas, 0, 0);
  }
  return { canvas, ctx, width, height };
}

/**
 * 多层合成为一张图（DataURL）。
 *
 * ```js
 * const png = composeLayersDataURL([staticIce, animIce], { background: '#fff' });
 * ```
 */
export function composeLayersDataURL(layers: any[], options: ComposeLayersOptions = {}): string {
  const { canvas } = composeLayersToCanvas(layers, options);
  return canvas.toDataURL(options.type || 'image/png', options.quality);
}
