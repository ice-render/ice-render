/**
 * CanvasRenderer 视口裁剪单测。
 *
 * 契约：
 * - 全量帧里，「非脏 + 已有上屏快照 + 与可见世界区不相交」的组件整组件跳过（不画、不捕获）
 * - 脏组件一律照画：它可能正从屏外移入，旧快照不能用来判定
 * - 无快照（首帧 / 结构重建 / 视口变化后快照清空）一律照画
 * - 画布尺寸缺失时不裁剪（无法定义可见区）
 * - 裁剪只跳过屏外组件，屏内组件的绘制不受影响
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';

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
  ellipse(...a: any[]) {
    this._commands.push(['ellipse', ...a]);
  }
  closePath() {
    this._closed = true;
  }
}

function makeHarness(renderMode: 'full' | 'dirty-rect' = 'full') {
  const noop = () => {};
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect: noop,
    clip: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    rect: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    setTransform: noop,
    setLineDash: noop,
    drawImage: noop,
  };
  (global as any).Path2D = FakePath2D;
  root.createPath2D = () => new FakePath2D();
  root.devicePixelRatio = 1;

  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = root;
  ice.ctx = ctx;
  ice.canvasWidth = 800;
  ice.canvasHeight = 600;
  ice.evtBus = new EventBus();
  ice.dirty = true;

  const renderer: any = new CanvasRenderer(ice, { renderMode });
  renderer.start();
  // 真实用法里 ICE.init 会把 renderer 挂回 ice（setViewport 的 markQueueDirty 依赖它）
  ice.renderer = renderer;
  return { ice, renderer };
}

function renderFrame(renderer: any, ice: any) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

/** 记录本帧哪些组件被真正 render（ICERect 不透明、不缓存，直接走 component.render()）。 */
function trackRender(comps: any[]) {
  const called: any[] = [];
  for (const c of comps) {
    const orig = c.render.bind(c);
    c.render = () => {
      called.push(c);
      return orig();
    };
  }
  return called;
}

describe('CanvasRenderer 视口裁剪', () => {
  test('首帧无快照：全部照画，不裁剪', () => {
    const { ice, renderer } = makeHarness();
    const near = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 1 });
    const far = new ICERect({ left: 3000, top: 3000, width: 40, height: 30, zIndex: 2 });
    ice.addChild(near);
    ice.addChild(far);

    const called = trackRender([near, far]);
    renderFrame(renderer, ice);

    expect(called).toContain(near);
    expect(called).toContain(far);
    expect(renderer.__lastFrameCulled).toBe(0);
  });

  test('稳态帧：屏外且未变脏的组件被裁剪，屏内组件照画', () => {
    const { ice, renderer } = makeHarness();
    const near = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 1 });
    const far = new ICERect({ left: 3000, top: 3000, width: 40, height: 30, zIndex: 2 });
    const edge = new ICERect({ left: 780, top: 580, width: 40, height: 30, zIndex: 3 }); // 与画布边缘相交
    ice.addChild(near);
    ice.addChild(far);
    ice.addChild(edge);

    renderFrame(renderer, ice); // prime：建立快照
    const called = trackRender([near, far, edge]);
    renderFrame(renderer, ice); // 稳态帧

    expect(called).toContain(near);
    expect(called).toContain(edge); // 与可见区相交（含边界相触）不得裁掉
    expect(called).not.toContain(far);
    expect(renderer.__lastFrameCulled).toBe(1);
  });

  test('屏外的脏组件必须照画（从屏外移入的场景）', () => {
    const { ice, renderer } = makeHarness();
    const far = new ICERect({ left: 3000, top: 3000, width: 40, height: 30, zIndex: 1 });
    const near = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 2 });
    ice.addChild(far);
    ice.addChild(near);

    renderFrame(renderer, ice);
    renderFrame(renderer, ice);
    expect(renderer.__lastFrameCulled).toBe(1); // far 被裁

    // far 变脏后即使仍在屏外也必须重画（它可能正在移入，旧快照不可信）
    far.setState({ left: 3050 });
    const called = trackRender([far, near]);
    renderFrame(renderer, ice);
    expect(called).toContain(far);
  });

  test('视口变化后快照被清空，当帧不误裁；下一帧按新可见区裁剪', () => {
    const { ice, renderer } = makeHarness();
    const inside = new ICERect({ left: 100, top: 100, width: 40, height: 30, zIndex: 1 });
    const outsideAfterZoom = new ICERect({ left: 500, top: 400, width: 40, height: 30, zIndex: 2 });
    ice.addChild(inside);
    ice.addChild(outsideAfterZoom);

    renderFrame(renderer, ice);
    renderFrame(renderer, ice);
    expect(renderer.__lastFrameCulled).toBe(0); // 800x600 视口下两者都可见

    ice.setViewport(2, 0, 0); // 可见世界区收缩为 [0,0,400,300]
    renderFrame(renderer, ice);
    expect(renderer.__lastFrameCulled).toBe(0); // 快照刚被清空 → 一律照画

    const called = trackRender([inside, outsideAfterZoom]);
    renderFrame(renderer, ice);
    expect(called).toContain(inside);
    expect(called).not.toContain(outsideAfterZoom);
    expect(renderer.__lastFrameCulled).toBe(1);
  });

  test('画布尺寸缺失时不裁剪（无法定义可见区）', () => {
    const { ice, renderer } = makeHarness();
    const far = new ICERect({ left: 3000, top: 3000, width: 40, height: 30, zIndex: 1 });
    const near = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 2 });
    ice.addChild(far);
    ice.addChild(near);

    renderFrame(renderer, ice);
    ice.canvasWidth = 0;
    ice.canvasHeight = 0;
    const called = trackRender([far, near]);
    renderFrame(renderer, ice);

    expect(called).toContain(far);
    expect(called).toContain(near);
    expect(renderer.__lastFrameCulled).toBe(0);
  });

  test('display:false 的屏外组件不参与裁剪计数（本来就不画）', () => {
    const { ice, renderer } = makeHarness();
    const hiddenFar = new ICERect({ left: 3000, top: 3000, width: 40, height: 30, zIndex: 1 });
    const near = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 2 });
    ice.addChild(hiddenFar);
    ice.addChild(near);

    renderFrame(renderer, ice);
    hiddenFar.setState({ display: false });
    renderFrame(renderer, ice);

    expect(renderer.__lastFrameCulled).toBe(0);
  });

  test('getWorldBox 暴露上屏快照，供命中检测做廉价预筛', () => {
    const { ice, renderer } = makeHarness();
    const near = new ICERect({ left: 10, top: 10, width: 40, height: 30, zIndex: 1 });
    ice.addChild(near);

    expect(renderer.getWorldBox(near)).toBeFalsy(); // 未上屏
    renderFrame(renderer, ice);
    const box: any = renderer.getWorldBox(near);
    expect(box).toBeTruthy();
    // 盒是「含 paint pad 的世界轴对齐盒」，必须覆盖组件几何范围
    expect(box[0]).toBeLessThanOrEqual(10);
    expect(box[1]).toBeLessThanOrEqual(10);
    expect(box[2]).toBeGreaterThanOrEqual(50);
    expect(box[3]).toBeGreaterThanOrEqual(40);
  });
});
