/**
 * OffscreenCanvas Worker 渲染最小可行性原型验收（可选用例）。
 *
 * 验证两类路径：
 *  - worker：worker 内加载引擎 dist 并在 OffscreenCanvas 渲染，结果经
 *    transferToImageBitmap 逐帧送达主线程；
 *  - 兼容回退：?backend=main 强制走主线程渲染，仍产出同构结果（backend='main-thread'）。
 * 覆盖说明见 docs/architecture/10-worker-offscreen.md。
 */
import { test, expect } from '@playwright/test';

async function collectResult(page: any, url: string) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text().slice(0, 200));
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => (window as any).__workerBenchResult !== undefined, undefined, { timeout: 30_000 });
  const res: any = await page.evaluate(() => (window as any).__workerBenchResult);
  expect(res.staticP50Ms).toBeGreaterThan(0);
  expect(res.animP50Ms).toBeGreaterThan(0);
  expect(res.dragP50Ms).toBeGreaterThan(0);
  expect(res.n).toBe(5000);
  expect(errs, '不应有页面/console 错误').toEqual([]);
  return res;
}

test('worker 路径：worker 渲染 + transfer 帧可达主线程', async ({ page }) => {
  test.setTimeout(60_000);
  const res = await collectResult(page, '/examples/performance/worker-main.html');
  expect(res.backend, '默认在支持的环境应走 worker').toBe('worker');
  expect(res.supported).toBe(true);
  expect(res.framesReceived, 'transfer 帧应送达主线程').toBeGreaterThan(0);

  const line = `worker n=${res.n}  static p50=${res.staticP50Ms.toFixed(3)}ms  anim p50=${res.animP50Ms.toFixed(3)}ms  drag p50=${res.dragP50Ms.toFixed(3)}ms  frames=${res.framesReceived}`;
  console.log(`[worker-perf] ${line}`);
  test.info().annotations.push({ type: 'worker-perf', description: line });
});

test('兼容回退：?backend=main 强制主线程渲染仍可用', async ({ page }) => {
  test.setTimeout(60_000);
  const res = await collectResult(page, '/examples/performance/worker-main.html?backend=main');
  expect(res.backend, '强制 main 时应上报主线程后端').toBe('main-thread');
  expect(res.supported).toBe(false);
  const line = `main-thread(回退) n=${res.n}  static p50=${res.staticP50Ms.toFixed(3)}ms  anim p50=${res.animP50Ms.toFixed(3)}ms  drag p50=${res.dragP50Ms.toFixed(3)}ms`;
  console.log(`[worker-perf:fallback] ${line}`);
  test.info().annotations.push({ type: 'worker-perf-fallback', description: line });
});
