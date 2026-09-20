/**
 * `Path2DRecorder`：路径对象的唯一入口 —— 命令流 + 原生转发。
 *
 * 背景：原生 `Path2D` 是不透明的，画得出来但拿不到几何描述。而 SVG / 服务端出图、
 * 以及「直接断言形状生成了哪些命令」都需要它 —— 所以路径对象一律走记录器。
 *
 * 本文件钉死三件事：
 * 1. 有原生 Path2D 时：命令既进命令流、也转发给原生对象（渲染路径与旧版一致）；
 * 2. 没有原生 Path2D 时（headless / 测试桩）：只记命令，**不再自己重放命令上屏**
 *    （"没有 Path2D 也要能画"那条支路 2026-09-20 随小程序支持一起删了）；
 * 3. `arc` 必须被记录 —— 它曾经缺过，导致事件圆这类形状在无原生 Path2D 的运行时直接抛
 *    `path.arc is not a function`。
 */
import Path2DRecorder from '../../src/cross-platform/Path2DRecorder';

/** 记录调用序列的原生 Path2D 替身 */
class FakeNativePath2D {
  public calls: Array<Array<any>> = [];
  moveTo(...a: any[]) {
    this.calls.push(['moveTo', ...a]);
  }
  lineTo(...a: any[]) {
    this.calls.push(['lineTo', ...a]);
  }
  bezierCurveTo(...a: any[]) {
    this.calls.push(['bezierCurveTo', ...a]);
  }
  quadraticCurveTo(...a: any[]) {
    this.calls.push(['quadraticCurveTo', ...a]);
  }
  arcTo(...a: any[]) {
    this.calls.push(['arcTo', ...a]);
  }
  rect(...a: any[]) {
    this.calls.push(['rect', ...a]);
  }
  arc(...a: any[]) {
    this.calls.push(['arc', ...a]);
  }
  ellipse(...a: any[]) {
    this.calls.push(['ellipse', ...a]);
  }
  closePath() {
    this.calls.push(['closePath']);
  }
}

describe('Path2DRecorder', () => {
  it('有原生 Path2D：命令流与原生对象都能拿到（命令流只是顺带记录）', () => {
    const native = new FakeNativePath2D();
    const path = new Path2DRecorder(native);

    path.moveTo(1, 2);
    path.lineTo(3, 4);
    path.rect(0, 0, 10, 10);
    path.closePath();

    expect(path.native).toBe(native);
    expect(path._commands).toEqual([
      ['moveTo', 1, 2],
      ['lineTo', 3, 4],
      ['rect', 0, 0, 10, 10],
      // 闭合按位置入队（多子路径形状必须各闭各的），不再只是末尾标志
      ['closePath'],
    ]);
    expect(native.calls).toEqual([['moveTo', 1, 2], ['lineTo', 3, 4], ['rect', 0, 0, 10, 10], ['closePath']]);
    expect(path._closed).toBe(true);
  });

  it('closePath 幂等：同一位置重复调用只记一次（doRender 每帧都会调）', () => {
    const path = new Path2DRecorder();
    path.moveTo(0, 0);
    path.lineTo(10, 0);
    path.closePath();
    path.closePath();
    path.closePath();
    expect(path._commands).toEqual([['moveTo', 0, 0], ['lineTo', 10, 0], ['closePath']]);

    // 新开一段子路径后，再闭合才是新的一次
    path.moveTo(5, 5);
    path.lineTo(5, 9);
    path.closePath();
    expect(path._commands.filter((c) => c[0] === 'closePath')).toHaveLength(2);
  });

  it('没有原生 Path2D：退化为纯记录器（命令流可用，但引擎不负责重放上屏）', () => {
    const path = new Path2DRecorder();
    path.moveTo(5, 6);

    expect(path.native).toBeNull();
    expect(path._commands).toEqual([['moveTo', 5, 6]]);
  });

  it('arc 既被记录、也转发给原生对象', () => {
    const native = new FakeNativePath2D();
    const path = new Path2DRecorder(native);

    path.arc(10, 10, 5, 0, Math.PI * 2, false);

    expect(path._commands).toEqual([['arc', 10, 10, 5, 0, Math.PI * 2, false]]);
    expect(native.calls[0][0]).toBe('arc');
  });

  it('命令流是自洽的、可被外部消费（服务端出图 / 形状断言）', () => {
    const path = new Path2DRecorder();
    path.moveTo(0, 0);
    path.lineTo(10, 0);
    path.arc(10, 10, 5, 0, Math.PI);
    path.closePath();

    // 外部消费者：自己把命令流重放到任意 ctx（引擎不再内建这条路径）
    const ctx: any = { calls: [] as any[] };
    ['moveTo', 'lineTo', 'arc', 'closePath'].forEach((name) => {
      ctx[name] = function (...args: any[]) {
        this.calls.push([name, ...args]);
      };
    });
    for (const cmd of path._commands) {
      ctx[cmd[0]](...cmd.slice(1));
    }

    expect(ctx.calls.map((c) => c[0])).toEqual(['moveTo', 'lineTo', 'arc', 'closePath']);
  });
});
