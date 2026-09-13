/**
 * 动画性能基线（浏览器口径）。
 *
 * 为什么单独做一套：`bench/render.cjs` 是 node + stub ctx，测的是引擎 JS 逻辑，**不含光栅化与离屏缓存**；
 * 而动画的真正成本恰恰在"写值 → 重绘"这一段（见 docs/architecture/04-rendering-performance.md#动画机制压测）。
 *
 * 它守着两条已经落地的机制（2026-09-13）：
 * ① **动画写值通道**：纯平移不置 `paramsDirty` → 离屏位图可纯平移复用（否则每帧重建）；
 * ② **设备像素量化**：飞行中的平移吸附到设备像素栅格（`AnimationManager.snapToDevicePixel`，默认开），
 *    让位移满足"整数设备像素"这个位图复用前提。
 *
 * 用法：
 *   npm run bench:anim                 # 打印基线（不判定）
 *   npm run bench:anim -- --check      # 按阈值判定（CI / verify:full 用）
 *   node bench/anim/animation-bench.mjs --n=5000 --frames=60 --json
 *
 * 阈值刻意设得宽松（跨机器/跨负载只要量级对就算过），它挡的是"机制被改坏"（比如量化被关、写值通道退回
 * `setState`）这类**数量级**回归，不是几个百分点的抖动。
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const hasFlag = (name) => args.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const readArg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};

const N = readArg('n', 1000);
const FRAMES = readArg('frames', 40);
const CHECK = hasFlag('check');
const JSON_OUT = hasFlag('json');

/** 阈值：p50 上限（ms）与位图复用率下限（%）。宽松到只挡数量级回归。 */
const THRESHOLDS = {
  'text-animated': { p50: 8, reuseRatio: 90 },
  'rect-animated': { p50: 5, reuseRatio: 0 },
};

const umd = readFileSync(path.join(repoRoot, 'dist', 'index.umd.js'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent('<!DOCTYPE html><html><body><canvas id="c" width="1600" height="1000"></canvas></body></html>');
await page.addScriptTag({ content: umd });

/**
 * 在页面里跑一个场景：N 个组件各挂一个 `left` 循环动画（走真实 `ICE_FRAME_EVENT` 驱动，
 * 与 examples/performance/animation-stress.html 同构），统计 p50 与离屏位图的重建/复用次数。
 */
async function runScene(kind, { snap = true } = {}) {
  return page.evaluate(
    ({ kind, snap, N, FRAMES }) => {
      document.body.innerHTML = '<canvas id="c" width="1600" height="1000"></canvas>';
      const ice = new ICE.ICE().init('c');
      ice.animationManager.snapToDevicePixel = snap;
      for (let i = 0; i < N; i++) {
        const left = (i % 40) * 30;
        const top = Math.floor(i / 40) * 22;
        const animations = { left: { from: left, to: left + 40, duration: 1000, easing: 'linear', loop: true } };
        const comp =
          kind === 'text'
            ? new ICE.ICEText({ left, top, text: 'label ' + i, style: { fontSize: 14, fillStyle: '#111827' }, animations })
            : new ICE.ICERect({ left, top, width: 18, height: 14, style: { fillStyle: '#3B82F6' }, animations });
        ice.addChild(comp);
      }
      ice.dirty = true;
      ice.renderer.frameEvtHandler();

      const cache = ice.renderer.cache;
      let rebuild = 0;
      let reuse = 0;
      const origBuild = cache.build.bind(cache);
      const origReuse = cache.refreshPosition.bind(cache);
      cache.build = (...a) => {
        rebuild++;
        return origBuild(...a);
      };
      cache.refreshPosition = (...a) => {
        const ok = origReuse(...a);
        if (ok) reuse++;
        return ok;
      };

      // warm：让缓存建立、动画初始化 startTime
      for (let i = 0; i < 5; i++) ice.evtBus.trigger('ICE_FRAME_EVENT');
      rebuild = 0;
      reuse = 0;

      const samples = [];
      for (let i = 0; i < FRAMES; i++) {
        const t0 = performance.now();
        ice.evtBus.trigger('ICE_FRAME_EVENT');
        samples.push(performance.now() - t0);
        // 推进墙钟（动画按 Date.now() 计算 elapsed）：不睡死进程，但让每帧之间真的过去几毫秒
        const until = performance.now() + 8;
        while (performance.now() < until) {
          /* busy-wait：模拟 120fps 以下的真实帧间隔 */
        }
      }
      samples.sort((a, b) => a - b);
      const p50 = samples[Math.floor(samples.length / 2)];
      return {
        kind,
        snap,
        n: N,
        p50: Number(p50.toFixed(2)),
        fps: Math.round(1000 / p50),
        rebuild,
        reuse,
        reuseRatio: rebuild + reuse > 0 ? Math.round((reuse / (rebuild + reuse)) * 100) : 0,
      };
    },
    { kind, snap, N, FRAMES }
  );
}

const textOn = await runScene('text', { snap: true });
const textOff = await runScene('text', { snap: false });
const rectOn = await runScene('rect', { snap: true });
await browser.close();

const rows = [
  { label: 'text-animated', result: textOn },
  { label: 'rect-animated', result: rectOn },
];

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      { n: N, frames: FRAMES, textSnapOn: textOn, textSnapOff: textOff, rectSnapOn: rectOn, thresholds: THRESHOLDS },
      null,
      2
    )
  );
} else {
  console.log(`动画基线（Chromium / 1600x1000 / dpr=1 / N=${N} / ${FRAMES} 帧）`);
  console.log('-'.repeat(78));
  console.log('场景                       p50      等效帧率   位图重建   位图复用   复用率');
  for (const row of rows) {
    const r = row.result;
    console.log(
      `${row.label.padEnd(26)}${String(r.p50 + 'ms').padEnd(10)}${String(r.fps + 'fps').padEnd(11)}` +
        `${String(r.rebuild).padEnd(11)}${String(r.reuse).padEnd(11)}${r.reuseRatio}%`
    );
  }
  console.log(
    `${'(对照) 量化关闭：文本'.padEnd(26)}${String(textOff.p50 + 'ms').padEnd(10)}${String(textOff.fps + 'fps').padEnd(11)}` +
      `${String(textOff.rebuild).padEnd(11)}${String(textOff.reuse).padEnd(11)}${textOff.reuseRatio}%`
  );
  console.log('-'.repeat(78));
  console.log('说明：text-animated 走"写值通道 + 设备像素量化"→ 位图纯平移复用；量化关掉后每帧重建位图。');
}

if (CHECK) {
  const failures = [];
  for (const row of rows) {
    const limit = THRESHOLDS[row.label];
    if (row.result.p50 > limit.p50) {
      failures.push(`${row.label}: p50 ${row.result.p50}ms > ${limit.p50}ms`);
    }
    if (limit.reuseRatio && row.result.reuseRatio < limit.reuseRatio) {
      failures.push(`${row.label}: 位图复用率 ${row.result.reuseRatio}% < ${limit.reuseRatio}%`);
    }
  }
  if (failures.length) {
    console.error('\n[bench:anim] 未达阈值：');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\n[bench:anim] 全部达标 ✓');
}
