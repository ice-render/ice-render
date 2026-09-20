/**
 * `roundRect` 的两条实现路径必须**逐像素一致**（永久回归）。
 *
 * 背景：引擎把圆角矩形从「4 次 arcTo 手撸」（10 条命令 + 每角一次三角函数）换成了
 * 平台规范的 `Path2D.roundRect`（2021 进入 Canvas 2D）。但 `roundRect` 不是所有运行时都有
 * —— `Path2DRecorder` 在构造时探一次，没有就**展开成等价的 `moveTo/lineTo/arcTo`** 再转发给原生对象。
 *
 * 于是这里有两条真实存在的分支，而它们**必须画出同一张图**：
 *   ① 有原生 `roundRect` → 原样转发；
 *   ② 没有 → 展开（老 Safari / 某些 headless 的 Path2D 实现走这条）。
 *
 * 夹具页在同一页里跑两个画布，第二个画布**在创建引擎之前**把 `Path2D.prototype.roundRect`
 * 删掉，因此两边的差异只可能来自「转发 vs 展开」这一件事。
 *
 * 为什么 jest 里测不了：展开的正确性（切线圆角、半径等比缩放、负宽高镜像）只有真的光栅化
 * 出来跟原生比才知道；node 环境没有 Path2D，比的是"命令流长什么样"，不是"画出来一不一样"。
 *
 * 覆盖的边角：标量半径 / 超限半径（等比缩成胶囊形）/ 半径 0（直角）/ 只描边 /
 * 四角不同半径 `[8,24,40,56]` / 负宽高（往左上画）。
 */
import { test, expect } from '@playwright/test';

declare const window: any;

test('roundRect：原生转发 vs arcTo 展开，渲染逐像素一致', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/e2e/visual/fixtures/round-rect-parity.html', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const stats = await page.evaluate(() => window.__stats());

  // 前提校验：两条分支真的各自走到了（否则"一致"是废话）
  expect(stats.nativeHasRoundRect, '原生画布应当走 roundRect 转发').toBe(true);
  expect(stats.fallbackHasRoundRect, '回退画布的原生对象不应有 roundRect').toBe(false);
  // 六个形状：3 个带圆角的 ICERect + 2 个自定义形状走 roundRect，radius=0 的那个走 rect
  expect(stats.nativeCommands.filter((c: string) => c.includes('roundRect')).length).toBe(5);
  expect(stats.nativeCommands.filter((c: string) => c === 'rect+closePath').length).toBe(1);
  expect(stats.nativeCommands).toHaveLength(6);
  expect(stats.fallbackCommands).toEqual(stats.nativeCommands); // 命令流与实现分支无关

  // 防空转：两边都得真的画了东西
  expect(stats.nativeInk).toBeGreaterThan(20000);
  expect(stats.fallbackInk).toBeGreaterThan(20000);

  const diff = await page.evaluate(() => window.__compare());
  expect(diff.diff, `差异像素 ${diff.diff}/${diff.total}，最大通道差 ${diff.maxDelta}`).toBe(0);
  expect(errors).toEqual([]);
});
