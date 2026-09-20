/**
 * ICE 家族**分层回归**：把每个下游应用的 `node_modules/ice-render` 指向**工作区引擎**（被测版本），
 * 跑它的单测 / e2e，跑完还原依赖。
 *
 * 为什么分层：应用层已经有十来个包，一轮"全家族单测 + e2e"要 8 分钟左右 —— 改一行文档也跑全量
 * 是纯浪费。但分层**绝不静默少测**：判定规则写死在下面，且每次都会把"为什么这么跑"打印出来。
 *
 * 三层（`--tier=`，默认 `affected`）：
 *
 * | tier | 跑什么 | 什么时候用 |
 * |---|---|---|
 * | `unit` | 全家族**单测**（每个包 1~2 秒） | 改的是文档/测试，或想要一层快速信号 |
 * | `affected` | 引擎 `verify:full` + 全家族单测 + **受影响的**应用跑 e2e | 日常 |
 * | `full` | 引擎 `verify:full` + 全家族单测 + **全部**应用 e2e | 发版前 / 大改引擎核心 |
 *
 * "受影响"由**改动的引擎路径 + 应用的引用面**判定（见 `classifyChangedSurface`）：
 * - 只改了 `src/worker/**`：谁真的接线了镜像（代码里出现 `MirrorHost` / `MirrorBridge` /
 *   `MirrorTarget` / `detectMirrorSupport` …）才算受影响，其余应用只跑单测；
 * - 改了 `src/` 下**其它**任何东西（图形 / 渲染器 / 事件 / 序列化 / ICE…）：**全家族**跑 e2e ——
 *   那些能力是所有应用共用的行为，"引用面"判断会漏，宁可多跑；
 * - 只改了文档 / 测试 / 基准 / 仓库元信息：不影响任何应用。
 *
 * 用法：
 * ```
 * node scripts/family-regression.cjs                            # = --tier=affected
 * node scripts/family-regression.cjs --tier=full                # 发版前
 * node scripts/family-regression.cjs --dry-run                  # 先看它打算跑什么
 * node scripts/family-regression.cjs --since=<git ref>          # 指定比较基线（默认 origin/dev）
 * node scripts/family-regression.cjs --skip-engine              # 引擎已经跑过 verify:full
 * node scripts/family-regression.cjs --only=ice-chart,ice-game  # 只跑指定成员
 * ```
 *
 * 约定：下游应用是**兄弟目录**（默认取引擎的父目录，可用 `--root=` / `ICE_FAMILY_ROOT` 覆盖）：
 * 目录名以 `ice-` 开头、里面有 `package.json` 即算家族成员（按**目录名**判定，因为有的包名带 scope，
 * 例如 `@damoqiongqiu/ice-chart`）；文档站排除在外（它不是应用）。新加应用不用改这个脚本。
 * 成员还会被标一个"**依不依赖引擎**"（有 `ice-render` 依赖或有 `node_modules/ice-render`）：
 * `affected` 层里不依赖引擎的成员**只跑单测、不跑 e2e** —— 它的 e2e 观察不到引擎改动，
 * 属于纯开销（发版前的 `full` 层照旧全跑）。
 *
 * 每个成员的"单测"这一格会挑第一个可用的门禁：`npm test` → `npm run types:check` → `npm run build`。
 * 后两者是给"没有测试用例、但要跟版"的成员（例如 React demo）准备的 ——
 * 用**工作区引擎**做一次类型检查/构建，"引擎改了它还能不能编过"这件事本身就是要验的。
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ARGS = process.argv.slice(2);
const argValue = (name, fallback = null) => {
  const hit = ARGS.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const [, value] = hit.split('=');
  return value === undefined ? true : value;
};

const ENGINE = path.resolve(__dirname, '..');
const ROOT = path.resolve(argValue('root', process.env.ICE_FAMILY_ROOT || path.join(ENGINE, '..')));
const TIER = String(argValue('tier', 'affected'));
const SINCE = argValue('since', null);
const DRY_RUN = !!argValue('dry-run', false);
const SKIP_ENGINE = !!argValue('skip-engine', false);
const ONLY = argValue('only', null);
const MIRROR_API =
  /\b(MirrorHost|MirrorBridge|MirrorTarget|detectMirrorSupport|describeMirrorSupport|MIRROR_PROTOCOL_VERSION|createGeometryOnlyContext|MirrorFallbackInfo)\b/;
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.html']);
/** 文档站：包名也以 ice- 开头，但它是站点不是应用 —— 不参与应用回归（文档同步是另一件事）。 */
const DOC_SITE_NAME = 'ice-render-doc';

