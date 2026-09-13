import { expect, test } from '@playwright/test';

/**
 * B 组（文本能力增强）的**真实浏览器**验证。
 *
 * 单测里的 ctx 是桩：`letterSpacing` 的语义、装饰线落在哪几个像素、textarea 的换行行为
 * 都只有真浏览器能证伪（例如 Chromium 会把数字 10 归一成 '10px'，而其它实现可能直接忽略）。
 */
const FIXTURE = '/e2e/visual/fixtures/text-advanced.html';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(FIXTURE);
  await page.waitForTimeout(300);
  (page as any).__errors = errors;
});

test('字间距：引擎盒子宽度 = 浏览器 canvas 量测宽度（含尾随间距）', async ({ page }) => {
  const result = await page.evaluate(() => {
    const t = (window as any).__t.spacing;
    const style = t.state.style;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = style.font;
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = String(style.letterSpacing) + 'px';
    }
    const measured = ctx.measureText('ABC').width;
    const boxWidth = t.state.width - (Number(style.paddingLeft) || 0) - (Number(style.paddingRight) || 0);
    return { measured, boxWidth };
  });
  expect(Math.abs(result.measured - result.boxWidth)).toBeLessThan(0.5);
});

test('行高：显式 40px 的两行文本，行距与文本高度都对得上', async ({ page }) => {
  const info = await page.evaluate(() => {
    const t = (window as any).__t.lineHeight;
    const lines = t.getRenderLines();
    return { textHeight: t.state.textHeight, delta: lines[1].y - lines[0].y, count: lines.length };
  });
  expect(info.count).toBe(2);
  expect(info.textHeight).toBeCloseTo(80, 1);
  expect(info.delta).toBeCloseTo(40, 1);
});

test('文本装饰线真的画到了像素上（下划线 / 删除线 / 无装饰对照）', async ({ page }) => {
  const counts = await page.evaluate(() => {
    const t = (window as any).__t;
    const canvas = document.getElementById('canvas-1') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    // 取「基线以下」的一小条（字号 24px 时约 1..7px）：大写拉丁没有降部，
    // 因此这里的红色像素只可能来自下划线（删除线在基线上方）
    const redBelow = (comp: any) => {
      const box = comp.getMinBoundingBox(true);
      const lines = comp.getRenderLines();
      // getRenderLines() 给的是**组件本地坐标**，要换算到画布坐标才能取像素
      const origin = comp.localToGlobal(0, 0);
      const fontSize = Number(comp.state.style.fontSize) || 12;
      const baselineY = origin[1] + lines[lines.length - 1].y;
      const y0 = Math.round(baselineY + 1);
      const y1 = Math.round(baselineY + fontSize * 0.3);
      if (!(y1 > y0)) return 0;
      const data = ctx.getImageData(
        Math.round(box.tl[0]),
        y0,
        Math.max(1, Math.round(box.tr[0] - box.tl[0])),
        y1 - y0
      ).data;
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 100 && data[i] > 150) total += 1; // 红色像素（#cc0000）
      }
      return total;
    };
    return { underline: redBelow(t.underlined), plain: redBelow(t.plain), strike: redBelow(t.struck) };
  });
  expect(counts.underline).toBeGreaterThan(50); // 下划线在基线下方
  expect(counts.plain).toBe(0); // 没配装饰线 → 基线下方没有任何墨迹
  expect(counts.strike).toBe(0); // 删除线在基线**上方**，不在这个区域
});

test('多行编辑：双击挂 textarea，回车插入换行而不是提交', async ({ page }) => {
  const center = await page.evaluate(() => {
    const p = (window as any).__t.editable.getMinBoundingBox(true).centerPoint;
    return { x: p[0], y: p[1] };
  });
  await page.mouse.dblclick(center.x, center.y);
  await page.waitForTimeout(150);

  expect(await page.evaluate(() => !!document.querySelector('textarea'))).toBe(true);
  expect(await page.evaluate(() => (document.querySelector('textarea') as HTMLTextAreaElement).value)).toBe('a\nb');

  await page.keyboard.press('Enter');
  await page.keyboard.type('c');
  await page.waitForTimeout(150);
  // 进入编辑时光标在文本末尾：回车插入换行、再输入追加到末尾
  expect(await page.evaluate(() => (window as any).__t.editable.getText())).toBe('a\nb\nc');
  expect(await page.evaluate(() => (window as any).__t.editable.state.editing)).toBe(true);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__t.editable.state.editing)).toBe(false);
  expect(await page.evaluate(() => !!document.querySelector('textarea'))).toBe(false);
});

test('选区自绘：有选区时出现选区底色像素，清空后消失', async ({ page }) => {
  const sample = async () =>
    page.evaluate(() => {
      const comp = (window as any).__t.selected;
      const box = comp.getMinBoundingBox(true);
      const canvas = document.getElementById('canvas-1') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(
        Math.round(box.tl[0]),
        Math.round(box.tl[1]),
        Math.max(1, Math.round(box.tr[0] - box.tl[0])),
        Math.max(1, Math.round(box.br[1] - box.tl[1]))
      ).data;
      let yellow = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i + 1] > 150 && data[i + 2] < 120 && data[i + 3] > 100) yellow += 1;
      }
      return yellow;
    });

  expect(await sample()).toBeGreaterThan(50);
  await page.evaluate(() => {
    const comp = (window as any).__t.selected;
    comp.setSelection(0, 0);
    comp.dirty = true;
    (window as any).__ice.dirty = true;
  });
  await page.waitForTimeout(200);
  expect(await sample()).toBe(0);
});

test('按字形命中：点击位置换算成 caretIndex 用的是真实字形宽度', async ({ page }) => {
  const result = await page.evaluate(() => {
    const comp = (window as any).__t.hit;
    const lines = comp.getRenderLines();
    const line = lines[0];
    const half = comp.state.width / 2;
    // 文字左边缘（本地坐标）→ 量出前 3 个字符的宽度，取其右边界作为点击点
    const left = -half;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = comp.state.style.font;
    const width3 = ctx.measureText('abc').width;
    return {
      at0: comp.getCaretIndexAt(left + 0.5, line.y),
      at3: comp.getCaretIndexAt(left + width3, line.y),
      atEnd: comp.getCaretIndexAt(left + comp.state.width, line.y),
    };
  });
  expect(result.at0).toBe(0);
  expect(result.at3).toBe(3);
  expect(result.atEnd).toBe(6);
});

test('页面无 console / pageerror 报错', async ({ page }) => {
  expect((page as any).__errors).toEqual([]);
});
