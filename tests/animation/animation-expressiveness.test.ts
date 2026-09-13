/**
 * 表达力（⑤）：**应用层自定义动画**的四件事（都在 `AnimationManager` 层）：
 *
 * 1. **自定义缓动**：直接给函数，或 `registerEasing(name, fn)` 后按名字用；
 * 2. **颜色插值**：`fillStyle: '#ff0000' → '#0000ff'` 终于能动了；
 * 3. **生命周期回调**：`onStart / onUpdate / onRepeat / onComplete`（链式编排的基础）；
 * 4. **往返方向**：`direction: 'normal' | 'reverse' | 'alternate'`（yoyo）。
 */
import AnimationManager from '../../src/animation/AnimationManager';
import { registerEasing, unregisterEasing, customEasingNames } from '../../src/animation/easing-registry';
import { ICE_ANIMATION_DIAGNOSTIC_CODES as CODES } from '../../src/animation/validate-animations';

function makeManager() {
  const ice: any = { evtBus: { on: () => {}, off: () => {}, trigger: () => {} } };
  return new AnimationManager(ice);
}

function makeEl(animations: any) {
  const el: any = {
    props: { id: 'el-1', animations },
    state: { left: 0, style: { fillStyle: '#ff0000' }, interactive: true },
    setState(newState: any) {
      Object.assign(this.state, newState);
      if (newState.style) {
        this.state.style = { ...this.state.style, ...newState.style };
      }
    },
  };
  return el;
}

describe('⑤-1 自定义缓动', () => {
  afterEach(() => {
    customEasingNames().forEach((name) => unregisterEasing(name));
  });

  it('直接给函数：这条动画按自己的手感走', () => {
    const mgr: any = makeManager();
    // 平方缓动：50% 进度只走 25%
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, easing: (t: number) => t * t } });
    mgr.add(el);
    mgr.tween(el, 0);
    mgr.tween(el, 50);
    expect(el.state.left).toBeCloseTo(25, 6);
  });

  it('registerEasing 注册后按名字用；未注册的名字仍回退 linear 并记诊断', () => {
    registerEasing('brandSpring', (t: number) => 1 - Math.pow(1 - t, 2));
    const mgr: any = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, easing: 'brandSpring' } });
    mgr.add(el);
    mgr.tween(el, 0);
    mgr.tween(el, 50);
    expect(el.state.left).toBeCloseTo(75, 6); // 1-(1-0.5)^2 = 0.75
    expect(mgr.getDiagnostics()).toEqual([]);

    const mgr2: any = makeManager();
    const el2 = makeEl({ left: { from: 0, to: 100, duration: 100, easing: 'nope' } });
    mgr2.add(el2);
    mgr2.tween(el2, 0);
    mgr2.tween(el2, 50);
    expect(el2.state.left).toBeCloseTo(50, 6); // 回退 linear
    expect(mgr2.getDiagnostics().map((d: any) => d.code)).toEqual([CODES.EASING_UNKNOWN]);
  });
});

describe('⑤-2 颜色插值', () => {
  it('fillStyle 红→蓝：中途是中值，终点精确', () => {
    const mgr: any = makeManager();
    const el = makeEl({ 'style.fillStyle': { from: '#ff0000', to: '#0000ff', duration: 100 } });
    mgr.add(el);
    mgr.tween(el, 0);
    mgr.tween(el, 50);
    expect(el.state.style.fillStyle).toBe('rgb(128, 0, 128)');
    mgr.tween(el, 120);
    expect(el.state.style.fillStyle).toBe('rgb(0, 0, 255)');
  });

  it('带单位数字串（同单位）也能动；单位不一致则按不可插值跳过并记诊断', () => {
    const mgr: any = makeManager();
    const el = makeEl({ 'style.lineWidth': { from: '2px', to: '10px', duration: 100 } });
    mgr.add(el);
    mgr.tween(el, 0);
    mgr.tween(el, 25);
    expect(el.state.style.lineWidth).toBe('4px');

    const mgr2: any = makeManager();
    const el2 = makeEl({ 'style.lineWidth': { from: '2px', to: '3em', duration: 100 } });
    mgr2.add(el2);
    mgr2.tween(el2, 0);
    expect(mgr2.getDiagnostics().map((d: any) => d.code)).toEqual([CODES.VALUE_NOT_INTERPOLATABLE]);
  });
});

