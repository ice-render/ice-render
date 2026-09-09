/**
 * EventBus 事件总线回归测试。
 *
 * EventBus extends ICEEventTarget，模拟 W3C EventTarget + jQuery 风格接口。
 * 引擎几乎所有内部机制（渲染调度、组件事件、DOM 事件转发）都依赖它，
 * 因此语义正确性（去重、once、suspend、scope 绑定）至关重要。
 */
// node 环境无 window，替换跨平台 root 避免加载 DOM 依赖
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import EventBus from '../../src/event/EventBus';

describe('EventBus 事件总线', () => {
  it('on + trigger：按注册 scope 调用回调，并传入 ICEEvent（含 type/param）', () => {
    const bus = new EventBus();
    const scope: any = { n: 0 };
    const events: any[] = [];
    bus.on(
      'foo',
      function (evt: any) {
        this.n += 1;
        events.push(evt);
      },
      scope
    );

    const ret = bus.trigger('foo', null, { x: 1 });

    expect(ret).toBe(true);
    expect(scope.n).toBe(1);
    expect(events[0].type).toBe('foo');
    expect(events[0].param.x).toBe(1);
  });

  it('同一 (fn, scope) 重复 on 会被去重', () => {
    const bus = new EventBus();
    let n = 0;
    const fn = () => n++;
    const scope = {};
    bus.on('a', fn, scope);
    bus.on('a', fn, scope);
    bus.trigger('a');
    expect(n).toBe(1);
  });

  it('off 移除监听，hasListener 反映状态', () => {
    const bus = new EventBus();
    const scope = {};
    const fn = () => {};
    bus.on('a', fn, scope);
    expect(bus.hasListener('a', fn, scope)).toBe(true);
    bus.off('a', fn, scope);
    expect(bus.hasListener('a', fn, scope)).toBe(false);
    expect(bus.trigger('a')).toBe(false);
  });

  it('once 只触发一次后自动移除', () => {
    const bus = new EventBus();
    let n = 0;
    bus.once('a', () => n++);
    bus.trigger('a');
    bus.trigger('a');
    expect(n).toBe(1);
  });

  it('suspend 挂起后 trigger 返回 false 且不执行，resume 恢复', () => {
    const bus = new EventBus();
    let n = 0;
    bus.on('a', () => n++);
    bus.suspend('a');
    expect(bus.trigger('a')).toBe(false);
    expect(n).toBe(0);
    bus.resume('a');
    expect(bus.trigger('a')).toBe(true);
    expect(n).toBe(1);
  });

  it('purgeEvents 清空所有监听', () => {
    const bus = new EventBus();
    let n = 0;
    bus.on('a', () => n++);
    bus.on('b', () => n++);
    bus.purgeEvents();
    bus.trigger('a');
    bus.trigger('b');
    expect(n).toBe(0);
  });

  it('trigger 无监听时返回 false', () => {
    const bus = new EventBus();
    expect(bus.trigger('nobody')).toBe(false);
  });

  it('W3C 别名 addEventListener / dispatchEvent / removeEventListener 等价', () => {
    const bus: any = new EventBus();
    let n = 0;
    const fn = () => n++;
    const scope = {};
    bus.addEventListener('click', fn, scope);
    bus.dispatchEvent('click');
    expect(n).toBe(1);
    bus.removeEventListener('click', fn, scope);
    bus.dispatchEvent('click');
    expect(n).toBe(1);
  });
});
