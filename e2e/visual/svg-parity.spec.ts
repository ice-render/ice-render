/**
 * SVG 导出与画布渲染的**一致性回归**（永久）。
 *
 * 做法：在真实浏览器里把同一份场景
 *   1) 取画布像素；
 *   2) `ice.toSvg({ area: 'viewport' })` 导出，塞进 <img> 由浏览器自己栅格化；
 *   3) 两图逐像素比对。
 *
 * 判据（关键）：**排除文本组件区域之后**，差异像素占比要低于阈值。
 * 为什么排除文本：canvas 的 fillText 与 SVG 的 <text> 是两套字形栅格化（hinting / AA / 基线定义），
 * 同样的字、同样的位置也会有成片的像素差 —— 那是渲染器差异，不是我们的 bug。
 * 几何、配色、圆角、渐变、阴影、透明度则应当逐像素一致（实测 0.00%~0.13%，留 0.5% 余量）。
 *
 * 这个用例是这次「导出功能」在浏览器里抓 bug 抓出来的：它当场揪出
 * ① `style.globalAlpha` 没进 SVG；② `ice.createLinearGradient()` 造的渐变完全导不出来
 * （根因在 merge 的 isPlainObject 把 CanvasGradient 剥成了 {addColorStop}）。
 */
import { test, expect } from '@playwright/test';

/**
 * 示例页把 `ice` 声明在脚本顶层 —— 那是**全局词法绑定**（不是 window 属性），
 * 因此在 page.evaluate 里直接引用标识符可用，`window.ice` 反而拿不到。
 */
declare const ice: any;

/** 非文本区域的差异比例上限（%）；超了就是几何/样式口径出问题 */
const NON_TEXT_DIFF_LIMIT = 0.5;

const PAGES: Array<{ name: string; rel: string; includeTools?: boolean; limit?: number }> = [
  { name: 'dashboard（卡片 / 阴影 / 文本）', rel: 'examples/layout/dashboard.html' },
  { name: 'shapes-style（虚线 / 渐变 / 阴影 / 透明度）', rel: 'examples/shapes/shapes-style-effects.html' },
  { name: 'text-multiline（多行文本）', rel: 'examples/text/text-multiline.html' },
  { name: 'line-visio（连线与标签）', rel: 'examples/line-and-link/line-visio.html' },
  // 连线标签是 PolyLine.drawLabel() 用 fillText 直接画的（不是独立子组件），
  // 导出器必须显式问它 —— 这一页专门盯这个（例：流程图「是/否」、BPMN 条件流标签）
  { name: 'link-label（连线标签）', rel: 'examples/line-and-link/link-label.html' },
  // 这页故意放了工具层演示 includeTools；导出时必须显式带上才与画布一致。
  // 它还带阴影 + 工具层虚线框，边缘 AA 的天然余量更大，单独放宽。
  { name: 'svg-export 示例页（含工具层）', rel: 'examples/export/svg-export.html', includeTools: true, limit: 1.8 },
];

test('SVG 导出与画布逐像素一致（排除文本字形栅格化）', async ({ page }) => {
  test.setTimeout(120_000);
  const failures: string[] = [];

  for (const item of PAGES) {
    const errs: string[] = [];
    const onErr = (m: any) => errs.push(String(m && m.message ? m.message : m).slice(0, 200));
    page.on('pageerror', onErr);
    page.on('console', (m) => {
      if (m.type() === 'error') onErr(m.text());
    });

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/' + item.rel, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    // 示例页把 ice 声明在脚本顶层（全局词法绑定），直接引用即可
    const svg = await page.evaluate((opts) => ice.toSvg({ area: 'viewport', ...opts }), {
      includeTools: !!item.includeTools,
    });
    expect(typeof svg, `${item.name}: toSvg 应返回字符串`).toBe('string');
    expect(svg).toContain('<svg');

    const metrics = await page.evaluate(async (svgText: string) => {
      const src = document.querySelector('canvas') as HTMLCanvasElement;
      const w = src.width;
      const h = src.height;
      const A = src.getContext('2d')!.getImageData(0, 0, w, h).data;

      // 文本组件占用的世界盒 → 视图像素盒（用于把字形差异剔出去）
      const boxes: number[][] = [];
      const walk = (nodes: any[]) => {
        (nodes || []).forEach((n) => {
          if (typeof n.measureText === 'function') {
            const b = n.getMinBoundingBox(true).getMinAndMaxPoint();
            boxes.push([b.minX, b.minY, b.maxX, b.maxY]);
          }
          walk(n.childNodes);
        });
      };
      walk(ice.childNodes);
      const vp = ice.getRenderViewport();
      const rects = boxes.map((b) => [
        b[0] * vp.scale + vp.tx - 2,
        b[1] * vp.scale + vp.ty - 2,
        b[2] * vp.scale + vp.tx + 2,
        b[3] * vp.scale + vp.ty + 2,
      ]);

      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      await img.decode();
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      off.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const B = off.getContext('2d')!.getImageData(0, 0, w, h).data;

      let nonTextDiff = 0;
      for (let i = 0; i < A.length; i += 4) {
        const idx = i / 4;
        const px = idx % w;
        const py = (idx / w) | 0;
        if (rects.some((r) => px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3])) continue;
        const d = Math.max(
          Math.abs(A[i] - B[i]),
          Math.abs(A[i + 1] - B[i + 1]),
          Math.abs(A[i + 2] - B[i + 2]),
          Math.abs(A[i + 3] - B[i + 3])
        );
        if (d > 24) nonTextDiff++;
      }
      return { total: w * h, nonTextDiff, ratio: (nonTextDiff / (w * h)) * 100 };
    }, svg);

    const limit = item.limit === undefined ? NON_TEXT_DIFF_LIMIT : item.limit;
    if (metrics.ratio > limit) {
      failures.push(
        `${item.name}: 非文本差异 ${metrics.ratio.toFixed(3)}% > ${limit}%（${metrics.nonTextDiff}/${metrics.total} 像素）`
      );
    }
    if (errs.length) {
      failures.push(`${item.name}: 控制台报错 ${errs.join(' | ')}`);
    }
  }

  expect(failures).toEqual([]);
});
