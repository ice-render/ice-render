/**
 * 无障碍原语：可访问节点快照 + 键盘焦点路由。
 *
 * 契约：
 * - 快照给出 id / 角色建议 / 可读名称 / **屏幕坐标盒（CSS 像素，含视口换算）** / 层级 / tab 顺序 / 选中态
 * - 只含已上屏（有有效变换矩阵）的组件；不发散、不修改任何组件 state
 * - 焦点原语：setFocusedComponent 后键盘事件派发给焦点组件；未设置时维持既有行为
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import DOMEventDispatcher from '../../src/event/DOMEventDispatcher';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEText from '../../src/graphic/text/ICEText';
import ICEImage from '../../src/graphic/ICEImage';
import ICEStar from '../../src/graphic/shape/ICEStar';
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
import ICEGroup from '../../src/graphic/container/ICEGroup';

/** 造一个「已上屏」的组件：手工给 composedMatrix，等价于渲染一帧后的状态。 */
function onScreen<T>(c: T, left = 0, top = 0): T {
  c.state.composedMatrix = [1, 0, 0, 1, left, top];
  return c;
}

function makeIce(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.eventDispatcher = new DOMEventDispatcher(ice);
  ice.setViewport(1, 0, 0);
  return ice;
}

describe('可访问节点快照', () => {
  it('角色建议：容器 / 文本 / 连线 / 图片 / 普通图元', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 100, height: 100 });
    const text = new ICEText({ text: 'hello' });
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [10, 10],
      ],
    });
    const image = new ICEImage({ src: 'a.png' });
    const rect = new ICERect({ width: 10, height: 10 });
    [group, text, line, image, rect].forEach((c, i) => ice.addChild(onScreen(c as any, i * 100, 0)));

    const nodes = ice.getAccessibilityTree();
    const roleOf = (id: string) => nodes.filter((n: any) => n.id === id)[0].role;

    expect(roleOf(group.props.id)).toBe('container');
    expect(roleOf(text.props.id)).toBe('text');
    expect(roleOf(line.props.id)).toBe('link');
    expect(roleOf(image.props.id)).toBe('image');
    expect(roleOf(rect.props.id)).toBe('graphic');
  });

  it('可读名称优先级：ariaLabel > text > title > id', () => {
    const ice = makeIce();
    const a = new ICEText({ text: '正文', ariaLabel: '显式名称' });
    const b = new ICEText({ text: '正文' });
    const c = new ICERect({ width: 10, height: 10, title: '标题名' });
    const d = new ICERect({ width: 10, height: 10 });
    [a, b, c, d].forEach((x, i) => ice.addChild(onScreen(x as any, i * 50, 0)));

    const nodes = ice.getAccessibilityTree();
    const labelOf = (id: string) => nodes.filter((n: any) => n.id === id)[0].label;

    expect(labelOf(a.props.id)).toBe('显式名称');
    expect(labelOf(b.props.id)).toBe('正文');
    expect(labelOf(c.props.id)).toBe('标题名');
    expect(labelOf(d.props.id)).toBe(d.props.id);
  });

  it('坐标盒是屏幕坐标（CSS 像素），随视口缩放/平移换算', () => {
    const ice = makeIce();
    const rect = new ICERect({ width: 40, height: 20 });
    ice.addChild(onScreen(rect, 100, 50));

    let node: any = ice.getAccessibilityTree()[0];
    expect(node.box).toEqual({ x: 100, y: 50, width: 40, height: 20 });

    ice.setViewport(2, 10, 20);
    node = ice.getAccessibilityTree()[0];
    expect(node.box).toEqual({ x: 100 * 2 + 10, y: 50 * 2 + 20, width: 80, height: 40 });
  });

  it('只含已上屏的组件（无有效变换矩阵的被排除）', () => {
    const ice = makeIce();
    const rendered = onScreen(new ICERect({ width: 10, height: 10 }), 0, 0);
    const neverRendered = new ICERect({ width: 10, height: 10 });
    ice.addChild(rendered);
    ice.addChild(neverRendered);

    const nodes = ice.getAccessibilityTree();
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe(rendered.props.id);
  });

  it('层级 / 父 id / tab 顺序（同级按 zIndex 升序）', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 200, height: 200 });
    ice.addChild(onScreen(group, 0, 0));
    const a = onScreen(new ICERect({ width: 10, height: 10, zIndex: 2 }), 0, 0);
    const b = onScreen(new ICERect({ width: 10, height: 10, zIndex: 1 }), 20, 0);
    group.addChild(b); // 先加 zIndex 大的
    group.addChild(a);

    const nodes = ice.getAccessibilityTree();
    expect(nodes.map((n: any) => n.level)).toEqual([1, 2, 2]);
    expect(nodes[1].id).toBe(b.props.id); // 同级按 zIndex 升序
    expect(nodes[2].id).toBe(a.props.id);
    expect(nodes[1].parentId).toBe(group.props.id);
    expect(nodes[0].parentId).toBeNull();
    expect(nodes.map((n: any) => n.tabIndex)).toEqual([0, 1, 2]);
  });

  it('includeHidden / includeTools / filter 生效', () => {
    const ice = makeIce();
    const hidden = onScreen(new ICERect({ width: 10, height: 10, display: false }), 0, 0);
    const shown = onScreen(new ICERect({ width: 10, height: 10 }), 20, 0);
    ice.addChild(hidden);
    ice.addChild(shown);
    const tool = onScreen(new ICERect({ width: 5, height: 5 }), 0, 0);
    ice.addTool(tool);

    expect(ice.getAccessibilityTree().map((n: any) => n.id)).toEqual([shown.props.id]);
    expect(ice.getAccessibilityTree({ includeHidden: true }).length).toBe(2);
    expect(ice.getAccessibilityTree({ includeTools: true }).map((n: any) => n.id)).toContain(tool.props.id);
    expect(
      ice.getAccessibilityTree({ filter: (c: any) => c.props.id === hidden.props.id, includeHidden: true }).length
    ).toBe(1);
  });

  it('selected 反映当前选中集合', () => {
    const ice = makeIce();
    const a = onScreen(new ICERect({ width: 10, height: 10 }), 0, 0);
    const b = onScreen(new ICERect({ width: 10, height: 10 }), 20, 0);
    ice.addChild(a);
    ice.addChild(b);
    ice.setSelection([b]);

    const nodes = ice.getAccessibilityTree();
    expect(nodes.filter((n: any) => n.id === a.props.id)[0].selected).toBe(false);
    expect(nodes.filter((n: any) => n.id === b.props.id)[0].selected).toBe(true);
  });

  it('不修改任何组件 state：点集路径的 dots 不会漂移', () => {
    const ice = makeIce();
    const star: any = new ICEStar({ left: 0, top: 0, outerRadius: 30, innerRadius: 12, spikes: 5 });
    ice.addChild(onScreen(star, 0, 0));
    star.calcDots();
    const before = JSON.stringify(star.state.dots);
    expect(star.state.dots.length).toBeGreaterThan(0);

    // 取多次快照（旧实现若用 getMaxBoundingBox(true) 会就地平移 dots 造成累积漂移）
    ice.getAccessibilityTree();
    ice.getAccessibilityTree();
    ice.getAccessibilityTree();

    expect(JSON.stringify(star.state.dots)).toBe(before);
  });
});

