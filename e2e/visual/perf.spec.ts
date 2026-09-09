/**
 * 真实画布渲染基准（Playwright 采集）。
 *
 * 加载 examples/performance/bench-scene.html（真实 canvas + Path2D + 光栅化），
 * 在多量级组件数下测量：
 *   - static/anim：单帧「引擎 JS + 光栅化」成本（同步驱动 frameEvtHandler）。
 *   - fps：引擎 rAF 驱动下的实际帧率（含 vsync 节奏）。
 *
 * 本文件是「数据采集 + 宽松上界」两类用途：
 *   - 常规运行会在 stdout 打印性能表格（可作人工回归基线）。
 *   - 上界断言故意放得很松，只在出现数量级级的回退时失败，避免 CI 机器抖动误报。
 *
 * 串行执行（mode: 'serial'），避免多个 benchmark 并发抢 CPU 相互干扰。
 */
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const SYNC_CASES = [
  { n: 1000, mode: 'static' },
  { n: 5000, mode: 'static' },
  { n: 5000, mode: 'anim' },
  { n: 10000, mode: 'anim' },
  { n: 5000, mode: 'drag', plain: true }, // 全不透明场景拖动单组件（脏矩形局部重绘生效）
  { n: 10000, mode: 'drag', plain: true },
];

const LOOSE_CEIL_MS = { 1000: 500, 5000: 2000, 10000: 4000 };

function pad(s, w) {
  s = String(s);
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

for (const c of SYNC_CASES) {
  test(`bench-scene n=${c.n} mode=${c.mode}`, async ({ page }) => {
    test.setTimeout(90_000);
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto(
      `/examples/performance/bench-scene.html?n=${c.n}&mode=${c.mode}&frames=60${c.plain ? '&plain=1' : ''}`,
      {
        waitUntil: 'load',
      }
    );
    await page.waitForFunction(() => (window as any).__benchResult !== undefined, undefined, { timeout: 60_000 });

    const res = await page.evaluate(() => (window as any).__benchResult);

    expect(pageErrors, '页面不应有未捕获异常').toEqual([]);
    expect(res.n, '组件数应与请求一致').toBe(c.n);
    expect(res.frameStats, '应产出 frameStats').toBeTruthy();

    const s = res.frameStats;
    expect(s.p50).toBeGreaterThan(0);
    expect(s.p50).toBeLessThan(LOOSE_CEIL_MS[c.n]);

    // 打印数据行（含 human 可读汇总）
    const line =
      pad(`n=${res.n}`, 12) +
      pad(`mode=${res.mode}`, 10) +
      pad(`comps=${res.totalComponents}`, 14) +
      pad(`p50=${s.p50.toFixed(3)}ms`, 16) +
      pad(`p95=${s.p95.toFixed(3)}ms`, 16) +
      pad(`max=${s.max.toFixed(3)}ms`, 16) +
      pad(`~fps=${(1000 / s.p50).toFixed(0)}`, 12) +
      `build=${res.buildMs.toFixed(1)}ms`;
    console.log(`[perf] ${line}`);
    test.info().annotations.push({ type: 'perf', description: line });
    test.info().attach('bench-result.json', { body: JSON.stringify(res, null, 2), contentType: 'application/json' });
  });
}

test('bench-scene n=5000 mode=fps (引擎 rAF 真实帧率)', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/examples/performance/bench-scene.html?n=5000&mode=fps&duration=1200', { waitUntil: 'load' });
  await page.waitForFunction(() => (window as any).__benchResult !== undefined, undefined, { timeout: 30_000 });

  const res = await page.evaluate(() => (window as any).__benchResult);
  expect(pageErrors, '页面不应有未捕获异常').toEqual([]);
  expect(res.fps).toBeGreaterThan(0);

  const line = `n=${res.n}  mode=fps  completed=${res.frames}帧/${res.elapsedMs.toFixed(0)}ms  fps=${res.fps.toFixed(1)}`;
  console.log(`[perf] ${line}`);
  test.info().annotations.push({ type: 'perf', description: line });
  test.info().attach('bench-result.json', { body: JSON.stringify(res, null, 2), contentType: 'application/json' });
});
