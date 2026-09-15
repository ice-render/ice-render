/**
 * 默认配置「原型共享」的内存基准。
 *
 * 为什么单独一套、不并进 `index.mjs`：这里量的是**保留内存**（字节/实例），
 * 而 mitata 那套基准的指标是「单次调用 p50 ns/iter」—— 硬塞进去只会得到没有意义的数字。
 *
 * 用法：
 *   npm run bench:mem                        # 各口径的每实例字节数（默认 N=20 万）
 *   npm run bench:mem -- --n=1000000         # 换规模（架构文档那张表用的就是 10 万 / 50 万 / 100 万）
 *   npm run bench:mem -- --check             # 与基线比较（默认 tolerance 1.3×），超出即非 0 退出
 *   npm run bench:mem -- --update-baseline   # 有意刷新基线
 *
 * 口径（与旧文档里那组数字的区别就在这里，别再混用）：
 *  - 每个规模**独立进程**跑一次，避免上一档的残留对象污染基线；
 *  - 造对象前后各强制两次 gc（需要 `--expose-gc`；脚本会自动用 `node --expose-gc` 重入自己）；
 *  - 指标 = (gc 后 heapUsed 差) / N = **每实例保留字节数**；
 *  - 消费的是构建产物 `dist/index.cjs`，改过 src/ 先 `npm run build`。
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 缺 --expose-gc 时自动重入（否则 heapUsed 里混着未回收的垃圾，数字没意义） ----------
if (typeof global.gc !== 'function' && !process.env.ICE_MEM_BENCH_REEXEC) {
  // 大 N（50 万 / 100 万）的保留内存本身就要 GB 级，顺手把 old-space 上限抬到 6GB；
  // 调用方自己传了 --max-old-space-size 就尊重调用方。
  const hasHeapFlag = process.execArgv.some((a) => a.startsWith('--max-old-space-size'));
  const flags = ['--expose-gc', ...(hasHeapFlag ? [] : ['--max-old-space-size=6144']), fileURLToPath(import.meta.url)];
  const child = spawnSync(process.execPath, [...flags, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, ICE_MEM_BENCH_REEXEC: '1' },
  });
  process.exit(typeof child.status === 'number' ? child.status : 1);
}

const require = createRequire(import.meta.url);
const mod = require(path.resolve(__dirname, '..', '..', 'dist', 'index.cjs'));
const { ICERect } = mod;

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const readArg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const N = Number(readArg('n', 200000));
const CHECK = hasFlag('check');
const UPDATE_BASELINE = hasFlag('update-baseline');
const TOLERANCE = Number(readArg('tolerance', 1.3));
const BASELINE_PATH = readArg('baseline', path.join(__dirname, 'memory-baseline.json'));
/** 朴素口径要为每个实例复制整份默认表（含嵌套对象），约 7.7KB/实例 —— 超过这个规模就跳过它（30 万 ≈2.3GB）。 */
const NAIVE_MAX_N = 300000;

const MB = 1024 * 1024;

/** 朴素对照：把「整份默认表」显式传给每个实例（等价于"每实例复制一份默认配置"）。 */
const fullDefaults = () => ({
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  lineDash: [],
  lineDashOffset: 0,
  lineDashFlow: false,
  lineDashFlowSpeed: 60,
  lineBorder: false,
  lineBorderWidth: 1.5,
  lineBorderColor: '',
  fill: true,
  stroke: true,
  animations: {},
  transform: { translate: [0, 0], scale: [1, 1], skew: [0, 0], rotate: 0 },
  linearMatrix: [],
  composedMatrix: [],
  origin: 'localCenter',
  originX: 0,
  originY: 0,
  clipChildren: false,
  opacity: 1,
  localOrigin: [0, 0],
  absoluteOrigin: [0, 0],
  display: true,
  draggable: true,
  transformable: true,
  interactive: true,
  linkable: true,
  showMinBoundingBox: false,
  showMaxBoundingBox: false,
  style: { fillStyle: '#ffffff', strokeStyle: '#000000', lineWidth: 1 },
});

const CASES = [
  { key: 'prototype-sharing', label: '原型共享：整个实例 new ICERect({})', make: () => new ICERect({}) },
  {
    key: 'props-state-only',
    label: '其中「默认配置」那部分（只留 props + state）',
    make: () => {
      const c = new ICERect({});
      return { props: c.props, state: c.state };
    },
  },
  { key: 'empty-object', label: '空对象 {}（V8 下限参照）', make: () => ({}) },
  {
    key: 'naive-full-defaults',
    label: '朴素：每实例显式传入整份默认表',
    make: () => new ICERect(fullDefaults()),
    naive: true,
  },
];

