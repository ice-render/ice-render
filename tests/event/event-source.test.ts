/**
 * **`evt.source` 与 `evt.target` 的契约**（2026-09-19）。
 *
 * 背景（都是实测出来的"使用者一定会撞"的坑）：
 *
 * ① 原始输入监听挂在 `window` 上（拖拽移出画布也要跟手），所以**画布外的输入**（工具栏按钮 /
 *    页面空白）也会被转发到总线。以前那种事件上 `evt.target` 是**原始 DOM 元素**
 *    （构造函数按 `for...in` 从 DOM 事件平铺字段拷进来的），应用只能靠 `instanceof ICEComponent`
 *    去猜"这到底是不是组件"；
 * ② 同一个 `eventPhase` 字段有两种含义：命中组件的路径在组件链末尾归零（总线看到 `0`），
 *    而"没有命中组件"的事件根本走不到组件链，相位沿用了 DOM 的 `BUBBLING_PHASE(3)`。
 *
 * 现在的契约：
 * - `evt.source`：`'canvas'`（画布内输入，可能有命中组件）| `'window'`（画布外输入，无命中）|
 *   `'engine'`（代码创建 / 引擎内部派发）；
 * - `evt.target`：**要么是命中的组件、要么是 `null`** —— 永远不是 DOM 元素；
 *   原始 DOM 元素在 `evt.originalEvent.target`；
 * - 总线那一段的 `eventPhase` 恒为 `0`（总线是传播终点，不在任何传播段里）。
 *
 * ⚠️ 消毒点在**包装入口**（`ICEEventTarget.trigger` 的 `originalEvent` 分支），不在构造函数里：
 * `new ICEEvent({ target: this })` 是引擎自己的合法用法（`ICELinkHook` 把"拖动的是哪个端点手柄"
 * 广播给 `ICELinkSlotManager`）—— 一刀切禁掉 target 会让连线端点拖拽当场 `null.getMaxBoundingBox`
 * （2026-09-19 家族回归实测到的回归）。下面最后两条用例把这两个方向都钉住。
 */
import EventBus from '../../src/event/EventBus';
import ICEEvent from '../../src/event/ICEEvent';
import DOMEventDispatcher from '../../src/event/DOMEventDispatcher';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';

jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  class PointerEvent {}
  return {
    __esModule: true,
    default: {
      createPath2D: () => new Path2DRecorder(),
      PointerEvent,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  };
});

global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
};

const RECT = { left: 0, top: 0 };

function makeRig() {
  const canvasEl: any = {
    tagName: 'CANVAS',
    width: 800,
    height: 600,
    style: {},
    contains: (node: any) => node === canvasEl,
  };
  const ice: any = {
    canvasEl,
    evtBus: new EventBus(),
    childNodes: [],
    toolNodes: [],
    canvasBoundingClientRect: RECT,
    updateCanvasBoundingRect: () => RECT,
    refreshInputRect: () => RECT,
    getInputRect: () => RECT,
    screenToWorld: (x: number, y: number) => [x, y],
  };
  const group: any = new ICEGroup({ id: 'group', width: 200, height: 200 });
  const leaf: any = new ICERect({ id: 'leaf', width: 50, height: 50 });
  group.addChild(leaf);
  ice.childNodes = [group];
  group.containsPoint = () => false;
  leaf.containsPoint = () => true;
  const dispatcher: any = new DOMEventDispatcher(ice);
  dispatcher.start();
  return { ice, dispatcher, canvasEl, group, leaf };
}

/** 模拟一次原生 press：`rawTarget` 决定"画布内 / 画布外"。 */
function press(rig: any, rawTarget: any) {
  rig.ice.evtBus.trigger('ICE_POINTERDOWN', {
    type: 'pointerdown',
    target: rawTarget,
    offsetX: 1,
    offsetY: 1,
    clientX: 1,
    clientY: 1,
    pointerId: 1,
    cancelable: true,
    bubbles: true,
  });
}

