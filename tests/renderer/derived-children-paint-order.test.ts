/**
 * **容器的派生部件永远画在自己的内容之下**（CSS 背景语义）+ **重排 API 只作用于真实子节点**。
 *
 * 背景（2026-09 在 ice-entity-designer 的两个示例上真实发生）：复合组件
 * （`hasDerivedChildren() === true`）把自己的底 / 标题 / 角标也挂在 `childNodes` 里
 * —— 形状由子组件绘制是刻意的（这样菱形 / 事件圆 / 圆角框都能画），但渲染顺序铁律是
 * 「树序 + 兄弟按 zIndex」，于是**容器的底和容器里的内容是同层兄弟**，底只要排在内容之后，
 * 整段内容就被**自己的底色**盖住：
 *
 *   - BPMN：池的底（默认 `'auto'` = 0）排在泳道（-20000）之后 → 任务矩形全部消失；
 *   - 状态机：复合状态的框（`baseZ + 1`）排在子状态（`'auto'`）之后 → 复合状态变成空框。
 *
 * 新语义（两处都必须与渲染队列同源）：
 * 1. `paintOrderChildrenOf(container)`：先「容器自己的派生部件」（`childNodes` 减去
 *    `getSerializableChildren()`）、再「真实子节点」，两组内各自按 `zIndex` 升序 —— 应用不需要
 *    再给底写「比内容更低」的魔数，也不存在"多低才算够低"的猜谜；
 * 2. `siblingScopeOf(container)`：`bringToFront` / `sendToBack` / `moveUp` / `moveDown` 的作用域
 *    收窄到**真实子节点** —— 派生部件不是文档内容，被重编号会把容器内容盖掉，而且重建即复位。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
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
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import { exportSvg } from '../../src/export/SvgExporter';
import { flattenTree, paintOrderChildrenOf, siblingScopeOf } from '../../src/util/data-util';

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

/**
 * 最小复现：容器**自带一个底**（派生部件），又真的装着内容（真实子节点）。
 * 与 BPMN 的 `FlowNode` / 状态机的 `StateNode` 同形。
 */
class CardWithBackground extends ICEGroup {
  public static readonly typeId = 'test:CardWithBackground';

  public background: any = null;

  constructor(props: any = {}) {
    super({ width: 200, height: 100, ...props });
    this.background = new ICERect({
      id: `${props.id}-background`,
      width: this.state.width,
      height: this.state.height,
      zIndex: props.backgroundZIndex,
      style: { fillStyle: '#abcdef', strokeStyle: '#abcdef' },
    });
    this.addChild(this.background);
  }

  public hasDerivedChildren(): boolean {
    return true;
  }

  /** 只有底是派生的，其余都是真实内容 */
  public getSerializableChildren(): any[] {
    return this.childNodes.filter((child: any) => child !== this.background);
  }
}

/** 队列里每个节点的 id（没有 id 时用类型占位） */
function paintOrder(ice: ICE): string[] {
  return flattenTree([], ice.childNodes).map((component: any) => component.props.id || component.constructor.name);
}

describe('渲染顺序：容器的派生部件先于内容', () => {
  it('底的 zIndex 排在内容之后，也仍然先画（内容不会被自己的底色盖住）', () => {
    const ice = makeIce();
    const card = new CardWithBackground({ id: 'card', backgroundZIndex: 'auto' });
    const content = new ICERect({ id: 'content', width: 80, height: 40, zIndex: -5 }); // 故意比底低
    card.addChild(content);
    ice.addChild(card);

    expect(paintOrder(ice)).toEqual(['card', 'card-background', 'content']);

    // 渲染队列（渲染器口径）与展平口径必须一致
    const queue = (ice.renderer as any).getOrderedQueues().components.map((c: any) => c.props.id);
    expect(queue).toEqual(['card', 'card-background', 'content']);
  });

  it('纯图形容器（没有 getSerializableChildren）行为不变：只按 zIndex 排', () => {
    const ice = makeIce();
    const group = new ICEGroup({ id: 'group', width: 200, height: 100 });
    group.addChild(new ICERect({ id: 'high', width: 10, height: 10, zIndex: 5 }));
    group.addChild(new ICERect({ id: 'low', width: 10, height: 10, zIndex: -5 }));
    ice.addChild(group);

    expect(paintOrder(ice)).toEqual(['group', 'low', 'high']);
  });

  it('派生部件之间、真实子节点之间各自仍按 zIndex 升序（相等保持加入顺序）', () => {
    const ice = makeIce();
    const card = new CardWithBackground({ id: 'card', backgroundZIndex: 3 });
    const decoration = new ICERect({ id: 'decoration', width: 10, height: 10, zIndex: -1 }); // 派生部件
    (card as any).addChild(decoration);
    (card as any).getSerializableChildren = function () {
      return this.childNodes.filter((child: any) => child !== this.background && child !== decoration);
    };
    card.addChild(new ICERect({ id: 'content-b', width: 10, height: 10, zIndex: 'auto' }));
    card.addChild(new ICERect({ id: 'content-a', width: 10, height: 10, zIndex: -2 }));
    ice.addChild(card);

    // 派生组：decoration(-1) < background(3)；真实组：content-a(-2) < content-b(auto)
    expect(paintOrder(ice)).toEqual(['card', 'decoration', 'card-background', 'content-a', 'content-b']);
  });

  it('嵌套：池 → 泳道 → 节点，三层各自的底都在自己这一层的内容之下（BPMN 最小复现）', () => {
    const ice = makeIce();
    const pool = new CardWithBackground({ id: 'pool' });
    const lane = new CardWithBackground({ id: 'lane', width: 180, height: 60, zIndex: -20000 });
    const task = new ICERect({ id: 'task', width: 60, height: 30, zIndex: 'auto' });
    lane.addChild(task);
    pool.addChild(lane);
    ice.addChild(pool);

    expect(paintOrder(ice)).toEqual(['pool', 'pool-background', 'lane', 'lane-background', 'task']);

    // 关键回归：把任务"压到最下"之后，它仍然画在泳道的底之上（可见），泳道的底也没被重编号
    task.sendToBack();
    expect(paintOrder(ice)).toEqual(['pool', 'pool-background', 'lane', 'lane-background', 'task']);
    expect(lane.background.state.zIndex).toBe('auto');
  });
});

