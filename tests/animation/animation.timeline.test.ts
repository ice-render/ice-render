/**
 * AnimationManager 关键帧时间轴 / 数组字段补间 / 弹簧缓动 契约。
 *
 * 契约要点：
 * - **数组字段**可逐元素补间（`transform.scale` / `transform.translate` / `transform.skew` 等）；
 *   只有「长度不一致」或「含非数字」才拒绝，且只告警一次、不再每帧重试。
 * - **关键帧**：`keyframes: [{ offset, value, easing? }]`，offset 缺省按顺序均分、超界夹紧、自动排序；
 *   `easing` 写在段起始帧上，只作用于该段；时间轴外保持首/末帧值（不外推）。
 * - **结束按时间判定**，不按「值越过 to」：弹簧过冲时值会 > to，按值判定会在第一帧过冲处提前结束。
 * - **非法 duration**（0 / 缺失）立即落到终点并结束，不再每帧空转。
 * - 未知缓动名回退 linear 并只告警一次。
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import AnimationManager from '../../src/animation/AnimationManager';
import ICERect from '../../src/graphic/shape/ICERect';

/** 桩：setState 做浅合并（足以断言「单属性写入」的形状）。 */
function makeEl(animations: any) {
  return {
    props: { id: 'el-1', animations },
    state: {
      left: 0,
      top: 0,
      interactive: true,
      transform: { translate: [0, 0], scale: [1, 1], skew: [0, 0], rotate: 0 },
      style: { globalAlpha: 1 },
    },
    setState(newState: any) {
      for (const k in newState) {
        this.state[k] = newState[k];
      }
    },
  } as any;
}

function makeManager() {
  return new AnimationManager({ evtBus: {} } as any) as any;
}

