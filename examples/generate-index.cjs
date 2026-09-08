/**
 * 根据 examples/ 目录结构生成 index.html 导航页。
 * 用法：node examples/generate-index.cjs
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const categories = {};

function walk(dir, rel = '') {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'assets') continue;
      walk(full, rel ? `${rel}/${name}` : name);
    } else if (name.endsWith('.html')) {
      const content = fs.readFileSync(full, 'utf8');
      const m = /<title>([^<]*)<\/title>/i.exec(content);
      const title = m ? m[1].trim() : name;
      const cat = rel || '(根目录)';
      (categories[cat] = categories[cat] || []).push({ name, title, path: rel ? `${rel}/${name}` : name });
    }
  }
}
walk(root);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let itemsHtml = '';
for (const cat of Object.keys(categories).sort()) {
  const demos = categories[cat];
  itemsHtml += `    <section>\n      <h2>${esc(cat)} <span class="count">${demos.length}</span></h2>\n      <ul>\n`;
  for (const d of demos) {
    itemsHtml += `        <li><a href="${esc(d.path)}">${esc(d.title)}</a> <code>${esc(d.name)}</code></li>\n`;
  }
  itemsHtml += '      </ul>\n    </section>\n';
}

const total = Object.values(categories).reduce((s, a) => s + a.length, 0);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>ice-render examples</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px;
    background: #1e1f24; color: #e6e6e6;
    font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    line-height: 1.6;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #9aa0aa; margin-bottom: 24px; font-size: 13px; }
  section { margin-bottom: 24px; }
  h2 { font-size: 16px; border-bottom: 1px solid #33363d; padding-bottom: 6px; margin: 0 0 8px; }
  h2 .count { color: #6ea8fe; font-weight: normal; font-size: 13px; margin-left: 6px; }
  ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 32px; }
  li { margin: 4px 0; break-inside: avoid; }
  a { color: #6ea8fe; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { color: #7f8590; font-size: 11px; margin-left: 8px; }
  .note { color: #9aa0aa; font-size: 12px; margin-top: 24px; border-top: 1px solid #33363d; padding-top: 12px; }
</style>
</head>
<body>
  <h1>ice-render examples</h1>
  <div class="sub">共 ${total} 个示例。先执行 <code>npm run build</code> 生成 <code>dist/index.umd.js</code>，再通过静态服务器打开本页（如 <code>npx http-server .</code>）。</div>
${itemsHtml}
  <div class="note">说明：<code>canvas-basic/</code> 与 <code>transform/</code>、<code>gl-matrix/</code> 为 gl-matrix/Canvas 基础教学（部分不依赖引擎）；<code>shapes/</code>、<code>group/</code>、<code>event/</code> 等为引擎能力示例。</div>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`生成 examples/index.html，共 ${total} 个示例`);
