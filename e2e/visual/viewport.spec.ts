/**
 * 画布缩放（视口 zoom/pan）交互回归。
 *
 * 验证：滚轮缩放改变 viewport.scale、拖拽平移改变 tx/ty、坐标换算往返一致、
 * 缩放后命中检测仍命中正确组件。
 */
import { test, expect } from '@playwright/test';

async function canvasCenter(page: any) {
  return page.evaluate(() => {
    const el = document.getElementById('canvas-1');
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}

test('画布缩放：滚轮 + 平移 + 缩放后命中', async ({ page }) => {
  await page.goto('/examples/viewport/viewport-zoom.html', { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const readViewport = () => page.evaluate(() => (window as any).__ice.viewport);
  expect(await readViewport()).toEqual({ scale: 1, tx: 0, ty: 0 });

  // 滚轮放大
  const c = await canvasCenter(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(200);
  expect((await readViewport()).scale).toBeGreaterThan(1);

  // 左键空白处拖拽平移（右下角空白）
  const blank = await page.evaluate(() => {
    const r = document.getElementById('canvas-1').getBoundingClientRect();
    return { x: r.left + 820, y: r.top + 550 };
  });
  await page.mouse.move(blank.x, blank.y);
  await page.mouse.down();
  await page.mouse.move(blank.x + 40, blank.y + 30, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const panned = await readViewport();
  expect(Math.abs(panned.tx)).toBeGreaterThan(0);
  expect(Math.abs(panned.ty)).toBeGreaterThan(0);

  // 坐标换算往返一致
  const roundtrip = await page.evaluate(() => {
    const ice = (window as any).__ice;
    const [sx, sy] = ice.worldToScreen(123, 77);
    const [wx, wy] = ice.screenToWorld(sx, sy);
    return { wx, wy };
  });
  expect(roundtrip.wx).toBeCloseTo(123, 5);
  expect(roundtrip.wy).toBeCloseTo(77, 5);

  // 缩放后命中检测：第一个矩形世界中心 (108,110) 应命中 ICERect
  const hit = await page.evaluate(() => {
    const ice = (window as any).__ice;
    const [sx, sy] = ice.worldToScreen(108, 110);
    return ice.hitTest(sx, sy).constructor.name;
  });
  expect(hit).toBe('ICERect');
});
