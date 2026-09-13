/**
 * 编排（⑥）：`AnimationTimeline` + 运行时控制原语。
 *
 * 设计要点（与 18 §3.1 一致）：时间轴**不是新的求值器**，只是调度器 —— `play()` 把每条轨道折算成
 * `delay` 写进 `props.animations`，推进仍由 `AnimationManager` 按帧/按时间完成。因此它天然与
 * 缓动、关键帧、量化、缓存复用、空闲停帧兼容。
 */
import AnimationManager from '../../src/animation/AnimationManager';
import ICERect from '../../src/graphic/shape/ICERect';

class FakeElement {
  public props: any;
  public state: any = { left: 0, interactive: true };
  constructor(id: string, animations: any = {}) {
    this.props = { id, animations };
  }
  public setState(newState: any): void {
    Object.assign(this.state, newState);
  }
}

function makeManager() {
  const ice: any = { evtBus: { on: () => {}, off: () => {}, trigger: () => {} } };
  const manager: any = new AnimationManager(ice);
  return { manager, ice };
}

describe('⑥ 时间轴：轨道与游标', () => {
  it('add 合并配置并记录起始时刻；数字 at 与 "+=N" 都支持', () => {
    const { manager } = makeManager();
    const a = new FakeElement('a');
    const b = new FakeElement('b');
    const timeline: any = manager.timeline();

    timeline.add(a, { left: { from: 0, to: 100, duration: 400 } }, { at: 0 });
    timeline.add(b, { left: { from: 0, to: 100, duration: 400 } }, { at: '+=120' });

    // 还没 play：只写进 props.animations，不动 delay
    expect(a.props.animations.left.to).toBe(100);
    expect(b.props.animations.left.to).toBe(100);
    expect(a.props.animations.left.delay).toBeUndefined();
    expect(timeline.duration).toBe(120 + 400);
  });

  it('stagger：同一份配置按 each 错峰（绝对时刻依次 +each）', () => {
    const { manager } = makeManager();
    const rows = ['r1', 'r2', 'r3'].map((id) => new FakeElement(id));
    const timeline: any = manager.timeline();
    timeline.stagger(rows, { 'style.globalAlpha': { from: 0, to: 1, duration: 200 } }, { each: 80, at: 100 });
    expect(timeline.duration).toBe(100 + 2 * 80 + 200);
  });

  it('非法 at（负数 / 乱字符串）退回游标，不抛异常', () => {
    const { manager } = makeManager();
    const a = new FakeElement('a');
    const timeline: any = manager.timeline();
    timeline.add(a, { left: { from: 0, to: 1, duration: 10 } }, { at: -5 });
    timeline.add(a, { left: { from: 0, to: 1, duration: 10 } }, { at: 'soon' });
    expect(timeline.duration).toBeGreaterThan(0);
  });
});

