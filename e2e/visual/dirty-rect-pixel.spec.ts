/**
 * 像素一致性验收（dirty-rect 决定性回归）。
 *
 * 同一确定性场景在 full 与 dirty-rect 两个 canvas 上渲染，逐步执行相同操作
 * （拖叶子/改色/拖 Group/改文本/旋转/控制面板启用禁用/结构变更），
 * 每一步后整幅逐像素比对必须 100% 一致。
 *
 * 两个场景：
 *  - 默认「富场景」：含旋转组/文本/阴影/星形/折线连线/面板，重点覆盖回退与各类边界；
 *  - ?opaque=1「全不透明场景」：无星形/折线/阴影，验证局部重绘真正执行（collectOk>0）且像素一致。
 */
import { test, expect } from '@playwright/test';

async function runSteps(page: any, url: string, requirePartial: boolean) {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const STEPS = 10;
  const stepResults: string[] = [];
  for (let i = 0; i < STEPS; i++) {
    await page.evaluate((s: number) => (window as any).__step(s), i);
    await page.waitForTimeout(200);
    const cmp: any = await page.evaluate(() => (window as any).__compare());
    stepResults.push(`step${i}: ${cmp.equal ? 'OK' : `DIFF=${cmp.diffCount}`}`);
    expect(cmp.equal, `step ${i} 像素不一致：${JSON.stringify(cmp)}`).toBe(true);
  }
  const stats: any = await page.evaluate(() => (window as any).__drStats);
  if (requirePartial) {
    expect(stats.collectOk, '全不透明场景应真正执行过至少一次局部重绘').toBeGreaterThan(0);
  }
  expect(pageErrors, '页面不应有未捕获异常').toEqual([]);
  return { stepResults, collectOk: stats.collectOk };
}

/**
 * 富场景：含旋转 / 文本 / 阴影 / **已连接的折线** / 控制面板，覆盖「回退边界」。
 *
 * 注意：本场景预期**稳定回退全量**（`局部执行=0`），这不是失败 ——
 * 折线属于「clip 会切断描边抗锯齿」的风险类别（见 CanvasRenderer.__riskyIntersectsRegion），
 * 而它在连上宿主后包围盒是真实且较大的，因此与任何脏区域都相交 → 回退全量。
 * 局部重绘是否真正执行由下面几个 `opaque` 场景断言（`collectOk > 0`）。
 */
test('富场景：dirty-rect 与 full 逐步逐像素一致（含回退边界）', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(page, '/e2e/visual/fixtures/dirty-rect-compare.html', false);
  console.log(`[dirty-rect-pixel:rich] 10 步全部一致（局部执行=${collectOk} 次）`);
  console.log(`  ${stepResults.join('  ')}`);
});

test('全不透明场景：局部重绘真正执行且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1',
    true
  );
  console.log(`[dirty-rect-pixel:opaque] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

test('含文本的全不透明场景：文本离屏缓存后局部重绘且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&text=1',
    true
  );
  console.log(`[dirty-rect-pixel:text] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

test('含星形的全不透明场景：dot-path 离屏缓存后局部重绘且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&star=1',
    true
  );
  console.log(`[dirty-rect-pixel:star] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

test('含半透明矩形的全不透明场景：半透明 shape 离屏缓存后局部重绘且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&alpha=1',
    true
  );
  console.log(`[dirty-rect-pixel:alpha] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});
