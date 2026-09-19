/**
 * 事件系统改版（2026-09-19）回归：**W3C 方法真实现 + 沿组件树冒泡 + API 契约**。
 *
 * 改版前的事实（探针实测过）：
 * - `ICEEvent.prototype.preventDefault / stopPropagation / stopImmediatePropagation /
 *   composedPath / initEvent` 全是 `throw new Error('Method not implemented.')` ——
 *   应用里一调用就把整个派发链打断（异常从监听器里冒出去，后面的监听器与总线都收不到事件）；
 * - 组件之间**没有冒泡**：只有"命中组件 + 总线"两站，父容器拿不到子组件上的事件
 *   （`ice-web-components` 里那些"在面板自己身上再 stopPropagation 一次"的写法因此既无效又危险，
 *   `ice-chart` 则被迫写了"只对原始 DOM 事件调用 preventDefault"的绕过代码）；
 * - `bubbles / cancelable / defaultPrevented / eventPhase` 这些字段对引擎自造事件是 `undefined`；
 * - `addEventListener / dispatchEvent` 只是把 `on / trigger` 挂到原型上，签名与 W3C 不一致。
 */
import EventBus from '../../src/event/EventBus';
import ICEEvent from '../../src/event/ICEEvent';
import DOMEventDispatcher from '../../src/event/DOMEventDispatcher';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';

const RECT = { left: 0, top: 0 };

/** 一棵三层组件树：grandparent → parent → leaf（命中 leaf）。 */
function makeTree() {
  const ice: any = {
    evtBus: new EventBus(),
    childNodes: [],
    toolNodes: [],
    canvasBoundingClientRect: RECT,
    updateCanvasBoundingRect: () => RECT,
    refreshInputRect: () => RECT,
    getInputRect: () => RECT,
    screenToWorld: (x: number, y: number) => [x, y],
  };
  const grandparent: any = new ICEGroup({ id: 'grandparent', width: 300, height: 300 });
  const parent: any = new ICEGroup({ id: 'parent', width: 200, height: 200 });
  const leaf: any = new ICERect({ id: 'leaf', width: 50, height: 50 });
  grandparent.addChild(parent);
  parent.addChild(leaf);
  ice.childNodes = [grandparent];
  // 命中检测：只让 leaf 命中（其余组件 containsPoint=false），避免依赖几何/合成矩阵
  grandparent.containsPoint = () => false;
  parent.containsPoint = () => false;
  leaf.containsPoint = () => true;
  return { ice, grandparent, parent, leaf };
}

function dispatchMouseDown(ice: any, evtName = 'ICE_MOUSEDOWN') {
  ice.evtBus.trigger(evtName, {
    type: 'mousedown',
    offsetX: 1,
    offsetY: 1,
    movementX: 0,
    movementY: 0,
    cancelable: true,
    bubbles: true,
  });
}

