/**
 * `Path2DRecorder`：路径对象的唯一入口 —— 命令流 + 原生转发。
 *
 * 背景：原生 `Path2D` 是不透明的，画得出来但拿不到几何描述。而 SVG/服务端出图、
 * 「无原生 Path2D 时重放命令到 ctx」、以及「直接断言形状生成了哪些命令」都需要它。
 *
 * 本文件钉死三件事：
 * 1. 有原生 Path2D 时：命令既进命令流、也转发给原生对象（渲染路径与旧版一致）；
 * 2. 没有原生 Path2D 时：`_isPolyfill` 为真、`drawable` 是记录器自身（ICEPath 走重放）；
 * 3. `arc` 必须被记录 —— PolyfillPath2D 时代缺这个方法，「无原生 Path2D」的运行时
 *    （Node / 小程序低版本）画事件圆这类形状会直接抛 `path.arc is not a function`。
 */
import Path2DRecorder from '../../src/cross-platform/Path2DRecorder';
import PolyfillPath2D from '../../src/cross-platform/PolyfillPath2D';

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

    expect(path._isPolyfill).toBe(false);
    expect(path.drawable).toBe(native);
    expect(path._commands).toEqual([
      ['moveTo', 1, 2],
      ['lineTo', 3, 4],
      ['rect', 0, 0, 10, 10],
    ]);
    expect(native.calls).toEqual([['moveTo', 1, 2], ['lineTo', 3, 4], ['rect', 0, 0, 10, 10], ['closePath']]);
    expect(path._closed).toBe(true);
  });

  it('没有原生 Path2D：退化为纯记录器，drawable 是自身（ICEPath 据此重放命令）', () => {
    const path = new Path2DRecorder();
    path.moveTo(5, 6);

    expect(path._isPolyfill).toBe(true);
    expect(path.drawable).toBe(path);
    expect(path._commands).toEqual([['moveTo', 5, 6]]);
  });

  it('arc 被记录（此前 PolyfillPath2D 缺这个方法，无原生 Path2D 的运行时直接抛错）', () => {
    const native = new FakeNativePath2D();
    const path = new Path2DRecorder(native);

    path.arc(10, 10, 5, 0, Math.PI * 2, false);

    expect(path._commands).toEqual([['arc', 10, 10, 5, 0, Math.PI * 2, false]]);
    expect(native.calls[0][0]).toBe('arc');
  });

  it('PolyfillPath2D 同样支持 arc（两个实现不漂移）', () => {
    const polyfill = new PolyfillPath2D();
    expect(typeof (polyfill as any).arc).toBe('function');
    (polyfill as any).arc(1, 2, 3, 0, Math.PI, true);
    expect(polyfill._commands).toEqual([['arc', 1, 2, 3, 0, Math.PI, true]]);
  });

  it('记录的命令能被重放到任意 ctx（服务端 / 小程序出图路径）', () => {
    const path = new Path2DRecorder();
    path.moveTo(0, 0);
    path.lineTo(10, 0);
    path.arc(10, 10, 5, 0, Math.PI);
    path.closePath();

    const ctx: any = {
      calls: [] as any[],
      beginPath() {
        this.calls.push(['beginPath']);
      },
      closePath() {
        this.calls.push(['closePath']);
      },
    };
    path._commands.forEach((cmd) => {
      ctx[cmd[0]] = function (...args: any[]) {
        this.calls.push([cmd[0], ...args]);
      };
    });
    const commands = path._commands;
    ctx.beginPath();
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      ctx[cmd[0]](...cmd.slice(1));
    }
    if (path._closed) {
      ctx.closePath();
    }

    expect(ctx.calls.map((c) => c[0])).toEqual(['beginPath', 'moveTo', 'lineTo', 'arc', 'closePath']);
  });
});
