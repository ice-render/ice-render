/**
 * 离屏缓存像素保真验收（决定性回归）。
 *
 * 同一确定性场景跑两遍：`canvas-a` 走离屏缓存（引擎默认），`canvas-b` 把
 * `cache.isCachable` 一律置假（直接落墨）。逐步执行相同操作，每一步整幅逐像素比对。
 *
 * 为什么必须有这条：位图缓存只要「光栅化缩放 / 贴图落点 / 位图原点」有一点点不匹配，
 * 就会变成双线性重采样 —— 折线、细笔画、小字号文字会被糊掉（实测：视网膜屏上缓存文字只剩
 * 约 30% 墨迹，编辑器里折线全部变虚）。历史上这里踩过四个坑：
 *   1. 用 `root.devicePixelRatio` 而不是渲染视口缩放来放大位图；
 *   2. 依赖 `ctx.scale(dpr,dpr)` —— 它会被 `renderTo()` 内部的 `setTransform()` 整条覆盖（死代码）；
 *   3. 用世界尺寸做 drawImage 的目标矩形，且落点带小数 → 双线性重采样；
 *   4. 子类在 `super.doRender()` 之后用 `applyTransformToCtx(null, true)` 复原变换 ——
 *      在离屏通道里会按主画布视口重算，把位图原点的平移丢掉（连线箭头/标签整块消失）。
 *
 * ## 验收口径
 * - **alpha 必须逐位相同**：覆盖率只要错位（缩放取整 / 位图原点丢失 / 亚像素位移）alpha 立刻会变。
 * - **RGB 允许 ≤2/255 的取整差**：位图是 8bit 预乘存储，深色字形压在不透明浅色底上会多经历一次
 *   「预乘→量化→解预乘」往返。实测：透明底上严格 0 差异，不透明浅色底上最大 2/255（肉眼不可辨）。
 * - **`?strict=1`（去掉不透明底色）必须严格 0 差异** —— 确保上面的容差没有掩盖真实缺陷。
 */
import { test, expect } from '@playwright/test';

interface Cmp {
  equal: boolean;
  diffCount: number;
  diffRatio: number;
  alphaDiffCount: number;
  alphaDiffRatio: number;
  totalPixels: number;
  maxChannelDelta: number;
  maxPremultDelta: number;
  inkA: number;
  inkB: number;
  inkDiffRatio: number;
  firstIndex: number;
}

/**
 * 步骤断言（容差口径见文件头）。
 *
 * 实测上界（6 个配置 × 12 步）：maxChannelDelta ≤5、alphaDiffRatio ≤4e-5、diffRatio ≤3e-3、
 * 墨迹差 =0。修复前的老实现：maxDelta 306、alpha 整片差 255、墨迹掉 5%~70% —— 判据有 ~4 个数量级余量。
 */
function assertWithinBounds(cmp: Cmp, step: number) {
  // alpha 差 = 覆盖率错位（几何/原点/缩放/裁切出问题），是最危险的一类
  expect(cmp.alphaDiffRatio, `step ${step} alpha 差异像素占比过高（覆盖率错位）：${JSON.stringify(cmp)}`).toBeLessThan(
    0.001
  );
  // 预乘差才是屏幕上看得见的偏差：8bit 预乘存储对低位 alpha 像素会放大「解预乘通道值」误差，
  // 直接卡未预乘的通道差会被这种无害像素淹没（实测那种像素屏幕贡献 <2/255）。
  expect(
    cmp.maxPremultDelta,
    `step ${step} 预乘通道差超界（屏幕可见偏差）：${JSON.stringify(cmp)}`
  ).toBeLessThanOrEqual(3);
  expect(cmp.maxChannelDelta, `step ${step} RGB 通道差超界：${JSON.stringify(cmp)}`).toBeLessThanOrEqual(96);
  expect(cmp.diffRatio, `step ${step} 差异像素占比过高：${JSON.stringify(cmp)}`).toBeLessThan(0.01);
  // 墨迹量必须守恒 —— 这条直接对应「缓存把折线/文字画糊或画丢」这个真实症状
  expect(cmp.inkDiffRatio, `step ${step} 墨迹像素数差异过大（内容被画糊/画丢）：${JSON.stringify(cmp)}`).toBeLessThan(
    0.002
  );
}

