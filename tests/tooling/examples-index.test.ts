/**
 * `examples/index.html` 导航页与真实示例文件的「双向一致」门禁（纯静态检查，无副作用）。
 *
 * 为什么需要：导航页由 `examples/generate-index.cjs` 生成，而它曾经把
 * `examples/mini-program/node_modules/**` 里第三方自带的示例 html 也收进来
 * （导航页从 88 条变成 95 条，多出 jimp / min-document / qrcode-reader 的页面）。
 * 这类问题不会让任何测试变红，只会让文档里的示例数字与页面对不上。
 *
 * 因此这里独立地把「磁盘上的示例清单」与「导航页里列出的链接」各算一遍，
 * 断言**集合相等**：既不缺（新增示例忘了重新生成），也不多（收进了不该收的目录）。
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const EXAMPLES = path.join(ROOT, 'examples');

/** 磁盘上的示例页（相对 examples/ 的路径，统一用 `/` 分隔）。 */
function listExampleFiles(dir = EXAMPLES, rel = ''): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      // 与生成器同一套排除规则：assets / node_modules / 点开头目录都不是示例
      if (name === 'assets' || name === 'node_modules' || name.startsWith('.')) continue;
      out.push(...listExampleFiles(full, rel ? `${rel}/${name}` : name));
    } else if (name.endsWith('.html')) {
      if (path.resolve(full) === path.resolve(EXAMPLES, 'index.html')) continue;
      out.push(rel ? `${rel}/${name}` : name);
    }
  }
  return out;
}

/** 导航页里列出的示例链接。 */
function listIndexLinks(): string[] {
  const html = fs.readFileSync(path.join(EXAMPLES, 'index.html'), 'utf8');
  const links = new Set<string>();
  const re = /href="([^"]+\.html)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    links.add(m[1].replace(/^\.\//, ''));
  }
  return [...links].sort();
}

describe('examples 导航页与示例文件一致', () => {
  it('导航页既不缺示例、也不多收（含不误收 node_modules）', () => {
    const files = listExampleFiles().sort();
    const links = listIndexLinks();

    expect(links.filter((l) => !files.includes(l))).toEqual([]); // 多收的
    expect(files.filter((f) => !links.includes(f))).toEqual([]); // 漏收的
    expect(links.length).toBe(files.length);
  });

  it('导航页不引用不存在的文件', () => {
    const missing = listIndexLinks().filter((l) => !fs.existsSync(path.join(EXAMPLES, l)));
    expect(missing).toEqual([]);
  });
});