describe('⑥ 时间轴：播放 / 暂停 / 停止 / 重播', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('play 把 at 折算成 delay 并注册进管理器；组件开始推进', () => {
    const { manager } = makeManager();
    const a = new FakeElement('a', { left: { from: 0, to: 100, duration: 100 } });
    const b = new FakeElement('b', { left: { from: 0, to: 100, duration: 100 } });
    const timeline: any = manager.timeline();
    timeline.add(a, { left: { from: 0, to: 100, duration: 100 } }, { at: 0 });
    timeline.add(b, { left: { from: 0, to: 100, duration: 100 } }, { at: 200 });
    timeline.play();

    expect(timeline.isPlaying()).toBe(true);
    expect(a.props.animations.left.delay).toBe(0);
    expect(b.props.animations.left.delay).toBe(200);
    expect(manager.isAnimating(a)).toBe(true);
    expect(manager.isAnimating(b)).toBe(true);

    // a 已经在走（0→100，一半进度），b 还在 delay 里（保持起点）
    manager.tween(a, 0);
    manager.tween(b, 0);
    manager.tween(a, 50);
    manager.tween(b, 50);
    expect(a.state.left).toBeCloseTo(50, 6);
    expect(b.state.left).toBeCloseTo(0, 6);
  });

  it('pause / resume 走管理器的全局暂停（进度冻结，恢复后接上）', () => {
    const { manager } = makeManager();
    const a = new FakeElement('a', { left: { from: 0, to: 100, duration: 100 } });
    const timeline: any = manager.timeline();
    timeline.add(a, { left: { from: 0, to: 100, duration: 100 } }, { at: 0 }).play();
    timeline.pause();
    expect(timeline.isPlaying()).toBe(false);
    expect(manager.isPaused()).toBe(true);
    timeline.resume();
    expect(timeline.isPlaying()).toBe(true);
    expect(manager.isPaused()).toBe(false);
  });

  it('stop 摘掉动画并还原 onComplete 包装；组件停在当前值', () => {
    const { manager } = makeManager();
    const originalComplete = jest.fn();
    const a = new FakeElement('a', {
      left: { from: 0, to: 100, duration: 100, onComplete: originalComplete },
    });
    const timeline: any = manager.timeline();
    timeline.add(a, { left: { from: 0, to: 100, duration: 100 } }, { at: 0 }).play();
    manager.tween(a, 0);
    timeline.stop();

    expect(manager.isAnimating(a)).toBe(false);
    // onComplete 已被还原（不再是时间轴的包装函数）
    expect(a.props.animations.left.onComplete).toBe(originalComplete);
    expect(timeline.isPlaying()).toBe(false);
  });

  it('restart：重置运行时状态后重播（点击重播的入口）', () => {
    const { manager } = makeManager();
    const a = new FakeElement('a', { left: { from: 0, to: 100, duration: 100 } });
    const timeline: any = manager.timeline();
    timeline.add(a, { left: { from: 0, to: 100, duration: 100 } }, { at: 0 }).play();
    manager.tween(a, 0);
    manager.tween(a, 200); // 跑完
    expect(a.props.animations.left.finished).toBe(true);
    expect(manager.isAnimating(a)).toBe(false);

    timeline.restart();
    expect(a.props.animations.left.finished).toBe(false);
    expect(a.props.animations.left.startTime).toBeUndefined();
    expect(manager.isAnimating(a)).toBe(true);
    manager.tween(a, 0);
    manager.tween(a, 50);
    expect(a.state.left).toBeCloseTo(50, 6); // 从头再放
  });

  it('finished：全部轨道跑完时 resolve（每条键的 onComplete 都计入）', async () => {
    const { manager } = makeManager();
    const a = new FakeElement('a', {
      left: { from: 0, to: 100, duration: 100 },
      top: { from: 0, to: 50, duration: 100 },
    });
    const timeline: any = manager.timeline();
    timeline.add(a, { left: { from: 0, to: 100, duration: 100 } }, { at: 0 }).play();
    let done = false;
    timeline.finished.then(() => {
      done = true;
    });
    manager.tween(a, 0);
    manager.tween(a, 150); // 两条键都在这一帧结束
    await Promise.resolve();
    expect(done).toBe(true);
  });
});

describe('⑥ 运行时控制原语', () => {
  it('replay(component)：把一个跑完的组件从头再放一遍', () => {
    const { manager } = makeManager();
    const a = new FakeElement('a', { left: { from: 0, to: 100, duration: 100 } });
    manager.add(a);
    manager.tween(a, 0);
    manager.tween(a, 200);
    expect(manager.isAnimating(a)).toBe(false);
    manager.replay(a);
    expect(manager.isAnimating(a)).toBe(true);
    manager.tween(a, 300); // startTime 重新初始化
    manager.tween(a, 350);
    expect(a.state.left).toBeCloseTo(50, 6);
  });
});

describe('⑥ 运行时挂动画（setAnimation / removeAnimation）', () => {
  it('没在构造时声明 animations 的组件也能在运行时挂上（不会被冻结的共享默认对象挡住）', () => {
    const { manager } = makeManager();
    const ice: any = { evtBus: { on: () => {}, off: () => {}, trigger: () => {} }, animationManager: manager };
    // 真实组件：`props.animations` 继承自冻结的共享默认对象（直接写会抛 object is not extensible）
    const component: any = new ICERect({ id: 'runtime', left: 0, top: 0, width: 10, height: 10 });
    component.ice = ice;
    expect(Object.isFrozen(component.props.animations)).toBe(true); // 共享默认对象是冻结的

    expect(() => component.setAnimation('style.globalAlpha', { from: 0, to: 1, duration: 100 })).not.toThrow();
    expect(component.props.animations['style.globalAlpha'].to).toBe(1);
    // 写时复制：新对象是实例自己的、可扩展
    expect(Object.isFrozen(component.props.animations)).toBe(false);
    expect(manager.isAnimating(component)).toBe(true);

    manager.tween(component, 0);
    manager.tween(component, 50);
    expect(component.state.style.globalAlpha).toBeCloseTo(0.5, 3);
  });

  it('removeAnimation：摘掉最后一条后组件退出动画管理', () => {
    const { manager } = makeManager();
    const ice: any = { evtBus: { on: () => {}, off: () => {}, trigger: () => {} }, animationManager: manager };
    const component: any = new ICERect({ left: 0, top: 0, width: 10, height: 10 });
    component.ice = ice;
    component.setAnimation('left', { from: 0, to: 10, duration: 10 });
    expect(manager.isAnimating(component)).toBe(true);
    component.removeAnimation('left');
    expect(manager.isAnimating(component)).toBe(false);
  });
});
