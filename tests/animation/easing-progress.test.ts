/**
 * EasingProgress（归一化进度函数）契约。
 *
 * 为什么需要它：关键帧的**段内缓动**要能在任意局部进度上求值，而历史的 `Easing`
 * 是「值语义 + 内部自读 Date.now()」的签名，无法在任意进度上调用。为此把缓动拆成两层，
 * 本文件锁定两件事：
 *
 * 1. **不漂移**：`EasingProgress[name](p)` 与 `Easing[name](0,1,1,startTime)` 在 0~1 网格上等价；
 * 2. **仿射性**：`Easing[name](from,to,..) === from + (to-from)·EasingProgress[name](p)`，
 *    这是管理器能对数组字段「逐元素补间」的前提；
 * 3. 弹簧类**自带过冲**（中途 > 1）——这正是管理器必须按时间而非按值判定结束的原因。
 */
import Easing, { EasingProgress } from '../../src/animation/Easing';

const CURVE_NAMES = [
  'linear',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInQuart',
  'easeOutQuart',
  'easeInOutQuart',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
];
const SPRING_NAMES = ['spring', 'springSoft', 'springSnappy'];
const DURATION = 1000;
const START = 1_000_000;

describe('EasingProgress ↔ Easing 等价性（防止两层实现漂移）', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(CURVE_NAMES)('%s：与值语义实现在 0~1 网格上等价', (name) => {
    let p = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => START + p * DURATION);
    const progress = EasingProgress[name];
    let worst = 0;
    for (let i = 0; i <= 100; i++) {
      p = i / 100;
      worst = Math.max(worst, Math.abs(Easing[name](0, 1, DURATION, START) - progress(p)));
    }
    expect(worst).toBeLessThan(1e-12);
  });

  it.each(CURVE_NAMES)('%s：对 from/to 仿射（数组逐元素补间的前提）', (name) => {
    let p = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => START + p * DURATION);
    const progress = EasingProgress[name];
    let worst = 0;
    for (const [from, to] of [
      [0, 100],
      [-40, 40],
      [3.5, -7.25],
      [1000, 0],
    ]) {
      for (let i = 0; i <= 20; i++) {
        p = i / 20;
        const byValue = Easing[name](from, to, DURATION, START);
        const byProgress = from + (to - from) * progress(p);
        worst = Math.max(worst, Math.abs(byValue - byProgress));
      }
    }
    expect(worst).toBeLessThan(1e-9);
  });

  it.each(CURVE_NAMES)('%s：单调曲线在端点取 0 / 1', (name) => {
    expect(EasingProgress[name](0)).toBeCloseTo(0, 12);
    expect(EasingProgress[name](1)).toBeCloseTo(1, 12);
  });
});

describe('弹簧进度（弹簧类缓动）', () => {
  it.each(SPRING_NAMES)('%s：p(0) = 0', (name) => {
    expect(EasingProgress[name](0)).toBeCloseTo(0, 12);
  });

  it.each(SPRING_NAMES)('%s：p(1) 收敛到 1（误差 < 2e-3，到点由管理器精确落到终点值）', (name) => {
    expect(Math.abs(EasingProgress[name](1) - 1)).toBeLessThan(2e-3);
  });

  it.each(SPRING_NAMES)('%s：中途出现过冲（进度 > 1）', (name) => {
    let peak = 0;
    for (let i = 0; i <= 1000; i++) {
      peak = Math.max(peak, EasingProgress[name](i / 1000));
    }
    expect(peak).toBeGreaterThan(1.005);
  });

  it('过冲幅度排序：springSnappy > spring > springSoft', () => {
    const peakOf = (name: string) => {
      let peak = 0;
      for (let i = 0; i <= 1000; i++) {
        peak = Math.max(peak, EasingProgress[name](i / 1000));
      }
      return peak;
    };
    expect(peakOf('springSnappy')).toBeGreaterThan(peakOf('spring'));
    expect(peakOf('spring')).toBeGreaterThan(peakOf('springSoft'));
  });

  it.each(SPRING_NAMES)('%s：起步阶段严格递增（确实在运动，而不是近似恒等）', (name) => {
    const progress = EasingProgress[name];
    // 起点处加速度最大：走过标称时长的 5% 时，进度已超过 5%
    expect(progress(0.05)).toBeGreaterThan(0.05);
    expect(progress(0.15)).toBeGreaterThan(progress(0.05));
  });

  it('进度函数是纯函数：不读时钟', () => {
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('进度函数不应读时钟');
    });
    expect(EasingProgress.spring(0.5)).toBeGreaterThan(1);
    expect(EasingProgress.linear(0.25)).toBe(0.25);
    spy.mockRestore();
  });

  it('Easing.spring 的值语义带过冲：值会越过 to 再回落', () => {
    jest.spyOn(Date, 'now').mockImplementation(() => START + 30); // τ = 0.3
    expect(Easing.spring(0, 100, 100, START)).toBeGreaterThan(100);
    jest.restoreAllMocks();
  });
});
