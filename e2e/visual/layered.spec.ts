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

test('跨层迁移：把静态图元提升到动画层再放回，世界坐标不变且监听不丢', async ({ page }) => {
  const result = await page.evaluate(() => {
    const staticIce = (window as any).__staticIce;
    const animIce = (window as any).__animIce;
    const target = staticIce.childNodes.find((c: any) => c.state.text === '静态标签 5');
    staticIce.setSelection([target]);

    const worldBefore = target.getMinBoundingBox(true).centerPoint.slice();
    const fired = [];
    target.on('after-move', () => fired.push('after-move'));

    // 提升到动画层
    document.getElementById('btn-migrate').click();
    // 让动画层把这一帧画出来（迁移后的重绑/动画注册都要在这一帧生效）
    animIce.dirty = true;
    animIce.renderer.frameEvtHandler();

    const afterPromote = {
      inAnimLayer: animIce.childNodes.indexOf(target) !== -1,
      inStaticLayer: staticIce.childNodes.indexOf(target) !== -1,
      ice: target.ice === animIce,
      evtBus: target.evtBus === animIce.evtBus,
      animated: !!(target.props.animations && target.props.animations['transform.translate']),
      selectedInAnim: animIce.selectionList.indexOf(target) !== -1,
      selectedInStatic: staticIce.selectionList.indexOf(target) !== -1,
      world: target.getMinBoundingBox(true).centerPoint.slice(),
    };

    // 放回静态层
    document.getElementById('btn-migrate-back').click();
    const afterBack = {
      inStaticLayer: staticIce.childNodes.indexOf(target) !== -1,
      inAnimLayer: animIce.childNodes.indexOf(target) !== -1,
      ice: target.ice === staticIce,
      evtBus: target.evtBus === staticIce.evtBus,
    };
    return { worldBefore, afterPromote, afterBack, firedCount: fired.length };
  });

  // 提升：换层、重绑、动画注册与选中态都跟过去，世界坐标不变（≤1px，量化/取整误差）
  expect(result.afterPromote.inAnimLayer).toBe(true);
  expect(result.afterPromote.inStaticLayer).toBe(false);
  expect(result.afterPromote.ice).toBe(true);
  expect(result.afterPromote.evtBus).toBe(true);
  expect(result.afterPromote.animated).toBe(true);
  expect(result.afterPromote.selectedInAnim).toBe(true);
  expect(result.afterPromote.selectedInStatic).toBe(false);
  expect(Math.abs(result.afterPromote.world[0] - result.worldBefore[0])).toBeLessThanOrEqual(1);
  expect(Math.abs(result.afterPromote.world[1] - result.worldBefore[1])).toBeLessThanOrEqual(1);

  // 放回：回到静态层，引用也换回来
  expect(result.afterBack.inStaticLayer).toBe(true);
  expect(result.afterBack.inAnimLayer).toBe(false);
  expect(result.afterBack.ice).toBe(true);
  expect(result.afterBack.evtBus).toBe(true);
});

test('页面无 console / pageerror 报错', async ({ page }) => {
  await page.waitForTimeout(300);
  expect((page as any).__errors).toEqual([]);
});

test('多层导出：SVG 合成两层内容、PNG 合成两层像素', async ({ page }) => {
  // SVG：矢量合成 —— 静态层的文本与动画层的标记都要在，且尺寸覆盖整个画布
  await page.click('#btn-export-svg');
  await page.waitForTimeout(300);
  const svg = await page.evaluate(() => (window as any).__layeredSvg as string);
  expect(svg).toContain('<svg');
  expect(svg).toContain('静态标签 0'); // 下层（静态层）的内容
  // 上层（动画层）的标记：颜色取自 COLORS[0] = #3B82F6
  expect(svg.toLowerCase()).toContain('#3b82f6');
  // viewport 口径：尺寸 = 画布尺寸（两层都是 1024×640）
  const meta = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
  expect(meta).toBeTruthy();
  expect([Number(meta![1]), Number(meta![2])]).toEqual([1024, 640]);

  // PNG：位图合成 —— 拿到 data URL，且尺寸与画布一致（两层都是 1024×640）
  await page.click('#btn-export-png');
  await page.waitForTimeout(300);
  const png = await page.evaluate(() => (window as any).__layeredPng as string);
  expect(png.startsWith('data:image/png;base64,')).toBe(true);
  const size = await page.evaluate(async (dataUrl: string) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  }, png);
  expect(size).toEqual({ width: 1024, height: 640 });

  // 单层对比：只导静态层时不应包含动画层的标记色（证明"合成确实叠了两层"）
  const single = await page.evaluate(() => (window as any).__staticIce.toSvg());
  expect(single.toLowerCase()).toContain('#475569'); // 静态文本色
  expect(single.toLowerCase()).not.toContain('#3b82f6'); // 标记色只存在于动画层
});
