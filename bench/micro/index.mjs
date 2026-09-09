/**
 * 微基准统一入口。
 *
 * 用法：
 *   npm run build            # 改过 src/ 后先重建 dist
 *   npm run bench:micro      # 跑全部
 *   node bench/micro/index.mjs --filter=matrix   # 只看某个子套件（按名称正则过滤）
 *
 * 各子套件注册 bench() 后由本入口统一 run()。输出为每项 median / p75 / p99 等。
 */
import { run } from 'mitata';
import './matrix.bench.mjs';
import './render.bench.mjs';
import './hit-test.bench.mjs';
import './util.bench.mjs';

const filter = process.argv.indexOf('--filter');
const opts = filter !== -1 && process.argv[filter + 1] ? { filter: new RegExp(process.argv[filter + 1]) } : {};

await run(opts);
