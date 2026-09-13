import { expect, test } from '@playwright/test';

/**
 * 帧调度与合规（④）的**真实浏览器**验证：
 *
 * - **空闲停帧**：没有脏、没有动画时 `FrameManager` 不再续帧（页面静止时 0 帧回调）；
 *   有动画/有脏时恢复；动画结束或暂停后再次归零。
 * - **减少动态效果**：`prefers-reduced-motion: reduce` 下动画直接落终态（不播放过程）。
 *
 * 这两条在单测里只能验桩，必须有真浏览器（rAF / matchMedia 都是宿主能力）。
 */
const FIXTURE = '/e2e/visual/fixtures/nested-interaction.html';

/** 统计 500ms 内 `ICE_FRAME_EVENT` 的次数。 */
async function countFrames(page: any): Promise<number> {
  return page.evaluate(async () => {
    const ice = (window as any).__ice;
    let frames = 0;
    const handler = (): void => {
      frames += 1;
    };
    ice.evtBus.on('ICE_FRAME_EVENT', handler);
    await new Promise((resolve) => setTimeout(resolve, 500));
    ice.evtBus.off('ICE_FRAME_EVENT', handler);
    return frames;
  });
}

test('空闲停帧：静止时 0 帧，有动画时恢复，动画结束/暂停后再次归零', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForTimeout(400);

  // ① 静止场景（无动画、无脏）：不应再有帧回调
  expect(await countFrames(page)).toBe(0);

  // ② 挂一个循环动画：帧循环被唤醒
  await page.evaluate(() => {
    const ice = (window as any).__ice;
    const rect = new (window as any).ICE.ICERect({
      left: 20,
      top: 20,
      width: 20,
      height: 20,
      style: { fillStyle: '#ef4444' },
      animations: { 'transform.translate': { from: [0, 0], to: [40, 0], duration: 600, loop: true } },
    });
    ice.addChild(rect);
    ice.dirty = true;
    ice.renderer.frameEvtHandler();
  });
  await page.waitForTimeout(200);
  const framesAfterAdd = await countFrames(page);
  const stateAfterAdd = await page.evaluate(() => {
    const ice = (window as any).__ice;
    return {
      animMapSize: ice.animationManager.animationMap.size,
      hasActive: ice.animationManager.hasActiveAnimations(),
      dirty: ice.dirty,
      stopped: undefined,
    };
  });
  expect(framesAfterAdd, JSON.stringify(stateAfterAdd)).toBeGreaterThan(10);

  // ③ 暂停 → 进度不推进 → 停帧
  await page.evaluate(() => (window as any).__ice.animationManager.pause());
  await page.waitForTimeout(200);
  expect(await countFrames(page)).toBe(0);

  // ④ 恢复 → 又跑起来
  await page.evaluate(() => (window as any).__ice.animationManager.resume());
  await page.waitForTimeout(200);
  expect(await countFrames(page)).toBeGreaterThan(10);

  // ⑤ 清掉动画并静置 → 再次归零
  await page.evaluate(() => {
    const ice = (window as any).__ice;
    ice.animationManager.animationMap.clear();
    ice.dirty = false;
  });
  await page.waitForTimeout(300);
  expect(await countFrames(page)).toBe(0);
});

test('置脏会把停掉的帧循环唤醒（否则画面永远不更新）', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForTimeout(400);
  expect(await countFrames(page)).toBe(0); // 先确认处于停帧状态

  const painted = await page.evaluate(async () => {
    const ice = (window as any).__ice;
    const rect = new (window as any).ICE.ICERect({
      left: 600,
      top: 500,
      width: 40,
      height: 30,
      style: { fillStyle: '#10b981' },
    });
    ice.addChild(rect); // 结构性变更 → ice.dirty = true → 应唤醒帧循环
    await new Promise((resolve) => setTimeout(resolve, 300));
    const canvas = document.getElementById('canvas-1') as HTMLCanvasElement;
    const data = canvas.getContext('2d')!.getImageData(600, 500, 40, 30).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 10) opaque += 1;
    return opaque;
  });
  expect(painted).toBeGreaterThan(500); // 新加的图元真的被画出来了
});

test('减少动态效果：prefers-reduced-motion: reduce 下动画直接落终态', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(FIXTURE);
  await page.waitForTimeout(400);

  const result = await page.evaluate(() => {
    const ice = (window as any).__ice;
    const rect = new (window as any).ICE.ICERect({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      animations: { left: { from: 0, to: 300, duration: 1000 } },
    });
    ice.addChild(rect);
    ice.dirty = true;
    ice.evtBus.trigger('ICE_FRAME_EVENT'); // 走总线帧：动画管理器 + 渲染器都会跑
    return {
      reducedMotion: ice.isReducedMotion(),
      left: rect.state.left,
      diagnostics: ice.animationManager.getDiagnostics().map((d: any) => d.code),
      hasActiveAnimations: ice.animationManager.hasActiveAnimations(),
    };
  });

  expect(result.reducedMotion).toBe(true);
  expect(result.left).toBe(300); // 直接落终态（不是从 0 慢慢走）
  expect(result.diagnostics).toContain('ICE_ANIM_REDUCED_MOTION');
  expect(result.hasActiveAnimations).toBe(false); // 没有留下"在推进"的动画
});

test('正常偏好下同一条动画照常逐帧播放（对照组）', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForTimeout(400);
  const result = await page.evaluate(async () => {
    const ice = (window as any).__ice;
    const rect = new (window as any).ICE.ICERect({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      animations: { left: { from: 0, to: 300, duration: 1000 } },
    });
    ice.addChild(rect);
    ice.dirty = true;
    ice.evtBus.trigger('ICE_FRAME_EVENT');
    const first = rect.state.left;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { reducedMotion: ice.isReducedMotion(), first, later: rect.state.left };
  });
  expect(result.reducedMotion).toBe(false);
  expect(result.first).toBeLessThan(50); // 首帧还在起点附近
  expect(result.later).toBeGreaterThan(result.first); // 逐帧推进
});
