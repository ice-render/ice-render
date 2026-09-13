/**
 * 分层渲染基线：**单画布** vs **双实例分层**（静态层画一次 + 动画层每帧重绘）。
 *
 * 为什么这是引擎该守的一条线：单画布即使已经在走局部重绘，也要**重画与脏区相交的静态内容**；
 * 静态层里只要有文本/折线这类"risky"内容（clip 下重绘与全量不一致），局部帧就很贵。
 * 分层把静态层的位图整层复用 → 动画帧只画动画层。
 * 实测（2026-09-13，Apple M4 / Chromium 153 / 1600×1000，10000 静态元素 + N 个动画标记）：
 *   N=200：单画布 25.1ms → 分层 0.5ms（50×）；N=2000：21.1 → 4.4ms；N=5000：34.4 → 12.5ms。
 *
 * 用法：
 *   npm run bench:layers                 # 打印基线
 *   npm run bench:layers -- --check      # 按阈值判定（已接进 verify:full）
 *   node bench/layers/layering-bench.mjs --markers=2000 --json
 *
 * 阈值同样是"挡数量级回归"用的：这里守的是「分层必须显著快于单画布」这个结论本身
 * （分层被改坏 / 视口同步把静态层也拖得每帧重绘 → 这条就会红）。
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

const MARKERS = readArg('markers', 200);
const FRAMES = readArg('frames', 30);
const CHECK = hasFlag('check');
const JSON_OUT = hasFlag('json');

/** 阈值：分层的 p50 上限，以及"单画布 / 分层"的最小倍数。 */
const LIMITS = { layeredP50: 8, minSpeedup: 2 };

