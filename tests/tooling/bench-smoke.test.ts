/**
 * 基准脚本的「不许烂掉」门禁。
 *
 * 为什么需要：`bench/render.cjs` 的默认产物路径曾指向早已改名的 `dist/index.cjs.js`，
 * 于是 `npm run bench` **直接跑不起来**、README 里引用的性能数字也无法复现 ——
 * 而它不在任何门禁里，所以很久没人发现。这里用一个小规模 N 真跑一遍，
 * 锁住「脚本可执行 + 关键指标都有输出」。
 *
 * 刻意**不**在这里断言耗时：CI 机器不可控、时间断言必然 flaky（实测同一台机
 * 组内波动 <1.5%，但跨机器可差数倍）。性能回归靠 `npm run bench 5000` 的新旧对照，
 * 见 AGENTS.md 的「性能改动必须做同时刻对照」。
 *
 * 前置：需要先 `npm run build`（脚本加载的是构建产物）。缺产物时跳过并显式告警，
 * 不静默通过 —— CI 的 `verify` job 里 bench 步骤排在 build 之后，因此那里一定会真跑。
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'index.cjs');

describe('bench 脚本可执行性（门禁）', () => {
  it('小规模跑通并输出全部场景指标', () => {
    if (!fs.existsSync(DIST)) {
      console.warn('[bench-smoke] 跳过：dist/index.cjs 不存在，请先 npm run build');
      return;
    }
    const out = execFileSync('node', [path.join(ROOT, 'bench', 'render.cjs'), '200'], {
      cwd: ROOT,
      encoding: 'utf-8',
    });
    expect(out).toContain('场景 A');
    expect(out).toContain('场景 B');
    expect(out).toContain('场景 C');
    expect(out).toContain('场景 D');
    expect(out).toContain('refreshQueue');
    expect(out).toContain('等效帧率上限');
  }, 60_000);
});