describe('⑤-3 生命周期回调', () => {
  it('onStart → onUpdate(每帧) → onComplete；回调收到 key/value/progress', () => {
    const mgr: any = makeManager();
    const events: any[] = [];
    const el = makeEl({
      left: {
        from: 0,
        to: 100,
        duration: 100,
        onStart: (ctx: any) => events.push(['start', ctx.key]),
        onUpdate: (ctx: any) => events.push(['update', Math.round(ctx.value), Number(ctx.progress.toFixed(2))]),
        onComplete: (ctx: any) => events.push(['complete', ctx.value]),
      },
    });
    mgr.add(el);
    mgr.tween(el, 0); // start + update(0)
    mgr.tween(el, 50); // update(50)
    mgr.tween(el, 120); // complete(100)

    expect(events[0]).toEqual(['start', 'left']);
    expect(events).toContainEqual(['update', 50, 0.5]);
    expect(events[events.length - 1]).toEqual(['complete', 100]);
  });

  it('loop/iterationCount 时每轮重复触发 onRepeat（带轮次）', () => {
    const mgr: any = makeManager();
    const repeats: number[] = [];
    const el = makeEl({
      left: { from: 0, to: 100, duration: 100, iterationCount: 3, onRepeat: (ctx: any) => repeats.push(ctx.iteration) },
    });
    mgr.add(el);
    mgr.tween(el, 0);
    mgr.tween(el, 100); // 第 1 轮结束 → repeat(1)
    mgr.tween(el, 200); // 第 2 轮结束 → repeat(2)
    mgr.tween(el, 300); // 第 3 轮结束 → 完成（不再 repeat）
    expect(repeats).toEqual([1, 2]);
  });

  it('回调抛异常不会打断帧循环，且记一条 CALLBACK_ERROR 诊断', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const mgr: any = makeManager();
    const el = makeEl({
      left: {
        from: 0,
        to: 100,
        duration: 100,
        onUpdate: () => {
          throw new Error('boom');
        },
      },
    });
    mgr.add(el);
    expect(() => {
      mgr.tween(el, 0);
      mgr.tween(el, 50);
    }).not.toThrow();
    expect(el.state.left).toBeCloseTo(50, 6); // 值照旧写进去了
    expect(mgr.getDiagnostics().map((d: any) => d.code)).toContain(CODES.CALLBACK_ERROR);
    warn.mockRestore();
  });
});

describe('⑤-4 往返方向（yoyo）', () => {
  it("direction: 'reverse' 从 to 走到 from", () => {
    const mgr: any = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, direction: 'reverse' } });
    mgr.add(el);
    mgr.tween(el, 0);
    expect(el.state.left).toBeCloseTo(100, 6);
    mgr.tween(el, 50);
    expect(el.state.left).toBeCloseTo(50, 6);
    mgr.tween(el, 120);
    expect(el.state.left).toBeCloseTo(0, 6);
  });

  it("direction: 'alternate' 与 iterationCount 组合：一轮来回、终点按轮次奇偶落两端", () => {
    const mgr: any = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, direction: 'alternate', iterationCount: 2 } });
    mgr.add(el);
    mgr.tween(el, 0); // 第 1 轮（正向）起点 0
    expect(el.state.left).toBeCloseTo(0, 6);
    mgr.tween(el, 50); // 第 1 轮 50%
    expect(el.state.left).toBeCloseTo(50, 6);
    mgr.tween(el, 100); // 第 1 轮结束 → 起点变成另一端（100），开始第 2 轮反向
    expect(el.state.left).toBeCloseTo(100, 6);
    mgr.tween(el, 150); // 第 2 轮 50%（反向）
    expect(el.state.left).toBeCloseTo(50, 6);
    mgr.tween(el, 220); // 全部结束 → 落在 from（反向轮的终点）
    expect(el.state.left).toBeCloseTo(0, 6);
  });
});