if (!['unit', 'affected', 'full'].includes(TIER)) {
  console.error(`未知 tier：${TIER}（可选 unit / affected / full）`);
  process.exit(2);
}

function run(cmd, cwd, timeout = 30 * 60 * 1000) {
  const startedAt = Date.now();
  try {
    const out = execSync(cmd, { cwd, stdio: 'pipe', timeout, encoding: 'utf8', env: { ...process.env, CI: '1' } });
    return { ok: true, ms: Date.now() - startedAt, tail: out.trim().split('\n').slice(-3).join(' | ') };
  } catch (error) {
    const out = `${error.stdout || ''}\n${error.stderr || ''}`;
    const tail = out.trim().split('\n').filter(Boolean).slice(-8).join(' | ');
    return { ok: false, ms: Date.now() - startedAt, tail: `${error.message} :: ${tail}` };
  }
}

function git(args, cwd = ENGINE) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim();
}

/** 家族成员：兄弟目录里包名以 `ice-` 开头、且不是引擎自己。 */
function discoverPackages() {
  const found = [];
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const cwd = path.join(ROOT, entry.name);
    if (path.resolve(cwd) === ENGINE) continue;
    const pkgFile = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgFile)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    if (!entry.name.startsWith('ice-') || entry.name === DOC_SITE_NAME) continue;
    found.push({
      name: entry.name,
      cwd,
      pkg,
      engineDep: dependsOnEngine(pkg) || fs.existsSync(path.join(cwd, 'node_modules/ice-render')),
    });
  }
  found.sort((a, b) => a.name.localeCompare(b.name));
  if (ONLY) {
    const wanted = String(ONLY)
      .split(',')
      .map((s) => s.trim());
    return found.filter((n) => wanted.includes(n.name));
  }
  return found;
}

/** 这个包是不是真的依赖引擎（文档站 / 周边工具会被这一条筛掉）。 */
function dependsOnEngine(pkg) {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (pkg[field] && pkg[field]['ice-render']) return true;
  }
  return false;
}

/** 成员的"单测"这一格挑哪个门禁（没有测试用例的成员退到类型检查/构建）。 */
function pickGate(scripts) {
  if (scripts.test) return { cmd: 'npm test', label: '单测' };
  if (scripts['types:check']) return { cmd: 'npm run types:check', label: '类型检查' };
  if (scripts.build) return { cmd: 'npm run build', label: '构建' };
  return null;
}

/** 引擎侧的改动面（已提交 + 未提交）。 */
function changedFiles() {
  let base = SINCE;
  if (!base) {
    for (const candidate of ['origin/dev', 'github-origin/dev', 'origin-github/dev']) {
      try {
        git(`rev-parse --verify ${candidate}`);
        base = candidate;
        break;
      } catch (e) {
        /* 试下一个 */
      }
    }
    base = base || 'HEAD~1';
  }
  const committed = git(`diff --name-only ${base}..HEAD`)
    .split('\n')
    .filter(Boolean);
  const dirty = git('status --porcelain')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).trim());
  return { base, files: Array.from(new Set(committed.concat(dirty))) };
}

/**
 * 改动面 → 哪些应用需要跑 e2e。
 *
 * 三种结论：`none`（不影响应用）/ `mirror-consumers`（只有真接线了镜像的应用）/
 * `all`（核心改动，全家族）。**判定宁可保守**：拿不准就 `all`。
 */
function classifyChangedSurface(files) {
  const src = files.filter((f) => f.startsWith('src/'));
  if (!src.length) {
    return { scope: 'none', reason: '改动只落在文档 / 测试 / 基准 / 仓库元信息上' };
  }
  const nonWorker = src.filter((f) => !f.startsWith('src/worker/'));
  if (nonWorker.length) {
    return {
      scope: 'all',
      reason: `改了引擎核心（${nonWorker.slice(0, 4).join('、')}${
        nonWorker.length > 4 ? ' …' : ''
      }）：所有应用共用这些行为，"引用面"判断会漏`,
    };
  }
  return { scope: 'mirror-consumers', reason: '只改了 src/worker/**：谁接线了镜像谁才受影响' };
}

