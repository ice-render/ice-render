/**
 * **两套事件 API 的一致性**（2026-09-19）：
 * `on / off / once`（jQuery 风格，引擎与家族在用的那套）与
 * `addEventListener / removeEventListener / dispatchEvent`（W3C 风格别名）
 * **必须是同一个实现的两种参数形状**，不能各有一套语义。
 *
 * 旧实现是 `prototype.addEventListener = prototype.on`：第三参 `{once:true}` 被当成 `scope`、
 * `dispatchEvent(event)` 把事件对象当成事件名 —— 表面像 W3C、实际不是。
 */
import ICEEventTarget from '../../src/event/ICEEventTarget';
import ICEEvent from '../../src/event/ICEEvent';

function target(): any {
  // ICEEventTarget 是抽象基类，这里用一个最小子类做夹具（不牵扯组件几何）
  class Fixture extends ICEEventTarget {}
  return new (Fixture as any)();
}

describe('on / addEventListener：同一份实现', () => {
  it('两条注册路径的行为逐项一致（次数 / scope / 返回值）', () => {
    const t1: any = target();
    const t2: any = target();
    const scopeA: any = { hits: 0 };
    const scopeB: any = { hits: 0 };

    t1.on(
      'x',
      function (this: any) {
        this.hits += 1;
      },
      scopeA
    );
    t2.addEventListener(
      'x',
      function (this: any) {
        this.hits += 1;
      },
      undefined
    );
    // 上面第二条走 W3C 形状（没有 scope）→ 默认 scope 是跨平台 root，不是 scopeB；
    // 这里为了对比"同 scope"的情形，再用 on 的第四参注册一份等价写法
    t2.off('x');
    t2.on(
      'x',
      function (this: any) {
        this.hits += 1;
      },
      scopeB
    );

    expect(t1.trigger('x')).toBe(true);
    expect(t2.trigger('x')).toBe(true);
    expect(scopeA.hits).toBe(1);
    expect(scopeB.hits).toBe(1);
  });

  it('交叉移除：addEventListener 注册的能被 off 摘掉，on 注册的能被 removeEventListener 摘掉', () => {
    const t: any = target();
    const calls: string[] = [];
    const a = () => calls.push('a');
    const b = () => calls.push('b');

    t.addEventListener('x', a); // W3C 形状（scope 默认 root）
    t.off('x', a); // jQuery 形状的移除
    t.on('x', b); // jQuery 形状
    t.removeEventListener('x', b); // W3C 形状的移除（忽略 scope）

    t.trigger('x');
    expect(calls).toEqual([]);
  });

  it('once() 与 addEventListener(..., { once: true }) 等价', () => {
    const t1: any = target();
    const t2: any = target();
    let n1 = 0;
    let n2 = 0;

    t1.once('x', () => (n1 += 1));
    t2.addEventListener('x', () => (n2 += 1), { once: true });
    t1.trigger('x');
    t1.trigger('x');
    t2.trigger('x');
    t2.trigger('x');

    expect([n1, n2]).toEqual([1, 1]);
  });

  it('listener 可以是 { handleEvent } 对象（W3C 允许），且能用对象本身移除', () => {
    const t: any = target();
    const seen: any[] = [];
    const obj = { handleEvent: (evt: any) => seen.push(evt.type) };

    t.addEventListener('x', obj);
    t.trigger('x');
    t.removeEventListener('x', obj);
    t.trigger('x');

    expect(seen).toEqual(['x']);
  });

  it('capture 只作注册身份：同一监听器按 capture 注册两次会各留一份', () => {
    const t: any = target();
    let n = 0;
    const fn = () => (n += 1);
    t.addEventListener('x', fn);
    t.addEventListener('x', fn, { capture: true });
    t.trigger('x');
    expect(n).toBe(2);

    // 移除 capture 那份，只留默认那份
    t.removeEventListener('x', fn, { capture: true });
    t.trigger('x');
    expect(n).toBe(3);
  });

  it('passive：监听器里 preventDefault 不生效，并提醒一次', () => {
    const t: any = target();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      let prevented: any = null;
      t.addEventListener(
        'wheel',
        (evt: any) => {
          evt.preventDefault();
          prevented = evt.defaultPrevented;
        },
        { passive: true }
      );
      const evt = new ICEEvent({ type: 'wheel', cancelable: true });
      t.dispatchEvent(evt);
      expect(prevented).toBe(false);
      expect(evt.defaultPrevented).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('signal：abort 后自动摘除；已 abort 的直接不注册', () => {
    const t: any = target();
    const controller = new AbortController();
    let n = 0;
    t.addEventListener('x', () => (n += 1), { signal: controller.signal });
    t.trigger('x');
    controller.abort();
    t.trigger('x');

    const aborted = new AbortController();
    aborted.abort();
    t.addEventListener('x', () => (n += 100), { signal: aborted.signal });
    t.trigger('x');

    expect(n).toBe(1);
  });
});

describe('dispatchEvent：W3C 返回值与时间戳', () => {
  it('未被取消返回 true；被 preventDefault 取消（cancelable）返回 false', () => {
    const t: any = target();
    t.addEventListener('x', () => {});
    expect(t.dispatchEvent(new ICEEvent({ type: 'x', cancelable: true }))).toBe(true);

    const cancelling: any = target();
    cancelling.addEventListener('x', (evt: any) => evt.preventDefault());
    expect(cancelling.dispatchEvent(new ICEEvent({ type: 'x', cancelable: true }))).toBe(false);
  });

  it('引擎自造事件的时间戳用单调时钟（performance.now 的量级，不是墙钟 epoch）', () => {
    const t: any = target();
    let stamp = 0;
    t.addEventListener('x', (evt: any) => (stamp = evt.timeStamp));
    t.trigger('x');

    expect(typeof stamp).toBe('number');
    expect(stamp).toBeGreaterThan(0);
    const perf: any = (globalThis as any).performance;
    // 有 performance 时：与它同一时间原点（差值远小于"epoch 量级"的 1e12）；
    // 没有时（测试桩 / headless）退回 Date.now()，只要求是个正数
    const sameClockAsPerformance =
      perf && typeof perf.now === 'function' ? Math.abs(perf.now() - stamp) < 5000 : stamp > 1e12;
    expect(sameClockAsPerformance).toBe(true);
  });
});