function gcNow() {
  if (typeof global.gc === 'function') {
    global.gc();
    global.gc();
  }
}

/** 保留内存 = 造 N 个对象前后（各两次 gc 后）的 heapUsed 差；返回每实例字节数。 */
function measure(make, n) {
  gcNow();
  const before = process.memoryUsage().heapUsed;
  const keep = new Array(n);
  for (let i = 0; i < n; i++) keep[i] = make();
  gcNow();
  const after = process.memoryUsage().heapUsed;
  return { perInstance: (after - before) / n, totalMB: (after - before) / MB, kept: keep.length };
}

const results = [];
for (const c of CASES) {
  if (c.naive && N > NAIVE_MAX_N) {
    console.log(`[bench:mem] 跳过「${c.label}」：N=${N} 时朴素口径需要数十 GB 内存，用默认 N=20 万看倍数即可。`);
    continue;
  }
  const r = measure(c.make, N);
  results.push({ ...c, ...r });
  console.log(
    `[bench:mem] ${c.label.padEnd(38)} N=${N}  ${r.totalMB.toFixed(1).padStart(7)} MB  ` +
      `${(r.perInstance / 1024).toFixed(2).padStart(5)} KB/实例  外推 100 万 ≈ ${((r.perInstance * 1e6) / 1024 / 1024 / 1024).toFixed(2)} GB`
  );
}

const sharing = results.find((r) => r.key === 'prototype-sharing');
const naive = results.find((r) => r.key === 'naive-full-defaults');
const defaultsOnly = results.find((r) => r.key === 'props-state-only');
if (sharing && naive) {
  console.log(
    `[bench:mem] 默认配置不复制的收益：朴素 / 原型共享 = ${(naive.perInstance / sharing.perInstance).toFixed(2)}×` +
      (defaultsOnly ? `（"默认配置"那部分 ${(defaultsOnly.perInstance / 1024).toFixed(2)} KB/实例）` : '')
  );
}

const measured = Object.fromEntries(results.map((r) => [r.key, Math.round(r.perInstance)]));

if (UPDATE_BASELINE) {
  const current = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) : {};
  const next = {
    _meta: {
      updated: new Date().toISOString().slice(0, 10),
      machine: `${os.cpus()[0].model} / Node ${process.version} / ${process.platform}-${process.arch}`,
      unit: 'bytes/实例（gc 后 heapUsed 差 / N，独立进程）',
      n: N,
      note: '用 npm run bench:mem -- --update-baseline 刷新；判定为「实测 ≤ 基线 × tolerance」',
      tolerance: TOLERANCE,
    },
    cases: { ...(current.cases || {}), ...measured },
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`[bench:mem] 基线已更新：${BASELINE_PATH}（${Object.keys(next.cases).length} 项，N=${N}）`);
}

if (CHECK) {
  const baseline = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) : null;
  if (!baseline || !baseline.cases) {
    console.log(`[bench:mem] ⚠️ 没有基线（${BASELINE_PATH}）——本次跳过判定。`);
    console.log('            要建立基线：npm run bench:mem -- --update-baseline');
    process.exit(0);
  }
  console.log('');
  console.log(
    `基线判定（tolerance=${TOLERANCE}×；基线更新于 ${baseline._meta?.updated}，单位 ${baseline._meta?.unit}）`
  );
  let failed = 0;
  for (const [key, value] of Object.entries(measured)) {
    const base = baseline.cases[key];
    if (typeof base !== 'number') {
      console.log(`${key.padEnd(34)} 实测 ${String(value).padStart(7)} B   基线 —（新增，无基线）`);
      continue;
    }
    const ratio = value / base;
    const ok = value <= base * TOLERANCE;
    if (!ok) failed++;
    console.log(
      `${key.padEnd(34)} 实测 ${String(value).padStart(7)} B   基线 ${String(base).padStart(7)} B   ${ratio.toFixed(2)}×   ${ok ? '✓' : '✗'}`
    );
  }
  if (failed) {
    console.log(
      `[bench:mem] ✗ ${failed} 项超出基线 ${TOLERANCE}× —— 单实例保留内存涨了，检查是否把默认配置搬回实例、或加了每实例大字段。`
    );
    process.exit(1);
  }
  console.log('[bench:mem] 全部达标 ✓');
}
