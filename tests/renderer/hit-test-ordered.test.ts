// 命中测试的快路径契约：复用渲染器「已排序队列」+ 倒序扫描，必须与
// 独立预言机（自己递归收集 + 精确点判定）给出**逐点相同**的结果。
//
// 背景：`hitTestComponents` 原先每次命中都要 flatten + sort（1 万组件实测 0.8ms/次），
// 而 hover 类交互是逐次 mousemove 调的（`ICEHoverManager` / ice-chart 的 HitResolver 都走它）。
// 快路径复用渲染器那份「只在结构/zIndex 变化时才重建」的队列，去掉每次命中的展平、排序与数组分配。
//
// **顺序语义（2026-09-17 渲染顺序铁律）**：绘制 = 树序（先父后子）+ 兄弟按 zIndex，
// 且**工具层整体画在组件层之上**（两层不再按 zIndex 交叉排序）。
// 判据：与一个**独立预言机**（不看世界盒预筛、不复用队列，自己按同一语义收集 + 精确点判定）逐点比对。
// 世界盒预筛只是优化，它绝不能改变「点得到谁」这个结果。
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICEText from '../../src/graphic/text/ICEText';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';
import { isEffectivelyVisible } from '../../src/util/data-util';

class FakePath2D {
  _isPolyfill = true;
  _commands: any[] = [];
  moveTo(...a: any[]) {
    this._commands.push(['moveTo', ...a]);
  }
  lineTo(...a: any[]) {
    this._commands.push(['lineTo', ...a]);
  }
  rect(...a: any[]) {
    this._commands.push(['rect', ...a]);
  }
  arc(...a: any[]) {
    this._commands.push(['arc', ...a]);
  }
  arcTo(...a: any[]) {
    this._commands.push(['arcTo', ...a]);
  }
  ellipse(...a: any[]) {
    this._commands.push(['ellipse', ...a]);
  }
  closePath() {
    this._commands.push(['closePath']);
  }
}

