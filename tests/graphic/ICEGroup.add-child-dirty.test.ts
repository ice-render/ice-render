/**
 * `addChild(child, false)` 不得吞掉「从未渲染过的组件」的脏标记。
 *
 * 背景：`dirty` 在引擎里同时承担两个语义 ——「本帧要重绘」和「几何缓存是否有效」。
 * `ICEPath.doRender` 只在 `this.dirty` 为真时调用 `createPathObject()`，因此一个从未绘制过、
 * 却被 `addChild(..., false)` 置干净的组件，路径缓存永远不会建立，**首次上屏自身是空路径**。
 *
 * 线上表现（ice-web-components 的 UIButton）：构造函数里 `this.addChild(this.label, false)`
 * 把自己置干净 —— 按钮的圆角矩形背景/边框全都不画，只剩白底白字的标签，
 * 页面上表现为「Primary / Danger / Small / Large 按钮完全看不见」。
 *
 * 2026-09-12 修复：新增 `ICEComponent.__everRendered`，`markDirty=false` 只表示「不要主动置脏」，
 * 对从未渲染过的组件不再强制置干净。
 */
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';

class FakePath2D {
  _isPolyfill = true;
  _commands: any[] = [];
  _closed = false;
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
  closePath() {
    this._closed = true;
  }
}

function makeCtx() {
  const calls = { fill: 0, stroke: 0 };
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
    setTransform: noop,
    setLineDash: noop,
    save: noop,
    restore: noop,
  };
  return { ctx, calls };
}

/** 复刻 UIButton 的构造方式：自身是「有填充的容器」，且构造期用 markDirty=false 挂子组件。 */
class FakeButton extends ICEGroup {
  constructor(props: any = {}) {
    super({ fill: true, stroke: true, ...props });
    this.addChild(new ICERect({ width: 4, height: 4 }), false);
  }
}

describe('addChild(markDirty=false) 与首次渲染', () => {
  beforeEach(() => {
    const root = require('../../src/cross-platform/root').default;
    root.createPath2D = () => new FakePath2D();
  });

  it('从未渲染过的容器被 addChild(..., false) 后仍保持 dirty', () => {
    const group = new ICEGroup({ width: 100, height: 50, fill: true, stroke: true });
    expect(group.dirty).toBe(true);

    group.addChild(new ICERect({ width: 10, height: 10 }), false);
    expect(group.dirty).toBe(true);
  });

  it('首次渲染会构建自身路径（UIButton 白底白字的根因）', () => {
    const button = new FakeButton({ width: 96, height: 36 });
    const { ctx, calls } = makeCtx();
    button.ctx = ctx;

    // 修复前：构造期的 addChild(..., false) 把 dirty 置成 false，
    // 首帧 doRender 跳过 createPathObject()，path2D 是一条空路径。
    expect((button.path2D as any)._commands.length).toBe(0);
    button.render();

    expect((button.path2D as any)._commands.length).toBeGreaterThan(0);
    expect(calls.fill).toBeGreaterThan(0);
    expect(calls.stroke).toBeGreaterThan(0);
  });

  it('已渲染过的容器仍保留 markDirty=false 的批量优化语义', () => {
    const group = new ICEGroup({ width: 100, height: 50, fill: true, stroke: true });
    const { ctx } = makeCtx();
    group.ctx = ctx;
    group.render();
    expect(group.dirty).toBe(false);

    // 已经上屏过 → markDirty=false 照旧只表示「不主动置脏」，不会一直挂脏标记
    group.addChild(new ICERect({ width: 10, height: 10 }), false);
    expect(group.dirty).toBe(false);

    // markDirty=true（默认）仍然置脏
    group.addChild(new ICERect({ width: 10, height: 10 }));
    expect(group.dirty).toBe(true);
  });
});
