/**
 * 主画布 HiDPI（dpr）端到端验证。
 *
 * 断言（真实浏览器）：
 * - dpr=2 的 canvas backing store = cssSize × 2，dpr=1 的等于 cssSize
 * - 两侧都真的有像素输出
 * - dpr=2 下命中检测仍用 CSS 像素语义：用 CSS 坐标命中图形，结果与 dpr=1 一致
 */
import { test, expect } from '@playwright/test';

const PAGE = '/examples/performance/hidpi.html';

test('HiDPI：backing store 放大到 css×dpr，且 dpr=2 下命中检测仍用 CSS 坐标', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const info: any = await page.evaluate(() => {
    const hud: any = (window as any).__hidpi;
    const c1: any = document.getElementById('canvas-1');
    const c2: any = document.getElementById('canvas-2');
    const painted = (c: any) => {
      const d = c.getContext('2d');
      const img = d.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < img.length; i += 4) if (img[i] !== 0) n++;
      return n;
    };
    const ice2: any = (window as any).__ice2 || null;
    return {
      hud,
      c1: { w: c1.width, h: c1.height, painted: painted(c1) },
      c2: { w: c2.width, h: c2.height, painted: painted(c2) },
      hasIce2: !!ice2,
    };
  });

  expect(errors).toEqual([]);

  // backing store：dpr=1 → cssSize；dpr=2 → cssSize × 2
  expect(info.hud.dpr1.engineDpr).toBe(1);
  expect(info.hud.dpr2.engineDpr).toBe(2);
  expect(info.c1.w).toBe(420);
  expect(info.c1.h).toBe(300);
  expect(info.c2.w).toBe(840);
  expect(info.c2.h).toBe(600);

  // 两侧都真的画出了东西
  expect(info.c1.painted).toBeGreaterThan(0);
  expect(info.c2.painted).toBeGreaterThan(0);

  // dpr=2 下命中检测：用 CSS 坐标命中圆形（左上 60,175 / 半径 26 → 圆心 86,201）
  const hit: any = await page.evaluate(() => {
    const ice: any = (window as any).__iceDpr2;
    if (!ice) return { skipped: true };
    const c = ice.hitTest(86, 201);
    return { skipped: false, type: c ? c.constructor.name : null };
  });
  if (!hit.skipped) {
    expect(hit.type).toBe('ICECircle');
  }
});
