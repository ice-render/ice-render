/**
 * 镜像钩子的**覆盖守卫**：任何 `setState` 覆盖都必须把变更送到桥上。
 *
 * 由来（2026-09-20，被 ice-entity-designer 的真实流程图抓出来）：`ICEComponent.setState` 里挂了
 * `notifyStateChange`，但 `ICEGroup.setState` 是**完全覆盖**（它要额外把整棵子树标脏），
 * **不经过** `ICEComponent.setState` —— 于是所有容器型组件的状态都不同步到 worker。
 * IED 的 `FlowNode extends ICEGroup`，所以"拖节点、改标题"在镜像里全都不动；
 * 症状是**没有报错、只是画面不动**，最难查的那一类。
 *
 * 这个守卫把"将来再加一个 setState 覆盖"这件事钉住：
 * 要么调用 `super.setState(...)`（自然走基类钩子），要么自己调 `notifyStateChange(...)`。
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../../src');

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      tsFiles(full, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * 取每个 `setState` **声明**的位置（跳过 `this.setState(` / `super.setState(` 这类调用点）。
 *
 * 用"声明到下一个声明之间的文本"来判定，不做大括号配对 —— 后者被注释/字符串里的
 * `setState(...) {` 骗过一次（守卫自己先红了一回）。
 */
function setStateDeclarations(text: string): Array<{ line: number; body: string }> {
  const lines = text.split('\n');
  const declLines: number[] = [];
  lines.forEach((line, i) => {
    if (/^\s*(public\s+|protected\s+|private\s+)?setState\s*\(/.test(line)) declLines.push(i);
  });
  return declLines.map((startLine, idx) => {
    const endLine = idx + 1 < declLines.length ? declLines[idx + 1] : lines.length;
    return { line: startLine + 1, body: lines.slice(startLine, endLine).join('\n') };
  });
}

describe('镜像钩子覆盖守卫', () => {
  it('每个 setState 覆盖都调 super.setState 或 notifyStateChange（否则容器状态不会进镜像）', () => {
    const offenders: string[] = [];
    for (const file of tsFiles(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      const rel = path.relative(SRC, file);
      for (const decl of setStateDeclarations(text)) {
        const ok = /super\.setState\s*\(/.test(decl.body) || /notifyStateChange\s*\(/.test(decl.body);
        if (!ok) offenders.push(`${rel}:${decl.line}`);
      }
    }
    expect(offenders.length === 0 ? 'ok' : `这些 setState 覆盖没把变更送到镜像桥：${offenders.join(' / ')}`).toBe('ok');
  });

  it('基类本身就是钩子的挂载点（防止有人把钩子从 ICEComponent.setState 挪走）', () => {
    const text = fs.readFileSync(path.join(SRC, 'graphic/ICEComponent.ts'), 'utf8');
    const decls = setStateDeclarations(text);
    expect(decls.length > 0 ? 'ok' : '在 ICEComponent 里找不到 setState 声明').toBe('ok');
    const hasHook = decls.some((d) => /notifyStateChange\s*\(/.test(d.body));
    expect(hasHook ? 'ok' : 'ICEComponent.setState 没有调用 notifyStateChange').toBe('ok');
  });
});
