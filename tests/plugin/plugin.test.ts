/**
 * 插件宿主：组件 / 渲染 / 交互工具三层注册点与生命周期。
 *
 * 契约：
 * - use 幂等（同名不重复 setup）；unuse 撤销渲染钩子与工具、调用 teardown，但**保留类型注册**
 * - 组件层：插件声明的类型自动 registerType，并获得稳定 typeId（可序列化）
 * - 渲染层：每帧调用，世界坐标；全量帧 region=null，局部帧 region 为脏区域；无钩子时零开销
 * - 交互层：match 命中则 addTool、失配则 removeTool；工具实例跨选中复用；exclusive 向上报告
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return {
    __esModule: true,
    default: {
      createPath2D: () => new PolyfillPath2D(),
      createOffscreenCanvas: (w: number, h: number) => ({
        canvas: { width: w, height: h },
        ctx: {
          scale() {},
          setTransform() {},
          save() {},
          restore() {},
          beginPath() {},
          rect() {},
          moveTo() {},
          lineTo() {},
          closePath() {},
          stroke() {},
          fill() {},
          setLineDash() {},
          drawImage() {},
        },
      }),
      devicePixelRatio: 1,
    },
  };
});

import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import ICERect from '../../src/graphic/shape/ICERect';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

function makeIce(withRenderer = false): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.ctx = undefined;
  if (withRenderer) {
    ice.canvasWidth = 400;
    ice.canvasHeight = 300;
    ice.ctx = makeCtx();
    const renderer: any = new CanvasRenderer(ice, { renderMode: 'dirty-rect' });
    renderer.start();
    ice.renderer = renderer;
  }
  return ice;
}

function makeCtx(): any {
  const noop = () => {};
  return {
    fills: 0,
    fill() {
      this.fills++;
    },
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
    setTransform: noop,
    setLineDash: noop,
    drawImage: noop,
    scale: noop,
  };
}

describe('插件生命周期', () => {
  it('use 幂等：同名重复注册不重复 setup，返回 false', () => {
    const ice = makeIce();
    const setup = jest.fn();
    expect(ice.use({ name: 'p1', setup })).toBe(true);
    expect(ice.use({ name: 'p1', setup })).toBe(false);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(ice.getPlugins()).toEqual(['p1']);
  });

  it('缺少 name 时明确抛错', () => {
    const ice = makeIce();
    expect(() => ice.use({} as any)).toThrow(/name/);
  });

  it('unuse 调用 teardown 并撤销插件；未注册的 name 返回 false', () => {
    const ice = makeIce();
    const teardown = jest.fn();
    ice.use({ name: 'p1', teardown });
    expect(ice.unuse('p1')).toBe(true);
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(ice.getPlugins()).toEqual([]);
    expect(ice.unuse('p1')).toBe(false);
  });

  it('setup / teardown 能拿到 ice 实例', () => {
    const ice = makeIce();
    const seen: any[] = [];
    ice.use({ name: 'p1', setup: (i: any) => seen.push(i), teardown: (i: any) => seen.push(i) });
    ice.unuse('p1');
    expect(seen).toEqual([ice, ice]);
  });
});

describe('第一层：组件注册', () => {
  it('插件声明的类型被注册，并可通过 typeId 反查（可序列化）', () => {
    class CustomWidget extends ICERect {}
    const ice = makeIce();
    ice.use({ name: 'widgets', components: { CustomWidget } });

    expect(ice.getType('CustomWidget')).toBe(CustomWidget);
    expect(ice.getTypeId(CustomWidget)).toBe('CustomWidget');

    ice.addChild(new CustomWidget({ left: 1, top: 2, width: 10, height: 10 }));
    const json: any = new Serializer(ice).toJSONObject();
    expect(json.childNodes[0].type).toBe('CustomWidget');

    // round-trip：新实例注册同名插件后即可反序列化
    const ice2 = makeIce();
    ice2.use({ name: 'widgets', components: { CustomWidget } });
    new Deserializer(ice2).fromJSONObject(json);
    expect(ice2.childNodes[0]).toBeInstanceOf(CustomWidget);
  });

  it('unuse 后类型注册保留（已存数据仍可加载）', () => {
    class CustomWidget extends ICERect {}
    const ice = makeIce();
    ice.use({ name: 'widgets', components: { CustomWidget } });
    ice.unuse('widgets');
    expect(ice.getType('CustomWidget')).toBe(CustomWidget);
  });
});

describe('第二层：渲染钩子', () => {
  it('未注册插件时零开销（hasRenderHooks 为 false）', () => {
    const ice = makeIce(true);
    expect(ice.plugins.hasRenderHooks()).toBe(false);
  });

  it('全量帧：钩子被调用，region 为 null，坐标系为渲染视口', () => {
    const ice = makeIce(true);
    const frames: any[] = [];
    ice.use({ name: 'overlay', render: (f: any) => frames.push(f) });
    ice.addChild(new ICERect({ left: 10, top: 10, width: 20, height: 20 }));

    ice.dirty = true;
    ice.renderer.frameEvtHandler();

    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0].mode).toBe('dirty-rect');
    expect(frames[0].region).toBeNull();
    expect(frames[0].ctx).toBe(ice.ctx);
    expect(frames[0].width).toBe(400);
  });

  it('unuse 后钩子不再被调用', () => {
    const ice = makeIce(true);
    const hook = jest.fn();
    ice.use({ name: 'overlay', render: hook });
    ice.addChild(new ICERect({ left: 10, top: 10, width: 20, height: 20 }));
    ice.dirty = true;
    ice.renderer.frameEvtHandler();
    const before = hook.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    ice.unuse('overlay');
    ice.dirty = true;
    ice.renderer.frameEvtHandler();
    expect(hook.mock.calls.length).toBe(before);
  });
});

describe('第三层：交互工具', () => {
  it('match 命中则挂到 toolNodes，失配则摘下', () => {
    const ice = makeIce();
    const tool = new ICERect({ left: 0, top: 0, width: 5, height: 5 });
    ice.use({
      name: 'tools',
      tools: [
        {
          id: 'rect-tool',
          match: (c: any) => c.state.width === 42,
          create: () => tool,
        },
      ],
    });

    const miss = new ICERect({ width: 10, height: 10 });
    ice.setSelection([miss]);
    expect(ice.toolNodes.length).toBe(0);

    const hit = new ICERect({ width: 42, height: 10 });
    ice.setSelection([hit]);
    expect(ice.toolNodes).toContain(tool);

    ice.setSelection([miss]);
    expect(ice.toolNodes).not.toContain(tool);
  });

  it('工具实例跨选中复用（不重复 create），并回调 onTargetChange', () => {
    const ice = makeIce();
    const create = jest.fn(() => new ICERect({ width: 5, height: 5 }));
    const onTargetChange = jest.fn();
    ice.use({
      name: 'tools',
      tools: [{ id: 't', match: () => true, create, onTargetChange }],
    });

    const a = new ICERect({ width: 10, height: 10 });
    const b = new ICERect({ width: 20, height: 20 });
    ice.setSelection([a]);
    ice.setSelection([b]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(onTargetChange).toHaveBeenCalledTimes(2);
    expect(onTargetChange.mock.calls[1][1]).toBe(b);
  });

  it('exclusive 命中时 setSelection 返回 true（供调用方禁用内置面板）', () => {
    const ice = makeIce();
    ice.use({
      name: 'tools',
      tools: [{ id: 't', match: () => true, create: () => new ICERect({ width: 5, height: 5 }), exclusive: true }],
    });
    const c = new ICERect({ width: 10, height: 10 });
    expect(ice.setSelection([c])).toBe(true);

    const plain = makeIce();
    plain.use({
      name: 'tools',
      tools: [{ id: 't', match: () => true, create: () => new ICERect({ width: 5, height: 5 }) }],
    });
    expect(plain.setSelection([c])).toBe(false);
  });

  it('match 抛错不影响引擎（按未命中处理）', () => {
    const ice = makeIce();
    ice.use({
      name: 'tools',
      tools: [
        {
          id: 'bad',
          match: () => {
            throw new Error('boom');
          },
          create: () => new ICERect({ width: 5, height: 5 }),
        },
      ],
    });
    const c = new ICERect({ width: 10, height: 10 });
    expect(() => ice.setSelection([c])).not.toThrow();
    expect(ice.toolNodes.length).toBe(0);
  });

  it('setSelection(null) 清空选中并摘下工具', () => {
    const ice = makeIce();
    const tool = new ICERect({ width: 5, height: 5 });
    ice.use({ name: 'tools', tools: [{ id: 't', match: () => true, create: () => tool }] });
    ice.setSelection([new ICERect({ width: 10, height: 10 })]);
    expect(ice.toolNodes).toContain(tool);

    ice.setSelection(null);
    expect(ice.selectionList).toEqual([]);
    expect(ice.toolNodes).not.toContain(tool);
  });

  it('unuse 会摘下该插件的工具', () => {
    const ice = makeIce();
    const tool = new ICERect({ width: 5, height: 5 });
    ice.use({ name: 'tools', tools: [{ id: 't', match: () => true, create: () => tool }] });
    ice.setSelection([new ICERect({ width: 10, height: 10 })]);
    expect(ice.toolNodes).toContain(tool);

    ice.unuse('tools');
    expect(ice.toolNodes).not.toContain(tool);
  });
});
