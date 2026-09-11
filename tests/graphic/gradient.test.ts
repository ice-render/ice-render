/**
 * 声明式渐变（style.fillGradient / strokeGradient）单测。
 *
 * 关键契约：
 * - 纯对象描述 → 渲染时构造 CanvasGradient，可**序列化**（手搓 CanvasGradient 存盘会丢）；
 * - 按描述对象引用缓存，`setState` 换对象后重建；重复渲染不重复构造；
 * - 渐变最后应用，压过同层 fillStyle / strokeStyle（不依赖 style 的键序）；
 * - 缺 API / 无 stop 时退回纯色，不出现「什么都没画出来」；
 * - 可写在主题 preset 里，并随主题热切换重新展开。
 */
import ICERect from '../../src/graphic/shape/ICERect';
import ICE from '../../src/ICE';
import EventBus from '../../src/event/EventBus';
import componentTypeMap from '../../src/consts/COMPONENT_TYPE_MAPPING';
import Serializer from '../../src/persistence/Serializer';
import Deserializer from '../../src/persistence/Deserializer';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

/** 录制型 ctx：记录 canvas 上被赋过哪些 fillStyle/strokeStyle，以及创建了哪些渐变 */
function makeCtx(opts: { conic?: boolean } = {}) {
  const calls = {
    linear: [] as any[],
    radial: [] as any[],
    conic: [] as any[],
    stops: [] as any[],
    fillSet: [] as any[],
    strokeSet: [] as any[],
  };
  const gradient = (kind: string) => ({
    __kind: kind,
    addColorStop: (offset: number, color: string) => calls.stops.push([kind, offset, color]),
  });
  const ctx: any = {
    lineWidth: 1,
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    rect: () => {},
    arcTo: () => {},
    fill: () => {},
    stroke: () => {},
    setTransform: () => {},
    setLineDash: () => {},
    save: () => {},
    restore: () => {},
    createLinearGradient: (...a: any[]) => {
      calls.linear.push(a);
      return gradient('linear');
    },
    createRadialGradient: (...a: any[]) => {
      calls.radial.push(a);
      return gradient('radial');
    },
    createConicGradient: opts.conic
      ? (...a: any[]) => {
          calls.conic.push(a);
          return gradient('conic');
        }
      : undefined,
  };
  // 用访问器记录赋值（render 结束会把泄漏属性归位，直接读 ctx.fillStyle 不可靠）
  let fill = '';
  let stroke = '';
  Object.defineProperty(ctx, 'fillStyle', {
    get: () => fill,
    set: (v: any) => {
      fill = v;
      calls.fillSet.push(v);
    },
  });
  Object.defineProperty(ctx, 'strokeStyle', {
    get: () => stroke,
    set: (v: any) => {
      stroke = v;
      calls.strokeSet.push(v);
    },
  });
  return { ctx, calls };
}

const LINEAR = {
  type: 'linear',
  from: [0, 0],
  to: [100, 0],
  stops: [
    [0, '#ff0000'],
    [1, '#0000ff'],
  ],
};

