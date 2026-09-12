import { test, expect } from '@playwright/test';

/**
 * 输入矩形缓存回归（真实浏览器）。
 *
 * 场景：图表创建之后，页面在画布**上方**插入内容，画布整体下移。
 * 修复前移动事件复用缓存的 rect → 之后每个 mousemove 的 canvas 内坐标都偏移同样的距离，
 * 悬停/命中/拖拽全部错位，直到用户点一下或滚一格（真实 bug，ice-chart 的示例页撞到过）。
 *
 * 断言在**组件收到的坐标**上：这是命中检测链路的最终观测点。
 */

test('画布上方插入内容后，单次 mousemove 的坐标依然正确（不需要先点一下）', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/input-rect-shift.html');
  await page.waitForTimeout(300);

  const canvasRect = await page.evaluate(() => {
    const r: any = (window as any).__canvasRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  // 目标：组件内部 (300, 200)（rect 是 200..400 x 150..250）
  const canvasLocal = { x: 300, y: 200 };

  await page.evaluate(() => (window as any).__insertBanner());
  await page.waitForTimeout(80);
  const shiftedRect = await page.evaluate(() => {
    const r: any = (window as any).__canvasRect();
    return { x: r.x, y: r.y };
  });
  // 前置条件：画布确实被推动了（否则这条用例没有意义）
  expect(shiftedRect.y).toBeGreaterThan(canvasRect.y + 10);

  // 只做一次移动，不点击、不滚轮
  await page.mouse.move(shiftedRect.x + canvasLocal.x, shiftedRect.y + canvasLocal.y);
  await page.waitForTimeout(120);

  const moves = await page.evaluate(() => (window as any).__moves);
  expect(moves.length).toBeGreaterThan(0);
  const [x, y] = moves[moves.length - 1];
  expect(x).toBe(canvasLocal.x);
  expect(y).toBe(canvasLocal.y);
});
