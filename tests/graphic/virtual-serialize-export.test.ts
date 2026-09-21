/**
 * **虚拟子源的序列化与导出契约（P2 的第 1+2 条）**（2026-09-21）。
 *
 * 背景（来自 IED 的真实接入反馈）：文档 6 万条目、而组件树上只有窗口内那几百个 ——
 * 于是「存盘 / 导出」如果只看组件树，就只能存下窗口里那一点。这两条契约要解决的就是它：
 *
 * ① **导出**：`VirtualChildSource.paintToSvg(sink, bounds)` —— 应用把**整份文档**写进 sink
 *    （复合符号用 `define` + `use` 复用），引擎负责包 `<g transform>`、拼 `<defs>`、保证
 *    "批量内容在下、物化子项在上"的次序与画布一致；
 * ② **序列化**：容器写出 `virtual: { type, count, version, payload }`；物化子项写出
 *    `virtualIndex`；反序列化按 `type` 找工厂（`registerVirtualSource`）重建子源、并把子项
 *    重新登进"已物化"表（否则会出现"子项在树上、文档以为没物化"→ 画两遍）。
 */
import ICE from '../../src/ICE';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICEVirtualLayer from '../../src/graphic/container/ICEVirtualLayer';
import ICERect from '../../src/graphic/shape/ICERect';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';
import { materializeVirtualChild, materializedIndices } from '../../src/graphic/virtual/virtual-child-source';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

class FakePath2D {
  _commands: any[] = [];
  _closed = false;
  moveTo(...a: any[]) {
    this._commands.push(['moveTo', ...a]);
  }
  lineTo(...a: any[]) {
    this._commands.push(['lineTo', ...a]);
  }
  rect(...a: any[]) {
    this._commands.push(['rect', ...a]);
  }
  ellipse(...a: any[]) {
    this._commands.push(['ellipse', ...a]);
  }
  closePath() {
    this._closed = true;
  }
}

function makeIce() {
  const noop = () => {};
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect: noop,
    clip: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    rect: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    setTransform: noop,
    setLineDash: noop,
    drawImage: noop,
  };
  (global as any).Path2D = FakePath2D;
  root.createPath2D = () => new FakePath2D();
  root.devicePixelRatio = 1;
  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = root;
  ice.ctx = ctx;
  ice.canvasWidth = 800;
  ice.canvasHeight = 600;
  ice.evtBus = new EventBus();
  ice.dirty = true;
  // 极简夹具没有 init()：序列化 / 导出那两个入口要手动挂上（与 ICE.init 里做的事同源）
  ice.serializer = new Serializer(ice);
  ice.deserializer = new Deserializer(ice);
  const renderer: any = new CanvasRenderer(ice, { renderMode: 'full' });
  renderer.start();
  ice.renderer = renderer;
  return { ice, renderer };
}

/** 三条目文档：两条"批量"符号 + 一个可物化的真组件。 */
function makeSource(state: { payload: any }) {
  return {
    count: 3,
    version: 7,
    documentType: 'test:doc',
    boxAt(i: number, out: Float64Array) {
      out[0] = i * 100;
      out[1] = 0;
      out[2] = i * 100 + 40;
      out[3] = 40;
    },
    forEachInBox(x0: number, y0: number, x1: number, y1: number, visit: (i: number) => void) {
      for (let i = 0; i < 3; i++) {
        const bx = i * 100;
        if (bx + 40 >= x0 && bx <= x1 && 40 >= y0 && 0 <= y1) visit(i);
      }
    },
    hitTest(lx: number, ly: number) {
      if (ly < 0 || ly > 40) return -1;
      const i = Math.floor(lx / 100);
      return i >= 0 && i < 3 && lx - i * 100 <= 40 ? i : -1;
    },
    paint() {
      return true;
    },
    materialize(i: number) {
      return new ICERect({ left: i * 100, top: 0, width: 40, height: 40 });
    },
    documentBounds(out: Float64Array) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 240;
      out[3] = 40;
      return true;
    },
    serializeDocument() {
      return state.payload;
    },
    /** 全量导出：两条批量符号用 def 复用，第三条（已物化）由引擎自己画。 */
    paintToSvg(sink: any) {
      sink.define('sym', '<rect x="0" y="0" width="40" height="40" fill="#f00"/>');
      sink.use('sym', 0, 0);
      sink.use('sym', 100, 0);
      sink.raw('<text x="0" y="60">bulk</text>');
      return true;
    },
  };
}

