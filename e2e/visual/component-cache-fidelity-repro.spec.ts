// @ts-nocheck
/**
 * 【已知问题回归 · 暂未修复】组件级离屏缓存与「直接落墨」的像素差，超出了引擎自己的口径。
 *
 * ## 这条用例是怎么来的
 *
 * 起因是 2026-09-14 发 2.3.2（新增静态层位图）之后，在 ice-entity-designer 的 entity-editor 上
 * 做「层开 / 层关」像素对照，看到约 0.9% 的像素有差（单像素最大 48/255）。当时怀疑是静态层。
 * 一连串实验把静态层**逐条排除**了：
 *
 * - 单组件「直绘 vs 位图」（CTM 只差整数设备像素）→ **0 差**（整数平移光栅化是逐位不变的）；
 * - 同一批内容画到**主画布**与**离屏画布** → **0 差**（不是后端差异）；
 * - 位图范围外扩 16 世界单位、强制重建层、关掉视口裁剪 → 差异**数值完全不变**；
 * - **把静态层在两侧都关掉、只切「组件缓存开 / 关」→ 差异是这个数（本用例的 7262px / α 2556）**
 *   —— 与「层开 / 层关」的差异**一字不差**。
 *
 * 结论：**这不是静态层引入的回归**，而是**组件级离屏缓存自身**与直接落墨之间的量化差
 *（位图是 8bit 预乘存储、且常被贴到已有墨迹之上），一直存在（2.3.1 及更早就有）。
 * 静态层只是把这件事搬到了 A/B 对照的另一侧：层里的成员被强制走「直接落墨」，
 * 而关层时同一个组件走的是缓存位图。
 *
 * ## 为什么标 fixme 而不是放着红
 *
 * 修它属于**组件缓存保真**这个独立议题（引擎文档 `04-rendering-performance.md` 与
 * `offscreen-cache-fidelity.spec.ts` 已给出口径：alpha 逐位、预乘 ≤3/255；本场景实测 α 差占比
 * 0.47% > 0.1% 的上界、单像素最大 48/255 > 3，**确实超界**）。它需要单独的方案与验证，
 * 不该在这里顺手改。留着它是为了让后续修这个问题的人有一条**可复现、可控**的用例。
 *
 * 场景：300 个文本（可缓存）+ 尾部 80 个矩形每帧置脏（脏比 > 20%），两个 canvas
 * 一个走组件缓存、一个强制直接落墨 —— 二者应当一致。
 */
import { test, expect } from '@playwright/test';

async function runSteps(page: any) {
  const pageErrors: string[] = [];
  page.on('pageerror', (e: any) => pageErrors.push(String(e)));
  await page.goto('/e2e/visual/fixtures/component-cache-fidelity-repro.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const STEPS = 5;
  const results: string[] = [];
  for (let i = 0; i < STEPS; i++) {
    await page.evaluate((s: number) => (window as any).__step(s), i);
    await page.waitForTimeout(260);
    const cmp: any = await page.evaluate(() => (window as any).__compare());
    results.push(
      `step${i}: ${cmp.equal ? 'OK' : `Δpx=${cmp.diffCount} Δα=${cmp.alphaDiffCount} maxPremult=${cmp.maxPremultDelta}`}`
    );
    expect(cmp.alphaDiffRatio, `step ${i} alpha 差异占比过高（覆盖率错位）：${JSON.stringify(cmp)}`).toBeLessThan(
      0.0005
    );
    expect(cmp.maxPremultDelta, `step ${i} 预乘通道差超界：${JSON.stringify(cmp)}`).toBeLessThanOrEqual(3);
    expect(cmp.diffRatio, `step ${i} 差异像素占比过高：${JSON.stringify(cmp)}`).toBeLessThan(0.005);
  }
  const builds = await page.evaluate(() => (window as any).__layerStats.builds);
  expect(pageErrors, '页面不应有未捕获异常').toEqual([]);
  return { results, builds };
}

test.fixme('【已知问题】组件级离屏缓存 vs 直接落墨：像素差超出 ≤3/255 口径（实测 α 差占比 0.47%）', async ({
  page,
}) => {
  const { results, builds } = await runSteps(page);
  expect(builds, '本场景应当真正建立过静态层位图').toBeGreaterThan(0);
  console.log(`[static-layer-cache] 5 步全部一致；建层 ${builds} 次`);
  console.log(`  ${results.join('  ')}`);
});
