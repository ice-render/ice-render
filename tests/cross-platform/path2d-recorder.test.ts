/**
 * `Path2DRecorder`：路径对象的唯一入口 —— 命令流 + 原生转发。
 *
 * 背景：原生 `Path2D` 是不透明的，画得出来但拿不到几何描述。而 SVG / 服务端出图、
 * 以及「直接断言形状生成了哪些命令」都需要它 —— 所以路径对象一律走记录器。
 *
 * 本文件钉死三件事：
 * 1. 有原生 Path2D 时：命令既进命令流、也转发给原生对象（渲染路径与旧版一致）；
 * 2. 没有原生 Path2D 时（headless / 测试桩）：只记命令，**不再自己重放命令上屏**
 *    （"没有 Path2D 也要能画"那条支路 2026-09-20 已删，见 CHANGELOG 的破坏性小节）；
 * 3. `arc` 必须被记录 —— 它曾经缺过，导致事件圆这类形状在无原生 Path2D 的运行时直接抛
 *    `path.arc is not a function`。
 */
import Path2DRecorder, { setPath2DNativeFactory } from '../../src/cross-platform/Path2DRecorder';

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
  roundRect(...a: any[]) {
    this.calls.push(['roundRect', ...a]);
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

  it('平台没有原生 Path2D（headless / 测试桩）：退化为纯记录器（命令流可用，但引擎不负责重放上屏）', () => {
    setPath2DNativeFactory(() => null);
    const path = new Path2DRecorder();
    path.moveTo(5, 6);

    expect(path.native).toBeNull();
    expect(path._commands).toEqual([['moveTo', 5, 6]]);
    setPath2DNativeFactory(null);
  });

  it('不传原生参数 = 按平台工厂自己造一份（自定义子类 clone 构造函数也能上屏）', () => {
    /**
     * 真实事故（2026-09-21，IED 踩了两次）：应用的形状子类这样 clone 构造函数
     * —— `const PathCtor = this.path2D.constructor; new PathCtor()` —— 在"构造参数式"的旧设计下
     * 拿到的是 native=null 的纯记录器，而引擎 3.0.0 起不再把命令重放到 ctx，
     * 于是组件变成"命令流 / SVG 导出 / 单测全正常，屏幕上没有轮廓"。
     * 现在默认值改为"给你一份真能上屏的"，显式传 null 才保留纯记录器语义。
     */
    const fake = new FakeNativePath2D();
    setPath2DNativeFactory(() => fake);

    const auto = new Path2DRecorder();
    expect(auto.native).toBe(fake);
    auto.moveTo(1, 2);
    expect(fake.calls).toEqual([['moveTo', 1, 2]]);

    // 显式传 null：依然是纯记录器（headless / 测试桩的显式表达）
    expect(new Path2DRecorder(null).native).toBeNull();

    setPath2DNativeFactory(null);
  });

  it('arc 既被记录、也转发给原生对象', () => {
    const native = new FakeNativePath2D();
    const path = new Path2DRecorder(native);

    path.arc(10, 10, 5, 0, Math.PI * 2, false);

    expect(path._commands).toEqual([['arc', 10, 10, 5, 0, Math.PI * 2, false]]);
    expect(native.calls[0][0]).toBe('arc');
  });

  it('roundRect 有原生实现：命令流记一条、原生收到一次调用', () => {
    const native = new FakeNativePath2D();
    const path = new Path2DRecorder(native);

    path.roundRect(1, 2, 100, 50, 8);

    // 改造前 ICERect 是 4 次 arcTo（10 条命令）手撸，现在是规范成员 roundRect 一条
    expect(path._commands).toEqual([['roundRect', 1, 2, 100, 50, 8]]);
    expect(native.calls).toEqual([['roundRect', 1, 2, 100, 50, 8]]);
    // 与 canvas 一致：roundRect 是闭合子路径，当前点停在左上角弧的起点
    expect(path.currentPoint).toEqual([9, 2]);
  });

  it('roundRect 没有原生实现：命令流仍是一条，原生收到等价的 arcTo 序列（不少画一层圆角）', () => {
    const native = new FakeNativePath2D();
    // 模拟老运行时（Safari < 16.4 / 某些 headless 的 Path2D）
    (native as any).roundRect = undefined;
    const path = new Path2DRecorder(native);

    path.roundRect(0, 0, 100, 50, 10);

    expect(path._commands).toEqual([['roundRect', 0, 0, 100, 50, 10]]);
    // 展开只转发给原生对象，**不进命令流**（否则同一次调用会既记 roundRect 又记展开）
    expect(native.calls.map((c) => c[0])).toEqual([
      'moveTo',
      'lineTo',
      'arcTo',
      'lineTo',
      'arcTo',
      'lineTo',
      'arcTo',
      'lineTo',
      'arcTo',
      'closePath',
    ]);
    expect(native.calls[2]).toEqual(['arcTo', 100, 0, 100, 10, 10]);
  });

  it('roundRect 全 0 半径退化为 rect（规范口径）', () => {
    const native = new FakeNativePath2D();
    const path = new Path2DRecorder(native);

    path.roundRect(0, 0, 10, 20, 0);

    expect(path._commands).toEqual([['rect', 0, 0, 10, 20]]);
    expect(native.calls).toEqual([['rect', 0, 0, 10, 20]]);
  });

  it('数组半径入队时拷贝一份：命令流不会被调用方事后改动', () => {
    const radii = [4, 8, 12, 16];
    const path = new Path2DRecorder();
    path.roundRect(0, 0, 100, 50, radii);
    radii[0] = 99;
    expect(path._commands[0][5]).toEqual([4, 8, 12, 16]);
  });

  it('roundRect 非法半径抛 RangeError（与原生同口径，不静默降级）', () => {
    const path = new Path2DRecorder(new FakeNativePath2D());
    expect(() => path.roundRect(0, 0, 10, 10, -1)).toThrow(RangeError);
    expect(() => path.roundRect(0, 0, 10, 10, [1, 2, 3, 4, 5])).toThrow(RangeError);
    // 抛错时不留半条命令
    expect(path._commands).toEqual([]);
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
