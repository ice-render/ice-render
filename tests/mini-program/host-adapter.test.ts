/**
 * 小程序宿主适配层（`examples/mini-program/host-adapter.js`）的坐标换算。
 *
 * 这层最容易错、也最不显眼：小程序触摸事件给的是**视口坐标**，而引擎按**画布内坐标**
 * 解释输入。少减一次 `rect.left/top`，命中就整体偏移，而且画布越靠下偏移越大。
 */
import { installMiniProgramEnv, waitFrames } from './env';

const env = installMiniProgramEnv();
const engine = require('../../src');
const { createHostAdapter } = require('../../examples/mini-program/host-adapter');

/** 桩：模拟 wx.createSelectorQuery().in(this).select('#id').boundingClientRect(cb).exec() */
function stubSelectorQuery(rect: any): void {
  (global as any).wx.createSelectorQuery = () => ({
    in: () => ({
      select: () => ({
        boundingClientRect: (cb: any) => ({
          exec: () => cb(rect),
        }),
      }),
    }),
  });
}

const ices: any[] = [];

afterAll(() => {
  ices.forEach((ice) => {
    try {
      ice.destroy();
    } catch (err) {
      /* 忽略 */
    }
  });
  env.restore();
});

describe('小程序宿主适配层', () => {
  it('把触摸的视口坐标换算成画布内坐标后再投递给引擎', async () => {
    // 画布在页面里偏右下：触摸点 (150, 260) 落在画布内 (50, 60)
    stubSelectorQuery({ left: 100, top: 200, width: 750, height: 600 });

    const canvas = env.makeCanvas(750, 600);
    const ice: any = new engine.ICE();
    ice.init(canvas.getContext('2d'));
    ices.push(ice);

    const rect = new engine.ICERect({ left: 20, top: 20, width: 200, height: 120 });
    ice.addChild(rect);

    const adapter = createHostAdapter({ ice, component: {}, canvasId: 'ice-canvas' });
    await adapter.refreshRect();

    const seen: any[] = [];
    ['mousedown', 'mousemove', 'mouseup'].forEach((name) => {
      ice.evtBus.on(name, (evt: any) => seen.push({ x: evt.offsetX, y: evt.offsetY }));
    });

    await waitFrames(80); // 命中检测依赖首帧合成的矩阵
    adapter.onTouchStart({ touches: [{ clientX: 150, clientY: 260, identifier: 7 }] });
    adapter.onTouchMove({ touches: [{ clientX: 250, clientY: 360, identifier: 7 }] });
    adapter.onTouchEnd({ changedTouches: [{ clientX: 250, clientY: 360, identifier: 7 }] });

    expect(seen).toEqual([
      { x: 50, y: 60 },
      { x: 150, y: 160 },
      { x: 150, y: 160 },
    ]);
  });

  it('拿不到画布矩形时退化为「视口坐标即画布坐标」，不抛错', async () => {
    stubSelectorQuery(null);

    const canvas = env.makeCanvas(400, 300);
    const ice: any = new engine.ICE();
    ice.init(canvas.getContext('2d'));
    ices.push(ice);

    const adapter = createHostAdapter({ ice, component: {}, canvasId: 'ice-canvas' });
    await adapter.refreshRect();

    const seen: any[] = [];
    ice.evtBus.on('mousedown', (evt: any) => seen.push({ x: evt.offsetX, y: evt.offsetY }));
    expect(() => adapter.onTouchStart({ touches: [{ clientX: 30, clientY: 40 }] })).not.toThrow();
    expect(seen).toEqual([{ x: 30, y: 40 }]);
  });
});
