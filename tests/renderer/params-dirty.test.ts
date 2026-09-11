/**
 * dirty / paramsDirty 拆分契约（「只重绘」与「重量测」解耦）。
 *
 * 背景：旧实现只有一个 `dirty`。容器 setState 会递归把所有后代置 `dirty`，
 * 而后代又以 `dirty` 决定是否重算派生参数（`calcComponentParams` → 点集 / 文本量测）
 * → 移动一个大容器时，后代全部白白重算（点集类图元要重跑 `calcDots`）。
 *
 * 契约：
 * - `dirty` = 需要重绘（祖先变换变化时后代必须重绘，因为绝对矩阵变了）；
 * - `paramsDirty` = 自身派生参数需要重算（只取决于组件自身 state，与祖先变换无关）；
 * - `refreshParams()` 是唯一入口：干净时跳过，算完清标志；
 * - 祖先移动 → 后代只重绘、不重算；后代自身 setState → 两者都置脏；
 * - `composeMatrix()` 对 dots 的原点平移是**幂等**的（重复 compose 不再累积偏移）。
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEStar from '../../src/graphic/shape/ICEStar';
import ICEText from '../../src/graphic/text/ICEText';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICEBoxLayout from '../../src/layout/ICEBoxLayout';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';

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
  arcTo(...a: any[]) {
    this._commands.push(['arcTo', ...a]);
  }
  ellipse(...a: any[]) {
    this._commands.push(['ellipse', ...a]);
  }
  arc(...a: any[]) {
    this._commands.push(['arc', ...a]);
  }
  closePath() {
    this._commands.push(['closePath']);
  }
}

function makeHarness(renderMode: 'full' | 'dirty-rect' = 'full') {
  const noop = () => {};
  const gradient = () => ({ addColorStop: noop });
  const baseCtx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    measureText: () => ({ width: 30 }),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createPattern: () => ({}),
  };
  const ctx: any = new Proxy(baseCtx, {
    get(t, prop) {
      if (typeof prop === 'symbol') return (t as any)[prop];
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      if (prop in t) return (t as any)[prop];
      return noop;
    },
    set(t, prop, v) {
      (t as any)[prop] = v;
      return true;
    },
  });
  (global as any).Path2D = FakePath2D;
  root.createPath2D = () => new FakePath2D();
  root.devicePixelRatio = 1;
  root.createOffscreenCanvas = () => ({ canvas: { width: 1, height: 1, offscreen: true }, ctx });

  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = root;
  ice.ctx = ctx;
  ice.canvasWidth = 800;
  ice.canvasHeight = 600;
  ice.evtBus = new EventBus();
  ice.dirty = true;

  const renderer: any = new CanvasRenderer(ice, { renderMode });
  renderer.start();
  ice.renderer = renderer;
  return { ice, renderer, ctx };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

/** 包装指定方法计数。返回 counters 与还原函数。 */
function count(comps: any[], methods: string[]) {
  const counters: any = { total: {}, per: new Map() };
  for (const m of methods) counters.total[m] = 0;
  const restores: Array<() => void> = [];
  for (const c of comps) {
    const perComp: any = {};
    for (const m of methods) {
      perComp[m] = 0;
      if (typeof c[m] !== 'function') continue;
      const orig = c[m].bind(c);
      c[m] = (...args: any[]) => {
        counters.total[m]++;
        perComp[m]++;
        return orig(...args);
      };
      restores.push(() => {
        c[m] = orig;
      });
    }
    counters.per.set(c, perComp);
  }
  return { counters, restore: () => restores.forEach((f) => f()) };
}

function makeGroup() {
  const group = new ICEGroup({ left: 0, top: 0, width: 600, height: 400, zIndex: 1 });
  const star = new ICEStar({ left: 10, top: 10, outerRadius: 12, zIndex: 10 });
  const rect = new ICERect({ left: 100, top: 10, width: 20, height: 20, style: { fillStyle: '#3366cc' }, zIndex: 11 });
  const text = new ICEText({
    left: 10,
    top: 80,
    text: 'hello',
    stroke: false,
    style: { fontSize: 14, fontFamily: 'Arial' },
    zIndex: 12,
  });
  group.addChild(star);
  group.addChild(rect);
  group.addChild(text);
  return { group, star, rect, text };
}