function makeHarness(withRenderer = true) {
  const noop = () => {};
  const ctx: any = new Proxy(
    {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      measureText: () => ({ width: 30 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createPattern: () => ({}),
    },
    {
      get(t, p) {
        if (typeof p === 'symbol') return (t as any)[p];
        if (p === 'then' || p === 'catch' || p === 'finally') return undefined;
        return p in t ? (t as any)[p] : noop;
      },
      set(t, p, v) {
        (t as any)[p] = v;
        return true;
      },
    }
  );
  (global as any).Path2D = FakePath2D;
  root.createPath2D = () => new FakePath2D();
  root.devicePixelRatio = 1;
  root.createOffscreenCanvas = () => ({ canvas: { width: 1, height: 1 }, ctx });

  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = root;
  ice.ctx = ctx;
  ice.canvasWidth = 800;
  ice.canvasHeight = 600;
  ice.evtBus = new EventBus();
  ice.dirty = true;
  if (withRenderer) {
    const renderer: any = new CanvasRenderer(ice, { renderMode: 'full' });
    renderer.start();
    ice.renderer = renderer;
  }
  return { ice };
}

function renderFrame(ice: any) {
  ice.dirty = true;
  ice.renderer.frameEvtHandler();
}

/**
 * 独立预言机：不复用任何队列、不做世界盒预筛 —— 自己按「树序 + 兄弟按 zIndex」递归收集，
 * 工具层整体在组件层之上，再逐个用精确点判定找最上层的可交互组件。
 *
 * 刻意**不调用** `flattenTree` / `sortSiblingsByZIndex`：预言机的意义就是另一份实现，
 * 复用了就等于拿实现验证实现。
 */
function oracleHit(ice: any, wx: number, wy: number): any {
  const collectOrdered = (nodes: any[], out: any[]) => {
    // 排的是**副本**（不能动 childNodes），相等时保持加入顺序 → `sort` 稳定
    const ordered = (nodes || []).slice().sort((a: any, b: any) => (a.state.zIndex || 0) - (b.state.zIndex || 0));
    for (const node of ordered) {
      out.push(node);
      collectOrdered(node.childNodes || [], out);
    }
  };
  const comps: any[] = [];
  const tools: any[] = [];
  collectOrdered(ice.childNodes || [], comps);
  collectOrdered(ice.toolNodes || [], tools);

  const pick = (nodes: any[]): any => {
    let found: any = null;
    for (const c of nodes) {
      if (c.isControlPanel) continue;
      if (!c.state.interactive || !isEffectivelyVisible(c)) continue;
      if (c.containsPoint(wx, wy)) {
        if (typeof c.isPointClippedOut === 'function' && c.isPointClippedOut(wx, wy)) continue;
        found = c;
      }
    }
    return found;
  };
  // 工具层画在组件层之上 → 先问工具层
  return pick(tools) || pick(comps);
}

/** 在画布上撒一格点，逐点比对「引擎 hitTest」与「独立预言机」。 */
function compareOnGrid(ice: any, step = 7) {
  let checked = 0;
  let hits = 0;
  for (let sx = 1; sx < 800; sx += step) {
    for (let sy = 1; sy < 600; sy += step) {
      const [wx, wy] = ice.screenToWorld(sx, sy);
      const got = ice.hitTest(sx, sy);
      const want = oracleHit(ice, wx, wy);
      // 逐点断言便于定位；不一致时直接抛出该点
      expect([sx, sy, got && got.props.id]).toEqual([sx, sy, want && want.props.id]);
      checked++;
      // 防空转：两边都返回 null 也会「相等」，必须确认这轮真的命中过东西
      if (want) hits++;
    }
  }
  // 这轮逐点比对至少要有若干次真实命中，否则「两边都是 null」会让比对变成空转
  expect(hits).toBeGreaterThan(5);
  return checked;
}

describe('命中测试：复用已排序队列的快路径', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('重叠 + 相同 zIndex + 嵌套分组：与独立预言机逐点一致', () => {
    const { ice } = makeHarness();
    const group: any = new ICEGroup({ left: 20, top: 20, width: 200, height: 200 });
    ice.addChild(group);
    const a: any = new ICERect({ id: 'a', left: 30, top: 30, width: 60, height: 60, zIndex: 5 });
    const b: any = new ICERect({ id: 'b', left: 50, top: 50, width: 60, height: 60, zIndex: 5 });
    const c: any = new ICERect({ id: 'c', left: 40, top: 40, width: 60, height: 60, zIndex: 4 });
    group.addChild(a);
    group.addChild(b);
    ice.addChild(c);
    renderFrame(ice);
    const checked = compareOnGrid(ice);
    expect(checked).toBeGreaterThan(1000);
  });

  it('工具层（控制面板）不参与命中，且 zIndex 相等时工具优先的语义不变', () => {
    const { ice } = makeHarness();
    const comp: any = new ICERect({ id: 'comp', left: 100, top: 100, width: 80, height: 80, zIndex: 10 });
    ice.addChild(comp);
    const panel: any = new ICERect({ id: 'panel', left: 100, top: 100, width: 80, height: 80, zIndex: 10 });
    (panel as any).isControlPanel = true;
    ice.toolNodes.push(panel);
    renderFrame(ice);
    const [wx, wy] = ice.screenToWorld(120, 120);
    const hit = ice.hitTest(120, 120);
    expect(hit).toBe(comp); // 面板被跳过
    expect(hit).toBe(oracleHit(ice, wx, wy));
    expect(compareOnGrid(ice)).toBeGreaterThan(1000);
  });

  it('不可交互 / display:false / 被祖先裁剪的组件都不命中，且与预言机一致', () => {
    const { ice } = makeHarness();
    const noInteract: any = new ICERect({
      id: 'noInteract',
      left: 10,
      top: 10,
      width: 40,
      height: 40,
      interactive: false,
      zIndex: 9,
    });
    const hidden: any = new ICERect({
      id: 'hidden',
      left: 60,
      top: 10,
      width: 40,
      height: 40,
      display: false,
      zIndex: 9,
    });
    const clipper: any = new ICEGroup({ left: 120, top: 10, width: 40, height: 40, clipChildren: true });
    const outside: any = new ICERect({ id: 'outside', left: 300, top: 300, width: 40, height: 40, zIndex: 9 });
    const text: any = new ICEText({ id: 'text', left: 400, top: 400, text: 'hi', width: 60, height: 20, zIndex: 3 });
    ice.addChild(noInteract);
    ice.addChild(hidden);
    clipper.addChild(outside);
    ice.addChild(clipper);
    ice.addChild(text);
    renderFrame(ice);
    expect(ice.hitTest(20, 20)).toBeNull(); // interactive:false
    expect(ice.hitTest(70, 20)).toBeNull(); // display:false
    expect(ice.hitTest(310, 310)).toBeNull(); // 被 clipChildren 祖先裁掉
    expect(compareOnGrid(ice)).toBeGreaterThan(1000);
  });

  it('结构变更后立即命中：队列按需刷新，新组件渲染后马上可命中', () => {
    const { ice } = makeHarness();
    const a: any = new ICERect({ id: 'a', left: 0, top: 0, width: 50, height: 50, zIndex: 1 });
    ice.addChild(a);
    renderFrame(ice);
    expect(ice.hitTest(20, 20)).toBe(a);

    // 未渲染就加一个新组件（结构变更 → 渲染队列是旧的）
    const b: any = new ICERect({ id: 'b', left: 20, top: 20, width: 50, height: 50, zIndex: 2 });
    ice.addChild(b);
    // 从未渲染过的组件还没有合成矩阵 → 命中不到它（既有语义，新旧两条路径一致）。
    // 这里要保证的是「不会因为队列过期，连本该命中的 a 也丢了」。
    expect(ice.hitTest(30, 30)).toBe(a);

    renderFrame(ice); // 渲染后 b 有了矩阵，且新队列包含它
    expect(ice.hitTest(30, 30)).toBe(b);
    expect(compareOnGrid(ice)).toBeGreaterThan(1000);
  });

  it('zIndex 变更后「尚未渲染」就命中：叠放次序必须立刻生效', () => {
    const { ice } = makeHarness();
    const a: any = new ICERect({ id: 'a', left: 0, top: 0, width: 80, height: 80, zIndex: 1 });
    const b: any = new ICERect({ id: 'b', left: 20, top: 20, width: 80, height: 80, zIndex: 2 });
    ice.addChild(a);
    ice.addChild(b);
    renderFrame(ice);
    expect(ice.hitTest(30, 30)).toBe(b);

    a.setState({ zIndex: 9 }); // 只改 zIndex，未渲染
    const hit = ice.hitTest(30, 30);
    expect(hit).toBe(a);
    expect(compareOnGrid(ice)).toBeGreaterThan(1000);
  });

  it('没有渲染器时回退到「展平 + 排序」的老路径，结果一致', () => {
    const { ice } = makeHarness(false);
    const a: any = new ICERect({ id: 'a', left: 0, top: 0, width: 80, height: 80, zIndex: 1 });
    const b: any = new ICERect({ id: 'b', left: 20, top: 20, width: 80, height: 80, zIndex: 2 });
    ice.addChild(a);
    ice.addChild(b);
    // 没有渲染循环 → 手动合成矩阵（`containsPoint` 依赖已缓存的合成矩阵）
    a.composeMatrix();
    b.composeMatrix();
    expect(ice.hitTest(30, 30)).toBe(b);
    expect(compareOnGrid(ice)).toBeGreaterThan(1000);
  });
});
