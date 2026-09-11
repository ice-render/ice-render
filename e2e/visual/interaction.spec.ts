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
  // 进入编辑态后变换面板应隐藏，避免手柄遮挡文本/光标
  expect(await page.evaluate(() => window.__ice.controlPanelManager.transformControlPanel.state.display)).toBe(false);

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

test('文本编辑：编辑态禁拖拽 + 点击别处退出编辑', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  const c = await page.evaluate(() => {
    const p = window.__text.getMinBoundingBox(true).centerPoint;
    return { x: p[0], y: p[1] };
  });

  // 双击进入编辑
  await page.mouse.dblclick(c.x, c.y);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__text.state.editing)).toBe(true);
  expect(await page.evaluate(() => window.__text.state.draggable)).toBe(false); // 编辑态禁拖拽

  // 点击空白处 → 失焦退出编辑
  await page.mouse.click(900, 700);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__text.state.editing)).toBe(false);
  expect(await page.evaluate(() => window.__text.state.draggable)).toBe(true); // 恢复拖拽
});

test('文本编辑：IME 中文输入 + 文本选中不显示变换面板', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  const c = await page.evaluate(() => {
    const p = window.__text.getMinBoundingBox(true).centerPoint;
    return { x: p[0], y: p[1] };
  });

  // 双击进入编辑，确认叠加了 input
  await page.mouse.dblclick(c.x, c.y);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => !!document.querySelector('input'))).toBe(true);

  // IME 中文输入（insertText 模拟组合输入）
  await page.keyboard.insertText('你好世界');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__text.getText())).toBe('hello你好世界');

  // 回车提交，input 移除
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__text.state.editing)).toBe(false);

  // 文本选中：transformable=false，不显示变换面板
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(100);
  const panel = await page.evaluate(() => window.__ice.controlPanelManager.transformControlPanel.state.display);
  expect(panel).toBe(false);
  expect(await page.evaluate(() => window.__text.state.transformable)).toBe(false);
});

/**
 * 修饰键约束：Shift 等比缩放 / Shift 旋转吸附。
 *
 * 这条用例同时守住两件事：
 * 1. 输入层必须把 DOM 事件的修饰键透传到组件事件上 —— `shiftKey` 是 DOM 事件原型上的
 *    不可枚举 getter，`ICEEvent` 的 `for...in` 拷贝带不过来（曾整条链路丢失）；
 * 2. 手柄确实按约束计算（等比 / 吸附 15°）。
 */
test('Shift 拖角手柄：保持目标宽高比（未旋转目标）', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  // 用顶层「未旋转」矩形：轴对齐时变换面板外框 = 组件盒子，等比约束可以精确断言。
  // （目标带旋转时面板是世界轴对齐外框，外框↔本地尺寸的映射本身有损，不适合做精确断言。）
  const c = await page.evaluate(() => window.__center('plain'));
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(200);

  const before = await page.evaluate(() => {
    const r = (window as any).__components.plain.state;
    return { width: r.width, height: r.height };
  });
  expect(before.width).toBeGreaterThan(1);
  const originRatio = before.width / before.height;

  await page.keyboard.down('Shift');
  for (let i = 0; i < 3; i++) {
    const hc = await page.evaluate(() => {
      const h = (window as any).__handles().find((x: any) => x.state.quadrant === 1);
      return (window as any).__handleCenter(h);
    });
    await page.mouse.move(hc.x, hc.y);
    await page.mouse.down();
    // 故意用非等比位移：只有等比约束生效，比例才不会被带歪
    await page.mouse.move(hc.x + 30, hc.y - 4, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(80);
  }
  await page.keyboard.up('Shift');

  const after = await page.evaluate(() => {
    const r = (window as any).__components.plain.state;
    return { width: r.width, height: r.height };
  });
  expect(after.width).toBeGreaterThan(before.width); // 反向自检：确实被拉大了
  expect(after.width / after.height).toBeCloseTo(originRatio, 2);
});

test('Shift 拖旋转手柄：角度吸附到 15° 整数倍', async ({ page }) => {
  await page.goto('/e2e/visual/fixtures/nested-interaction.html');
  await page.waitForTimeout(400);

  const c = await page.evaluate(() => window.__center('rect'));
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(150);
  const initialWorld = await page.evaluate(() => (window as any).__components.rect.getRotateAngle(true));

  await page.keyboard.down('Shift');
  const rhc = await page.evaluate(() => (window as any).__handleCenter((window as any).__rotateHandle()));
  await page.mouse.move(rhc.x, rhc.y);
  await page.mouse.down();
  // 用非 15° 整数倍的位移，确保「不吸附就必然不是整数倍」
  await page.mouse.move(rhc.x + 37, rhc.y + 13, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  await page.keyboard.up('Shift');

  // 断言「世界旋转角」而不是目标本地角：本地角还会叠加祖先旋转（夹具的 root 带 45°），
  // 手柄控制的是面板角，setGlobalRotate 再把它换算到目标本地。
  const world = await page.evaluate(() => (window as any).__components.rect.getRotateAngle(true));
  expect(Number.isFinite(world)).toBe(true);
  // 必须落在 15° 整数倍上。容差取 1e-3：矩阵链（atan2 → 逆矩阵 → 变换叠加）会累积 ~1e-6 级误差，
  // 不能按「精确整除」断言。
  const offGrid = Math.abs(world - Math.round(world / 15) * 15);
  expect(offGrid).toBeLessThan(1e-3);
  // 反向自检：这次拖拽确实改变了角度（否则上面的断言会空转）
  expect(Math.abs(world - initialWorld)).toBeGreaterThan(1);
});
