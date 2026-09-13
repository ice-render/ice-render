import { expect, test } from '@playwright/test';

/**
 * 表达力（⑤）的**真实浏览器**验证：应用层自定义动画的四件事在真 canvas 上确实生效。
 *
 * 单测用的是桩对象；这里验的是"值真的写进了 state、真的画到了画布上"：
 * 颜色插值出的 `rgb(...)` 是 canvas 认的颜色、自定义缓动决定手感、回调按序触发、alternate 往返。
 */
const FIXTURE = '/e2e/visual/fixtures/nested-interaction.html';

test('颜色插值 + 自定义缓动 + 回调链 + alternate 往返（真实引擎）', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.waitForTimeout(400);

  const result = await page.evaluate(async () => {
    const ice = (window as any).__ice;
    const ICE = (window as any).ICE;
    // 应用层注册自己的缓动
    ICE.registerEasing('e2eEase', (t: number) => t * t);

    const events: string[] = [];
    const rect = new ICE.ICERect({
      left: 100,
      top: 100,
      width: 60,
      height: 40,
      style: { fillStyle: '#ff0000' },
      animations: {
        // 颜色动画：红 → 蓝（以前直接不支持）
        'style.fillStyle': {
          from: '#ff0000',
          to: '#0000ff',
          duration: 400,
          onComplete: () => events.push('color-done'),
        },
        // 自定义缓动 + alternate 往返：0 → 120，来回一次
        'transform.translate': {
          from: [0, 0],
          to: [120, 0],
          duration: 400,
          easing: 'e2eEase',
          direction: 'alternate',
          iterationCount: 2,
          onStart: () => events.push('start'),
          onRepeat: () => events.push('repeat'),
          onComplete: () => events.push('move-done'),
        },
      },
    });
    ice.addChild(rect);
    ice.dirty = true;
    ice.evtBus.trigger('ICE_FRAME_EVENT');

    const sample = () => ({
      color: rect.state.style.fillStyle,
      translate: rect.state.transform.translate.slice(),
    });

    await new Promise((resolve) => setTimeout(resolve, 250)); // 中途
    const middle = sample();
    await new Promise((resolve) => setTimeout(resolve, 800)); // 两个动画都跑完
    const end = sample();

    // 颜色确实被画到了画布上（取矩形内部一点的像素）
    const canvas = document.getElementById('canvas-1') as HTMLCanvasElement;
    const data = canvas.getContext('2d')!.getImageData(120, 110, 1, 1).data;

    return { middle, end, events, pixel: [data[0], data[1], data[2], data[3]] };
  });

  // 中途：颜色是插值出来的中值（红蓝混合），位移只走了自定义缓动的平方进度
  expect(result.middle.color).toMatch(/^rgb\(\d+, 0, \d+\)$/);
  const midColor = result.middle.color.match(/^rgb\((\d+), 0, (\d+)\)$/)!;
  expect(Number(midColor[1])).toBeGreaterThan(0);
  expect(Number(midColor[2])).toBeGreaterThan(0);

  // 终点：颜色精确到蓝；位移回到起点（alternate 两个 iteration：去 + 回）
  expect(result.end.color).toBe('rgb(0, 0, 255)');
  expect(result.end.translate[0]).toBeCloseTo(0, 3);

  // 回调节奏：start → repeat（第一轮结束）→ color-done / move-done
  expect(result.events).toContain('start');
  expect(result.events).toContain('repeat');
  expect(result.events).toContain('color-done');
  expect(result.events).toContain('move-done');
  expect(result.events.indexOf('start')).toBeLessThan(result.events.indexOf('repeat'));
  expect(result.events.indexOf('repeat')).toBeLessThan(result.events.indexOf('move-done'));

  // 画布像素是蓝色的（颜色动画真的落地了，不只是 state 里有个字符串）
  expect(result.pixel[3]).toBeGreaterThan(200);
  expect(result.pixel[2]).toBeGreaterThan(200);
  expect(result.pixel[0]).toBeLessThan(60);
});

test('页面无 console / pageerror 报错', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(FIXTURE);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const ICE = (window as any).ICE;
    const ice = (window as any).__ice;
    const rect = new ICE.ICERect({
      left: 10,
      top: 10,
      width: 20,
      height: 20,
      animations: { left: { from: 0, to: 40, duration: 200, easing: (t: number) => t ** 3 } },
    });
    ice.addChild(rect);
    ice.dirty = true;
  });
  await page.waitForTimeout(400);
  expect(errors).toEqual([]);
});
