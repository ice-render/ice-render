/**
 * **换主题后位图缓存必须作废** —— 真机像素判据（2026-09-17 修的真实缺陷）。
 *
 * 缺陷：`ice-smart-water` 侧栏热切换到深色后，大量文本仍是浅色主题的深字；
 * `?theme=dark` 刷新路径完全正常。根因见 `tests/theme/theme-cache-invalidation.test.ts`：
 * 组件级离屏缓存与静态层都是"内容没变就贴旧位图"，而**主题不在内容指纹里**。
 *
 * 为什么这里必须是**像素**判据、而不是断言"缓存被清了"：
 * - 单测能证明"调了 clear()"，但证不了"屏幕上的字真的变了"（贴回来的路径可能绕过它）；
 * - 库侧 `e2e/theme-coverage.spec.ts` 读的是 `resolvedStyleColor()`（**样式值**），
 *   同样看不出位图过期 —— 这个缺陷在两边都是盲区，所以补这条。
 *
 * 口径：**同一页两个画布、同一份确定性场景**，一个热切换、一个开机即深色，
 * 逐像素比对必须一致（alpha 逐位相同、通道差 ≤3）。
 */
import { expect, test } from '@playwright/test';

test('热切换之后的画布，与「开机即深色」逐像素一致（文本不再贴旧位图）', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/e2e/visual/fixtures/theme-cache-hotswitch.html', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // 切换**之前**两张图本来就该不同（浅底 vs 深底）—— 先确认这点，否则"切换后一致"没有意义
  const before = await page.evaluate(() => (window as any).__compare());
  expect(before.diffRatio, '切换前两张图应当明显不同（否则场景没搭对）').toBeGreaterThan(0.05);

  const switched = await page.evaluate(() => (window as any).__switch() as { clears: number });
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => (window as any).__compare());
  const stats = await page.evaluate(() => (window as any).__stats());

  // 判据一：像素一致（这条才是"用户看得见"的）
  // 把差异样例放进**被断言的值**里：这样失败时 jest/playwright 的 diff 直接把
  // 「热切换那张是什么色 vs 开机即深色那张是什么色」打出来（断言第二参数不会显示）
  expect({ 一致: after.equal, 采样: after.topSamples }).toEqual({ 一致: true, 采样: [] });
  expect(after.diffRatio, '差异像素占比应当为 0').toBeLessThanOrEqual(0.0001);
  expect(after.alphaDiffRatio, 'alpha 必须逐位相同（覆盖率错位一票否决）').toBeLessThanOrEqual(0.0005);
  expect(after.maxPremultDelta, '预乘通道差 ≤3/255').toBeLessThanOrEqual(3);

  // 判据二：缓存**确实**被清了（且这条断言失败时能一眼看出是"没清"而不是"没重绘"）
  expect({ 清缓存次数: switched.clears }).toEqual({ 清缓存次数: 1 });
  expect(stats.clears).toBe(1);

  expect(errors, '页面不应有未捕获异常').toEqual([]);
});
