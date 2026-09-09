import { test, expect } from '@playwright/test';

/**
 * 引擎渲染可视化回归（golden-image）。
 *
 * 原理：对一组「确定性渲染」的示例页截图，与已提交的基准图（__snapshots__）做像素级对比，
 * 捕获 jest 单测抓不到的「光栅层」回归（例如某次改动导致矩形渲染错位、嵌套坐标算错但矩阵值仍有限）。
 *
 * 注意：只收录「静态确定渲染」的示例，排除含 rAF 动画/随机坐标的示例（如 marching-ant、animation-basic）。
 */

const demos: Array<{ name: string; path: string }> = [
  { name: 'group-nested', path: '/examples/group/group-nested.html' },
  { name: 'group-and-children', path: '/examples/group/group-and-children.html' },
  { name: 'line-basic', path: '/examples/line-and-link/line-basic.html' },
  { name: 'line-visio', path: '/examples/line-and-link/line-visio.html' },
  { name: 'text-in-group', path: '/examples/text/text-in-group.html' },
  { name: 'text-padding', path: '/examples/text/text-padding.html' },
  { name: 'text-multiline', path: '/examples/text/text-multiline.html' },
  { name: 'text-edit', path: '/examples/text/text-edit.html' },
  { name: 'origin-custom', path: '/examples/transform/origin-custom.html' },
  { name: 'link-label', path: '/examples/line-and-link/link-label.html' },
  { name: 'shapes-style-effects', path: '/examples/shapes/shapes-style-effects.html' },
  { name: 'image-clip', path: '/examples/image/image-clip.html' },
  { name: 'line-curve', path: '/examples/line-and-link/line-curve.html' },
  { name: 'image-sprite', path: '/examples/image/image-sprite.html' },
  { name: 'flow-layout', path: '/examples/layout/flow-layout.html' },
  { name: 'layered-layout', path: '/examples/layout/layered-layout.html' },
];

for (const d of demos) {
  test(d.name, async ({ page }) => {
    await page.goto(d.path);
    // 等待首帧渲染完成（引擎由 rAF 驱动）
    await page.waitForTimeout(600);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveScreenshot(`${d.name}.png`);
  });
}
