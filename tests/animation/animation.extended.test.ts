/**
 * AnimationManager 扩展契约：点路径 / delay / 取整策略 / interactive 保留 / 销毁摘除。
 *
 * 契约：
 * - 动画键支持**点路径**（`transform.rotate` / `style.globalAlpha`）：旧实现写成字面量键，静默失效
 * - 同一帧内多个属性共用父级时会逐段合并，不互相覆盖
 * - 默认**不取整**（旧实现 Math.floor 让 0→1 的透明度/角度/缩放失真）；`round: true` 才取整
 * - `delay` 延迟期内保持 from，之后按 (t - startTime - delay) 推进；loop 每轮重新计 delay
 * - 动画期间**保存并恢复** interactive 原值，不覆盖用户显式设置的 false
 * - 组件销毁时从动画列表摘除（旧实现不摘，销毁后仍被每帧 setState）
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import AnimationManager from '../../src/animation/AnimationManager';
import ICERect from '../../src/graphic/shape/ICERect';

/** 桩：setState 做浅合并（与真实 merge 在「单层 + 嵌套对象整体替换」上行为一致，足够断言形状）。 */
function makeEl(animations: any, interactive = true) {
  return {
    props: { id: 'el-1', animations },
    state: {
      left: 0,
      top: 0,
      interactive,
      transform: { translate: [0, 0], scale: [1, 1], skew: [0, 0], rotate: 0 },
      style: { globalAlpha: 1, fillStyle: 'red' },
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

describe('AnimationManager 点路径', () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  it('支持嵌套字段：transform.rotate 真正写入 state.transform', () => {
    const mgr = makeManager();
    const el = makeEl({ 'transform.rotate': { from: 0, to: 90, duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);

    expect(el.state.transform.rotate).toBe(45);
    // 旧实现会产生一个名为 'transform.rotate' 的字面量键，且 transform.rotate 恒为 0
    expect(el.state['transform.rotate']).toBeUndefined();
  });

  it('同帧内多个属性共用父级时逐段合并，不互相覆盖', () => {
    const mgr = makeManager();
    const el = makeEl({
      'style.globalAlpha': { from: 0, to: 1, duration: 100 },
      'style.lineWidth': { from: 0, to: 10, duration: 100 },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);

    expect(el.state.style.globalAlpha).toBeCloseTo(0.5, 6);
    expect(el.state.style.lineWidth).toBeCloseTo(5, 6);
  });

  it('非数值属性（数组型 transform.scale）被明确拒绝，不写出 NaN', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const mgr = makeManager();
    const el = makeEl({ 'transform.scale': { from: [1, 1], to: [3, 3], duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);

    expect(el.state.transform.scale).toEqual([1, 1]); // 保持原值，未被 NaN 污染
    expect(el.state['transform.scale']).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(mgr.animationMap.size).toBe(0); // 拒绝后不再每帧重试
    warn.mockRestore();
  });

  it('支持 style 路径：style.globalAlpha', () => {
    const mgr = makeManager();
    const el = makeEl({ 'style.globalAlpha': { from: 0, to: 1, duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 40;
    mgr.tween(el);

    expect(el.state.style.globalAlpha).toBeCloseTo(0.4, 6);
  });
});

describe('AnimationManager 取整策略', () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  it('默认不取整：0→1 的中间值保留小数（旧实现 Math.floor 会恒为 0）', () => {
    const mgr = makeManager();
    const el = makeEl({ 'style.globalAlpha': { from: 0, to: 1, duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);

    expect(el.state.style.globalAlpha).toBe(0.5);
  });

  it('round: true 时按整数步进取整', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 10, duration: 100, round: true } });
    mgr.add(el);

    mgr.tween(el);
    now = 55;
    mgr.tween(el);

    expect(el.state.left).toBe(6); // 5.5 → 6
    expect(Number.isInteger(el.state.left)).toBe(true);
  });

  it('未声明 round 的位移保留小数（平滑运动）', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 10, duration: 100 } });
    mgr.add(el);

    mgr.tween(el);
    now = 55;
    mgr.tween(el);

    expect(el.state.left).toBeCloseTo(5.5, 6);
  });
});

describe('AnimationManager delay', () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  it('延迟期内保持 from，不推进进度', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, delay: 200 } });
    mgr.add(el);

    mgr.tween(el);
    expect(el.state.left).toBe(0);

    now = 100;
    mgr.tween(el);
    expect(el.state.left).toBe(0); // 仍在延迟内

    now = 199;
    mgr.tween(el);
    expect(el.state.left).toBe(0);
  });

  it('越过 delay 后按 (t - startTime - delay) 推进，总时长 = delay + duration', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, delay: 200 } });
    mgr.add(el);

    mgr.tween(el);
    now = 250; // 已过 delay 50ms
    mgr.tween(el);
    expect(el.state.left).toBe(50);

    now = 300; // delay(200) + duration(100)
    mgr.tween(el);
    expect(el.state.left).toBe(100);
    expect(mgr.animationMap.size).toBe(0);
  });

  it('多个属性用不同 delay 可形成错峰（序列）', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: { from: 0, to: 100, duration: 100 },
      top: { from: 0, to: 100, duration: 100, delay: 100 },
    });
    mgr.add(el);

    mgr.tween(el);
    now = 50;
    mgr.tween(el);
    expect(el.state.left).toBe(50);
    expect(el.state.top).toBe(0); // 仍在延迟内

    now = 150;
    mgr.tween(el);
    expect(el.state.left).toBe(100);
    expect(el.state.top).toBe(50);
  });

  it('loop 时每轮重新计 delay', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, delay: 100, loop: true } });
    mgr.add(el);

    mgr.tween(el); // startTime=0
    now = 100; // delay 结束，进度 0
    mgr.tween(el);
    expect(el.state.left).toBe(0);

    now = 200; // delay(100)+duration(100) → 到达终点 → 重置
    mgr.tween(el);
    expect(el.state.left).toBe(0);
    expect(mgr.animationMap.size).toBe(1);

    now = 250; // 新一轮仍在 delay 内
    mgr.tween(el);
    expect(el.state.left).toBe(0);

    now = 350; // 新一轮 delay 结束 + 50ms
    mgr.tween(el);
    expect(el.state.left).toBe(50);
  });
});

