import { expect, test } from '@playwright/test';

/**
 * 分层渲染（静态层 + 动画层）的**真实浏览器**验证。
 *
 * 引擎只提供原语（`ICE.linkViewport` / `ice.setInputPassthrough`），分层由应用按配方组织：
 * 这两条原语正是「两层能一起缩放平移」与「上层不吃掉下层交互」的前提，缺一个分层就没法用。
 */
const FIXTURE = '/examples/animation/layered-canvas.html';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => !!(window as any).__staticIce && !!(window as any).__animIce);
  (page as any).__errors = errors;
});

test('两层都在画：静态层画一次、动画层持续动', async ({ page }) => {
  await page.waitForTimeout(400);
  const painted = await page.evaluate(() => {
    const count = (id: string) => {
      const c = document.getElementById(id) as HTMLCanvasElement;
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 10) n++;
      return n;
    };
    return { staticLayer: count('canvas-static'), animLayer: count('canvas-anim') };
  });
  expect(painted.staticLayer).toBeGreaterThan(5000);
  expect(painted.animLayer).toBeGreaterThan(2000);
});

test('视口双向绑定：任一侧缩放/平移，两层视口始终一致', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const staticIce = (window as any).__staticIce;
    const animIce = (window as any).__animIce;
    staticIce.setViewport(1.6, -40, -25);
    const afterStatic = { ...animIce.viewport };
    animIce.zoomAt(300, 200, 1.5);
    const afterAnim = { staticIce: { ...staticIce.viewport }, animIce: { ...animIce.viewport } };
    staticIce.setViewport(1, 0, 0); // 复位，别影响后续断言
    return { afterStatic, afterAnim };
  });
  expect(result.afterStatic).toEqual({ scale: 1.6, tx: -40, ty: -25 });
  expect(result.afterAnim.staticIce).toEqual(result.afterAnim.animIce);
});

test('输入穿透：点击动画层覆盖的区域，命中的是下层的静态图元', async ({ page }) => {
  // 先确认动画层确实覆盖着静态文本（两层同尺寸叠放）
  const passthroughOn = await page.evaluate(() => {
    const anim = document.getElementById('canvas-anim') as HTMLCanvasElement;
    return getComputedStyle(anim).pointerEvents;
  });
  expect(passthroughOn).toBe('none');

  // 取一个静态文本的中心（世界坐标 = 屏幕坐标，视口为单位视口）
  const point = await page.evaluate(() => {
    const staticIce = (window as any).__staticIce;
    const target = staticIce.childNodes.find((c: any) => c.state.text === '静态标签 0');
    const box = target.getMinBoundingBox(true);
    const rect = (document.getElementById('canvas-static') as HTMLCanvasElement).getBoundingClientRect();
    return { x: rect.left + box.centerPoint[0], y: rect.top + box.centerPoint[1] };
  });
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(150);
  const selected = await page.evaluate(() =>
    ((window as any).__staticIce.selectionList || []).map((c: any) => c.state.text || c.constructor.typeId)
  );
  expect(selected).toContain('静态标签 0');

  // 关掉穿透后，事件被动画层吃掉 → 下层不再选中（这正是"为什么必须给穿透"的证据）
  await page.evaluate(() => (window as any).__animIce.setInputPassthrough(false));
  const point2 = await page.evaluate(() => {
    const staticIce = (window as any).__staticIce;
    const target = staticIce.childNodes.find((c: any) => c.state.text === '静态标签 1');
    const box = target.getMinBoundingBox(true);
    const rect = (document.getElementById('canvas-static') as HTMLCanvasElement).getBoundingClientRect();
    return { x: rect.left + box.centerPoint[0], y: rect.top + box.centerPoint[1] };
  });
  await page.mouse.click(point2.x, point2.y);
  await page.waitForTimeout(150);
  const selected2 = await page.evaluate(() =>
    ((window as any).__staticIce.selectionList || []).map((c: any) => c.state.text || c.constructor.typeId)
  );
  expect(selected2).not.toContain('静态标签 1');
});

test('静音/继续整层动画不影响另一层', async ({ page }) => {
  const before = await page.evaluate(() => {
    const anim = (window as any).__animIce;
    return anim.animationManager.isPaused();
  });
  expect(before).toBe(false);
  await page.evaluate(() => (window as any).__animIce.animationManager.pause());
  const paused = await page.evaluate(() => (window as any).__animIce.animationManager.isPaused());
  expect(paused).toBe(true);
  const staticDirty = await page.evaluate(() => (window as any).__staticIce.dirty);
  expect(staticDirty).toBe(false); // 静态层空闲，不该被动画层牵连
  await page.evaluate(() => (window as any).__animIce.animationManager.resume());
});

test('页面无 console / pageerror 报错', async ({ page }) => {
  await page.waitForTimeout(300);
  expect((page as any).__errors).toEqual([]);
});