describe('dirty / paramsDirty 拆分', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    // node 环境没有 document，ICEText 的 DOM 降级量测会 console.error，这里静音
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('移动容器：后代只重绘，不重算派生参数（点集 / 文本量测）', () => {
    const { ice, renderer } = makeHarness();
    const { group, star, rect, text } = makeGroup();
    ice.addChild(group);
    renderFrame(renderer, ice); // prime：首次量测

    const { counters, restore } = count(
      [star, rect, text],
      ['calcComponentParams', 'calcDots', 'measureText', 'render']
    );
    group.setState({ left: 40, top: 25 }); // 只移动容器
    renderFrame(renderer, ice);
    restore();

    expect(counters.total.calcComponentParams).toBe(0);
    expect(counters.total.calcDots).toBe(0);
    expect(counters.total.measureText).toBe(0);
    // 但必须重绘（祖先矩阵变了，后代的屏幕位置变了）
    expect(counters.total.render).toBeGreaterThan(0);
    expect(rect.dirty).toBe(false);
  });

  it('后代自身几何变化时，仍会重算派生参数（点集）', () => {
    const { ice, renderer } = makeHarness();
    const { group, star, rect } = makeGroup();
    ice.addChild(group);
    renderFrame(renderer, ice);

    const { counters, restore } = count([star, rect], ['calcDots', 'calcComponentParams']);
    star.setState({ outerRadius: 30 }); // 只有 star 自己变了
    renderFrame(renderer, ice);
    restore();

    expect(counters.total.calcDots).toBeGreaterThan(0);
    const starCounts = counters.per.get(star);
    const rectCounts = counters.per.get(rect);
    expect(starCounts.calcDots).toBeGreaterThan(0);
    expect(rectCounts.calcDots).toBe(0); // 未变的兄弟节点不受影响
  });

  it('ICEGroup.setState：后代 dirty 置脏、paramsDirty 保持干净', () => {
    const { ice, renderer } = makeHarness();
    const { group, star } = makeGroup();
    ice.addChild(group);
    renderFrame(renderer, ice);

    expect(star.paramsDirty).toBe(false);
    group.setState({ left: 10 });

    expect(star.dirty).toBe(true); // 需要重绘
    expect(star.paramsDirty).toBe(false); // 不需要重量测
    expect(group.paramsDirty).toBe(true); // 容器自身仍要重算（尺寸等）
  });

  it('refreshParams 契约：干净时跳过、置脏后重算并清标志', () => {
    const star: any = new ICEStar({ left: 0, top: 0, outerRadius: 20 });
    expect(star.paramsDirty).toBe(true);

    const calls: number[] = [];
    const orig = star.calcComponentParams.bind(star);
    star.calcComponentParams = () => {
      calls.push(1);
      return orig();
    };

    star.refreshParams();
    expect(calls.length).toBe(1);
    expect(star.paramsDirty).toBe(false);

    star.refreshParams(); // 干净 → 跳过
    expect(calls.length).toBe(1);

    star.paramsDirty = true;
    star.refreshParams();
    expect(calls.length).toBe(2);
    expect(star.paramsDirty).toBe(false);
  });

  it('composeMatrix 幂等：重复 compose 不再累积平移 dots', () => {
    const star: any = new ICEStar({ left: 0, top: 0, outerRadius: 30 });
    star.ice = { ctx: {} };
    star.refreshParams();
    const absolute = JSON.stringify(star.state.dots);
    star.composeMatrix();
    const once = JSON.stringify(star.state.dots);
    star.composeMatrix();
    const twice = JSON.stringify(star.state.dots);
    star.composeMatrix();
    const thrice = JSON.stringify(star.state.dots);

    expect(once).not.toBe(absolute); // 确实被平移到「以 origin 为原点」
    expect(twice).toBe(once); // 幂等
    expect(thrice).toBe(once);

    // 重新量测后再 compose，回到与第一次 compose 完全相同的结果
    star.paramsDirty = true;
    star.refreshParams();
    star.composeMatrix();
    expect(JSON.stringify(star.state.dots)).toBe(once);
  });

  it('连续移动容器多帧：后代点集不漂移，世界盒按位移线性移动', () => {
    const { ice, renderer } = makeHarness();
    const { group, star } = makeGroup();
    ice.addChild(group);
    renderFrame(renderer, ice);

    const dotsAfterPrime = JSON.stringify(star.state.dots);
    const boxAfterPrime = star.getMaxBoundingBox(true).getMinAndMaxPoint();

    let expectedMinX = boxAfterPrime.minX;
    let prevLeft = 0; // prime 帧时容器 left
    for (let i = 0; i < 5; i++) {
      const nextLeft = 30 + i * 5;
      group.setState({ left: nextLeft, top: 20 });
      renderFrame(renderer, ice);
      expectedMinX += nextLeft - prevLeft;
      prevLeft = nextLeft;

      // 点集是「本地坐标」，容器移动不应改变它（更不应累积偏移）
      expect(JSON.stringify(star.state.dots)).toBe(dotsAfterPrime);
      // 世界盒应当正好移动 5（若点集漂移，这里会偏离）
      const mm = star.getMaxBoundingBox(true).getMinAndMaxPoint();
      expect(mm.minX).toBeCloseTo(expectedMinX, 6);
    }
  });

  it('布局：新加入容器的子组件仍会被量测（派生尺寸参与排布）', () => {
    const { ice, renderer } = makeHarness();
    const row = new ICEGroup({ left: 0, top: 0, width: 600, height: 100 });
    ice.addChild(row);
    row.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));

    // 星形不显式给宽高：宽高要从 outerRadius 派生（40），布局读的正是 state.width
    const star = new ICEStar({ outerRadius: 20, zIndex: 1 });
    const rect = new ICERect({ width: 30, height: 30, style: { fillStyle: '#3366cc' }, zIndex: 2 });
    row.addChild(star);
    row.addChild(rect);
    renderFrame(renderer, ice);

    expect(star.state.width).toBe(40); // 派生尺寸必须已算出，而不是 0
    expect(star.state.left).toBe(0);
    expect(rect.state.left).toBe(50); // 40 + gap 10
  });
});
