/**
 * `style.filter`（`ctx.filter`）的**缓存保真**回归（永久）。
 *
 * 为什么单独立一份：滤镜是唯一一类「长度参数是设备像素、不随视图缩放」的绘制状态
 * （`stroke` / `shadowBlur` 都在用户坐标里，随变换缩放），因此它把「离屏位图该扩多少边」
 * 这件事逼到了两个必须同时成立的口径上：
 *   ① 模糊/投影的墨迹会溢出几何盒 → 位图必须扩边（照 `stylePaintPad`）；
 *   ② 扩边量的单位是**设备像素**，而 pad 是世界坐标 → 必须除以渲染视口缩放。
 *
 * 真机实测（Chromium，`blur(8px)` 画一个实心块，量 alpha>0 的最远像素）：
 * 溢出在 `setTransform(1 / 0.62 / 0.5)` 下恒为 18~19 **设备**像素 —— 与变换无关。
 * 改造前按世界坐标扩边，`?scale=0.62` 下 `drop-shadow` 差 **118** 像素、`blur(8px)` 差 **76** 像素
 * （滤镜尾巴被位图切掉）。修好后两个缩放档都必须**严格 0 差异**。
 *
 * 另一条钉住的是「改滤镜 → 位图必须失效」：内容指纹漏了 `filter`，`canvas-a` 会继续贴旧滤镜的
 * 位图（属性改了画面不动）。它在步骤 1~5 里被覆盖 —— 只要指纹漏项，这里立刻炸。
 */
import { test, expect } from '@playwright/test';

interface FilterCmp {
  equal: boolean;
  diffCount: number;
  alphaDiffCount: number;
  maxChannelDelta: number;
  maxPremultDelta: number;
  firstIndex: number;
  inkA: number;
  inkB: number;
}

const URL = '/e2e/visual/fixtures/filter-cache-fidelity.html';
const STEPS = 8;

async function runSteps(page: any, url: string) {
  const errors: string[] = [];
  page.on('pageerror', (e: any) => errors.push(String(e.message).slice(0, 200)));
  page.on('console', (m: any) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const stats: any = await page.evaluate(() => (window as any).__cacheStats());
  expect(stats.cached, '应当有组件真的走了离屏缓存（否则这条用例什么都没测）').toBeGreaterThanOrEqual(2);

  for (let i = 0; i < STEPS; i++) {
    const ok = await page.evaluate((s: number) => (window as any).__step(s), i);
    expect(ok, `step ${i} 应当存在`).toBe(true);
    await page.waitForTimeout(250);
    const cmp: FilterCmp = await page.evaluate(() => (window as any).__compare());
    // 滤镜的缓存路径与直接落墨必须**逐像素相同**：扩边量错一点就是一条被切掉的尾巴，
    // 容差只会把「差一点点」的切边放过去 —— 这条边界必须卡死。
    expect(cmp.equal, `step ${i} 缓存与直接落墨不一致：${JSON.stringify(cmp)}`).toBe(true);
    expect(cmp.inkA, `step ${i} 两条路径的墨迹像素数必须一致`).toBe(cmp.inkB);
  }
  expect(errors, '页面不应有未捕获异常').toEqual([]);
}

test('滤镜缓存保真 · 单位视口（scale=1）', async ({ page }) => {
  await runSteps(page, URL);
});

test('滤镜缓存保真 · 缩略视图（scale=0.62，位图扩边量要按设备像素换算）', async ({ page }) => {
  await runSteps(page, URL + '?scale=0.62');
});
