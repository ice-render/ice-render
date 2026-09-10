/**
 * 视口变换（视图缩放/平移）单测。
 *
 * 验证：setViewport + 坐标换算；组件 render 时 CTM = viewport · composedMatrix；
 * 默认单位视口不影响既有渲染。
 */
import ICE from '../src/ICE';
import ICERect from '../src/graphic/shape/ICERect';

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
  closePath() {}
}

function makeCtx() {
  const calls: any = { setTransform: [] };
  const noop = () => {};
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    setTransform: (...a: any[]) => calls.setTransform.push(a),
    setLineDash: noop,
  };
  return { ctx, calls };
}

describe('ICE 视口变换', () => {
  beforeEach(() => {
    const root = require('../src/cross-platform/root').default;
    root.createPath2D = () => new FakePath2D();
  });

  it('setViewport + worldToScreen/screenToWorld', () => {
    const ice = new ICE();
    ice.setViewport(2, 100, 50);
    expect(ice.viewport).toEqual({ scale: 2, tx: 100, ty: 50 });
    expect(ice.worldToScreen(10, 20)).toEqual([120, 90]);
    expect(ice.screenToWorld(120, 90)).toEqual([10, 20]);
  });

  it('setViewport 非法 scale 兜底为 1', () => {
    const ice = new ICE();
    ice.setViewport(0, 10, 20);
    expect(ice.viewport.scale).toBe(1);
  });

  it('render 时 CTM = viewport · composedMatrix', () => {
    const ice: any = new ICE();
    ice.viewport = { scale: 2, tx: 100, ty: 50 };
    const { ctx, calls } = makeCtx();

    const rect = new ICERect({ left: 10, top: 20, width: 40, height: 30 });
    rect.ice = ice;
    rect.ctx = ctx;
    rect.render();

    // composed = [1,0,0,1,30,35]；viewport·composed = [2,0,0,2,160,120]
    expect(calls.setTransform[0]).toEqual([2, 0, 0, 2, 160, 120]);
  });

  it('默认单位视口不影响 render CTM', () => {
    const ice: any = new ICE();
    ice.viewport = { scale: 1, tx: 0, ty: 0 };
    const { ctx, calls } = makeCtx();

    const rect = new ICERect({ left: 10, top: 20, width: 40, height: 30 });
    rect.ice = ice;
    rect.ctx = ctx;
    rect.render();

    expect(calls.setTransform[0]).toEqual([1, 0, 0, 1, 30, 35]);
  });

  it('hitTest 命中组件 / 空白返回 null，视口缩放后仍正确', () => {
    const ice: any = new ICE();
    const rect = new ICERect({ left: 10, top: 20, width: 40, height: 30 });
    rect.ice = ice;
    ice.childNodes = [rect];
    ice.toolNodes = [];
    rect.getMinBoundingBox(true); // 确保 composedMatrix 就绪

    // 单位视口：屏幕即世界，rect 中心 (30,35)
    expect(ice.hitTest(30, 35).constructor.name).toBe('ICERect');
    expect(ice.hitTest(999, 999)).toBeNull();

    // 缩放 2x + 平移：世界中心 (30,35) → 屏幕 (160,170)
    ice.viewport = { scale: 2, tx: 100, ty: 100 };
    expect(ice.hitTest(160, 170).constructor.name).toBe('ICERect');
    expect(ice.hitTest(999, 999)).toBeNull();
  });
});
