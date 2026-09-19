/**
 * **渲染顺序铁律（2026-09-17，v2.13.0）：树序 + 兄弟按 zIndex。**
 *
 * 背景（真实 bug）：默认 `zIndex` 是**构造顺序计数器**（`ICEComponent.instanceCounter++`），
 * 而渲染队列过去是「展平整棵树 → **全局**按 zIndex 排序」。于是**父容器比子组件后构造**时，
 * 父的 zIndex 反超自己的整棵子树 → **父把自己的子组件盖住**，画面一片空白且不报错。
 * `ice-web-components` 的 `ICEPanel`（有底色）踩得最明显：一个"先摆子件、后建外框"的页面画不出来。
 *
 * 新语义：
 * - 绘制 = **先父后子**（树序）；`zIndex` **只在兄弟之间**比较（相等保持加入顺序）；
 * - **工具层整体画在组件层之上**（`componentQueue` → `toolsQueue`），两层不再按 zIndex 交叉；
 * - 命中判定与绘制同源（见 `hit-test-ordered.test.ts` 的逐点预言机比对）。
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  addPath() {}
  roundRect() {}
} as any;

import EventBus from '../../src/event/EventBus';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import { flattenTree } from '../../src/util/data-util';

function makeIce(): ICE {
  const ice = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.dirty = true;
  ice.renderer = new CanvasRenderer(ice);
  (ice.renderer as any).start();
  return ice;
}

/** 队列里每个节点的 id（没有 id 时用构造顺序占位）。 */
function queueIds(ice: ICE): string[] {
  const q = (ice.renderer as any).componentQueue as any[];
  return q.map((c) => (c.props && c.props.id) || '?');
}

describe('渲染顺序：树序 + 兄弟按 zIndex', () => {
  it('回归：父容器**晚于**子组件构造时，子组件仍画在父之上（父不再盖住自己的子树）', () => {
    const ice = makeIce();
    // 故意"先子后父"，并**显式**把父的 zIndex 写得比子大 —— 这是旧实现下画不出来的那种写法
    //（默认值现在是 0/auto 层，必须显式给值才能造出"父的号比子大"）
    const child = new ICERect({ id: 'child', width: 40, height: 40, zIndex: 1 });
    const parent = new ICEGroup({ id: 'parent', width: 200, height: 200, zIndex: 99 });
    parent.addChild(child);
    ice.addChild(parent);
    // 让"父的 zIndex 比子大"这件事显式成立 —— 旧实现下就是它把子盖住的
    expect(parent.state.zIndex).toBeGreaterThan(child.state.zIndex);

    (ice.renderer as any).refreshQueue();
    const ids = queueIds(ice);
    expect(ids.indexOf('parent')).toBeLessThan(ids.indexOf('child'));
  });

  it('同父兄弟按 zIndex 升序；相等时保持加入顺序', () => {
    const ice = makeIce();
    const a = new ICERect({ id: 'a', width: 10, height: 10, zIndex: 30 });
    const b = new ICERect({ id: 'b', width: 10, height: 10, zIndex: 10 });
    const c = new ICERect({ id: 'c', width: 10, height: 10, zIndex: 10 });
    ice.addChild(a);
    ice.addChild(b);
    ice.addChild(c);

    (ice.renderer as any).refreshQueue();
    expect(queueIds(ice)).toEqual(['b', 'c', 'a']);
  });

  it('跨子树不越级：深层节点的 zIndex 再大也压不过祖先的兄弟', () => {
    const ice = makeIce();
    const first = new ICEGroup({ id: 'first', width: 100, height: 100, zIndex: 1 });
    const deep = new ICERect({ id: 'deep', width: 10, height: 10, zIndex: 9999 });
    first.addChild(deep);
    const second = new ICERect({ id: 'second', width: 100, height: 100, zIndex: 2 });
    ice.addChild(first);
    ice.addChild(second);

    (ice.renderer as any).refreshQueue();
    // first 整棵子树（含 deep）都在 second 之前 —— 子树的叠放位置由它在兄弟里的位置决定
    expect(queueIds(ice)).toEqual(['first', 'deep', 'second']);
  });

  it('工具层整体在组件层之上（组件 zIndex 再大也压不过工具层）', () => {
    const ice = makeIce();
    const comp = new ICERect({ id: 'comp', width: 10, height: 10, zIndex: 10000000 });
    const tool = new ICERect({ id: 'tool', width: 10, height: 10, zIndex: 1 });
    ice.addChild(comp);
    ice.toolNodes.push(tool);

    (ice.renderer as any).refreshQueue();
    // 两条队列分开渲染：组件队列先画、工具队列后画（不是按 zIndex 交叉）
    expect(queueIds(ice)).toEqual(['comp']);
    const tools = ((ice.renderer as any).toolsQueue as any[]).map((c) => c.props.id);
    expect(tools).toEqual(['tool']);
  });

  it('zIndex 变更后重新展平仍然只排兄弟（不会退回全局排序）', () => {
    const ice = makeIce();
    const parent = new ICEGroup({ id: 'parent', width: 100, height: 100 });
    const child = new ICERect({ id: 'child', width: 10, height: 10 });
    parent.addChild(child);
    const sibling = new ICERect({ id: 'sibling', width: 10, height: 10 });
    ice.addChild(parent);
    ice.addChild(sibling);
    (ice.renderer as any).refreshQueue();
    expect(queueIds(ice)).toEqual(['parent', 'child', 'sibling']);

    // 把深层子节点的 zIndex 抬到最大：旧实现会把它排到 sibling 之后（越级）
    child.setState({ zIndex: 99999 });
    (ice.renderer as any).refreshQueue();
    expect(queueIds(ice)).toEqual(['parent', 'child', 'sibling']);
  });

  it('flattenTree 是同一套顺序，且**不修改** childNodes 本身', () => {
    const ice = makeIce();
    const a = new ICERect({ id: 'a', width: 10, height: 10, zIndex: 5 });
    const b = new ICERect({ id: 'b', width: 10, height: 10, zIndex: 1 });
    ice.addChild(a);
    ice.addChild(b);

    const flat = flattenTree([], ice.childNodes).map((c: any) => c.props.id);
    expect(flat).toEqual(['b', 'a']);
    // 展平排的是副本：调用方按 childNodes 顺序取"第 N 个"是既有语义
    expect((ice.childNodes as any[]).map((c: any) => c.props.id)).toEqual(['a', 'b']);
  });
});