describe('声明式渐变', () => {
  it('linear：按 from/to 构造渐变、写入 fillStyle，并按 offset 顺序添加 stop', () => {
    const { ctx, calls } = makeCtx();
    const rect = new ICERect({ width: 100, height: 50, style: { fillGradient: LINEAR } });
    rect.renderTo(ctx);
    expect(calls.linear).toEqual([[0, 0, 100, 0]]);
    expect(calls.stops).toEqual([
      ['linear', 0, '#ff0000'],
      ['linear', 1, '#0000ff'],
    ]);
    expect(calls.fillSet[calls.fillSet.length - 1].__kind).toBe('linear');
  });

  it('radial：支持 center / radius / innerRadius', () => {
    const { ctx, calls } = makeCtx();
    const rect = new ICERect({
      width: 100,
      height: 100,
      style: {
        fillGradient: {
          type: 'radial',
          center: [50, 50],
          radius: 40,
          innerRadius: 5,
          stops: [
            [0, '#fff'],
            [1, '#000'],
          ],
        },
      },
    });
    rect.renderTo(ctx);
    expect(calls.radial).toEqual([[50, 50, 5, 50, 50, 40]]);
    expect(calls.fillSet[calls.fillSet.length - 1].__kind).toBe('radial');
  });

  it('conic：运行时支持时构造 conic 渐变', () => {
    const { ctx, calls } = makeCtx({ conic: true });
    const rect = new ICERect({
      width: 100,
      height: 100,
      style: {
        fillGradient: {
          type: 'conic',
          center: [50, 50],
          startAngle: 1,
          stops: [
            [0, '#fff'],
            [1, '#000'],
          ],
        },
      },
    });
    rect.renderTo(ctx);
    expect(calls.conic).toEqual([[1, 50, 50]]);
    expect(calls.fillSet[calls.fillSet.length - 1].__kind).toBe('conic');
  });

  it('conic 缺 API 时退回中间色纯色（不空白）', () => {
    const { ctx, calls } = makeCtx({ conic: false });
    const rect = new ICERect({
      width: 100,
      height: 100,
      style: {
        fillGradient: {
          type: 'conic',
          stops: [
            [0, '#111111'],
            [0.5, '#22ff22'],
            [1, '#333333'],
          ],
        },
      },
    });
    rect.renderTo(ctx);
    expect(calls.conic.length).toBe(0);
    expect(calls.fillSet[calls.fillSet.length - 1]).toBe('#22ff22');
  });

  it('无 stop 时不构造渐变，也不覆盖 fillStyle', () => {
    const { ctx, calls } = makeCtx();
    const rect = new ICERect({ width: 100, height: 50, style: { fillGradient: { type: 'linear', stops: [] } } });
    rect.renderTo(ctx);
    expect(calls.linear.length).toBe(0);
  });

  it('按描述引用缓存：重复渲染只构造一次；setState 换新描述后重建', () => {
    const { ctx, calls } = makeCtx();
    const desc = { ...LINEAR };
    const rect = new ICERect({ width: 100, height: 50, style: { fillGradient: desc } });
    rect.renderTo(ctx);
    rect.renderTo(ctx);
    expect(calls.linear.length).toBe(1); // 第二次命中缓存

    rect.setState({ style: { fillGradient: { ...LINEAR } } });
    rect.renderTo(ctx);
    expect(calls.linear.length).toBe(2); // 换对象 → 重建
  });

  it('渐变压过同层 fillStyle（不依赖 style 键序）', () => {
    const { ctx, calls } = makeCtx();
    // fillStyle 写在 fillGradient 之后：若按键序遍历，纯色会赢
    const rect = new ICERect({ width: 100, height: 50, style: { fillGradient: LINEAR, fillStyle: '#00ff00' } });
    rect.renderTo(ctx);
    expect(calls.fillSet).toContain('#00ff00');
    expect(calls.fillSet[calls.fillSet.length - 1].__kind).toBe('linear');
  });

  it('strokeGradient 写入 strokeStyle', () => {
    const { ctx, calls } = makeCtx();
    const rect = new ICERect({
      width: 100,
      height: 50,
      style: { strokeGradient: { ...LINEAR }, lineWidth: 4 },
    });
    rect.renderTo(ctx);
    expect(calls.strokeSet[calls.strokeSet.length - 1].__kind).toBe('linear');
  });

  it('stop 支持 {offset,color} 形式并按 offset 升序添加', () => {
    const { ctx, calls } = makeCtx();
    const rect = new ICERect({
      width: 100,
      height: 50,
      style: {
        fillGradient: {
          type: 'linear',
          stops: [
            { offset: 1, color: '#0000ff' },
            { offset: 0, color: '#ff0000' },
          ],
        },
      },
    });
    rect.renderTo(ctx);
    expect(calls.stops).toEqual([
      ['linear', 0, '#ff0000'],
      ['linear', 1, '#0000ff'],
    ]);
  });

  it('可序列化：JSON round-trip 后渐变描述仍在，且能重新渲染', () => {
    const makeIce = () => {
      const ice: any = new ICE();
      ice.evtBus = new EventBus();
      ice.childNodes = [];
      ice.toolNodes = [];
      ice.typeMapping = { ...componentTypeMap };
      return ice;
    };
    const ice: any = makeIce();
    const rect: any = new ICERect({ width: 100, height: 50, style: { fillGradient: LINEAR } });
    ice.addChild(rect);

    const json = new Serializer(ice).toJSONString();
    expect(json).toContain('fillGradient');
    expect(json).toContain('#ff0000');

    const ice2: any = makeIce();
    new Deserializer(ice2).fromJSONString(json);
    const restored: any = ice2.childNodes[0];
    expect(restored.state.style.fillGradient.type).toBe('linear');
    expect(restored.state.style.fillGradient.stops).toEqual(LINEAR.stops);

    // 还原后照样能画出来
    const { ctx, calls } = makeCtx();
    restored.renderTo(ctx);
    expect(calls.fillSet[calls.fillSet.length - 1].__kind).toBe('linear');
  });

  it('可写在主题 preset 里，并随主题热切换用新主题色重建', () => {
    const { ctx, calls } = makeCtx();
    const rect: any = new ICERect({ preset: 'gradient', width: 100, height: 200 });
    rect.renderTo(ctx);
    const firstStops = calls.stops.slice();
    expect(firstStops.length).toBe(2);

    // 热切换主题：preset 按新主题重新展开 → 渐变描述是新对象 → 重建
    const ice: any = new ICE();
    ice.childNodes = [];
    ice.toolNodes = [];
    ice.evtBus = { on: () => {}, off: () => {}, trigger: () => {} };
    ice.addChild(rect);
    ice.setTheme('dark');

    calls.stops.length = 0;
    rect.renderTo(ctx);
    expect(calls.stops.length).toBe(2);
  });
});