describe('键盘焦点路由', () => {
  function setup() {
    const ice = makeIce();
    const a = onScreen(new ICERect({ width: 10, height: 10 }), 0, 0);
    const b = onScreen(new ICERect({ width: 10, height: 10 }), 20, 0);
    ice.addChild(a);
    ice.addChild(b);
    ice.canvasBoundingClientRect = { left: 0, top: 0 };
    ice.updateCanvasBoundingRect = () => ice.canvasBoundingClientRect;
    ice.getInputRect = () => ice.canvasBoundingClientRect;
    ice.screenToWorld = (x: number, y: number) => [x, y];
    // 必须把「启动的」dispatcher 挂回 ice：setFocusedComponent 写的是 ice.eventDispatcher
    ice.eventDispatcher = new DOMEventDispatcher(ice);
    ice.eventDispatcher.start();
    return { ice, a, b };
  }

  it('未设置焦点时，键盘事件派发给上次点击命中的组件（既有行为不变）', () => {
    const { ice, a, b } = setup();
    a.trigger = jest.fn();
    b.trigger = jest.fn();

    ice.evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 5, clientY: 5 });
    ice.evtBus.trigger('ICE_KEYDOWN', { type: 'keydown', key: 'ArrowRight' });

    expect(a.trigger).toHaveBeenCalled();
    expect(b.trigger).not.toHaveBeenCalled();
  });

  it('setFocusedComponent 后键盘事件派发给焦点组件（而非上次点击的）', () => {
    const { ice, a, b } = setup();
    a.trigger = jest.fn();
    b.trigger = jest.fn();

    ice.evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 5, clientY: 5 }); // 点中了 a
    ice.setFocusedComponent(b.props.id); // 焦点设到 b
    ice.evtBus.trigger('ICE_KEYDOWN', { type: 'keydown', key: 'ArrowRight' });

    expect(ice.getFocusedComponent()).toBe(b);
    expect(b.trigger).toHaveBeenCalled();
    const aKeyCalls = (a.trigger as jest.Mock).mock.calls.filter((c) => c[0] === 'keydown');
    expect(aKeyCalls.length).toBe(0);
  });

  it('setFocusedComponent(null) 清除焦点后回落既有行为', () => {
    const { ice, a, b } = setup();
    a.trigger = jest.fn();
    b.trigger = jest.fn();

    ice.setFocusedComponent(b.props.id);
    ice.setFocusedComponent(null);
    expect(ice.getFocusedComponent()).toBeNull();

    ice.evtBus.trigger('ICE_MOUSEDOWN', { type: 'mousedown', clientX: 5, clientY: 5 });
    ice.evtBus.trigger('ICE_KEYDOWN', { type: 'keydown', key: 'ArrowRight' });
    expect(a.trigger).toHaveBeenCalled();
  });

  it('不存在的 id 会清空焦点（不抛错）', () => {
    const { ice } = setup();
    expect(() => ice.setFocusedComponent('NOT_EXIST')).not.toThrow();
    expect(ice.getFocusedComponent()).toBeNull();
  });
});
