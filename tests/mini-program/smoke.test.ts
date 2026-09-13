/**
 * 小程序宿主契约：**引擎在小程序形状的运行时里必须能跑**。
 *
 * 不跑真机、不开微信开发者工具：把 `document` / `window` / `Path2D` / `requestAnimationFrame` /
 * `FontFace` / `OffscreenCanvas` / `devicePixelRatio` 全部摘掉，只留 `wx.*`，
 * 画布对象就是**小程序 canvas 节点本来的样子**（只有 `width` / `height` / `getContext`）。
 *
 * 这一层能拦住的，是「引擎偷偷用了浏览器专有 API」这类在真机上必崩、在 jsdom 里却看不见的问题。
 * 历史上已经因此踩过三次（本文件把它们全部钉死）：
 *   1. 无 rAF 时 `FrameManager.start()` 启动即抛错；
 *   2. 无原生 `Path2D` 时 `path.arc is not a function`；
 *   3. `ICE.init()` 无条件调 `canvasEl.getBoundingClientRect()`（小程序 canvas 节点没有这个方法）；
 *   4. 文本量测在无 DOM 时靠「抛异常 → 吞掉」降级，会在小程序控制台刷错误日志；
 *   5. 老基础库没有 `wx.createOffscreenCanvas` 时离屏缓存抛错，异常发生在帧回调里 → 白屏。
 */
import { installMiniProgramEnv, waitFrames } from './env';

// 适配层在模块加载时读全局：必须先搭环境，再 require 引擎
const env = installMiniProgramEnv();
const engine = require('../../src');

/** 记录创建过的实例：测试结束前要先停掉帧循环，否则定时器会在环境拆掉之后继续跑 */
const ices: any[] = [];

function createIce(canvas: any, options?: any): any {
  const ice = new engine.ICE();
  ice.init(canvas.getContext('2d'), options);
  ices.push(ice);
  return ice;
}

function buildSampleScene(ice: any): void {
  ice.addChild(
    new engine.ICERect({
      left: 40,
      top: 40,
      width: 160,
      height: 80,
      style: { fillStyle: '#e0e7ff', strokeStyle: '#4f46e5' },
    })
  );
  ice.addChild(
    new engine.ICEText({ left: 60, top: 70, text: '小程序', style: { fillStyle: '#0f172a', fontSize: 16 } })
  );
  ice.addChild(
    new engine.ICECircle({ left: 260, top: 40, radius: 40, style: { fillStyle: '#fef3c7', strokeStyle: '#d97706' } })
  );
  ice.addChild(
    new engine.ICEPolyLine({
      startPoint: [200, 80],
      endPoint: [260, 80],
      arrow: 'end',
      style: { strokeStyle: '#64748b' },
    })
  );
}

afterAll(() => {
  ices.forEach((ice) => {
    try {
      ice.destroy();
    } catch (err) {
      /* 已经销毁过就忽略 */
    }
  });
  env.restore();
});

