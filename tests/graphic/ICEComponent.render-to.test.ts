/**
 * ICEComponent.renderTo / render 拆分与离屏渲染目标注入的单测。
 *
 * 验证：render() 语义不变；renderTo(targetCtx, baseMatrix) 把内容画到目标 ctx、
 * 最终 CTM = baseMatrix · composedMatrix、渲染后恢复 this.ctx 并清 dirty。
 */
import ICERect from '../../src/graphic/shape/ICERect';

class FakePath2D {
  _isPolyfill = true;
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
  arcTo(...a: any[]) {
    this._commands.push(['arcTo', ...a]);
  }
  closePath() {
    this._closed = true;
  }
}

function makeCtx() {
  const calls: any = { setTransform: [], fill: 0, stroke: 0 };
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
    arcTo: noop,
    fill: () => calls.fill++,
    stroke: () => calls.stroke++,
    setTransform: (...a: any[]) => calls.setTransform.push(a),
    setLineDash: noop,
    save: noop,
    restore: noop,
  };
  return { ctx, calls };
}

describe('ICEComponent.renderTo 离屏渲染目标注入', () => {
  beforeEach(() => {
    const root = require('../../src/cross-platform/root').default;
    root.createPath2D = () => new FakePath2D();
  });

  it('renderTo 把内容画到目标 ctx，且不污染原 ctx', () => {
    const orig = makeCtx();
    const target = makeCtx();
    const rect = new ICERect({ left: 10, top: 20, width: 40, height: 30 });
    rect.ctx = orig.ctx;

    rect.renderTo(target.ctx, [1, 0, 0, 1, -100, -200]);

    expect(target.calls.fill).toBeGreaterThan(0);
    expect(target.calls.stroke).toBeGreaterThan(0);
    expect(orig.calls.fill).toBe(0);
    expect(orig.calls.stroke).toBe(0);
    expect(rect.ctx).toBe(orig.ctx); // 渲染后 ctx 恢复
    expect(rect.dirty).toBe(false);
  });

  it('baseMatrix 参与最终 CTM：setTransform = base · composed', () => {
    const target = makeCtx();
    const rect = new ICERect({ left: 10, top: 20, width: 40, height: 30 });
    rect.ctx = target.ctx;

    rect.renderTo(target.ctx, [1, 0, 0, 1, -100, -200]);

    // origin=localCenter → localOrigin [20,15]，left/top=10/20，linear=identity
    // composed = [1,0,0,1,30,35]；base·composed = [1,0,0,1,-70,-165]
    expect(target.calls.setTransform[0]).toEqual([1, 0, 0, 1, -70, -165]);
  });

  it('无 baseMatrix 时 render() 与 renderTo() 的变换一致', () => {
    const plain = makeCtx();
    const to = makeCtx();
    const a = new ICERect({ left: 5, top: 7, width: 20, height: 10 });
    const b = new ICERect({ left: 5, top: 7, width: 20, height: 10 });
    a.ctx = plain.ctx;
    b.ctx = to.ctx;

    a.render();
    b.renderTo(to.ctx);

    expect(to.calls.setTransform[0]).toEqual(plain.calls.setTransform[0]);
    expect(to.calls.fill).toBe(plain.calls.fill);
  });
});
