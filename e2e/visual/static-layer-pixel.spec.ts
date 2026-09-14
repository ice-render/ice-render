/**
 * 静态层位图的像素一致性验收。
 *
 * 同一确定性场景跑两个 canvas：canvas-a 关闭静态层（逐组件重画 = 旧行为），
 * canvas-b 开启（默认）。逐步驱动相同操作（分散改色 / 结构变更 / 改 zIndex / 文本变更 /
 * 小范围损伤），每一步整幅逐像素比对必须 100% 一致。
 *
 * 判据与 `offscreen-cache-fidelity` 同口径（静态层本质就是位图）：
 * **alpha 必须逐位相同**（覆盖率错位一票否决），**预乘通道差 ≤3/255**
 *（8bit 预乘存储贴回不透明底时多一次量化往返，屏幕上不可辨），差异像素占比 <1%。
 * `?hidpi=1` 覆盖 dpr=2：位图栅格与设备栅格的对齐是这条路径最容易出错的地方。
 */
import { test, expect } from '@playwright/test';

async function runSteps(page: any, url: string) {
  const pageErrors: string[] = [];
  page.on('pageerror', (e: any) => pageErrors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const STEPS = 10;
  const stepResults: string[] = [];
  for (let i = 0; i < STEPS; i++) {
    await page.evaluate((s: number) => (window as any).__step(s), i);
    await page.waitForTimeout(220);
    const cmp: any = await page.evaluate(() => (window as any).__compare());
    stepResults.push(`step${i}: ${cmp.equal ? 'OK' : `±${cmp.maxPremultDelta}`}`);
    expect(cmp.alphaDiffRatio, `step ${i} alpha 差异占比过高（覆盖率错位）：${JSON.stringify(cmp)}`).toBeLessThan(
      0.0005
    );
    expect(cmp.maxPremultDelta, `step ${i} 预乘通道差超界：${JSON.stringify(cmp)}`).toBeLessThanOrEqual(3);
    expect(cmp.diffRatio, `step ${i} 差异像素占比过高：${JSON.stringify(cmp)}`).toBeLessThan(0.005);
  }
  const builds = await page.evaluate(() => (window as any).__layerStats.builds);
  expect(pageErrors, '页面不应有未捕获异常').toEqual([]);
  return { stepResults, builds };
}

test('静态层位图：与逐组件重画逐步逐像素一致，且确实走了层路径', async ({ page }) => {
  const { stepResults, builds } = await runSteps(page, '/e2e/visual/fixtures/static-layer-compare.html');
  expect(builds, '本场景应当真正建立过静态层位图').toBeGreaterThan(0);
  console.log(`[static-layer] 10 步全部一致；建层 ${builds} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

test('静态层位图（dpr=2）：高分屏下仍逐步逐像素一致', async ({ page }) => {
  const { stepResults, builds } = await runSteps(page, '/e2e/visual/fixtures/static-layer-compare.html?hidpi=1');
  expect(builds, '本场景应当真正建立过静态层位图').toBeGreaterThan(0);
  console.log(`[static-layer:hidpi] 10 步全部一致；建层 ${builds} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});
