/**
 * Worker 镜像渲染（阶段二 · 第一块：跨线程状态/命令协议）的真机验收。
 *
 * 判据：**worker 按协议同步出来的画面，必须与主线程用同一棵树直绘的画面逐像素一致**。
 * 这条比"画面动起来了"强得多 —— 它同时钉住了三件事：
 * ① 全量场景（`scene`）能把树完整搬过去（类型注册、派生参数、主题都在内）；
 * ② 状态增量（`ops`）与原树逐点等价（含点集这类派生参数、嵌套 `style` 深合并）；
 * ③ 结构变更走全量重同步之后，镜像依旧与原树一致。
 *
 * 场景刻意**不含文本**：worker 内拿不到主画布的 `lang`，CJK 字形选择可能与主线程分叉
 * （见 docs/architecture/10-worker-offscreen.md §2 的边界表）。几何场景应当严格 0 差异。
 */
import { test, expect } from '@playwright/test';

interface MirrorCmp {
  diff: number;
  alphaDiff: number;
  maxChannel: number;
  maxPremult: number;
  firstPixel: number;
  total: number;
}

test('worker 镜像：状态增量与结构重同步之后，画面与主线程参考逐像素一致', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/examples/worker/mirror-render.html', { waitUntil: 'load' });
  await page.waitForFunction(() => (window as any).__ready(), undefined, { timeout: 20_000 });

  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const ok = await page.evaluate((s: number) => (window as any).__step(s), i);
    expect(ok, `step ${i} 应当存在`).toBe(true);
    const before: any = await page.evaluate(() => (window as any).__stats().frames);
    const frame: any = await page.evaluate((since: number) => (window as any).__waitFrame(since), before);
    // `renderMs` 只用于报告（小场景常常 <0.1ms，量到 0 不代表没渲染）；用帧计数确认"真的画了一帧"
    expect(frame.stats.frames).toBeGreaterThan(0);
    expect(frame.stats.renderMs).toBeGreaterThanOrEqual(0);
    const cmp: MirrorCmp = await page.evaluate(() => (window as any).__compare());
    expect(cmp.alphaDiff, `step ${i} alpha 差异（覆盖率错位）：${JSON.stringify(cmp)}`).toBe(0);
    expect(cmp.maxPremult, `step ${i} 预乘通道差：${JSON.stringify(cmp)}`).toBeLessThanOrEqual(2);
    // 几何场景（无文本）钉严格 0：任何结构性错位都不该被容差放过
    expect(cmp.diff, `step ${i} 差异像素：${JSON.stringify(cmp)}`).toBe(0);
  }

  const stats: any = await page.evaluate(() => (window as any).__stats());
  expect(stats.last.appliedOps, '镜像应当真的应用过状态补丁').toBeGreaterThan(0);
  expect(errors, '不应有页面/console 错误').toEqual([]);

  const line =
    `mirror 帧=${stats.frames} 消息=${stats.sent} 组件=${stats.last.components} ` +
    `已应用 op=${stats.last.appliedOps} 最后一帧 ${stats.last.renderMs.toFixed(2)}ms`;
  console.log(`[worker-mirror] ${line}`);
  test.info().annotations.push({ type: 'worker-mirror', description: line });
});