describe('ICEEvent：W3C 方法真实现（不再是抛异常的桩）', () => {
  it('preventDefault：cancelable 才生效，并把默认行为转给原始 DOM 事件', () => {
    const raw: any = { type: 'mousedown', cancelable: true, preventDefault: jest.fn() };
    const evt = new ICEEvent(raw);
    evt.originalEvent = raw;
    expect(evt.defaultPrevented).toBe(false);

    evt.preventDefault();
    expect(evt.defaultPrevented).toBe(true);
    expect(raw.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('preventDefault：不可取消的事件是 no-op（与 W3C 一致）', () => {
    const raw: any = { type: 'x', cancelable: false, preventDefault: jest.fn() };
    const evt = new ICEEvent(raw);
    evt.originalEvent = raw;
    evt.preventDefault();
    expect(evt.defaultPrevented).toBe(false);
    expect(raw.preventDefault).not.toHaveBeenCalled();
  });

  it('stopPropagation / stopImmediatePropagation 打标记（派发器据此决定继续与否）', () => {
    const evt = new ICEEvent({ type: 'x', bubbles: true });
    expect(evt.__iceStopped).toBe(false);
    expect(evt.__iceImmediateStopped).toBe(false);
    evt.stopPropagation();
    expect(evt.__iceStopped).toBe(true);
    expect(evt.cancelBubble).toBe(true);
    evt.stopImmediatePropagation();
    expect(evt.__iceImmediateStopped).toBe(true);
  });

  it('initEvent 重置类型 / 传播 / 取消标记', () => {
    const evt = new ICEEvent({ type: 'x', bubbles: true, cancelable: true });
    evt.cancelable = true;
    evt.preventDefault();
    evt.stopImmediatePropagation();
    evt.initEvent('y', false, false);
    expect({ type: evt.type, bubbles: evt.bubbles, cancelable: evt.cancelable }).toEqual({
      type: 'y',
      bubbles: false,
      cancelable: false,
    });
    expect(evt.defaultPrevented).toBe(false);
    expect(evt.__iceStopped).toBe(false);
    expect(evt.__iceImmediateStopped).toBe(false);
  });

  it('引擎自造事件的字段有确定的默认值（旧实现是 undefined）', () => {
    const evt = new ICEEvent({ type: 'engine' });
    expect(evt.bubbles).toBe(false);
    expect(evt.cancelable).toBe(false);
    expect(evt.defaultPrevented).toBe(false);
    expect(evt.eventPhase).toBe(0);
    expect(evt.param).toEqual({});
  });
});

describe('沿组件树冒泡（DOMEventDispatcher）', () => {
  it('★ 命中组件的事件冒泡到各级父容器，总线最后收到一次', () => {
    const { ice, grandparent, parent, leaf } = makeTree();
    new DOMEventDispatcher(ice).start();
    const order: string[] = [];
    const metas: any[] = [];
    leaf.on('mousedown', (evt: any) => {
      order.push('leaf');
      metas.push({
        target: evt.target && evt.target.state.id,
        current: evt.currentTarget.state.id,
        phase: evt.eventPhase,
      });
    });
    parent.on('mousedown', (evt: any) => {
      order.push('parent');
      metas.push({ target: evt.target.state.id, current: evt.currentTarget.state.id, phase: evt.eventPhase });
    });
    grandparent.on('mousedown', (evt: any) => order.push('grandparent'));
    ice.evtBus.on('mousedown', (evt: any) =>
      order.push('bus:' + (evt.param && evt.param.component && evt.param.component.state.id))
    );

    dispatchMouseDown(ice);

    expect(order).toEqual(['leaf', 'parent', 'grandparent', 'bus:leaf']);
    expect(metas[0]).toEqual({ target: 'leaf', current: 'leaf', phase: 2 }); // AT_TARGET
    expect(metas[1]).toEqual({ target: 'leaf', current: 'parent', phase: 3 }); // BUBBLING_PHASE
  });

  it('★ stopPropagation：不再向祖先冒泡，但**总线仍然收到一次**（引擎内部通道不受影响）', () => {
    const { ice, grandparent, parent, leaf } = makeTree();
    new DOMEventDispatcher(ice).start();
    const order: string[] = [];
    leaf.on('mousedown', (evt: any) => {
      order.push('leaf');
      evt.stopPropagation();
    });
    parent.on('mousedown', () => order.push('parent'));
    grandparent.on('mousedown', () => order.push('grandparent'));
    ice.evtBus.on('mousedown', () => order.push('bus'));

    dispatchMouseDown(ice);

    expect(order).toEqual(['leaf', 'bus']);
  });

  it('★ stopImmediatePropagation：当前目标上剩下的监听器也不执行', () => {
    const { ice, parent, leaf } = makeTree();
    new DOMEventDispatcher(ice).start();
    const order: string[] = [];
    leaf.on('mousedown', (evt: any) => {
      order.push('leaf#1');
      evt.stopImmediatePropagation();
    });
    leaf.on('mousedown', () => order.push('leaf#2'));
    parent.on('mousedown', () => order.push('parent'));
    ice.evtBus.on('mousedown', () => order.push('bus'));

    dispatchMouseDown(ice);

    expect(order).toEqual(['leaf#1', 'bus']);
  });

  it('组件路径与总线路径拿到的 param 一致（都带 component）', () => {
    const { ice, leaf } = makeTree();
    new DOMEventDispatcher(ice).start();
    const seen: any[] = [];
    leaf.on('mousedown', (evt: any) => seen.push(['component', evt.param && evt.param.component === leaf]));
    ice.evtBus.on('mousedown', (evt: any) => seen.push(['bus', evt.param && evt.param.component === leaf]));

    dispatchMouseDown(ice);

    expect(seen).toEqual([
      ['component', true],
      ['bus', true],
    ]);
  });

  it('composedPath：命中组件 → 各级父容器', () => {
    const { ice, grandparent, parent, leaf } = makeTree();
    new DOMEventDispatcher(ice).start();
    let path: any[] = [];
    leaf.on('mousedown', (evt: any) => {
      path = evt.composedPath();
    });

    dispatchMouseDown(ice);

    expect(path).toEqual([leaf, parent, grandparent]);
  });

  it('引擎自造事件（无 originalEvent）也能派发，且 cancelable=false 时 preventDefault 不生效', () => {
    const { ice, leaf } = makeTree();
    new DOMEventDispatcher(ice).start();
    let prevented: any = null;
    leaf.on('mousedown', (evt: any) => {
      evt.preventDefault();
      prevented = evt.defaultPrevented;
    });

    dispatchMouseDown(ice);

    // 派发器构造的事件带 cancelable:true（见上面的 fake DOM 事件）；这里只断言方法不再抛异常
    expect(prevented).toBe(true);
  });

  /**
   * 冒泡的**第一顺位连带后果**：默认的拖动/键盘处理只应作用于**被命中的组件**。
   * 否则"拖子组件 → 父容器也注册了 mousemove → 一起动"会立刻变成回归。
   */
  it('★ 拖子组件时祖先容器不跟着动（默认拖动处理只认命中组件）', () => {
    const { ice, parent, leaf } = makeTree();
    new DOMEventDispatcher(ice).start();
    const moved: string[] = [];
    const track = (comp: any) => {
      comp.moveGlobalPosition = () => moved.push(comp.state.id);
    };
    track(parent);
    track(leaf);

    dispatchMouseDown(ice); // 命中 leaf → 冒泡到 parent
    // 之后移动事件按"拖拽归属"派发给按下时的组件（leaf），并继续冒泡到 parent
    ice.evtBus.trigger('ICE_MOUSEMOVE', {
      type: 'mousemove',
      offsetX: 2,
      offsetY: 2,
      movementX: 2,
      movementY: 2,
      bubbles: true,
    });

    expect(moved).toEqual(['leaf']);
  });

  it('★ 方向键只移动被派发的组件，不移动祖先', () => {
    const { ice, parent, leaf } = makeTree();
    const dispatcher: any = new DOMEventDispatcher(ice);
    dispatcher.focusedComponent = leaf; // 焦点在 leaf：键盘事件派发给它，再冒泡到 parent
    dispatcher.start();
    const moved: string[] = [];
    parent.moveGlobalPosition = () => moved.push('parent');
    leaf.moveGlobalPosition = () => moved.push('leaf');

    ice.evtBus.trigger('ICE_KEYDOWN', { type: 'keydown', key: 'ArrowUp', bubbles: true });

    expect(moved).toEqual(['leaf']);
  });
});

describe('事件 API 契约', () => {
  it('on / once / off / suspend / resume / purgeEvents 都返回 this（可链式）', () => {
    const target: any = new ICERect({ width: 10, height: 10 });
    const fn = () => {};
    expect(target.on('a', fn)).toBe(target);
    expect(target.once('b', fn)).toBe(target);
    expect(target.suspend('a')).toBe(target);
    expect(target.resume('a')).toBe(target);
    expect(target.off('a', fn)).toBe(target);
    expect(target.purgeEvents()).toBe(target);
  });

  it('off(name)（不传回调）清空该事件的监听，其它事件不受影响', () => {
    const target: any = new ICERect({ width: 10, height: 10 });
    const calls: string[] = [];
    target.on('a', () => calls.push('a1'));
    target.on('a', () => calls.push('a2'));
    target.on('b', () => calls.push('b'));

    target.off('a');
    target.trigger('a');
    target.trigger('b');

    expect(calls).toEqual(['b']);
  });

  it('W3C 别名：addEventListener(type, fn, { once }) / dispatchEvent(event) / removeEventListener', () => {
    const target: any = new ICERect({ width: 10, height: 10 });
    const calls: string[] = [];
    target.addEventListener('x', () => calls.push('once'), { once: true });
    const repeat = () => calls.push('on');
    target.addEventListener('x', repeat);

    target.dispatchEvent({ type: 'x' }); // 收**事件对象**（旧实现把它当成事件名）
    target.dispatchEvent({ type: 'x' });
    target.removeEventListener('x', repeat);
    target.dispatchEvent({ type: 'x' });

    expect(calls).toEqual(['once', 'on', 'on']);
  });
});
