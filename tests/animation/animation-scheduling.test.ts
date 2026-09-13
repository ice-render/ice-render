/**
 * 帧调度与合规（④）的回归：
 *
 * - **次要动画降频**（`fps`）：按时间降采样，跳过帧不改变运动曲线；终点仍精确落值；
 * - **减少动态效果**（`prefers-reduced-motion`）：动画直接落终态、只留结果，并记一条 `ICE_ANIM_REDUCED_MOTION`
 *   运行期诊断（让开发者知道"没动"是用户偏好，而不是引擎坏了）；
 * - **暂停时不再需要帧**（`hasActiveAnimations()`）：配合空闲停帧，暂停的动画不空转。
 */
import AnimationManager from '../../src/animation/AnimationManager';
import { ICE_ANIMATION_DIAGNOSTIC_CODES as CODES } from '../../src/animation/validate-animations';

function makeManager() {
  const ice: any = { evtBus: { on: () => {}, off: () => {}, trigger: () => {} } };
  return new AnimationManager(ice);
}

function makeEl(animations: any) {
  return {
    props: { id: 'el-1', animations },
    state: { left: 0, top: 0, interactive: true },
    setState(newState: any) {
      Object.assign(this.state, newState);
    },
  };
}

describe('④-2 次要动画降频（fps）', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fps: 30 时按 ~33ms 采样：高频 tick 不会每帧都写值', () => {
    const mgr: any = makeManager();
    const el: any = makeEl({ left: { from: 0, to: 1000, duration: 1000, fps: 30 } });
    mgr.add(el);

    const writes: number[] = [];
    for (let t = 0; t <= 300; t += 16) {
      mgr.tween(el, t);
      writes.push(el.state.left);
    }
    // 300ms 内 30fps 至多 ~10 次更新，而 tick 有 19 次 → 必须有"值没变"的帧
    const distinct = new Set(writes).size;
    expect(distinct).toBeLessThan(writes.length);
    expect(distinct).toBeGreaterThan(4);
  });

  it('降频不改变运动曲线与终点：linear 动画在 50% 处仍是一半，到点仍是精确终值', () => {
    const mgr: any = makeManager();
    const el: any = makeEl({ left: { from: 0, to: 100, duration: 100, fps: 20 } });
    mgr.add(el);

    mgr.tween(el, 0);
    mgr.tween(el, 50); // 50% → 50（20fps 下 50ms ≥ 50ms 间隔 ✓）
    expect(el.state.left).toBeCloseTo(50, 6);
    mgr.tween(el, 120); // 到点
    expect(el.state.left).toBeCloseTo(100, 6);
  });
});

describe('④-4 减少动态效果（prefers-reduced-motion）', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('开启后动画直接落终态、不再逐帧推进（并记一条 warning 诊断）', () => {
    const mgr: any = makeManager();
    mgr.reducedMotion = true;
    const el: any = makeEl({ left: { from: 0, to: 100, duration: 1000 } });
    mgr.add(el);

    mgr.tween(el, 0); // 首帧就落终态
    expect(el.state.left).toBe(100);
    expect((el.props.animations.left as any).finished).toBe(true);

    const diagnostics = mgr.getDiagnostics();
    expect(diagnostics.map((d: any) => d.code)).toEqual([CODES.REDUCED_MOTION]);
    expect(diagnostics[0].severity).toBe('warning');
    expect(diagnostics[0].path).toBe('left');
  });

  it('关键帧动画同样折叠到最后那一帧的值', () => {
    const mgr: any = makeManager();
    mgr.reducedMotion = true;
    const el: any = makeEl({
      left: {
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 0.5, value: 80 },
          { offset: 1, value: 30 },
        ],
        duration: 500,
      },
    });
    mgr.add(el);
    mgr.tween(el, 0);
    expect(el.state.left).toBe(30);
  });

  it('关闭后恢复逐帧播放', () => {
    const mgr: any = makeManager();
    mgr.reducedMotion = false;
    const el: any = makeEl({ left: { from: 0, to: 100, duration: 100 } });
    mgr.add(el);
    mgr.tween(el, 0);
    mgr.tween(el, 50);
    expect(el.state.left).toBeCloseTo(50, 6);
    expect(mgr.getDiagnostics()).toEqual([]);
  });
});

describe('④ 配合空闲停帧：帧需求（hasActiveAnimations）', () => {
  it('有动画时"需要帧"；暂停后不再需要；跑完同样不需要', () => {
    const mgr: any = makeManager();
    expect(mgr.hasActiveAnimations()).toBe(false);

    const el: any = makeEl({ left: { from: 0, to: 100, duration: 100 } });
    mgr.add(el);
    expect(mgr.hasActiveAnimations()).toBe(true);

    mgr.pause();
    expect(mgr.hasActiveAnimations()).toBe(false); // 暂停 = 进度不推进 → 可以停帧
    mgr.resume();
    expect(mgr.hasActiveAnimations()).toBe(true);

    mgr.tween(el, 0);
    mgr.tween(el, 200); // 跑完 → 从 animationMap 摘除
    expect(mgr.hasActiveAnimations()).toBe(false);
  });
});