describe('AnimationManager interactive 保留', () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  it('动画期间保存并恢复 interactive 原值：用户设的 false 不会被强制改回 true', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100 } }, false);
    // 直接调 frameEventHandler（跳过 start 的订阅）
    mgr.add(el);
    (mgr as any).frameEventHandler({} as any);

    expect(el.state.interactive).toBe(false);
  });

  it('原本为 true 的组件在动画期间会被暂时置 false（避免影响属性计算）', () => {
    const mgr = makeManager();
    const seen: boolean[] = [];
    const el = makeEl({ left: { from: 0, to: 100, duration: 100 } }, true);
    const origSetState = el.setState.bind(el);
    el.setState = (ns: any) => {
      seen.push(el.state.interactive);
      origSetState(ns);
    };
    mgr.add(el);
    (mgr as any).frameEventHandler({} as any);

    expect(seen).toEqual([false]); // tween 期间 interactive 为 false
    expect(el.state.interactive).toBe(true); // 之后恢复
  });
});

describe('AnimationManager 与销毁的配合', () => {
  it('组件销毁时从动画列表摘除（真实 manager + 真实组件）', () => {
    const ice: any = { evtBus: {} };
    const mgr: any = new AnimationManager(ice);
    ice.animationManager = mgr;

    const comp: any = new ICERect({ width: 10, height: 10, animations: { left: { from: 0, to: 10, duration: 100 } } });
    mgr.add(comp);
    expect(mgr.animationMap.size).toBe(1);

    comp.ice = ice;
    comp.destory();

    expect(mgr.animationMap.size).toBe(0);
  });
});
