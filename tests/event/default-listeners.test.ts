/**
 * **引擎默认处理器：类级声明 + 派发时解析**（2026-09-21 内存优化）。
 *
 * 改造前每个组件在构造期 `on('mousedown'|'keydown'|'keyup', …)`，于是每个图元常驻
 * `1 个 listeners 对象 + 3 个数组 + 3 条记录`；10 万图元的真实场景里这是纯记账开销
 * （真机 Chrome + V8 堆快照：`Array` 19.8MB / `Object` 32.1MB 里的大头）。
 *
 * 这个文件守住三件事：
 * ① 构造期确实不再常驻这些监听（否则优化等于没做）；
 * ② 默认行为逐条不变 —— 能拖动、能收键盘、能 `suspend`、能 `purgeEvents`；
 * ③ **能摘**：`off` / `off(name)` / `removeEventListener` / `hasListener` 把默认处理器
 *   当成"真的在 listeners 里"来匹配（`LineControlPanel`、第三方组件依赖这条）。
 */
import ICERect from '../../src/graphic/shape/ICERect';
import { __resetListenedEventNames, isEventNameListened } from '../../src/event/listened-event-names';

/** 探针：记录默认处理器有没有被调用。**不调 super**，避免真的进入拖拽/移动逻辑。 */
class Probe extends ICERect {
  public log: string[] = [];
  protected mouseDownEvtHandler(_evt?: any) {
    this.log.push('mousedown');
  }
  protected keyboardEvtHandler(_evt: any) {
    this.log.push('keydown');
  }
}

/** 覆盖 initEvents 且**不调 super**：默认处理器不该被启用（改造前后同义）。 */
class OptedOut extends ICERect {
  public log: string[] = [];
  protected initEvents(): void {
    // 故意留空
  }
  protected mouseDownEvtHandler(_evt?: any) {
    this.log.push('mousedown');
  }
}

const makeRect = (props: any = {}) => new ICERect({ left: 0, top: 0, width: 10, height: 10, ...props }) as any;

beforeEach(() => __resetListenedEventNames());

describe('默认处理器：类级声明', () => {
  it('构造期不再为每个图元常驻 mousedown/keydown/keyup 监听', () => {
    const rect = makeRect();
    expect(Object.keys(rect.listeners)).toEqual([]); // 空对象（开关是 Symbol 键，不可枚举）
    expect(rect.listeners.mousedown).toBeUndefined();
    expect(rect.listeners.keydown).toBeUndefined();
    expect(rect.listeners.keyup).toBeUndefined();
  });

  it('事件名照样登记（按需派发的前置条件：没人听的名字不派发）', () => {
    makeRect();
    ['mousedown', 'keydown', 'keyup'].forEach((name) => expect(isEventNameListened(name)).toBe(true));
    expect(isEventNameListened('mousemove')).toBe(false); // 拖拽真正开始时才登记
  });

  it('默认处理器仍然会被调用（按下与键盘）', () => {
    const rect: any = new Probe({ left: 0, top: 0, width: 10, height: 10 });
    rect.trigger('mousedown', null, {});
    rect.trigger('keydown', { key: 'a' });
    expect(rect.log).toEqual(['mousedown', 'keydown']);
  });

  it('次序与改造前一致：默认处理器先于用户注册的监听', () => {
    const rect: any = new Probe({ left: 0, top: 0, width: 10, height: 10 });
    rect.on('mousedown', () => rect.log.push('user'), rect);
    rect.trigger('mousedown', null, {});
    expect(rect.log).toEqual(['mousedown', 'user']);
  });

  it('用户重新注册同一个处理器：去重后仍然只触发一次', () => {
    const rect: any = new Probe({ left: 0, top: 0, width: 10, height: 10 });
    rect.on('mousedown', rect.mouseDownEvtHandler, rect); // TransformControlPanel 的写法
    rect.trigger('mousedown', null, {});
    expect(rect.log).toEqual(['mousedown']);
  });

  it('子类覆盖 initEvents 且不调 super → 默认处理器不启用', () => {
    const rect: any = new OptedOut({ left: 0, top: 0, width: 10, height: 10 });
    rect.trigger('mousedown', null, {});
    expect(rect.log).toEqual([]);
    expect(isEventNameListened('mousedown')).toBe(false); // 也没登记：真没人听
  });
});

