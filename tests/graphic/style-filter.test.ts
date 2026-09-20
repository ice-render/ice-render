/**
 * `style.filter`（`ctx.filter`）的契约。
 *
 * 定位：**它不是引擎新造的属性**，而是"style 一律透传给 ctx"这条既有机制自动带来的现代 Canvas 能力
 * （`filter` 是 Canvas 2D 的成员，支持 `blur()` / `grayscale()` / `drop-shadow()` 等 CSS 滤镜函数）。
 * 既有的三条机制决定了它今天就能用：
 *   ① `applyStyleToCtx()` 把 style 的键逐个写到 ctx；
 *   ② `LEAKY_CTX_PROPS` 里有 `['filter', 'none']` —— 画完复位，不会漏给同一帧后面的组件；
 *   ③ `ObjectCache.__styleKey()` 把它算进内容指纹（否则"改了滤镜画面不动"）。
 *
 * 这里钉的是最容易退化的那一环：**透传本身**（写进 ctx、绘制那一刻生效、画完复位）。
 * 渲染观感（真的糊了没有）由浏览器负责，不属于单测能断言的范围。
 */
import ICERect from '../../src/graphic/shape/ICERect';

class FakePath2D {
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
  roundRect(...a: any[]) {
    this._commands.push(['roundRect', ...a]);
  }
  closePath() {}
}

/** 记录「fill 那一刻」的 ctx.filter：透传是否生效，就看这里读到的值。 */
function makeCtx() {
  const seen: any[] = [];
  const ctx: any = {
    filter: 'none',
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
    fill: () => seen.push(ctx.filter),
    stroke: () => {},
  };
  return { ctx, seen };
}

describe('style.filter（ctx.filter）', () => {
  beforeEach(() => {
    const root = require('../../src/cross-platform/root').default;
    root.createPath2D = () => new FakePath2D();
  });

  it('写进 ctx：绘制那一刻 filter 就是调用方给的值', () => {
    const { ctx, seen } = makeCtx();
    const rect = new ICERect({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      style: { fillStyle: '#f00', filter: 'blur(3px)' },
    });
    rect.ctx = ctx;
    rect.render();
    expect(seen[0]).toBe('blur(3px)');
  });

  it('画完复位成 none：不会漏给同一帧后面绘制的组件', () => {
    const { ctx } = makeCtx();
    const rect = new ICERect({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      style: { fillStyle: '#f00', filter: 'grayscale(1)' },
    });
    rect.ctx = ctx;
    rect.render();
    // 组件渲染必须"自包含"：脏矩形局部重绘 / 离屏缓存的像素契约都建立在这一点上
    expect(ctx.filter).toBe('none');
  });

  it('没写 filter 的组件不会把上一次的滤镜带进来（绘制时是 none）', () => {
    const { ctx, seen } = makeCtx();
    const first = new ICERect({ left: 0, top: 0, width: 20, height: 20, style: { filter: 'blur(8px)' } });
    first.ctx = ctx;
    first.render();

    const second = new ICERect({ left: 0, top: 0, width: 20, height: 20, style: { fillStyle: '#0f0' } });
    second.ctx = ctx;
    second.render();
    expect(seen[1]).toBe('none');
  });
});