describe('重排 API 的作用域 = 真实子节点', () => {
  it('bringToFront / sendToBack / moveUp / moveDown 不动派生部件的 zIndex', () => {
    const ice = makeIce();
    const card = new CardWithBackground({ id: 'card', backgroundZIndex: 'auto' });
    const a = new ICERect({ id: 'a', width: 10, height: 10 });
    const b = new ICERect({ id: 'b', width: 10, height: 10 });
    const c = new ICERect({ id: 'c', width: 10, height: 10 });
    card.addChild(a);
    card.addChild(b);
    card.addChild(c);
    ice.addChild(card);

    const backgroundZ = card.background.state.zIndex;
    expect(siblingScopeOf(card).map((item: any) => item.props.id)).toEqual(['a', 'b', 'c']);

    // 四个 API 都只在 [a, b, c] 里重编号：底（派生部件）的 zIndex 一次都不动
    a.sendToBack();
    expect(card.background.state.zIndex).toBe(backgroundZ);
    a.moveUp();
    a.bringToFront();
    expect(paintOrder(ice)).toEqual(['card', 'card-background', 'b', 'c', 'a']);
    c.moveDown();
    expect(card.background.state.zIndex).toBe(backgroundZ);

    // 真实子节点之间的次序照旧由四个 API 管（c 下移一位 → c 在最下、a 仍在最上）
    expect(paintOrder(ice)).toEqual(['card', 'card-background', 'c', 'b', 'a']);
  });

  it('派生部件自己调用重排 API 是空操作（它不是文档内容，不该被排进次序）', () => {
    const ice = makeIce();
    const card = new CardWithBackground({ id: 'card', backgroundZIndex: 'auto' });
    card.addChild(new ICERect({ id: 'content', width: 10, height: 10 }));
    ice.addChild(card);

    const before = paintOrder(ice);
    card.background.bringToFront();
    card.background.sendToBack();
    (card.background as any).moveUp();
    expect(paintOrder(ice)).toEqual(before);
  });

  it('合成组件没有派生部件时，作用域与行为都不变（顶层兄弟 / 普通容器）', () => {
    const ice = makeIce();
    const group = new ICEGroup({ id: 'group', width: 100, height: 100 });
    const a = new ICERect({ id: 'a', width: 10, height: 10 });
    const b = new ICERect({ id: 'b', width: 10, height: 10 });
    group.addChild(a);
    group.addChild(b);
    ice.addChild(group);

    expect(siblingScopeOf(group).length).toBe(2);
    a.sendToBack();
    expect(paintOrder(ice)).toEqual(['group', 'a', 'b']);
    b.bringToFront();
    expect(paintOrder(ice)).toEqual(['group', 'a', 'b']);
  });

  it('只有 0/1 个子节点时不分组（快路径不分配新数组）', () => {
    const lone = new ICEGroup({ id: 'lone' });
    const only = new ICERect({ id: 'only' });
    lone.addChild(only);
    expect(paintOrderChildrenOf(lone)).toBe((lone as any).childNodes);
    expect(paintOrderChildrenOf({ childNodes: null })).toEqual([]);
  });
});

describe('SVG 导出与渲染队列同源', () => {
  it('导出的叠放次序 = 容器底在前、内容在后（与画布一致）', () => {
    const ice = makeIce();
    const card = new CardWithBackground({ id: 'card', backgroundZIndex: 9 });
    const content = new ICERect({
      id: 'content',
      width: 40,
      height: 20,
      zIndex: -9,
      style: { fillStyle: '#123456', strokeStyle: '#123456' },
    });
    card.addChild(content);
    ice.addChild(card);

    const svg = exportSvg(ice);
    const backgroundAt = svg.indexOf('#abcdef');
    const contentAt = svg.indexOf('#123456');
    expect(backgroundAt).toBeGreaterThan(-1);
    expect(contentAt).toBeGreaterThan(-1);
    expect(backgroundAt).toBeLessThan(contentAt);
  });
});
