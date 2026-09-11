/**
 * zoomAt：以屏幕点为锚点的视口缩放原语。
 *
 * 核心不变量：缩放前后，锚点下的世界坐标必须映射回同一屏幕位置（锚点不动）。
 * 约束：只改视口状态，严禁修改组件 state（与 setViewport 同一铁律）。
 */
import ICE from '../src/ICE';
import EventBus from '../src/event/EventBus';
import ICERect from '../src/graphic/shape/ICERect';

function makeIce() {
  const ice: any = new ICE();
  // 未走 init()：手工挂一条事件总线，才能 addChild（引擎正常用法是 init 里创建）
  ice.evtBus = new EventBus();
  ice.setViewport(1, 0, 0);
  return ice;
}

describe('ICE.zoomAt 锚点缩放', () => {
  it('缩放后锚点下的世界坐标仍落在同一屏幕位置', () => {
    const ice = makeIce();
    const [wx, wy] = ice.screenToWorld(300, 200);

    ice.zoomAt(300, 200, 2);

    expect(ice.viewport.scale).toBe(2);
    expect(ice.worldToScreen(wx, wy)).toEqual([300, 200]);
  });

  it('translate 按 x - world * scale 反解', () => {
    const ice = makeIce();
    ice.zoomAt(100, 50, 2);
    expect(ice.viewport.tx).toBe(100 - 100 * 2);
    expect(ice.viewport.ty).toBe(50 - 50 * 2);
  });

  it('已有平移时锚点依然不动', () => {
    const ice = makeIce();
    ice.setViewport(1.5, -40, 25);
    const [wx, wy] = ice.screenToWorld(220, 140);

    ice.zoomAt(220, 140, 0.5);

    expect(ice.viewport.scale).toBeCloseTo(0.75, 10);
    const [sx, sy] = ice.worldToScreen(wx, wy);
    expect(sx).toBeCloseTo(220, 10);
    expect(sy).toBeCloseTo(140, 10);
  });

  it('连续缩放锚点保持不动（滚轮连滚场景）', () => {
    const ice = makeIce();
    const anchor = [180, 90];
    const [wx, wy] = ice.screenToWorld(anchor[0], anchor[1]);

    for (let i = 0; i < 12; i++) {
      ice.zoomAt(anchor[0], anchor[1], 1.1);
    }

    const [sx, sy] = ice.worldToScreen(wx, wy);
    expect(sx).toBeCloseTo(anchor[0], 6);
    expect(sy).toBeCloseTo(anchor[1], 6);
  });

  it('scale 被钳制在 [minScale, maxScale] 内', () => {
    const ice = makeIce();
    for (let i = 0; i < 100; i++) ice.zoomAt(0, 0, 2, 0.5, 4);
    expect(ice.viewport.scale).toBe(4);

    for (let i = 0; i < 100; i++) ice.zoomAt(0, 0, 0.5, 0.5, 4);
    expect(ice.viewport.scale).toBe(0.5);
  });

  it('非正数 / 非有限值的 factor 直接忽略', () => {
    const ice = makeIce();
    ice.setViewport(2, 10, 20);
    ice.zoomAt(5, 5, 0);
    ice.zoomAt(5, 5, -3);
    ice.zoomAt(5, 5, NaN);
    ice.zoomAt(5, 5, Infinity);
    expect(ice.viewport).toEqual({ scale: 2, tx: 10, ty: 20 });
  });

  it('已到钳制边界时不再改动 translate', () => {
    const ice = makeIce();
    ice.setViewport(4, 7, -9);
    ice.zoomAt(100, 100, 2, 0.5, 4);
    expect(ice.viewport).toEqual({ scale: 4, tx: 7, ty: -9 });
  });

  it('只改视口，不修改任何组件 state', () => {
    const ice = makeIce();
    const rect: any = new ICERect({ left: 30, top: 40, width: 60, height: 20 });
    ice.addChild(rect);
    const snapshot = { left: rect.state.left, top: rect.state.top, width: rect.state.width, height: rect.state.height };

    ice.zoomAt(123, 45, 3);

    expect(rect.state.left).toBe(snapshot.left);
    expect(rect.state.top).toBe(snapshot.top);
    expect(rect.state.width).toBe(snapshot.width);
    expect(rect.state.height).toBe(snapshot.height);
    expect(ice.viewport.scale).toBe(3);
  });

  it('返回 this 支持链式调用', () => {
    const ice = makeIce();
    expect(ice.zoomAt(0, 0, 1.2)).toBe(ice);
  });
});