async function runSteps(page: any, url: string, strict: boolean) {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const stats: any = await page.evaluate(() => (window as any).__cacheStats());
  const STEPS = 12;
  for (let i = 0; i < STEPS; i++) {
    const ok = await page.evaluate((s: number) => (window as any).__step(s), i);
    expect(ok, `step ${i} 应当存在`).toBe(true);
    await page.waitForTimeout(200);
    const cmp: Cmp = await page.evaluate(() => (window as any).__compare());
    assertWithinBounds(cmp, i);
    if (strict) {
      // 干净场景（透明底、内容互不重叠）应当更接近零：这里再收紧一档，
      // 确保上面的大容差没有掩盖「本该严格一致」的场景。
      expect(cmp.diffRatio, `step ${i} 干净场景差异像素占比应极低：${JSON.stringify(cmp)}`).toBeLessThan(0.0005);
      expect(cmp.alphaDiffRatio, `step ${i} 干净场景 alpha 差异应极低：${JSON.stringify(cmp)}`).toBeLessThan(0.0001);
    }
  }
  expect(pageErrors, '页面不应有未捕获异常').toEqual([]);
  return stats;
}

const URL = '/e2e/visual/fixtures/offscreen-cache-fidelity.html';

test('严格口径（透明底、内容互不重叠）：差异压到极低', async ({ page }) => {
  const stats = await runSteps(page, URL + '?strict=1', true);
  expect(stats.cached, '应当有组件真的走了离屏缓存').toBeGreaterThanOrEqual(6);
  console.log(`[cache-fidelity:strict] 12 步严格一致；缓存组件 ${stats.cached}/${stats.total}`);
});

test('基准视口：alpha 差异极低、RGB 在取整上界内', async ({ page }) => {
  const stats = await runSteps(page, URL, false);
  expect(stats.cached, '应当有组件真的走了离屏缓存').toBeGreaterThanOrEqual(6);
  console.log(`[cache-fidelity:base] 12 步达标；缓存组件 ${stats.cached}/${stats.total}`);
});

test('非单位视口（scale=0.386，编辑器默认视图）：达标', async ({ page }) => {
  const stats = await runSteps(page, URL + '?zoom=1', false);
  expect(stats.cached, '应当有组件真的走了离屏缓存').toBeGreaterThanOrEqual(6);
  console.log(`[cache-fidelity:zoom] 12 步达标；缓存组件 ${stats.cached}/${stats.total}`);
});

test('dpr=2 高分屏：达标', async ({ page }) => {
  const stats = await runSteps(page, URL + '?dpr=2', false);
  expect(stats.cached, '应当有组件真的走了离屏缓存').toBeGreaterThanOrEqual(6);
  console.log(`[cache-fidelity:dpr2] 12 步达标；缓存组件 ${stats.cached}/${stats.total}`);
});

test('dpr=2 + 非单位视口：达标', async ({ page }) => {
  const stats = await runSteps(page, URL + '?dpr=2&zoom=1', false);
  expect(stats.cached, '应当有组件真的走了离屏缓存').toBeGreaterThanOrEqual(6);
  console.log(`[cache-fidelity:dpr2+zoom] 12 步达标；缓存组件 ${stats.cached}/${stats.total}`);
});

test('重叠的半透明抗锯齿内容（8bit 预乘最吃亏的场景）：仍在上界内', async ({ page }) => {
  const stats = await runSteps(page, URL + '?overlap=1', false);
  expect(stats.cached, '应当有组件真的走了离屏缓存').toBeGreaterThanOrEqual(6);
  console.log(`[cache-fidelity:overlap] 12 步达标；缓存组件 ${stats.cached}/${stats.total}`);
});