describe('小程序形状环境 · 内核冒烟', () => {
  it('环境确实是「小程序形状」：没有 document / window / Path2D / rAF', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    expect(typeof (global as any).Path2D).toBe('undefined');
    expect(typeof (global as any).requestAnimationFrame).toBe('undefined');
    expect(typeof (global as any).wx).toBe('object');
  });

  it('ICE.init 直接吃小程序 canvas 节点（只有 width/height/getContext），绕开 DOM', () => {
    const canvas = env.makeCanvas(750, 600);
    const ice = createIce(canvas);
    expect(ice.canvasWidth).toBe(750);
    expect(ice.canvasHeight).toBe(600);
    // 没有 getBoundingClientRect 时，读回的是「原点在 0,0、尺寸等于画布」的矩形
    expect(ice.canvasBoundingClientRect.left).toBe(0);
    expect(ice.canvasBoundingClientRect.width).toBe(750);
  });

  it('dpr>1：backing store 放大、逻辑尺寸不变（无 getBoundingClientRect 也不许炸）', () => {
    const canvas = env.makeCanvas(750, 600);
    createIce(canvas, { dpr: 2 });
    expect(canvas.width).toBe(1500);
    expect(canvas.height).toBe(1200);
  });

  it('建图元 + 无 rAF（定时器兜底）出帧，绘制命令落在小程序 ctx 上', async () => {
    const canvas = env.makeCanvas(750, 600);
    const ice = createIce(canvas);
    buildSampleScene(ice);

    await waitFrames(150);

    const calls = env.allCalls();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls).toContain('fillText');
    expect(calls).toContain('lineTo');
  });

  it('没有原生 Path2D 时，路径命令被重放到 ctx（圆走 arc/ellipse）', async () => {
    const canvas = env.makeCanvas(400, 300);
    const ice = createIce(canvas);
    ice.addChild(new engine.ICECircle({ left: 20, top: 20, radius: 30, style: { fillStyle: '#fee2e2' } }));

    await waitFrames(120);

    const calls = env.allCalls();
    expect(calls.includes('arc') || calls.includes('ellipse')).toBe(true);
  });

  it('离屏缓存走 wx.createOffscreenCanvas（走的是小程序分支，不是 document）', async () => {
    const before = env.stats.offscreen;
    const canvas = env.makeCanvas(750, 600);
    const ice = createIce(canvas);
    buildSampleScene(ice);
    await waitFrames(200);
    expect(env.stats.offscreen).toBeGreaterThan(before);
  });

  it('老基础库没有 wx.createOffscreenCanvas：不许崩，降级为直接落墨', async () => {
    const wxAny: any = (global as any).wx;
    const saved = wxAny.createOffscreenCanvas;
    delete wxAny.createOffscreenCanvas; // 模拟老基础库
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const canvas = env.makeCanvas(750, 600);
      const ice = createIce(canvas);
      buildSampleScene(ice);

      await waitFrames(200);

      // 没有离屏 canvas 也要把图画出来（走直接落墨）
      const calls = env.allCalls();
      expect(calls.length).toBeGreaterThan(0);
      expect(calls).toContain('fillText');
      expect(calls).toContain('fill');
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      wxAny.createOffscreenCanvas = saved;
      errorSpy.mockRestore();
    }
  });

  it('老基础库（measureText 只有 width）：文本量测优雅降级，不抛错也不刷错误日志', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const canvas = env.makeCanvas(400, 300, { legacyTextMetrics: true });
      const ice = createIce(canvas);
      expect(() => ice.addChild(new engine.ICEText({ left: 20, top: 20, text: '老基础库' }))).not.toThrow();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('命中测试与包围盒可用（不需要 DOM 事件）', () => {
    const canvas = env.makeCanvas(400, 300);
    const ice = createIce(canvas);
    const rect = new engine.ICERect({ left: 40, top: 40, width: 160, height: 80 });
    ice.addChild(rect);
    expect(ice.findComponent(rect.state.id)).toBe(rect);
    const box = rect.getMinBoundingBox(true);
    expect(box.center[0]).toBeCloseTo(120, 5);
    expect(box.center[1]).toBeCloseTo(80, 5);
  });

  it('小程序触摸事件（bindtouchstart/move/end）被归一化成鼠标语义事件 + 画布内坐标', async () => {
    const canvas = env.makeCanvas(750, 600);
    const ice = createIce(canvas);
    const rect = new engine.ICERect({ left: 40, top: 40, width: 160, height: 80 });
    ice.addChild(rect);

    // 总线层只认鼠标语义名（touch → mouse 的映射由派发器完成），上层代码零改动。
    // 挂在总线上而不是挂在组件上：命中之后事件可能落到变换手柄上，这里要钉的是**输入契约**本身。
    const received: any[] = [];
    ['mousedown', 'mousemove', 'mouseup'].forEach((name) => {
      ice.evtBus.on(name, (evt: any) => {
        received.push({
          name,
          x: evt.offsetX,
          y: evt.offsetY,
          mx: evt.movementX,
          my: evt.movementY,
          target: evt.target && evt.target.state ? evt.target.state.id : null,
        });
      });
    });

    // 宿主把 wx 的 touch 转成引擎总线上的事件：坐标一律是**画布内坐标**
    //（引擎在没有 getBoundingClientRect 时按 (0,0) 兜底，正好对上这个口径）
    const touch = (type: string, x: number, y: number) => {
      const point = { clientX: x, clientY: y, identifier: 1 };
      ice.evtBus.trigger(`ICE_${type.toUpperCase()}`, {
        type,
        touches: type === 'touchend' ? [] : [point],
        changedTouches: [point],
        timeStamp: Date.now(),
      });
    };

    // 命中检测依赖渲染时合成的矩阵（`state.composedMatrix`），首帧之前 `hitTest` 会落空 ——
    // 真实时序里触摸必然发生在首帧之后，这里如实等待一帧。
    await waitFrames(80);
    expect(ice.hitTest(80, 60)).toBe(rect);

    // 起点与终点都落在矩形内（mouseup 会重新做命中检测；移动事件走缓存目标）
    touch('touchstart', 80, 60);
    touch('touchmove', 180, 160);
    touch('touchend', 120, 80);

    expect(received.map((item) => item.name)).toEqual(['mousedown', 'mousemove', 'mouseup']);
    expect(received[0]).toMatchObject({ x: 80, y: 60 });
    expect(received[1]).toMatchObject({ x: 180, y: 160 });
    expect(received[2]).toMatchObject({ x: 120, y: 80 });
    // touchstart 必须命中图元（否则后面的拖拽/选中都无从谈起）
    expect(received[0].target).toBe(rect.state.id);
    // 触摸事件没有原生 movement，引擎用「与上一次坐标的差」补算（拖拽/手柄靠它）
    expect(received[1].mx).toBe(100);
    expect(received[1].my).toBe(100);
  });

  it('序列化 → 反序列化往返不丢图元', () => {
    const canvas = env.makeCanvas(400, 300);
    const ice = createIce(canvas);
    ice.addChild(new engine.ICERect({ left: 20, top: 20, width: 120, height: 60 }));
    ice.addChild(new engine.ICEText({ left: 30, top: 30, text: '嗨' }));
    const json = ice.toJSONString();

    const restored = createIce(env.makeCanvas(400, 300));
    restored.fromJSONString(json);

    expect(restored.childNodes.length).toBe(2);
  });

  it('SVG 导出可用（同一套命令流，不依赖 canvas）', () => {
    const canvas = env.makeCanvas(400, 300);
    const ice = createIce(canvas);
    ice.addChild(new engine.ICERect({ left: 20, top: 20, width: 120, height: 60, style: { fillStyle: '#dbeafe' } }));
    expect(ice.toSvg({})).toContain('<svg');
  });

  it('全程没有触碰「小程序 Canvas 2D 子集之外」的成员', () => {
    expect(env.unknownAccesses()).toEqual([]);
  });
});
