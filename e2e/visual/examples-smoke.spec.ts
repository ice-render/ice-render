/**
 * examples 冒烟回归（永久）。
 *
 * 遍历 examples/ 下所有 .html 页面，校验：
 *  1) 无 pageerror、无 console error；
 *  2) 有 canvas 的页面确实在画布上有像素输出（自动绘制或交互后绘制）；
 *  3) 例外情况：event/pojo-event.html 设计上无 canvas（纯事件机制 demo）；
 *     init/ice-init.html 设计上 canvas 为空（仅 init + 按钮，依赖用户交互）；
 *     performance/multi-hidden-canvas.html 100 个离屏 canvas 循环 >900ms 才上屏，单独延时；
 *     performance/worker-main.html 测量完成才 transfer 帧，单独等 __workerBenchResult 且断言 frames>0。
 *
 * 任何不通过都明确指出，定位「示例被改动破坏」类回归。
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

function walk(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'assets') continue;
      out.push(...walk(full, rel ? `${rel}/${name}` : name));
    } else if (name.endsWith('.html') && name !== 'index.html') {
      out.push(rel ? `${rel}/${name}` : name);
    }
  }
  return out;
}

const NO_CANVAS = new Set(['event/pojo-event.html']);
const ALLOW_BLANK_DESIGN = new Set(['init/ice-init.html']);

interface Page {
  rel: string;
  /** ms 等待首次帧上屏（含测量/动画） */
  wait: number;
  /** worker-main 特殊：等到结果对象出现，并校验 transfer 帧 > 0 */
  expectWorkerResult?: boolean;
}

const pages: Page[] = walk(path.join(ROOT, 'examples')).map((rel) => {
  if (rel === 'performance/multi-hidden-canvas.html') {
    return { rel, wait: 6000 };
  }
  if (rel === 'performance/max-elements.html') {
    return { rel, wait: 10000 };
  }
  if (rel === 'performance/worker-main.html') {
    return { rel, wait: 30000, expectWorkerResult: true };
  }
  return { rel, wait: 1200 };
});

test('examples 冒烟：所有页面无错误且画布正常输出', async ({ page }) => {
  test.setTimeout(600_000);
  const issues: string[] = [];

  for (const p of pages) {
    const errs: string[] = [];
    const onErr = (m: any) => {
      const t = String(m && m.message ? m.message : m);
      if (t && !errs.includes(t)) errs.push(t.slice(0, 300));
    };
    page.on('pageerror', onErr);
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text().slice(0, 300));
    });
    const url = `/examples/${p.rel}`;
    await page.goto(url, { waitUntil: 'load' });
    if (p.expectWorkerResult) {
      await page.waitForFunction(() => (window as any).__workerBenchResult !== undefined, undefined, {
        timeout: 30_000,
      });
      const wr: any = await page.evaluate(() => (window as any).__workerBenchResult);
      page.removeListener('pageerror', onErr);
      page.removeListener('console', onErr);
      if (errs.length) {
        issues.push(`${p.rel}: 错误 ${errs.join(' | ')}`);
      } else if (wr.framesReceived <= 0) {
        issues.push(`${p.rel}: worker 路径未收到 transfer 帧`);
      } else {
        console.log(`[smoke] OK ${p.rel} (worker frames=${wr.framesReceived})`);
      }
      continue;
    }
    await page.waitForTimeout(p.wait);
    const info: any = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const totalPainted = canvases.reduce((acc: number, c: any) => {
        try {
          const d = c.getContext('2d');
          if (!d) return acc;
          const img = d.getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 3; i < img.length; i += 4) if (img[i] !== 0) n++;
          return acc + n;
        } catch (e) {
          return acc + -1;
        }
      }, 0);
      return { canvasCount: canvases.length, painted: totalPainted };
    });
    page.removeListener('pageerror', onErr);
    page.removeListener('console', onErr);
    if (NO_CANVAS.has(p.rel)) {
      if (info.canvasCount !== 0) {
        issues.push(`${p.rel}: 本应无 canvas，实际 ${info.canvasCount} 个`);
      } else if (errs.length) {
        issues.push(`${p.rel}: ${errs.join(' | ')}`);
      } else {
        console.log(`[smoke] OK ${p.rel} (no canvas, by design)`);
      }
      continue;
    }
    if (info.canvasCount === 0) {
      issues.push(`${p.rel}: 页面没有 canvas`);
      continue;
    }
    if (info.painted < 0) {
      console.log(`[smoke] SKIP ${p.rel}: canvas 像素不可读`);
      continue;
    }
    if (errs.length) {
      issues.push(`${p.rel}: ${errs.join(' | ')}`);
    } else if (info.painted === 0 && !ALLOW_BLANK_DESIGN.has(p.rel)) {
      issues.push(`${p.rel}: 画布无任何像素输出（疑似空白）`);
    } else {
      console.log(`[smoke] OK ${p.rel} (${info.painted}px)`);
    }
  }

  if (issues.length) {
    console.log('[smoke] 总问题：' + issues.length);
    for (const s of issues) console.log('[smoke] ISSUE: ' + s);
  }
  expect(issues, issues.join('\n')).toEqual([]);
});
