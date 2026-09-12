/**
 * 子树裁剪（`clipChildren`）回归测试。
 *
 * 需求来源：滚动容器（ScrollPane）必须把子组件裁在自己的可视区内 —— 引擎此前只有
 * 脏矩形用的 `ctx.clip`，没有任何「容器裁剪后代」的能力。
 *
 * 约定：
 * - `state.clipChildren === true` 的容器，会把**所有后代**裁到自己的盒子内；
 * - 裁剪在**设备空间**建立（`ctx.setTransform(1,0,0,1,0,0)` → `rect` → `clip` → 复位 CTM），
 *   与脏矩形路径同一套做法：组件自己后续 `setTransform` 不会清掉已建立的 clip；
 * - 离屏缓存的位图拿不到祖先裁剪，因此被裁剪的组件不参与缓存（见 ObjectCache.isCachable）；
 * - 命中检测同样跳过裁剪区之外的点（scrolled-out 的组件不该被点到）。
 */
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import { hitTestComponents } from '../../src/util/data-util';

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
  const log: string[] = [];
  const clips: number[][] = [];
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    beginPath: () => log.push('beginPath'),
    closePath: () => log.push('closePath'),
    rect: (...a: number[]) => {
      log.push('rect');
      (ctx as any).__lastRect = a;
    },
    clip: () => {
      log.push('clip');
      clips.push((ctx as any).__lastRect || []);
    },
    setTransform: () => log.push('setTransform'),
    moveTo: () => {},
    lineTo: () => {},
    arcTo: () => {},
    fill: () => log.push('fill'),
    stroke: () => log.push('stroke'),
    setLineDash: () => {},
    measureText: (s: string) => ({ width: s.length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  return { ctx, log, clips };
}

describe('子树裁剪 clipChildren', () => {
  beforeEach(() => {
    const root = require('../../src/cross-platform/root').default;
    root.createPath2D = () => new FakePath2D();
  });

  it('普通容器不裁剪后代', () => {
    const { ctx, clips } = makeCtx();
    const parent = new ICEGroup({ left: 0, top: 0, width: 100, height: 100 });
    const child = new ICERect({ left: 200, top: 50, width: 20, height: 20 });
    parent.addChild(child, false);
    child.ctx = ctx;

    child.render();
    expect(clips).toHaveLength(0);
  });

  it('clipChildren 容器把后代裁到自己的盒子里', () => {
    const { ctx, clips } = makeCtx();
    const parent = new ICEGroup({ left: 0, top: 0, width: 100, height: 100, clipChildren: true });
    const child = new ICERect({ left: 200, top: 50, width: 20, height: 20 });
    parent.addChild(child, false);
    child.ctx = ctx;

    child.render();
    expect(clips).toEqual([[0, 0, 100, 100]]);
  });

  it('裁剪对子孙全部生效，且多层嵌套会依次求交', () => {
    const { ctx, clips } = makeCtx();
    const outer = new ICEGroup({ left: 0, top: 0, width: 200, height: 200, clipChildren: true });
    const inner = new ICEGroup({ left: 10, top: 10, width: 50, height: 50, clipChildren: true });
    const leaf = new ICERect({ left: 5, top: 5, width: 10, height: 10 });
    outer.addChild(inner, false);
    inner.addChild(leaf, false);
    leaf.ctx = ctx;

    leaf.render();
    expect(clips).toEqual([
      [0, 0, 200, 200],
      [10, 10, 50, 50],
    ]);
  });

  it('裁剪在组件自身绘制之前建立，且 save/restore 成对（不污染后续组件）', () => {
    const { ctx, log } = makeCtx();
    const parent = new ICEGroup({ left: 0, top: 0, width: 100, height: 100, clipChildren: true });
    const child = new ICERect({ left: 10, top: 10, width: 20, height: 20 });
    parent.addChild(child, false);
    child.ctx = ctx;

    child.render();
    expect(log.indexOf('clip')).toBeLessThan(log.indexOf('fill'));
    expect(log.filter((c) => c === 'save').length).toBe(log.filter((c) => c === 'restore').length);
  });

  it('容器自身不被自己的裁剪影响', () => {
    const { ctx, clips } = makeCtx();
    const parent = new ICEGroup({ left: 0, top: 0, width: 100, height: 100, clipChildren: true });
    parent.ctx = ctx;
    parent.render();
    expect(clips).toHaveLength(0);
  });

  it('视口缩放时裁剪矩形换算成设备像素', () => {
    const { ctx, clips } = makeCtx();
    const parent = new ICEGroup({ left: 0, top: 0, width: 100, height: 100, clipChildren: true });
    const child = new ICERect({ left: 10, top: 10, width: 20, height: 20 });
    parent.addChild(child, false);
    child.ctx = ctx;
    // 模拟主画布视口：scale=2、平移 (5, 7)
    child.ice = { getRenderViewport: () => ({ scale: 2, tx: 5, ty: 7 }) };

    child.render();
    expect(clips).toEqual([[5, 7, 200, 200]]); // world(0,0,100,100) * 2 + (5,7)
  });

  it('命中检测跳过裁剪区之外的点（滚出去的组件点不到）', () => {
    const parent = new ICEGroup({ left: 0, top: 0, width: 100, height: 100, clipChildren: true });
    const inside = new ICERect({ left: 10, top: 10, width: 20, height: 20 });
    const outside = new ICERect({ left: 150, top: 10, width: 20, height: 20 });
    parent.addChild(inside, false);
    parent.addChild(outside, false);
    const ice: any = { childNodes: [parent], toolNodes: [] };
    // 真实流程里命中检测发生在渲染之后（矩阵已合成）；这里手动合成一次，语义一致
    inside.getMinBoundingBox(true);

    expect(hitTestComponents(ice, 155, 15, 0)).toBeNull(); // 盒内有组件，但在裁剪区外
    expect(hitTestComponents(ice, 15, 15, 0)).toBe(inside);
  });
});
