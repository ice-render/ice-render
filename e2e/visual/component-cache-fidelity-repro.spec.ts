/**
 * 组件级离屏缓存的**密集场景实测上界**（与简单场景的严格口径分开记）。
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
 * ## 口径：两个场景、两个界（2026-09-14 量实）
 *
 * `offscreen-cache-fidelity.spec.ts` 的严格口径（**alpha 差占比 <0.1%、预乘 ≤3/255**）是在
 * **简单场景**下量出来的（少量大对象、互不重叠、透明底）。本用例的场景相反：**密集文本**。
 * 2026-09-14 实测（静态层两侧全关，只切组件缓存开 / 关）：
 *
 * | 场景 | 差异像素占比 | alpha 差占比 | 最大通道差 | 最大预乘差 |
 * |---|---|---|---|---|
 * | 单个文本 | 0 | 0 | 0 | 0 |
 * | 300 文本 · 不重叠 | 1.34% | 0.47% | 5 | 2 |
 * | 300 文本 · 重叠 | 4.18% | 0.84% | 9 | 5 |
 * | 300 文本 + 不透明底色 | 8.75% | 0.21% | 5 | 4 |
 *
 * 机制：位图是 8bit **预乘**存储，贴回时还要与「底下已有的墨迹」做一次 source-over 合成，
 * 而直接落墨时字形是直接栅格化到那块墨迹上的 —— 两者在**半透明边缘像素**上必然差一档；
 * 重叠越多、底下内容越不透明，参与的像素就越多。这解释了为什么「单个 0 差、多件才出现」，
 * 也解释了「外扩位图边界 / 关视口裁剪 / 强制重建位图**都不能改变数值**」（三条都做过实验）。
 *
 * 所以本用例断言的是**密集场景的实测上界（含约 2× 余量）**，它**不替代**简单场景的严格口径。
 * 若将来在真实应用里观察到远超这里的差值（历史观测：ice-entity-designer 里单像素 48/255，
 * 尚未在受控场景复现），应当按**新问题**处理，不要继续放宽这里的界。
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
    // 密集场景实测上界（见文件头表格）：
    //   α 差占比实测 0.47% → 界 1.5%；预乘实测 2 → 界 8；差异像素占比实测 1.34% → 界 5%
    // 注意：**不要**拿这一组界去替代 offscreen-cache-fidelity 里简单场景的严格口径。
    expect(cmp.alphaDiffRatio, `step ${i} alpha 差异占比过高（覆盖率错位）：${JSON.stringify(cmp)}`).toBeLessThan(
      0.015
    );
    expect(cmp.maxPremultDelta, `step ${i} 预乘通道差超界：${JSON.stringify(cmp)}`).toBeLessThanOrEqual(8);
    expect(cmp.diffRatio, `step ${i} 差异像素占比过高：${JSON.stringify(cmp)}`).toBeLessThan(0.05);
  }
  expect(pageErrors, '页面不应有未捕获异常').toEqual([]);
  return { results };
}

test('密集文本场景：组件级缓存 vs 直接落墨的像素差在文件头记录的实测上界内', async ({ page }) => {
  const { results } = await runSteps(page);
  console.log('[cache-fidelity:doc] 5 步都在实测上界内（本用例两侧都不走静态层，隔离的是组件缓存本身）');
  console.log(`  ${results.join('  ')}`);
});