/** 这个应用有没有真的接线镜像（扫代码文件，不看 node_modules / dist）。 */
function mirrorConsumers(packages) {
  const hits = new Map();
  const walk = (dir, onFile) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git', 'test-results', 'playwright-report'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, onFile);
      else if (CODE_EXT.has(path.extname(entry.name))) onFile(full);
    }
  };
  for (const pkg of packages) {
    const matched = new Set();
    for (const dir of ['src', 'examples', 'e2e', 'tests']) {
      const full = path.join(pkg.cwd, dir);
      if (!fs.existsSync(full)) continue;
      walk(full, (file) => {
        const m = fs.readFileSync(file, 'utf8').match(MIRROR_API);
        if (m) matched.add(m[0]);
      });
    }
    if (matched.size) hits.set(pkg.name, Array.from(matched).sort());
  }
  return hits;
}

function linkEngine(pkg) {
  const link = path.join(pkg.cwd, 'node_modules/ice-render');
  const backup = path.join(pkg.cwd, 'node_modules/ice-render.__fam-bak');
  if (!fs.existsSync(path.join(pkg.cwd, 'node_modules'))) return 'skip-no-node_modules';
  const isEngineLink =
    fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink() && fs.realpathSync(link) === fs.realpathSync(ENGINE);
  if (isEngineLink) return 'unchanged';
  if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  if (fs.existsSync(link)) {
    fs.renameSync(link, backup);
    fs.symlinkSync(ENGINE, link, 'junction');
    return 'swapped';
  }
  fs.symlinkSync(ENGINE, link, 'junction');
  return 'linked';
}

