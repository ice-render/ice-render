/**
 * 对齐吸附（AlignmentGuideManager）交互回归。
 *
 * 拖拽矩形靠近另一矩形边缘时，验证吸附修正位置 + 工具层出现提示线。
 */
import { test, expect } from '@playwright/test';

test('对齐吸附：拖拽靠近边缘自动吸附并显示提示线', async ({ page }) => {
  await page.goto('/examples/alignment/alignment-snap.html', { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const c = await page.evaluate(() => {
    const r = document.getElementById('canvas-1').getBoundingClientRect();
    return { left: r.left, top: r.top };
  });

  // 第一个矩形 left=80,top=80,w=140,h=90，中心约 (150,125)；向右拖 77px 靠近第二个矩形左边缘(300)
  const sx = c.left + 150;
  const sy = c.top + 125;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 77, sy, { steps: 10 });
  await page.waitForTimeout(200); // 拖拽中检查（松手后提示线会清除）

  const snap = await page.evaluate(() => {
    const ice = (window as any).__ice;
    const a = ice.childNodes[0];
    // 提示线的颜色现在走主题引用（paint 时解析），所以按「引用路径 + 解析结果」一起判：
    // 直接比 '#EC4899' 会随着主题化改动失效（这正是这次要验证的能力）。
    const guides = ice.toolNodes.filter((t: any) => {
      const value = t.state.style && t.state.style.fillStyle;
      if (value && value.$token === 'chrome.guide.color') return true;
      return value === '#EC4899';
    });
    return { left: a.state.left, top: a.state.top, guideCount: guides.length };
  });

  // 吸附后 right = 160 + 140 = 300，正好对齐第二个矩形 left=300
  expect(snap.left).toBe(160);
  expect(snap.top).toBe(80);
  expect(snap.guideCount).toBeGreaterThan(0);

  await page.mouse.up();
});
