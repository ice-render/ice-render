/**
 * OffscreenCanvas Worker 渲染最小可行性原型验收（可选用例）。
 *
 * 验证：worker 内能加载引擎 dist 并在 OffscreenCanvas 上完成确定性场景渲染；
 * 结果经 transferToImageBitmap 逐帧送达主线程；window.__workerBenchResult 可采集。
 * 覆盖说明见 docs/architecture/10-worker-offscreen.md。
 */
import { test, expect } from '@playwright/test';

test('worker-min 原型：worker 渲染 + transfer 帧可达主线程', async ({ page }) => {
  test.setTimeout(60_000);
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text().slice(0, 200));
  });

  await page.goto('/examples/performance/worker-main.html', { waitUntil: 'load' });
  await page.waitForFunction(() => (window as any).__workerBenchResult !== undefined, undefined, { timeout: 30_000 });

  const res: any = await page.evaluate(() => (window as any).__workerBenchResult);
  expect(res.n, '组件数').toBe(5000);
  expect(res.staticP50Ms).toBeGreaterThan(0);
  expect(res.animP50Ms).toBeGreaterThan(0);
  expect(res.framesReceived, 'transfer 帧应送达主线程').toBeGreaterThan(0);
  expect(errs, '不应有页面/console 错误').toEqual([]);

  const line = `worker n=${res.n}  static p50=${res.staticP50Ms.toFixed(3)}ms  anim p50=${res.animP50Ms.toFixed(3)}ms  drag p50=${res.dragP50Ms.toFixed(3)}ms  frames=${res.framesReceived}`;
  console.log(`[worker-perf] ${line}`);
  test.info().annotations.push({ type: 'worker-perf', description: line });
});