describe('默认处理器：摘除与查询的身份匹配', () => {
  it('off(name, 处理器, 组件) 之后不再触发；hasListener 如实反映', () => {
    const rect: any = new Probe({ left: 0, top: 0, width: 10, height: 10 });
    expect(rect.hasListener('mousedown', rect.mouseDownEvtHandler, rect)).toBe(true);

    rect.off('mousedown', rect.mouseDownEvtHandler, rect);
    expect(rect.hasListener('mousedown', rect.mouseDownEvtHandler, rect)).toBe(false);
    rect.trigger('mousedown', null, {});
    expect(rect.log).toEqual([]);
  });

  it('off(name)（不传回调）= 清空该事件上的全部监听，默认处理器一并摘掉', () => {
    const rect: any = new Probe({ left: 0, top: 0, width: 10, height: 10 });
    let user = 0;
    rect.on('mousedown', () => user++, rect);

    rect.off('mousedown');
    rect.trigger('mousedown', null, {});
    expect(rect.log).toEqual([]);
    expect(user).toBe(0);
  });

  it('removeEventListener 按 W3C 身份（忽略 scope）也能摘掉默认处理器', () => {
    const rect: any = new Probe({ left: 0, top: 0, width: 10, height: 10 });
    rect.removeEventListener('keydown', rect.keyboardEvtHandler);
    rect.trigger('keydown', { key: 'a' });
    expect(rect.log).toEqual([]);
  });

  it('off 不匹配别的处理器：用户监听被摘掉，默认处理器照旧', () => {
    const rect: any = new Probe({ left: 0, top: 0, width: 10, height: 10 });
    const user = () => rect.log.push('user');
    rect.on('mousedown', user, rect);
    rect.off('mousedown', user, rect);

    rect.trigger('mousedown', null, {});
    expect(rect.log).toEqual(['mousedown']);
  });

  it('purgeEvents() 之后默认处理器同样不再响应', () => {
    const rect: any = new Probe({ left: 0, top: 0, width: 10, height: 10 });
    expect(rect.hasListener('keydown', rect.keyboardEvtHandler, rect)).toBe(true);

    rect.purgeEvents();
    expect(rect.hasListener('keydown', rect.keyboardEvtHandler, rect)).toBe(false);
    rect.trigger('keydown', { key: 'a' });
    expect(rect.log).toEqual([]);
  });
});

describe('默认处理器：挂起与冒泡', () => {
  it('suspend(name) 仍然挡住默认处理器，resume 后恢复', () => {
    const rect: any = new Probe({ left: 0, top: 0, width: 10, height: 10 });
    rect.suspend('keydown');
    rect.trigger('keydown', { key: 'a' });
    expect(rect.log).toEqual([]);

    rect.resume('keydown');
    rect.trigger('keydown', { key: 'a' });
    expect(rect.log).toEqual(['keydown']);
  });

  it('默认处理器拿到的 ICEEvent 与用户监听看到的是同一个（currentTarget / 代码触发的 target=null）', () => {
    const seen: any[] = [];
    class TargetProbe extends ICERect {
      protected mouseDownEvtHandler(evt: any) {
        // 在处理器里取样：派发结束后 `trigger` 会把 currentTarget 还原
        seen.push({ evt, target: evt.target, currentTarget: evt.currentTarget });
      }
    }
    const rect: any = new TargetProbe({ left: 0, top: 0, width: 10, height: 10 });
    let fromUser: any = null;
    rect.on('mousedown', (evt: any) => (fromUser = evt), rect);
    rect.trigger('mousedown', null, {});

    expect(seen.length).toBe(1);
    expect(seen[0].currentTarget).toBe(rect);
    // 代码触发（没有命中结果）时 `evt.target` 为 null —— 引擎既有口径，与改造前一致
    expect(seen[0].target).toBeNull();
    expect(fromUser).toBe(seen[0].evt); // 同一条事件对象一路传到底
  });
});
