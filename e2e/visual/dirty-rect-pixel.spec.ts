/**
 * 像素一致性验收（dirty-rect 决定性回归）。
 *
 * 同一确定性场景在 full 与 dirty-rect 两个 canvas 上渲染，逐步执行相同操作
 * （拖叶子/改色/拖 Group/改文本/旋转/控制面板启用禁用/结构变更），
 * 每一步后整幅逐像素比对必须 100% 一致。
 *
 * 两个场景：
 *  - 默认「富场景」：含旋转组/文本/阴影/星形/折线连线/面板，重点覆盖回退与各类边界；
 *  - ?opaque=1「全不透明场景」：无星形/折线/阴影，验证局部重绘真正执行（collectOk>0）且像素一致。
 */
import { test, expect } from '@playwright/test';

async function runSteps(page: any, url: string, requirePartial: boolean) {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const STEPS = 10;
  const stepResults: string[] = [];
  for (let i = 0; i < STEPS; i++) {
    await page.evaluate((s: number) => (window as any).__step(s), i);
    await page.waitForTimeout(200);
    const cmp: any = await page.evaluate(() => (window as any).__compare());
    stepResults.push(`step${i}: ${cmp.equal ? 'OK' : `DIFF=${cmp.diffCount}`}`);
    expect(cmp.equal, `step ${i} 像素不一致：${JSON.stringify(cmp)}`).toBe(true);
  }
  const stats: any = await page.evaluate(() => (window as any).__drStats);
  if (requirePartial) {
    expect(stats.collectOk, '全不透明场景应真正执行过至少一次局部重绘').toBeGreaterThan(0);
  }
  expect(pageErrors, '页面不应有未捕获异常').toEqual([]);
  return { stepResults, collectOk: stats.collectOk, perStep: stats.perStep as number[] };
}

/**
 * 富场景：含旋转 / 文本 / 阴影 / **已连接的折线** / 控制面板，覆盖「回退边界」。
 *
 * 注意：本场景预期**稳定回退全量**（`局部执行=0`），这不是失败 ——
 * 折线属于「clip 会切断描边抗锯齿」的风险类别（见 CanvasRenderer.__riskyIntersectsRegion），
 * 而它在连上宿主后包围盒是真实且较大的，因此与任何脏区域都相交 → 回退全量。
 * 局部重绘是否真正执行由下面几个 `opaque` 场景断言（`collectOk > 0`）。
 */
test('富场景：dirty-rect 与 full 逐步逐像素一致（含回退边界）', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(page, '/e2e/visual/fixtures/dirty-rect-compare.html', false);
  console.log(`[dirty-rect-pixel:rich] 10 步全部一致（局部执行=${collectOk} 次）`);
  console.log(`  ${stepResults.join('  ')}`);
});

test('全不透明场景：局部重绘真正执行且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1',
    true
  );
  console.log(`[dirty-rect-pixel:opaque] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

test('含文本的全不透明场景：文本离屏缓存后局部重绘且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&text=1',
    true
  );
  console.log(`[dirty-rect-pixel:text] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

test('含星形的全不透明场景：dot-path 离屏缓存后局部重绘且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&star=1',
    true
  );
  console.log(`[dirty-rect-pixel:star] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

test('含半透明矩形的全不透明场景：半透明 shape 离屏缓存后局部重绘且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&alpha=1',
    true
  );
  console.log(`[dirty-rect-pixel:alpha] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

/**
 * 非单位视口（缩放 + 平移）：脏区在世界坐标里收集，而 clearRect/clip 在渲染坐标里。
 * 这两个坐标系只在「视口为单位变换」时重合 —— 以前这里直接回退全量，现在走映射，
 * 因此既要断言**局部重绘真的执行了**（collectOk > 0），又要断言**逐像素仍一致**。
 */
test('非单位视口（缩放+平移）：局部重绘执行且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&zoom=1',
    true
  );
  console.log(`[dirty-rect-pixel:zoom] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

/** dpr=2：backing store 与渲染视口都放大一倍，同样不能靠回退全量来「蒙对」。 */
test('dpr=2 高分屏：局部重绘执行且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&hidpi=1',
    true
  );
  console.log(`[dirty-rect-pixel:dpr2] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

/** 两个因子同时生效：渲染视口 = dpr · viewport，映射必须一次到位。 */
test('非单位视口 + dpr=2 组合：局部重绘执行且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&zoom=1&hidpi=1',
    true
  );
  console.log(`[dirty-rect-pixel:zoom+dpr2] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

/**
 * 分散脏区：同一步里拖动两个相距很远的组件。
 * 若把脏区并成唯一的大盒，这个场景会直接撞上面积阈值 → 回退全量；
 * 切成多块后每块都贴近真实脏区，因此必须断言局部重绘确实执行了。
 */
test('分散脏区（多块裁剪）：局部重绘执行且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&multi=1',
    true
  );
  console.log(`[dirty-rect-pixel:multi] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  ${stepResults.join('  ')}`);
});

/**
 * 拖动「内含文本的分组」：子文本只被标 `dirty`（`paramsDirty` 仍为 false）且已命中离屏缓存，
 * 属于「仅位置变化」—— 主画布只是把位图平移贴回，clip 只作用整像素采样。
 * 这条路径此前被「刚变脏的 risky 组件一律回退」拦住，现在放开，必须仍然逐像素一致。
 */
test('拖动内含文本的分组（仅位置变化的已缓存 risky 组件）：局部重绘执行且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk, perStep } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&grouptext=1',
    true
  );
  console.log(`[dirty-rect-pixel:grouptext] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  每步局部帧数=${JSON.stringify(perStep)}`);
  // 第 3 步是「拖动整个 Group」，分组内的文本只被标 dirty（paramsDirty 仍 false）且已缓存 →
  // 必须能走局部重绘。这条断言有区分度：去掉放宽逻辑后该步为 0。
  expect(perStep[3], '拖动含文本的分组必须走局部重绘').toBeGreaterThan(0);
});

/**
 * 横跨场景的连线：连线通常跨画布 → 任何脏区都与它相交，而它是 risky（点集路径）。
 * 在「连线也能走离屏缓存」之前，这条会稳定把整帧顶成全量重绘（编辑器里就是这样：
 * 拖动实体 22/22 帧全部回退）。这里断言第 1 步（拖动叶子）确实走了局部重绘，且像素仍一致。
 */
test('场景里有横跨的连线（连线走离屏缓存后）：局部重绘执行且逐像素一致', async ({ page }) => {
  const { stepResults, collectOk, perStep } = await runSteps(
    page,
    '/e2e/visual/fixtures/dirty-rect-compare.html?opaque=1&line=1',
    true
  );
  console.log(`[dirty-rect-pixel:line] 10 步全部一致；局部重绘执行=${collectOk} 次`);
  console.log(`  每步局部帧数=${JSON.stringify(perStep)}`);
  expect(perStep[1], '拖动叶子时，横跨的连线不应把整帧顶成全量').toBeGreaterThan(0);
});