function restoreEngine(pkg, mode) {
  const link = path.join(pkg.cwd, 'node_modules/ice-render');
  const backup = path.join(pkg.cwd, 'node_modules/ice-render.__fam-bak');
  if (mode !== 'swapped' && mode !== 'linked') return;
  if (fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
  else fs.rmSync(link, { recursive: true, force: true });
  if (mode === 'swapped' && fs.existsSync(backup)) fs.renameSync(backup, link);
}

// ---------------------------------------------------------------- 计划
const packages = discoverPackages();
if (!packages.length) {
  console.error(`没有在 ${ROOT} 下找到家族成员（可用 --root= / ICE_FAMILY_ROOT 指定）`);
  process.exit(2);
}
const { base, files } = changedFiles();
const surface = classifyChangedSurface(files);
const consumers = mirrorConsumers(packages);
const needsE2e = (pkg) => {
  if (TIER === 'full') return true;
  if (TIER === 'unit') return false;
  // 不依赖引擎的成员：e2e 观察不到引擎改动，`affected` 层不跑（`full` 层照旧跑）
  if (!pkg.engineDep) return false;
  if (surface.scope === 'all') return true;
  if (surface.scope === 'none') return false;
  return consumers.has(pkg.name);
};
const e2ePackages = packages.filter((p) => needsE2e(p));
/**
 * 跳过 e2e 的成员里，**只列"因为不依赖引擎"**那一类（那是长期事实）；
 * "这次改动没影响它"这类只在真的做了引用面判定时才有信息量，别刷屏。
 */
const skippedE2e = packages.filter(
  (p) => TIER !== 'full' && !needsE2e(p) && (!p.engineDep || surface.scope === 'mirror-consumers')
);

console.log(`[family] 引擎：${ENGINE}`);
console.log(`[family] 家族根目录：${ROOT}（${packages.length} 个成员）`);
console.log(`[family] tier=${TIER} · 比较基线=${base} · 改动 ${files.length} 个文件`);
console.log(`[family] 改动面：${surface.scope} —— ${surface.reason}`);
if (surface.scope === 'mirror-consumers') {
  console.log(
    `[family] 接线镜像的应用：${
      consumers.size ? Array.from(consumers).map(([n, s]) => `${n}(${s.join(',')})`).join('；') : '（无）'
    }`
  );
}
if (!files.length) {
  console.log('[family] ⚠️ 没有检测到引擎侧改动 —— 如果这不是你预期的，请显式传 --since=<ref>');
}
console.log(
  `[family] 计划：${SKIP_ENGINE || TIER === 'unit' ? '跳过引擎回归' : '引擎 verify:full'} + ` +
    `全家族单测（${packages.length} 个）+ e2e（${e2ePackages.length} 个：${
      e2ePackages.map((p) => p.name).join('、') || '无'
    }）`
);
if (skippedE2e.length) {
  console.log(
    `[family] 跳过 e2e 的成员：${skippedE2e
      .map((p) => (p.engineDep ? `${p.name}(未被这次改动影响)` : `${p.name}(不依赖引擎)`))
      .join('、')}`
  );
}

if (DRY_RUN) {
  console.log('[family] --dry-run：只打印计划，未执行');
  process.exit(0);
}

// ---------------------------------------------------------------- 执行
const startedAt = Date.now();
const results = [];

if (!SKIP_ENGINE && TIER !== 'unit') {
  console.log('\n=== engine verify:full ===');
  const engineRun = run('npm run verify:full', ENGINE);
  console.log(
    `  ${engineRun.ok ? '✓' : '✗'} ${(engineRun.ms / 1000).toFixed(1)}s${engineRun.ok ? '' : `\n    ${engineRun.tail}`}`
  );
  results.push({ name: '(engine) verify:full', unit: engineRun, e2e: { ok: true, ms: 0 }, engine: true });
}

for (const pkg of packages) {
  console.log(`\n=== ${pkg.name} ===`);
  let mode = 'unchanged';
  try {
    mode = linkEngine(pkg);
    if (mode === 'skip-no-node_modules') {
      console.log('  (无 node_modules，跳过)');
      results.push({ name: pkg.name, skipped: true });
      continue;
    }
    const scripts = pkg.pkg.scripts || {};
    const gate = pickGate(scripts);
    const unit = gate ? run(gate.cmd, pkg.cwd) : { ok: true, ms: 0, skipped: true, tail: '(无测试 / 类型检查 / 构建脚本)' };
    const gateLabel = gate ? gate.label : '门禁';
    console.log(
      `  ${gateLabel}: ${unit.ok ? '✓' : '✗'} ${(unit.ms / 1000).toFixed(1)}s${
        gate ? `（${gate.cmd}）` : ''
      }${unit.ok ? '' : `\n    ${unit.tail}`}`
    );
    let e2e = { ok: true, ms: 0, skipped: true, tail: '(按分层策略跳过)' };
    if (needsE2e(pkg) && scripts['test:e2e']) {
      e2e = run('npm run test:e2e', pkg.cwd);
      console.log(`  e2e:  ${e2e.ok ? '✓' : '✗'} ${(e2e.ms / 1000).toFixed(1)}s${e2e.ok ? '' : `\n    ${e2e.tail}`}`);
    } else {
      console.log(`  e2e:  —  ${scripts['test:e2e'] ? '按分层策略跳过' : '（无 e2e 脚本）'}`);
    }
    results.push({ name: pkg.name, unit, e2e, gateLabel });
  } finally {
    restoreEngine(pkg, mode);
  }
}

// ---------------------------------------------------------------- 汇总
console.log('\n================ 家族回归汇总 ================');
for (const r of results) {
  if (r.skipped) {
    console.log(`${r.name.padEnd(30)} 跳过`);
    continue;
  }
  console.log(
    `${r.name.padEnd(32)} ${(r.gateLabel || '单测').padEnd(6)} ${r.unit.ok ? '✓' : '✗'}   e2e ${
      r.engine || r.e2e.skipped ? '—' : r.e2e.ok ? '✓' : '✗'
    }`
  );
}
const failed = results.filter((r) => !r.skipped && (!r.unit.ok || !r.e2e.ok));
console.log(
  `\n耗时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s · tier=${TIER} · e2e 覆盖 ${e2ePackages.length}/${packages.length} 个应用`
);
console.log(failed.length ? `✗ 失败 ${failed.length} 个` : '✓ 全部通过');
process.exit(failed.length ? 1 : 0);