describe('虚拟子源：序列化契约', () => {
  test('容器写出 virtual 块；物化子项写出 virtualIndex', () => {
    const { ice } = makeIce();
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 240,
      height: 40,
      childSource: makeSource({ payload: { rows: 3, tag: 'demo' } }),
    });
    ice.addChild(layer);
    materializeVirtualChild(layer, 2);

    const json = JSON.parse(new Serializer(ice).toJSONString());
    const node = json.childNodes[0];
    expect(node.virtual).toEqual({
      type: 'test:doc',
      count: 3,
      version: 7,
      payload: { rows: 3, tag: 'demo' },
    });
    expect(node.childNodes.length).toBe(1);
    expect(node.childNodes[0].virtualIndex).toBe(2); // 物化的那一个是下标 2
  });

  test('反序列化：按 type 找工厂重建子源 + 重新登进"已物化"表', () => {
    const { ice } = makeIce();
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 240,
      height: 40,
      childSource: makeSource({ payload: { rows: 3, tag: 'demo' } }),
    });
    ice.addChild(layer);
    materializeVirtualChild(layer, 2);
    const json = new Serializer(ice).toJSONString();

    /**
     * 虚拟源注册表是**进程级**的（工厂是纯函数、没有实例状态）：同一个 type 只注册一次，
     * 同名不同工厂会**抛错**（与 `registerType` 同一条纪律）。
     */
    const seen: any[] = [];
    ice.registerVirtualSource('test:doc', (payload: any, ctx: any) => {
      seen.push({ payload, count: ctx.count, version: ctx.version });
      return makeSource({ payload });
    });

    const ice2: any = makeIce().ice;
    new Deserializer(ice2).fromJSONString(json);

    expect(seen.length).toBe(1);
    expect(seen[0].payload).toEqual({ rows: 3, tag: 'demo' });
    expect(seen[0].count).toBe(3);
    expect(seen[0].version).toBe(7);

    const layer2: any = ice2.childNodes[0];
    expect(layer2.getChildSource()).toBeTruthy();
    // 物化子项回来了，而且**登记在同一个下标上**（否则会画两遍）
    expect(materializedIndices(layer2)).toEqual([2]);
    expect(layer2.childNodes.length).toBe(1);
    expect(layer2.childNodes[0].state.left).toBe(200);
  });

  test('没有注册工厂时：子源不重建（告警），但物化子项照旧还原（不炸）', () => {
    const { ice } = makeIce();
    // 用一个**没注册过**的 type（注册表是进程级的，别蹭前面用例注册过的 'test:doc'）
    const source: any = makeSource({ payload: { rows: 3 } });
    Object.defineProperty(source, 'documentType', { value: 'test:unknown-doc', enumerable: true });
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 240,
      height: 40,
      childSource: source,
    });
    ice.addChild(layer);
    materializeVirtualChild(layer, 1);
    const json = new Serializer(ice).toJSONString();

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const ice2: any = makeIce().ice;
    new Deserializer(ice2).fromJSONString(json);
    warn.mockRestore();

    const layer2: any = ice2.childNodes[0];
    expect(layer2.getChildSource()).toBeNull();
    expect(layer2.childNodes.length).toBe(1);
  });
});

describe('虚拟子源：SVG 导出契约', () => {
  test('全量导出包含批量内容（define/use）与物化子项，且次序与画布一致', () => {
    const { ice, renderer } = makeIce();
    const layer: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 240,
      height: 40,
      childSource: makeSource({ payload: {} }),
    });
    ice.addChild(layer);
    ice.dirty = true;
    renderer.frameEvtHandler();
    materializeVirtualChild(layer, 2); // 第 2 条变成真组件（决定它必须画在批量内容之后）

    const svg = ice.toSvg({ area: 'content' });
    // defs 里有复用定义、正文里是引用（复合符号导出的正确形态：少数 def + 每个实例一条 use）
    expect(svg).toContain('<defs><g id="sym">');
    expect(svg).toContain('<use href="#sym" x="0" y="0"/>');
    expect(svg).toContain('<use href="#sym" x="100" y="0"/>');
    expect(svg).toContain('>bulk</text>');
    // 次序：批量内容必须在**物化子项之前**（画布上也是这么叠的）
    const bulkAt = svg.indexOf('bulk');
    const childAt = svg.indexOf('M-20,-20');
    expect(childAt).toBeGreaterThan(-1);
    expect(bulkAt).toBeLessThan(childAt);
    // 批量内容包在容器的世界矩阵 <g> 里
    expect(svg).toContain('<g transform="matrix(1 0 0 1 0 0)"><g transform="matrix(1 0 0 1 0 0)">');
  });

  test('content 区域用 documentBounds（不实现时退回容器盒）', () => {
    const { ice, renderer } = makeIce();
    const withBounds: any = new ICEVirtualLayer({
      left: 0,
      top: 0,
      width: 1000,
      height: 1000,
      childSource: makeSource({ payload: {} }),
    });
    ice.addChild(withBounds);
    ice.dirty = true;
    renderer.frameEvtHandler();
    const a = ice.toSvg({ area: 'content' });
    const wA = Number((a.match(/width="([\d.]+)"/) || [])[1]);
    expect(wA).toBeCloseTo(240, 0);
  });
});
