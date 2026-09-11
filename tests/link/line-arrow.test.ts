/**
 * 线条端点箭头：默认实心 + 空心可配置（`arrowStyle`）。
 *
 * 历史行为：箭头三角形不是独立图形，而是 `calcArrowPoints()` 把顶点**插进折线点集**
 * （起点 `[P0,A1,A2,P0,...]`；终点 `[...,Pn,B1,B2,Pn]`），而折线在 `arrangeParam` 里强制
 * `fill:false` 只描边 → 三角形三条边都被描出来 → 看起来是**空心**的。
 * 现在默认用「线色」把三角形填实；`arrowStyle:'hollow'` 可回到旧的空心观感。
 *
 * 同源的另一处缺陷：直线（共线）时 `__localBox()` 走 `splitEndpointsTo4Points()`，
 * 该路径只按 `state.points` 首尾 + `lineWidth` 生成 4 顶点，**不含箭头 wing 的横向张开**
 * → dirty-rect 快照盒偏小，局部重绘可能裁掉箭头；选择框也会切到箭头。
 *
 * 断言只用「ctx 调用序列」与几何数值，不依赖像素。
 */
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});
global.Path2D = class {
  moveTo() {}
  lineTo() {}
  closePath() {}
  rect() {}
  arc() {}
  ellipse() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 记录 ctx 调用序列的桩。
 * `fill` 事件里带上「调用时的 fillStyle」与「实参个数」，一次断言即可同时锁住
 * 「确实填充了」「填充色=线色」「用的是无参 fill（只填当前路径）」（详见 fill()）。
 */
function recordingCtx(lineColor = '#123456') {
  const events: string[] = [];
  const ctx: any = {
    strokeStyle: lineColor,
    fillStyle: 'rgba(0, 0, 0, 0)', // 故意设成透明：若实现没显式设 fillStyle，填充会「看不见」
    lineWidth: 1,
    lineDashOffset: 0,
    save() {
      events.push('save');
    },
    restore() {
      events.push('restore');
    },
    setTransform() {},
    setLineDash() {},
    beginPath() {
      events.push('beginPath');
    },
    closePath() {
      events.push('closePath');
    },
    moveTo(x: number, y: number) {
      events.push(`moveTo(${r2(x)},${r2(y)})`);
    },
    lineTo(x: number, y: number) {
      events.push(`lineTo(${r2(x)},${r2(y)})`);
    },
    quadraticCurveTo() {},
    bezierCurveTo() {},
    rect() {},
    arc() {},
    ellipse() {},
    stroke() {
      events.push('stroke');
    },
    fill(...args: any[]) {
      // 带参 fill(path2D) 会把整条折线一并填满（折线是开放路径），因此这里记录实参个数
      events.push(`fill(style=${ctx.fillStyle},argc=${args.length})`);
    },
  };
  return { ctx, events };
}

/** 只取「最后一次 beginPath 之后、第一个 fill 之前」的事件：即箭头三角形的路径构造 */
function trianglePathBeforeFill(events: string[]): string[] {
  const fillIdx = events.findIndex((e) => e.startsWith('fill('));
  if (fillIdx < 0) return [];
  let beginIdx = -1;
  for (let i = fillIdx - 1; i >= 0; i--) {
    if (events[i] === 'beginPath') {
      beginIdx = i;
      break;
    }
  }
  return beginIdx < 0 ? [] : events.slice(beginIdx + 1, fillIdx);
}

const FILLED_FILL_EVENT = 'fill(style=#123456,argc=0)';

/** 水平 2 点线：贴近真实场景，箭头 wing 的纵向张开最容易观察 */
const H_LINE = [
  [0, 0],
  [100, 0],
];

/**
 * 复现真实渲染流程：`__renderCore()` 的顺序是
 * `refreshParams()`（算出 dots 与箭头下标）→ `applyStyleToCtx()` → `doRender()`。
 * 所以直接调 `doRender()` 之前必须先 `refreshParams()`。
 * `applyStyleToCtx()` 那一步这里用「预置 ctx.strokeStyle」等价替代。
 */
function renderLine(props: any, lineColor = '#123456') {
  const { ctx, events } = recordingCtx(lineColor);
  const line: any = new ICEPolyLine({ points: H_LINE, style: { strokeStyle: lineColor, lineWidth: 2 }, ...props });
  line.ctx = ctx;
  line.refreshParams();
  line.doRender();
  return { line, ctx, events };
}

describe('端点箭头：默认实心（arrowStyle）', () => {
  it('默认 arrowStyle 为 filled，且不影响折线本身的点集', () => {
    const { line } = renderLine({ arrow: 'end' });
    expect(line.state.arrowStyle).toBe('filled');
    expect(line.state.arrow).toBe('end');
  });

  it('默认给终点箭头填实心：闭合三角路径 + 无参 fill，颜色取线色', () => {
    const { events } = renderLine({ arrow: 'end' });

    // 三角形 = dots[n-4..n-2] = (100,0) → (87.01,-7.5) → (87.01,7.5)
    expect(trianglePathBeforeFill(events)).toEqual([
      'moveTo(100,0)',
      'lineTo(87.01,-7.5)',
      'lineTo(87.01,7.5)',
      'closePath',
    ]);
    // argc=0 ⇒ 用的是无参 fill（只填当前路径），不会把整条开放折线填满
    expect(events).toContain(FILLED_FILL_EVENT);
  });

  it('arrowStyle:"hollow" 时不填充，但仍然描边（保持旧的空心观感）', () => {
    const { events } = renderLine({ arrow: 'end', arrowStyle: 'hollow' });
    expect(events.some((e) => e.startsWith('fill('))).toBe(false);
    expect(events).toContain('stroke');
  });

  it('arrow:"none" 时零副作用：不填、不动点集', () => {
    const { line, events } = renderLine({ arrow: 'none' });
    expect(line.__arrowFaceIndexes.length).toBe(0);
    expect(events.some((e) => e.startsWith('fill('))).toBe(false);
    expect(line.state.dots.length).toBe(line.state.points.length);
  });

  it('arrow:"both" 时两端都填，一次 fill 填两个三角面', () => {
    const { line, events } = renderLine({ arrow: 'both' });

    expect(line.__arrowFaceIndexes.length).toBe(2);
    const path = trianglePathBeforeFill(events);
    expect(path.filter((e) => e === 'closePath').length).toBe(2);
    expect(path.filter((e) => e.startsWith('moveTo(')).length).toBe(2);
    expect(events.filter((e) => e.startsWith('fill(')).length).toBe(1);
  });

  it('填充色跟随线色（两组不同线色的对照）', () => {
    for (const color of ['#123456', '#ff00aa']) {
      const { events } = renderLine({ arrow: 'end' }, color);
      expect(events).toContain(`fill(style=${color},argc=0)`);
    }
  });

  it('填充期间不污染 ctx：save 在 fill 之前、restore 在 fill 之后', () => {
    const { events } = renderLine({ arrow: 'end' });

    const fillIdx = events.findIndex((e) => e.startsWith('fill('));
    expect(fillIdx).toBeGreaterThan(-1);
    expect(events.slice(0, fillIdx)).toContain('save');
    expect(events.slice(fillIdx)).toContain('restore');
  });

  it('arrowStyle 只影响画法、不影响几何：filled 与 hollow 的 dots 完全相同', () => {
    const build = (arrowStyle: string) => {
      const line: any = new ICEPolyLine({ points: H_LINE, arrow: 'both', arrowStyle });
      line.refreshParams();
      return line;
    };
    expect(build('filled').state.dots).toEqual(build('hollow').state.dots);
  });
});

/**
 * 包围盒：直线 + 箭头时，共线分支的盒子只按线段方向外扩 `lineWidth/2`，
 * 纵向（垂直于线）**没有任何外扩**，所以箭头 wing 的 ±7.5px 完全落在盒外。
 */
describe('端点箭头：包围盒必须包含箭头张开', () => {
  function makeLine(props: any = {}) {
    const l: any = new ICEPolyLine({
      points: [
        [0, 0],
        [100, 0],
      ],
      style: { lineWidth: 2 },
      ...props,
    });
    l.ice = { ctx: {} };
    l.refreshParams();
    l.composeMatrix();
    return l;
  }

  /** 默认 arrowLength=15、arrowAngel=30° ⇒ wing 距轴线 15·sin30° = 7.5 */
  const WING = 7.5;

  it('带箭头：盒子把 wing 的 ±7.5 纳入（= arrowLength · sin30°）', () => {
    const l = makeLine({ arrow: 'end' });
    const box = l.__localBox();
    // 实测基线：不带箭头时是 [0,-1,100,1]（线宽 2），箭头把纵向撑到 ±7.5
    expect(box[0]).toBeCloseTo(0, 6);
    expect(box[1]).toBeCloseTo(-WING, 6);
    expect(box[2]).toBeCloseTo(100, 6);
    expect(box[3]).toBeCloseTo(WING, 6);
    expect(box[3] - box[1]).toBeCloseTo(2 * WING, 6);
  });

  it('对照：无箭头时盒子只按线宽外扩（splitEndpointsTo4Points 的既有语义）', () => {
    const l = makeLine({ arrow: 'none' });
    const box = l.__localBox();
    // 实测：水平 2 点线 + lineWidth 2 → [0,-1,100,1]，纵向跨度 = 线宽
    expect(box[0]).toBeCloseTo(0, 6);
    expect(box[1]).toBeCloseTo(-1, 6);
    expect(box[2]).toBeCloseTo(100, 6);
    expect(box[3]).toBeCloseTo(1, 6);
    expect(box[3] - box[1]).toBeCloseTo(2, 6);
  });

  it('起点/终点箭头都计入（both 时两端各差分张开）', () => {
    const l = makeLine({ arrow: 'both' });
    const box = l.__localBox();
    expect(box[1]).toBeCloseTo(-WING, 6);
    expect(box[3]).toBeCloseTo(WING, 6);
  });

  it('带箭头时「上屏快照盒」与「最小包围盒」仍逐位一致', () => {
    for (const arrow of ['start', 'end', 'both']) {
      const l = makeLine({ arrow });
      const box = l.getMinBoundingBox().getMinAndMaxPoint();
      const out = new Float64Array(4);
      l.__paintWorldBox(out);
      expect(Array.from(out)).toEqual([box.minX, box.minY, box.maxX, box.maxY]);
    }
  });

  it('重复量测稳定（不引入新的循环依赖/自我漂移）', () => {
    const l = makeLine({ arrow: 'end' });
    const first = { box: Array.from(l.__localBox()), w: l.state.width, h: l.state.height };
    for (let i = 0; i < 3; i++) {
      l.paramsDirty = true;
      l.refreshParams();
      l.composeMatrix();
      expect(Array.from(l.__localBox())).toEqual(first.box);
      expect(l.state.width).toBe(first.w);
      expect(l.state.height).toBe(first.h);
    }
  });
});