const umd = readFileSync(path.join(repoRoot, 'dist', 'index.umd.js'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent('<!DOCTYPE html><html><body></body></html>');
await page.addScriptTag({ content: umd });

const result = await page.evaluate(
  ({ MARKERS, FRAMES }) => {
    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    const W = 1600;
    const H = 1000;

    /** 静态层：文本 + 折线 + 方块（文本/折线是 risky 类别，单画布局部重绘也会很贵）。 */
    const buildStatic = (ice) => {
      for (let i = 0; i < 2000; i++) {
        ice.addChild(
          new ICE.ICEText({
            left: (i % 50) * 32,
            top: Math.floor(i / 50) * 25,
            text: '静态标签 ' + i,
            style: { fontSize: 12, fillStyle: '#475569' },
          })
        );
      }
      for (let i = 0; i < 1000; i++) {
        const x = (i % 40) * 40;
        const y = 600 + Math.floor(i / 40) * 16;
        ice.addChild(
          new ICE.ICEPolyLine({
            points: [
              [x, y],
              [x + 30, y + 10],
              [x + 60, y + 2],
            ],
            stroke: true,
            fill: false,
            style: { strokeStyle: '#94a3b8', lineWidth: 1 },
          })
        );
      }
      for (let i = 0; i < 7000; i++) {
        ice.addChild(
          new ICE.ICERect({
            left: (i % 160) * 10,
            top: Math.floor(i / 160) * 6,
            width: 6,
            height: 4,
            style: { fillStyle: '#e2e8f0' },
          })
        );
      }
    };

    const buildMarkers = (ice) => {
      for (let i = 0; i < MARKERS; i++) {
        ice.addChild(
          new ICE.ICECircle({
            // 铺满画布：脏区面积是"单画布 vs 分层"的关键变量（聚在一角时单画布也能靠局部重绘过关）
            left: 20 + (i % 20) * 78,
            top: 120 + Math.floor(i / 20) * 70,
            radius: 8,
            style: { fillStyle: COLORS[i % COLORS.length] },
            animations: {
              'transform.translate': { from: [0, 0], to: [60, 30], duration: 1200, easing: 'linear', loop: true },
            },
          })
        );
      }
    };

    /** 同步驱动一帧（真实运行时由 FrameManager 统一广播给所有实例的 bus）。 */
    const frame = (buses) => {
      for (const bus of buses) bus.trigger('ICE_FRAME_EVENT');
    };

    /** 预热：让缓存建立、动画初始化 startTime（同时把 setup 阶段留下的 dirty 清掉）。 */
    const warm = (buses) => {
      for (let i = 0; i < 5; i++) frame(buses);
    };

    const bench = (buses, frames) => {
      const samples = [];
      for (let i = 0; i < frames; i++) {
        const t0 = performance.now();
        frame(buses);
        samples.push(performance.now() - t0);
        const until = performance.now() + 8;
        while (performance.now() < until) {
          /* 推进墙钟，模拟真实帧间隔 */
        }
      }
      samples.sort((a, b) => a - b);
      return Number(samples[Math.floor(samples.length / 2)].toFixed(2));
    };

    const out = {};

    // ① 单画布：静态 + 动画同处一个实例
    {
      document.body.innerHTML = `<canvas id="c1" width="${W}" height="${H}"></canvas>`;
      const ice = new ICE.ICE().init('c1');
      buildStatic(ice);
      buildMarkers(ice);
      ice.dirty = true;
      ice.renderer.frameEvtHandler();
      warm([ice.evtBus]);
      out.singleCanvasP50 = bench([ice.evtBus], FRAMES);
      ice.destroy();
    }

    // ② 分层：静态层（画一次）+ 动画层（每帧只画标记）；视口绑定 + 上层输入穿透
    {
      document.body.innerHTML =
        `<div style="position:relative;width:${W}px;height:${H}px">` +
        `<canvas id="cs" width="${W}" height="${H}" style="position:absolute;left:0;top:0"></canvas>` +
        `<canvas id="ca" width="${W}" height="${H}" style="position:absolute;left:0;top:0"></canvas></div>`;
      const staticIce = new ICE.ICE().init('cs');
      buildStatic(staticIce);
      staticIce.dirty = true;
      staticIce.renderer.frameEvtHandler(); // 静态层只画这一次

      const animIce = new ICE.ICE().init('ca');
      buildMarkers(animIce);
      animIce.dirty = true;
      animIce.renderer.frameEvtHandler();
      ICE.ICE.linkViewport(staticIce, animIce);
      animIce.setInputPassthrough(true);

      // 先预热（把 linkViewport 触发的"静态层重绘一次"消化掉），再统计动画期间的静态层重绘
      warm([staticIce.evtBus, animIce.evtBus]);

      // 统计静态层在动画期间是否真的重绘（分层收益 = 静态层一帧都不画）
      let staticRenders = 0;
      const origFull = staticIce.renderer.doRenderFull.bind(staticIce.renderer);
      const origPartial = staticIce.renderer.__renderDirtyRect.bind(staticIce.renderer);
      staticIce.renderer.doRenderFull = (...a) => {
        staticRenders++;
        return origFull(...a);
      };
      staticIce.renderer.__renderDirtyRect = (...a) => {
        staticRenders++;
        return origPartial(...a);
      };

      out.layeredP50 = bench([staticIce.evtBus, animIce.evtBus], FRAMES);
      out.staticLayerRendersDuringAnimation = staticRenders;
      out.staticLayerDirty = staticIce.dirty;
      animIce.destroy();
      staticIce.destroy();
    }

    return { markers: MARKERS, frames: FRAMES, ...out };
  },
  { MARKERS, FRAMES }
);

await browser.close();

const speedup = Number((result.singleCanvasP50 / Math.max(0.01, result.layeredP50)).toFixed(1));
const summary = { ...result, speedup, limits: LIMITS };

if (JSON_OUT) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`分层渲染基线（Chromium / 1600x1000 / dpr=1 / 10000 静态元素 + ${result.markers} 个动画标记）`);
  console.log('-'.repeat(72));
  console.log(`单画布（静态 + 动画同一实例）：${result.singleCanvasP50} ms/帧`);
  console.log(`双实例分层（静态层画一次 + 动画层）：${result.layeredP50} ms/帧`);
  console.log(`倍数：${speedup}×   动画期间静态层的重绘次数：${result.staticLayerRendersDuringAnimation}`);
  console.log('-'.repeat(72));
}

if (CHECK) {
  const failures = [];
  if (result.layeredP50 > LIMITS.layeredP50) {
    failures.push(`分层 p50 ${result.layeredP50}ms > ${LIMITS.layeredP50}ms`);
  }
  if (speedup < LIMITS.minSpeedup) {
    failures.push(`分层相对单画布只有 ${speedup}× < ${LIMITS.minSpeedup}×`);
  }
  if (result.staticLayerRendersDuringAnimation !== 0) {
    failures.push(`静态层在动画期间被重绘了 ${result.staticLayerRendersDuringAnimation} 次（分层收益归零）`);
  }
  if (failures.length) {
    console.error('\n[bench:layers] 未达阈值：');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\n[bench:layers] 全部达标 ✓');
}
