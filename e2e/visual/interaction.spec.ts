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

test('反复翻转+旋转后 8 个手柄象限仍唯一（修复手柄消失）', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  const c = await page.evaluate(() => window.__center('rect'));
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(150);

  const uniq = () =>
    page.evaluate(() => {
      const qs = window.__handles().map((h) => h.state.quadrant);
      return new Set(qs).size;
    });

  for (let round = 0; round < 5; round++) {
    // 拖角手柄跨过中心（触发象限翻转）
    const hc = await page.evaluate(() => {
      const h = window.__handles().find((x) => x.state.quadrant === 1);
      return h ? window.__handleCenter(h) : null;
    });
    const center = await page.evaluate(() => window.__center('rect'));
    if (hc) {
      await page.mouse.move(hc.x, hc.y);
      await page.mouse.down();
      await page.mouse.move(center.x + (center.x - hc.x), center.y + (center.y - hc.y), { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(80);
    }
    // 拖旋转手柄
    const rhc = await page.evaluate(() => window.__handleCenter(window.__rotateHandle()));
    await page.mouse.move(rhc.x, rhc.y);
    await page.mouse.down();
    await page.mouse.move(rhc.x + 40, rhc.y + 25, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(80);

    expect(await uniq()).toBe(8);
  }
});

test('命中检测精度：圆的包围盒边角点不误命中', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  // 先点圆的包围盒边角（圆心外 ~15.6px > 半径 12，但仍在 24×24 包围盒内）：
  // 精确判定下应命中后方的容器(group)，而非 circle（无预选中，避免面板遮挡干扰）
  const corner = await page.evaluate(() => {
    const p = window.__components.circle.localToGlobal(11, 11);
    return { x: p[0], y: p[1] };
  });
  await page.mouse.click(corner.x, corner.y);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__ice.selectionList[0] === window.__components.circle)).toBe(false);

  // 再点圆心：应选中 circle
  const center = await page.evaluate(() => {
    const p = window.__components.circle.localToGlobal(0, 0);
    return { x: p[0], y: p[1] };
  });
  await page.mouse.click(center.x, center.y);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__ice.selectionList[0] === window.__components.circle)).toBe(true);
});

test('文本内联编辑：双击进入编辑、键入更新文本', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  // 双击文本进入编辑态
  const c = await page.evaluate(() => {
    const p = window.__text.getMinBoundingBox(true).centerPoint;
    return { x: p[0], y: p[1] };
  });
  await page.mouse.dblclick(c.x, c.y);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__text.state.editing)).toBe(true);

  // 键入
  await page.keyboard.type(' world');
  await page.waitForTimeout(100);

  expect(await page.evaluate(() => window.__text.getText())).toBe('hello world');
});

test('Path2D 降级：无 Path2D 环境渲染与原生像素一致', async ({ page }) => {
  // 原生 Path2D 渲染
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);
  const nativeShot = await page.locator('#canvas-1').screenshot();

  // 模拟小程序低版本：删掉全局 Path2D，走 PolyfillPath2D
  const page2 = await page.context().newPage();
  await page2.addInitScript(() => {
    delete (window as any).Path2D;
  });
  await page2.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page2.waitForTimeout(400);

  // 确认走了 polyfill
  expect(await page2.evaluate(() => window.__components.rect.path2D._isPolyfill)).toBe(true);

  const polyfillShot = await page2.locator('#canvas-1').screenshot();
  // 两种渲染应逐像素一致
  expect(Buffer.compare(nativeShot, polyfillShot)).toBe(0);
  await page2.close();
});

test('多行文本：\\n 拆分后高度增加', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  const info = await page.evaluate(() => {
    const single = new ICE.ICEText({ left: 600, top: 300, text: 'hello' });
    const multi = new ICE.ICEText({ left: 600, top: 300, text: 'hello\nworld' });
    return { singleH: single.state.height, multiH: multi.state.height };
  });

  expect(info.multiH).toBeGreaterThan(info.singleH);
});