describe('AnimationManager 数组字段补间', () => {
  let now = 0;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('transform.scale 逐元素补间，不产生 NaN', () => {
    const mgr = makeManager();
    const el = makeEl({ 'transform.scale': { from: [1, 1], to: [3, 3], duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);

    expect(el.state.transform.scale).toEqual([2, 2]);
    expect(el.state['transform.scale']).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('各分量独立补间（非等比数组）', () => {
    const mgr = makeManager();
    const el = makeEl({ 'transform.translate': { from: [0, 0], to: [10, -4], duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 25;
    mgr.tween(el);

    expect(el.state.transform.translate).toEqual([2.5, -1]);
  });

  it('到点后精确落在 to，并从动画列表移除', () => {
    const mgr = makeManager();
    const el = makeEl({ 'transform.scale': { from: [1, 1], to: [3, 3], duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 100;
    mgr.tween(el);

    expect(el.state.transform.scale).toEqual([3, 3]);
    expect(mgr.animationMap.size).toBe(0);
  });

  it('round: true 对数组逐元素取整', () => {
    const mgr = makeManager();
    const el = makeEl({ 'transform.scale': { from: [0, 0], to: [5, 3], duration: 100, round: true } });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);

    expect(el.state.transform.scale).toEqual([3, 2]); // 2.5→3，1.5→2
  });

  it('长度不一致的数组被拒绝，只告警一次且不再重试', () => {
    const mgr = makeManager();
    const el = makeEl({ 'transform.scale': { from: [1, 1], to: [3, 3, 3], duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);
    now = 80;
    mgr.tween(el);

    expect(el.state.transform.scale).toEqual([1, 1]); // 保持原值
    expect(el.state['transform.scale']).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(mgr.animationMap.size).toBe(0);
  });

  it('数组内含非数字被拒绝', () => {
    const mgr = makeManager();
    const el = makeEl({ 'transform.skew': { from: [1, 'a'], to: [3, 3], duration: 100 } });
    mgr.add(el);

    mgr.tween(el);

    expect(el.state.transform.skew).toEqual([0, 0]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('数组补间写入真实 state 时走写时复制，不污染共享默认', () => {
    const mgr = makeManager();
    const a: any = new ICERect({
      width: 10,
      height: 10,
      animations: { 'transform.scale': { from: [1, 1], to: [3, 3], duration: 100 } },
    });
    const b: any = new ICERect({ width: 10, height: 10 });
    mgr.add(a);

    mgr.tween(a);
    now = 50;
    mgr.tween(a);

    expect(a.state.transform.scale).toEqual([2, 2]);
    // 同一 transform 对象上的其它字段不受影响
    expect(a.state.transform.rotate).toBe(0);
    expect(a.state.transform.translate).toEqual([0, 0]);
    // 另一个实例仍读到共享默认值，说明默认对象未被就地修改
    expect(b.state.transform.scale).toEqual([1, 1]);
  });
});

describe('AnimationManager 关键帧时间轴', () => {
  let now = 0;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('两帧等价于 from/to', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 1, value: 100 },
        ],
        duration: 100,
      },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);
    expect(el.state.left).toBe(50);

    now = 100;
    mgr.tween(el);
    expect(el.state.left).toBe(100);
    expect(mgr.animationMap.size).toBe(0);
  });

  it('多段分段插值（0 → 100 → 0）', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 0.25, value: 100 },
          { offset: 1, value: 0 },
        ],
        duration: 100,
      },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 10; // 第一段 40%
    mgr.tween(el);
    expect(el.state.left).toBeCloseTo(40, 6);

    now = 25; // 恰好到达中间帧
    mgr.tween(el);
    expect(el.state.left).toBe(100);

    now = 50; // 第二段 1/3 处
    mgr.tween(el);
    expect(el.state.left).toBeCloseTo(100 - 100 / 3, 6);

    now = 100;
    mgr.tween(el);
    expect(el.state.left).toBe(0);
  });

  it('段内 easing 只作用于该段（写在段起始帧上）', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 0, value: 0, easing: 'easeInQuad' },
          { offset: 1, value: 100 },
        ],
        duration: 100,
        easing: 'linear',
      },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);

    expect(el.state.left).toBeCloseTo(25, 6); // easeInQuad(0.5) = 0.25
  });

  it('段内未声明 easing 时回落到动画级 easing', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 1, value: 100 },
        ],
        duration: 100,
        easing: 'easeInQuad',
      },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);

    expect(el.state.left).toBeCloseTo(25, 6);
  });

  it('offset 缺省时按顺序均分', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { keyframes: [{ value: 0 }, { value: 100 }, { value: 0 }], duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 25; // 落在 0 → 0.5 段的一半
    mgr.tween(el);

    expect(el.state.left).toBeCloseTo(50, 6);
  });

  it('offset 乱序会被排序', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 1, value: 0 },
          { offset: 0, value: 100 },
        ],
        duration: 100,
      },
    });
    mgr.add(el);

    mgr.tween(el);
    expect(el.state.left).toBe(100); // 起始即首帧

    now = 50;
    mgr.tween(el);
    expect(el.state.left).toBeCloseTo(50, 6);
  });

  it('offset 超出 [0,1] 会被夹紧', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: -1, value: 0 },
          { offset: 2, value: 100 },
        ],
        duration: 100,
      },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);
    expect(el.state.left).toBeCloseTo(50, 6);
  });

  it('时间轴之外保持首/末帧值，不外推', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 0.5, value: 10 },
          { offset: 1, value: 20 },
        ],
        duration: 100,
      },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 25; // 尚未进入首帧
    mgr.tween(el);

    expect(el.state.left).toBe(10);
  });

  it('关键帧的取值也可以是数组', () => {
    const mgr = makeManager();
    const el = makeEl({
      'transform.scale': {
        keyframes: [
          { offset: 0, value: [1, 1] },
          { offset: 1, value: [3, 5] },
        ],
        duration: 100,
      },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);

    expect(el.state.transform.scale).toEqual([2, 3]);
  });

  it('关键帧 + loop：每轮回到首帧值', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 1, value: 100 },
        ],
        duration: 100,
        loop: true,
      },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 100;
    mgr.tween(el);
    expect(el.state.left).toBe(0);
    expect(mgr.animationMap.size).toBe(1);

    now = 150;
    mgr.tween(el);
    expect(el.state.left).toBeCloseTo(50, 6);
  });

  it('关键帧 + round 生效', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 1, value: 10 },
        ],
        duration: 100,
        round: true,
      },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 55;
    mgr.tween(el);

    expect(el.state.left).toBe(6); // 5.5 → 6
  });

  it('只有一帧的 keyframes 非法：拒绝且只告警一次', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { keyframes: [{ offset: 0, value: 0 }], duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);
    now = 80;
    mgr.tween(el);

    expect(el.state.left).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(mgr.animationMap.size).toBe(0);
  });

  it('offset 非数字的 keyframes 非法', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 'abc', value: 0 },
          { offset: 1, value: 100 },
        ],
        duration: 100,
      },
    });
    mgr.add(el);

    mgr.tween(el);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(mgr.animationMap.size).toBe(0);
  });

  it('各帧取值不同型（数字 vs 数组）非法', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: {
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 1, value: [1, 1] },
        ],
        duration: 100,
      },
    });
    mgr.add(el);

    mgr.tween(el);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('各帧数组长度不一致非法', () => {
    const mgr = makeManager();
    const el = makeEl({
      'transform.scale': {
        keyframes: [
          { offset: 0, value: [1, 1] },
          { offset: 1, value: [1, 1, 1] },
        ],
        duration: 100,
      },
    });
    mgr.add(el);

    mgr.tween(el);

    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('AnimationManager 弹簧缓动', () => {
  let now = 0;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('过冲：值越过 to，但动画不会被提前判定结束', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, easing: 'spring' } });
    mgr.add(el);

    mgr.tween(el);
    now = 30; // spring 在此处过冲
    mgr.tween(el);

    expect(el.state.left).toBeGreaterThan(100);
    expect(el.props.animations.left.finished).not.toBe(true);
    expect(mgr.animationMap.size).toBe(1);
  });

  it('到点时精确落在 to（弹簧 p(1) 的残差被消除）', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, easing: 'spring' } });
    mgr.add(el);

    mgr.tween(el);
    now = 100;
    mgr.tween(el);

    expect(el.state.left).toBe(100);
    expect(mgr.animationMap.size).toBe(0);
  });

  it('弹簧缓动也能驱动数组字段', () => {
    const mgr = makeManager();
    const el = makeEl({ 'transform.scale': { from: [1, 1], to: [2, 2], duration: 100, easing: 'spring' } });
    mgr.add(el);

    mgr.tween(el);
    now = 30;
    mgr.tween(el);

    expect(el.state.transform.scale[0]).toBeGreaterThan(2);
    expect(el.state.transform.scale[1]).toBeGreaterThan(2);
  });

  it('spring 可作为主题 motion token 语义名解析', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 'normal', easing: 'spring' } });
    mgr.add(el);

    mgr.tween(el);

    expect(el.props.animations.left.duration).toBe(200); // DEFAULT_THEME.motion.duration.normal
    expect(el.props.animations.left.easing).toBe('spring');
  });

  it('未知缓动名回退 linear，且只告警一次', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, easing: 'no-such-easing' } });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);
    now = 60;
    mgr.tween(el);

    expect(el.state.left).toBeCloseTo(60, 6);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('AnimationManager 非法 duration', () => {
  let now = 0;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('duration = 0：立即落到终点并结束（旧实现 from===to 时会永远空转）', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 5, to: 5, duration: 0 } });
    mgr.add(el);

    mgr.tween(el);

    expect(el.state.left).toBe(5);
    expect(mgr.animationMap.size).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('duration 缺失：立即落到终点并结束，不再每帧空转', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100 } });
    mgr.add(el);

    mgr.tween(el);

    expect(el.state.left).toBe(100);
    expect(mgr.animationMap.size).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
