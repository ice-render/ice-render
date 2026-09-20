/**
 * **兼容性保护的真机验收**：上不了 worker 时，画面必须照常可用。
 *
 * 三条路径都要过：
 * ① `?backend=main` —— 宿主显式走主线程（不支持 worker 的浏览器等价形态）；
 * ② worker 脚本加载失败（404 / 被 CSP 挡 / 顶层就抛）—— 自动回退，且**主线程继续画**；
 * ③ 回退之后**功能一项不少**：改状态 → 主线程重绘 → 画面真的跟着变。
 *
 * 判据刻意落在"像素"上：回退最容易出的问题是"不崩、但画面冻在最后一帧"（看起来像还在跑），
 * 所以这里既要求回退被上报，又要求回退后画面仍有墨迹、且随状态变化而变。
 */
import { test, expect } from '@playwright/test';

const waitFallback = async (page: any, timeout = 12_000) => {
  await page.waitForFunction(() => !!(window as any).__fallback, undefined, { timeout });
  return page.evaluate(() => (window as any).__fallback);
};

test('兼容回退：worker 脚本加载失败 → 自动回退主线程，画面仍然可用且跟着状态变', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));

  await page.setViewportSize({ width: 1200, height: 800 });
  // 故意指向一个不存在的 worker 脚本：模拟"脚本没部署 / 被 CSP 拦 / 加载期就抛"
  await page.goto('/examples/worker/mirror-render.html?worker=no-such-worker.js', { waitUntil: 'load' });

  const fallback: any = await waitFallback(page);
  expect(['worker-error', 'ready-timeout'], `回退原因应当明确上报：${JSON.stringify(fallback)}`).toContain(
    fallback.reason
  );
  // 回退之后镜像不应再接管画面
  expect(await page.evaluate(() => (window as any).__hostActive())).toBe(false);

  // ① 画面有内容（主线程在回退时立刻重绘了一帧）
  const ink0: any = await page.evaluate(() => (window as any).__inkBox('view'));
  expect(ink0.n, `回退后可见画布必须有墨迹（不能是空白）：${JSON.stringify(ink0)}`).toBeGreaterThan(0);

  // ② 功能一项不少：改状态 → 主线程重绘 → **画面像素真的变了**（不能冻在最后一帧）
  const hash0: number = await page.evaluate(() => (window as any).__pixelHash('view'));
  await page.evaluate(() => (window as any).__step(1));
  const hash1: number = await page.evaluate(() => (window as any).__pixelHash('view'));
  expect(hash1, `回退后改状态画面必须跟着变（hash ${hash0} → ${hash1}）`).not.toBe(hash0);

  expect(errors, '回退路径不应产生未捕获异常').toEqual([]);
});

test('兼容回退：?backend=main 强制主线程渲染仍可用（宿主自己决定的路径）', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/examples/worker/mirror-render.html?backend=main', { waitUntil: 'load' });

  const fallback: any = await waitFallback(page, 5_000);
  expect(fallback.reason).toBe('forced');
  expect(await page.evaluate(() => (window as any).__hostActive())).toBe(false);

  const ink: any = await page.evaluate(() => (window as any).__inkBox('view'));
  expect(ink.n, `强制主线程渲染必须有画面：${JSON.stringify(ink)}`).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
