/**
 * 分层位图合成（`composeLayersToCanvas` / `composeLayersDataURL`）的回归。
 *
 * 这是分层渲染配套的**光栅**导出：`ice.toDataURL()` 只拿得到自己那一层，
 * 要导出"用户看到的整张图"必须按层序把各层 canvas 叠一次。
 * 逐像素的正确性放真实浏览器验（`e2e/visual/layered.spec.ts`），这里钉住的是
 * 调用契约：层序、尺寸取最大、背景、缺能力时的稳定错误码。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  const root: any = { createPath2D: () => new Path2DRecorder() };
  return { __esModule: true, default: root, __root: root };
});

import root from '../../src/cross-platform/root';
import { composeLayersToCanvas, composeLayersDataURL } from '../../src/export/compose-layers';
import { getICEErrorCode } from '../../src/util/errors';

/** 造一个假的"层"：与真实用法一致 —— 传的就是 ICE 实例，合成只读它的 `canvasEl`。 */
function makeLayer(id: string, width: number, height: number) {
  return { canvasEl: { id, width, height } } as any;
}

function installOffscreen(record: any[]) {
  (root as any).createOffscreenCanvas = (w: number, h: number) => {
    const ctx: any = {
      fillStyle: '',
      drawImage: (src: any, x: number, y: number) => record.push({ kind: 'drawImage', src: src.id, x, y }),
      fillRect: (x: number, y: number, width: number, height: number) =>
        record.push({ kind: 'fillRect', fillStyle: ctx.fillStyle, x, y, width, height }),
    };
    const canvas: any = {
      width: w,
      height: h,
      toDataURL: (type?: string) => `data:${type || 'image/png'};base64,FAKE(${w}x${h})`,
    };
    record.push({ kind: 'createOffscreenCanvas', w, h });
    return { canvas, ctx };
  };
}

describe('分层位图合成', () => {
  it('按数组顺序叠加，尺寸取各层最大的一份', () => {
    const record: any[] = [];
    installOffscreen(record);
    const a = makeLayer('static', 800, 600);
    const b = makeLayer('anim', 800, 600);

    const out = composeLayersToCanvas([a, b]);
    expect(out.width).toBe(800);
    expect(out.height).toBe(600);
    const draws = record.filter((r) => r.kind === 'drawImage').map((r) => r.src);
    expect(draws).toEqual(['static', 'anim']); // 第一层在下，依次叠
    expect(record.some((r) => r.kind === 'fillRect')).toBe(false); // 没给背景就不铺
  });

  it('尺寸不等时取最大；可显式指定输出尺寸', () => {
    const record: any[] = [];
    installOffscreen(record);
    const small = makeLayer('small', 400, 300);
    const large = makeLayer('large', 1024, 768);

    const auto = composeLayersToCanvas([small, large]);
    expect([auto.width, auto.height]).toEqual([1024, 768]);

    const explicit = composeLayersToCanvas([small, large], { width: 512, height: 512 });
    expect([explicit.width, explicit.height]).toEqual([512, 512]);
  });

  it('给了背景就先铺底（再叠层）', () => {
    const record: any[] = [];
    installOffscreen(record);
    composeLayersToCanvas([makeLayer('a', 10, 10)], { background: '#ffffff' });
    const ops = record.map((r) => r.kind);
    expect(ops).toEqual(['createOffscreenCanvas', 'fillRect', 'drawImage']);
    expect(record[1].fillStyle).toBe('#ffffff');
  });

  it('dataURL：默认 PNG、可换类型；层里没有可用 canvas 时退化为 1x1', () => {
    const record: any[] = [];
    installOffscreen(record);
    expect(composeLayersDataURL([makeLayer('a', 20, 10)])).toContain('data:image/png');
    expect(composeLayersDataURL([makeLayer('a', 20, 10)], { type: 'image/jpeg', quality: 0.8 })).toContain(
      'data:image/jpeg'
    );
    expect(composeLayersDataURL([{} as any])).toContain('1x1');
  });

  it('运行时没有离屏画布能力 → 抛稳定错误码（应用层可据此兜底）', () => {
    const previous = (root as any).createOffscreenCanvas;
    delete (root as any).createOffscreenCanvas;
    let code = null;
    try {
      composeLayersToCanvas([makeLayer('a', 10, 10)]);
    } catch (err: any) {
      code = getICEErrorCode(err);
    } finally {
      (root as any).createOffscreenCanvas = previous;
    }
    expect(code).toBe('ICE_OFFSCREEN_CANVAS_UNSUPPORTED');
  });
});
