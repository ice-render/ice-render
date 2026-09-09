import AnimationManager from '../../src/animation/AnimationManager';

function makeEl(animations: any) {
  return {
    props: { id: 'el-1', animations },
    state: { left: 0, top: 0, interactive: true },
    setState(newState: any) {
      Object.assign(this.state, newState);
    },
  };
}

describe('AnimationManager', () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeManager() {
    const ice: any = { evtBus: {} };
    return new AnimationManager(ice);
  }

  it('单属性动画：到达终点后结束并移除', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100 } });
    mgr.add(el);

    (mgr as any).tween(el); // now=0：初始化 startTime，left=0
    expect(el.state.left).toBe(0);

    now = 50;
    (mgr as any).tween(el);
    expect(el.state.left).toBe(50);

    now = 100;
    (mgr as any).tween(el);
    expect(el.state.left).toBe(100);
    expect((mgr as any).animationMap.size).toBe(0);
  });

  it('loop: true 无限循环', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, loop: true } });
    mgr.add(el);

    (mgr as any).tween(el); // 初始化 startTime

    now = 100;
    (mgr as any).tween(el); // 到达终点，loop → 从 from 重新开始
    expect(el.state.left).toBe(0);
    expect((mgr as any).animationMap.size).toBe(1);

    now = 150;
    (mgr as any).tween(el);
    expect(el.state.left).toBe(50);
  });

  it('iterationCount: N 播放 N 次后结束', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100, iterationCount: 2 } });
    mgr.add(el);

    (mgr as any).tween(el); // 初始化 startTime

    now = 100;
    (mgr as any).tween(el); // 第 1 轮结束，iterationCount 2→1，重复
    expect((mgr as any).animationMap.size).toBe(1);

    now = 200;
    (mgr as any).tween(el); // 第 2 轮结束，不再重复
    expect(el.state.left).toBe(100);
    expect((mgr as any).animationMap.size).toBe(0);
  });

  it('递减动画 from > to', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 100, to: 0, duration: 100 } });
    mgr.add(el);

    (mgr as any).tween(el); // 初始化 startTime，left=100

    now = 50;
    (mgr as any).tween(el);
    expect(el.state.left).toBe(50);

    now = 100;
    (mgr as any).tween(el);
    expect(el.state.left).toBe(0);
    expect((mgr as any).animationMap.size).toBe(0);
  });

  it('多属性独立计时：全部结束后才移除', () => {
    const mgr = makeManager();
    const el = makeEl({
      left: { from: 0, to: 100, duration: 100 },
      top: { from: 0, to: 200, duration: 200 }, // 更慢
    });
    mgr.add(el);

    (mgr as any).tween(el); // 初始化 startTime

    now = 100;
    (mgr as any).tween(el); // left 结束，top 未结束
    expect(el.state.left).toBe(100);
    expect((mgr as any).animationMap.size).toBe(1);

    now = 200;
    (mgr as any).tween(el); // top 也结束
    expect(el.state.top).toBe(200);
    expect((mgr as any).animationMap.size).toBe(0);
  });

  it('pause/resume 冻结进度，从暂停处继续', () => {
    const mgr = makeManager();
    const el = makeEl({ left: { from: 0, to: 100, duration: 100 } });
    mgr.add(el);

    (mgr as any).tween(el); // 初始化 startTime=0

    now = 50;
    (mgr as any).tween(el);
    expect(el.state.left).toBe(50);

    mgr.pause();
    expect(mgr.isPaused()).toBe(true);

    now = 150; // 暂停了 100ms
    mgr.resume(); // startTime += 100

    (mgr as any).tween(el); // deltaT = 150 - 100 = 50 → left = 50
    expect(el.state.left).toBe(50); // 未跳变
    expect(mgr.isPaused()).toBe(false);
  });
});
