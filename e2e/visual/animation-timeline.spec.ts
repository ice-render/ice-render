import { expect, test } from '@playwright/test';

/**
 * 编排（⑥）的**真实浏览器**验证：错峰入场 + 点击重播。
 *
 * 这条链路只有真浏览器能验：`play()` 把 `at` 折算成 `delay` 之后，推进完全靠真实的
 * `ICE_FRAME_EVENT`（rAF）与墙钟 —— 单测里是我们手动喂时间。
 */
const FIXTURE = '/examples/animation/animation-timeline.html';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => !!(window as any).__timeline);
  (page as any).__errors = errors;
});

test('错峰入场：各卡片按 at 依次开始（不是同时），最终全部落位', async ({ page }) => {
  // 立刻取样（此时只有第一张卡片开始动）
  const early = await page.evaluate(() => {
    const cards = (window as any).__cards;
    return cards.map(({ card }: any) => Number(card.state.style.globalAlpha));
  });
  expect(early[0]).toBeGreaterThan(0); // 第一张已经开始淡入
  expect(early[early.length - 1]).toBeLessThan(early[0]); // 最后一张还几乎没动（错峰生效）

  await page.waitForTimeout(1200); // 等整条时间轴跑完
  const settled = await page.evaluate(() => {
    const cards = (window as any).__cards;
    return cards.map(({ card, label, home }: any) => ({
      alpha: Number(card.state.style.globalAlpha),
      left: card.state.left,
      homeLeft: home.left,
      textAlpha: Number(label.state.style.globalAlpha),
      translate: card.state.transform.translate.slice(),
    }));
  });
  settled.forEach((entry: any) => {
    expect(entry.alpha).toBeCloseTo(1, 2); // 都淡入完成
    expect(entry.textAlpha).toBeCloseTo(1, 2);
    expect(entry.left).toBeCloseTo(entry.homeLeft, 3); // 位移回到原位
    expect(entry.translate[1]).toBeCloseTo(0, 3);
  });
  expect((page as any).__errors).toEqual([]);
});

test('点击重播：restart 把卡片放回起点并重放；stop 之后不再推进', async ({ page }) => {
  await page.waitForTimeout(1200);

  // 重播：卡片先回到起点（alpha 0）再重新淡入
  await page.click('#btn-restart');
  const rightAfterRestart = await page.evaluate(() => {
    const cards = (window as any).__cards;
    const timeline = (window as any).__timeline;
    return {
      playing: timeline.isPlaying(),
      alphas: cards.map(({ card }: any) => Number(card.state.style.globalAlpha)),
    };
  });
  expect(rightAfterRestart.playing).toBe(true);
  expect(Math.max(...rightAfterRestart.alphas)).toBeLessThan(0.5); // 回到起点附近

  await page.waitForTimeout(1200);
  const afterReplay = await page.evaluate(() =>
    (window as any).__cards.every(({ card }: any) => Number(card.state.style.globalAlpha) > 0.95)
  );
  expect(afterReplay).toBe(true);

  // 停止：再重播到一半后 stop → 动画不再推进（值冻结）
  await page.click('#btn-restart');
  await page.waitForTimeout(150);
  await page.click('#btn-stop');
  const frozen = await page.evaluate(() => {
    const cards = (window as any).__cards;
    return cards.map(({ card }: any) => Number(card.state.style.globalAlpha));
  });
  await page.waitForTimeout(500);
  const stillFrozen = await page.evaluate(() =>
    (window as any).__cards.map(({ card }: any) => Number(card.state.style.globalAlpha))
  );
  expect(stillFrozen).toEqual(frozen);

  // 暂停/继续：pause 后值不变，resume 后继续推进
  await page.click('#btn-play');
  await page.waitForTimeout(200);
  await page.click('#btn-pause');
  const pausedAt = await page.evaluate(() =>
    (window as any).__cards.map(({ card }: any) => Number(card.state.style.globalAlpha))
  );
  await page.waitForTimeout(300);
  const stillPaused = await page.evaluate(() =>
    (window as any).__cards.map(({ card }: any) => Number(card.state.style.globalAlpha))
  );
  expect(stillPaused).toEqual(pausedAt);
  await page.click('#btn-pause'); // 继续
  await page.waitForTimeout(800);
  const afterResume = await page.evaluate(() =>
    (window as any).__cards.every(({ card }: any) => Number(card.state.style.globalAlpha) > 0.95)
  );
  expect(afterResume).toBe(true);
  expect((page as any).__errors).toEqual([]);
});
