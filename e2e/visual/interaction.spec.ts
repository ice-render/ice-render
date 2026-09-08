import { test, expect } from '@playwright/test';

/**
 * 交互回归：真实鼠标驱动。fixture 的 root 带 scale 1.3 + rotate 45（对齐 group-nested.html），
 * 验证缩放+旋转嵌套下的命中检测与变换漂移。
 */

test('resize→rotate→resize 循环后面板与目标无漂移（含缩放+旋转祖先）', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  // 选中 rect
  const c = await page.evaluate(() => window.__center('rect'));
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(150);

  const readDrift = () => page.evaluate(() => window.__drift('rect'));

  // 初始漂移应 ~0
  expect(await readDrift()).toBeLessThan(1);

  for (let round = 0; round < 3; round++) {
    // 1) 拖拽对角线手柄（象限 1，右上角）resize
    for (let i = 0; i < 3; i++) {
      const hc = await page.evaluate(() => {
        const h = window.__handles().find((x) => x.state.quadrant === 1);
        return window.__handleCenter(h);
      });
      await page.mouse.move(hc.x, hc.y);
      await page.mouse.down();
      await page.mouse.move(hc.x + 15, hc.y - 8, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(80);
    }

    // 2) 拖拽旋转手柄
    const rhc = await page.evaluate(() => window.__handleCenter(window.__rotateHandle()));
    await page.mouse.move(rhc.x, rhc.y);
    await page.mouse.down();
    await page.mouse.move(rhc.x + 30, rhc.y + 15, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(80);

    // 每轮结束漂移都应 ~0
    const drift = await readDrift();
    expect(drift).toBeLessThan(1);
  }
});

test('命中检测：点击最深层子组件应选中它', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  let c = await page.evaluate(() => window.__center('rect'));
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__ice.selectionList[0] === window.__components.rect)).toBe(true);

  c = await page.evaluate(() => window.__center('circle'));
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__ice.selectionList[0] === window.__components.circle)).toBe(true);
});
