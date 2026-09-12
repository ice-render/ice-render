/**
 * 子树不透明度（`state.opacity`）回归测试。
 *
 * 需求来源：淡入淡出（Modal / Drawer / Message / Tooltip）必须让**整棵子树**一起变透明。
 * 引擎渲染是「把树拉平、逐个组件独立绘制」，所以祖先的不透明度要靠渲染时相乘继承 ——
 * 仅设置某个组件自己的 `style.globalAlpha` 只影响它自身的绘制。
 *
 * 约定：
 * - `state.opacity` ∈ [0,1]，默认 1；最终 alpha = 自身 opacity × 所有祖先 opacity × style.globalAlpha；
 * - 不透明度 ≠ 1 时按「非不透明落墨」处理（不参与离屏缓存、脏矩形回退更保守）。
 */
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';

class FakePath2D {
  _isPolyfill = true;
  _commands: any[] = [];
  rect(...a: any[]) {
    this._commands.push(['rect', ...a]);
  }
  moveTo(...a: any[]) {
    this._commands.push(['moveTo', ...a]);
  }
  lineTo(...a: any[]) {
    this._commands.push(['lineTo', ...a]);
  }
  arcTo(...a: any[]) {
    this._commands.push(['arcTo', ...a]);
  }
  closePath() {}
}

/** 记录「绘制时」的 globalAlpha（fill 调用那一刻的 ctx.globalAlpha）。 */
function makeCtx() {
  const alphas: number[] = [];
  const ctx: any = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    rect() {},
    clip() {},
    setTransform() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    setLineDash() {},
    fill: () => alphas.push(ctx.globalAlpha),
    stroke: () => alphas.push(ctx.globalAlpha),
    measureText: (s: string) => ({ width: s.length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  };
  return { ctx, alphas };
}

describe('子树不透明度 opacity', () => {
  beforeEach(() => {
    const root = require('../../src/cross-platform/root').default;
    root.createPath2D = () => new FakePath2D();
  });

  it('组件自身 opacity 生效（绘制时 alpha = opacity）', () => {
    const { ctx, alphas } = makeCtx();
    const rect = new ICERect({ left: 0, top: 0, width: 20, height: 20, opacity: 0.5 });
    rect.ctx = ctx;
    rect.render();
    expect(alphas[0]).toBe(0.5);
  });

  it('祖先 opacity 作用于后代（整棵子树一起变透明）', () => {
    const { ctx, alphas } = makeCtx();
    const parent = new ICEGroup({ left: 0, top: 0, width: 100, height: 100, opacity: 0.5 });
    const child = new ICERect({ left: 10, top: 10, width: 20, height: 20 });
    parent.addChild(child, false);
    child.ctx = ctx;
    child.render();
    expect(alphas[0]).toBe(0.5);
  });

  it('多层 opacity 相乘，并与 style.globalAlpha 叠加', () => {
    const { ctx, alphas } = makeCtx();
    const outer = new ICEGroup({ left: 0, top: 0, width: 200, height: 200, opacity: 0.5 });
    const inner = new ICEGroup({ left: 0, top: 0, width: 100, height: 100, opacity: 0.5 });
    const leaf = new ICERect({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      style: { fillStyle: '#000000', globalAlpha: 0.8 },
    });
    outer.addChild(inner, false);
    inner.addChild(leaf, false);
    leaf.ctx = ctx;
    leaf.render();
    expect(alphas[0]).toBeCloseTo(0.5 * 0.5 * 0.8, 5);
  });

  it('opacity 为 1（默认）时不写 ctx.globalAlpha，不污染后续组件', () => {
    const { ctx, alphas } = makeCtx();
    const parent = new ICEGroup({ left: 0, top: 0, width: 100, height: 100 });
    const child = new ICERect({ left: 0, top: 0, width: 20, height: 20, opacity: 0.4 });
    const sibling = new ICERect({ left: 0, top: 0, width: 20, height: 20 });
    parent.addChild(child, false);
    parent.addChild(sibling, false);

    child.ctx = ctx;
    child.render();
    sibling.ctx = ctx;
    sibling.render();

    // 每个组件都是 fill + stroke 两次落墨：前两个是 child（0.4），后两个是 sibling（1）
    expect(alphas.slice(0, 2)).toEqual([0.4, 0.4]);
    expect(alphas.slice(-2)).toEqual([1, 1]); // 第二个组件不受第一个的 alpha 影响
  });

  it('opacity ≠ 1 视为非不透明落墨（不参与离屏缓存）', () => {
    const { isOpaqueDrawing } = require('../../src/renderer/dirty-rect-util');
    expect(isOpaqueDrawing({ style: { fillStyle: '#ffffff', globalAlpha: 1 }, opacity: 0.5 })).toBe(false);
    expect(isOpaqueDrawing({ style: { fillStyle: '#ffffff', globalAlpha: 1 }, opacity: 1 })).toBe(true);
  });
});
