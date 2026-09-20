/**
 * 微基准统一入口。
 *
 * 用法：
 *   npm run build            # 改过 src/ 后先重建 dist
 *   npm run bench:micro      # 跑全部
 *   node bench/micro/index.mjs --filter=matrix   # 只看某个子套件（按名称正则过滤）
 *   node bench/micro/index.mjs --check           # 与基线对比，超阈值即非 0 退出（门禁用）
 *   node bench/micro/index.mjs --update-baseline # 有意刷新基线
 *
 * 各子套件注册 bench() 后由本入口统一 run()。输出为每项 median / p75 / p99 等。
 *
 * 基线判定同样走**宽松倍数**（默认 2.5×）：微基准受 JIT/GC/机器负载影响比场景基准更大，
 * 它挡的是"热路径被改坏"（如矩阵零分配被破坏、命中预筛退化），不是几个百分点的抖动。
 */
import { run } from 'mitata';
import './matrix.bench.mjs';
import './render.bench.mjs';
import './hit-test.bench.mjs';
import './util.bench.mjs';
import './path-recorder.bench.mjs';
import './event-dispatch.bench.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const readArg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const filter = argv.indexOf('--filter');
const opts = filter !== -1 && argv[filter + 1] ? { filter: new RegExp(argv[filter + 1]) } : {};

const CHECK = hasFlag('check');
const UPDATE_BASELINE = hasFlag('update-baseline');
const TOLERANCE = Number(readArg('tolerance', 2.5));
const BASELINE_PATH = readArg('baseline', path.join(__dirname, 'baseline.json'));

const results = await run(opts);

// mitata 的返回：{ benchmarks: [{ alias, runs: [{ stats: { p50, ... } }] }] }
// 同名基准会出现多次（不同参数/子场景），这里按出现顺序补后缀，保证键唯一且稳定。
const measured = {};
for (const item of results?.benchmarks || []) {
  const p50 = item?.runs?.[0]?.stats?.p50;
  if (!(typeof p50 === 'number' && p50 > 0)) continue;
  let key = item.alias || '(unnamed)';
  let n = 2;
  while (key in measured) key = `${item.alias} (${n++})`;
  measured[key] = Math.round(p50 * 10000) / 10000; // ns/iter（mitata 对 fn 基准用纳秒），保留 4 位
}

const round = (x) => Math.round(x * 10000) / 10000;

if (UPDATE_BASELINE) {
  const current = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) : {};
  const next = {
    _meta: {
      updated: new Date().toISOString().slice(0, 10),
      machine: `${os.cpus()[0].model} / Node ${process.version} / ${process.platform}-${process.arch}`,
      unit: 'ns/iter (mitata p50)',
      note: '用 npm run bench:micro -- --update-baseline 刷新；判定为「实测 ≤ 基线 × tolerance」',
      tolerance: TOLERANCE,
    },
    cases: { ...(current.cases || {}), ...measured },
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`[bench:micro] 基线已更新：${BASELINE_PATH}（${Object.keys(next.cases).length} 项）`);
}

if (CHECK) {
  const baseline = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) : null;
  if (!baseline || !baseline.cases) {
    console.log(`[bench:micro] ⚠️ 没有基线（${BASELINE_PATH}）——本次跳过判定。`);
    console.log('              要建立基线：npm run bench:micro -- --update-baseline');
    process.exit(0);
  }

  console.log('');
  console.log(`基线判定（tolerance=${TOLERANCE}×；基线更新于 ${baseline._meta?.updated}，单位 ${baseline._meta?.unit}）`);
  console.log('指标                                          实测        基线      倍数  判定');
  console.log('--------------------------------------------------------------------------------');
  let failed = 0;
  let missing = 0;
  for (const [key, value] of Object.entries(measured)) {
    const base = baseline.cases[key];
    if (typeof base !== 'number') {
      // 新增的基准项：没有基线不算失败，但要提示去刷新基线
      missing++;
      console.log(key.padEnd(46) + String(round(value)).padStart(10) + '           —    （新增，无基线）');
      continue;
    }
    const ratio = value / base;
    const ok = value <= base * TOLERANCE;
    if (!ok) failed++;
    console.log(
      key.padEnd(46) + String(round(value)).padStart(10) + String(base).padStart(12) + (ratio.toFixed(2) + '×').padStart(8) + '   ' + (ok ? '✓' : '✗')
    );
  }
  console.log('--------------------------------------------------------------------------------');
  if (failed) {
    console.log(`[bench:micro] ✗ ${failed} 项超出基线 ${TOLERANCE}× —— 热路径出现数量级退化，请检查最近改动。`);
    process.exit(1);
  }
  console.log(`[bench:micro] 全部达标 ✓${missing ? `（${missing} 项新增基准还没有基线，可跑 --update-baseline 收录）` : ''}`);
}