describe('evt.source / evt.target 契约', () => {
  it('画布内命中组件：source=canvas、target=组件、总线相位归零', () => {
    const rig = makeRig();
    const hits: any[] = [];
    // 事件对象是一路复用的**同一个对象**（2.18 起如此），所以各段必须**当场取值**：
    // 事后读到的会是最后一段（总线把相位归零）之后的状态。
    const snap = (where: string) => (evt: any) => ({
      where,
      source: evt.source,
      target: evt.target,
      phase: evt.eventPhase,
      currentTarget: evt.currentTarget,
    });
    rig.leaf.on('pointerdown', (evt: any) => hits.push(snap('leaf')(evt)));
    rig.group.on('pointerdown', (evt: any) => hits.push(snap('group')(evt)));
    rig.ice.evtBus.on('pointerdown', (evt: any) => hits.push(snap('bus')(evt)));

    press(rig, rig.canvasEl);

    expect(hits.map((h) => h.where)).toEqual(['leaf', 'group', 'bus']);
    hits.forEach((h) => {
      expect(h.source).toBe('canvas');
      expect(h.target).toBe(rig.leaf); // 恒为命中组件（祖先段也是它）
    });
    // 组件链：命中段 2 / 祖先段 3；总线段 0（传播终点）
    expect(hits[0].phase).toBe(2);
    expect(hits[1].phase).toBe(3);
    expect(hits[2].phase).toBe(0);
    expect(hits[2].currentTarget).toBe(rig.ice.evtBus);
  });

  it('画布内点空白（没命中组件）：source=canvas、target=null、总线仍然收到一次', () => {
    const rig = makeRig();
    rig.leaf.containsPoint = () => false;
    const busEvents: any[] = [];
    rig.ice.evtBus.on('pointerdown', (evt: any) => busEvents.push(evt));

    press(rig, rig.canvasEl);

    expect(busEvents.length).toBe(1);
    expect(busEvents[0].source).toBe('canvas');
    expect(busEvents[0].target).toBeNull();
    expect(busEvents[0].eventPhase).toBe(0);
  });

  it('画布外点按钮（工具栏）且坐标没命中：source=window、target=null、DOM 元素在 originalEvent 上', () => {
    const rig = makeRig();
    const button: any = { tagName: 'BUTTON', id: 'btn-save' };
    rig.leaf.containsPoint = () => false;
    const busEvents: any[] = [];
    rig.ice.evtBus.on('pointerdown', (evt: any) => busEvents.push(evt));

    press(rig, button);

    expect(busEvents.length).toBe(1);
    expect(busEvents[0].source).toBe('window');
    expect(busEvents[0].target).toBeNull(); // 不是 HTMLButtonElement
    expect(busEvents[0].originalEvent.target).toBe(button); // 要 DOM 信息来这里取
    expect(busEvents[0].eventPhase).toBe(0); // 与"命中组件"那条路径口径一致
  });

  /**
   * **已知行为（当前不改，但要知道）**：画布外的输入**仍然会做命中测试** ——
   * 坐标是按画布矩形（`clientX - rect.left`）换算的，工具栏按钮如果正好在画布右侧，
   * 换算出来的坐标就可能落在画布内，于是"点按钮顺带选中了画布元素"。
   * 归属信息现在由 `evt.source === 'window'` 明确给出，应用据此过滤即可；
   * "画布外输入要不要干脆不做命中"是语义级决策（会动到键盘转发 / HTML 浮层的既有行为），
   * 留待单独评估 —— 这条用例把现状钉住，改的时候会红。
   */
  it('画布外输入的已知行为：仍可能命中坐标落在画布内的组件（source 依旧是 window）', () => {
    const rig = makeRig();
    const button: any = { tagName: 'BUTTON', id: 'btn-save' };
    const busEvents: any[] = [];
    rig.ice.evtBus.on('pointerdown', (evt: any) => busEvents.push(evt));

    press(rig, button);

    expect(busEvents[0].source).toBe('window'); // 归属以 source 为准
    expect(busEvents[0].target).toBe(rig.leaf); // 坐标恰好落在画布内 → 命中了组件（已知行为）
  });

  it('目标在画布**内部**的元素上（如画布里的某个子元素）：算画布内', () => {
    const rig = makeRig();
    const inner: any = { tagName: 'DIV', id: 'overlay' };
    rig.canvasEl.contains = (node: any) => node === rig.canvasEl || node === inner;
    const busEvents: any[] = [];
    rig.ice.evtBus.on('pointerdown', (evt: any) => busEvents.push(evt));

    press(rig, inner);

    expect(busEvents[0].source).toBe('canvas');
  });

  it('代码创建的事件：source=engine（`trigger` 与 `new ICEEvent` 都算）', () => {
    const rig = makeRig();
    const seen: any[] = [];
    rig.leaf.on('my-event', (evt: any) => seen.push(evt.source));
    rig.leaf.trigger('my-event');
    expect(seen).toEqual(['engine']);

    expect(new ICEEvent({ type: 'x' }).source).toBe('engine');
  });

  it('包装原始 DOM 事件时消毒身份字段（DOM 的 target / 相位不会污染）', () => {
    const domLike: any = {
      type: 'click',
      target: { tagName: 'BUTTON' },
      currentTarget: { tagName: 'BODY' },
      srcElement: { tagName: 'BUTTON' },
      eventPhase: 3,
      bubbles: true,
      cancelable: true,
    };
    const target: any = new ICEGroup({ id: 'host' });
    const seen: any[] = [];
    target.on('click', (evt: any) => seen.push(evt));
    target.trigger('click', domLike);
    const evt = seen[0];

    expect(evt.target).toBeNull();
    expect(evt.srcElement).toBeNull();
    expect(evt.currentTarget).toBeNull();
    expect(evt.eventPhase).toBe(0);
    expect(evt.source).toBe('engine');
    // 原始 DOM 元素不丢：在 originalEvent 上
    expect(evt.originalEvent.target).toEqual({ tagName: 'BUTTON' });
    // 非身份字段照旧平铺（应用能拿到 DOM 事件上的 cancelable / bubbles / type）
    expect(evt.type).toBe('click');
    expect(evt.cancelable).toBe(true);
  });

  it('显式指定 target 仍然可用（`new ICEEvent({ target })`：引擎自己就这么用）', () => {
    const rig = makeRig();
    const seen: any[] = [];
    rig.ice.evtBus.on('HOOK_MOUSEMOVE', (evt: any) => seen.push(evt.target));

    // 与 ICELinkHook 同款：把"拖动的是哪个端点手柄"广播出去
    rig.ice.evtBus.trigger('HOOK_MOUSEMOVE', new ICEEvent({ target: rig.leaf }));

    expect(seen[0]).toBe(rig.leaf);
  });

  it('应用转发事件时改写 `evt.target` 仍然生效（AGENTS 铁律 ⑦）', () => {
    const rig = makeRig();
    const seenByGroup: any[] = [];
    rig.leaf.on('keydown', (evt: any) => {
      evt.target = rig.group; // 转给谁就把 target 设成谁
      rig.group.trigger('keydown', evt, evt.param);
    });
    rig.group.on('keydown', (evt: any) => seenByGroup.push({ target: evt.target, origin: evt.__iceTarget }));

    rig.leaf.trigger('keydown', new ICEEvent({ type: 'keydown' }));

    expect(seenByGroup).toEqual([{ target: rig.group, origin: rig.leaf }]);
  });
});
