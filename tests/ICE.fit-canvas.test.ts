/**
 * 画布尺寸对齐：`fitCanvasToDisplaySize()`。
 *
 * 这个方法的来历：这段契约原先只活在私有的 `__applyDevicePixelRatio()` 里（只在 init 时跑一次），
 * 于是**两个应用各自重写了一遍**，还各自踩了不同的坑 ——
 * `ice-chart` 用 border-box 尺寸（引擎注释里警告过："会被边框撑大，示例页画布带 1px 边框"），
 * `smart-water` 忘了乘 dpr。两次都不是"写错代码"，是"没人提供入口"。
 *
 * 契约：
 * - backing store = 逻辑尺寸 × dpr；CSS 尺寸固定为逻辑尺寸（**不取整**，避免顺手改人家布局宽度）
 * - 同步 `canvasWidth` / `canvasHeight`，并刷新命中用的矩形与内容盒
 * - 不传尺寸时从**内容盒**读，读不到再退回画布当前逻辑尺寸
 * - 返回「是否真的变了」，调用方据此决定**自己那层**要不要重新布局
 * - init 的 dpr 路径已改为委托本方法，行为逐字节不变（由 ICE.dpr.test.ts 守着）
 * - **改了尺寸就自己置脏**：改 canvas 尺寸会清空画布，补画的义务属于引擎
 *   （少了它，空闲停帧状态下 resize 会静默白屏）
 */
import ICE from '../src/ICE';
import ICERect from '../src/graphic/shape/ICERect';
import root from '../src/cross-platform/root';

const CSS_W = 400;
const CSS_H = 300;

function makeCtx() {
  const noop = () => {};
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    setTransform: noop,
    clearRect: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    rect: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    clip: noop,
    setLineDash: noop,
    drawImage: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  };
}

/** `rect` 传 null 模拟「没有 getBoundingClientRect」的运行时（小程序那类宿主）。 */
function makeCanvas(
  rect: { left: number; top: number; width: number; height: number } | null = {
    left: 0,
    top: 0,
    width: CSS_W,
    height: CSS_H,
  }
) {
  const ctx = makeCtx();
  const el: any = {
    width: CSS_W,
    height: CSS_H,
    style: {},
    oncontextmenu: null,
    getContext: () => ctx,
  };
  if (rect) {
    el.getBoundingClientRect = () => ({ ...rect });
  }
  return { el, ctx };
}

const originalRequestFrame = root.requestFrame;

beforeEach(() => {
  root.requestFrame = () => 0;
});

afterEach(() => {
  root.requestFrame = originalRequestFrame;
});

describe('fitCanvasToDisplaySize：显式传尺寸', () => {
  it('dpr=1：backing store 与逻辑尺寸一致，CSS 与内部状态一起对齐', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el);

    const changed = ice.fitCanvasToDisplaySize(640, 480);

    expect(changed).toBe(true);
    expect(el.width).toBe(640);
    expect(el.height).toBe(480);
    expect(el.style.width).toBe('640px');
    expect(el.style.height).toBe('480px');
    expect(ice.canvasWidth).toBe(640);
    expect(ice.canvasHeight).toBe(480);
    ice.destroy();
  });

  it('dpr=2：backing store 是逻辑尺寸的两倍，CSS 固定为逻辑尺寸', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 2 });

    ice.fitCanvasToDisplaySize(500, 250);

    expect(el.width).toBe(1000);
    expect(el.height).toBe(500);
    expect(el.style.width).toBe('500px');
    expect(el.style.height).toBe('250px');
    expect(ice.canvasWidth).toBe(1000);
    ice.destroy();
  });

  it('逻辑尺寸不取整（先乘 dpr 再取整）——不能顺手改人家的布局宽度', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 2 });

    ice.fitCanvasToDisplaySize(400.5, 300.25);

    // CSS 尺寸保持小数原样
    expect(el.style.width).toBe('400.5px');
    expect(el.style.height).toBe('300.25px');
    // backing store 才是取整的地方：round(400.5*2)=801，round(300.25*2)=601
    expect(el.width).toBe(801);
    expect(el.height).toBe(601);
    ice.destroy();
  });

  it('刷新命中用的矩形（尺寸变了，位置多半也变了）', () => {
    const rect = { left: 10, top: 20, width: 400, height: 300 };
    const { el } = makeCanvas(rect);
    const ice: any = new ICE().init(el);

    rect.left = 80;
    rect.top = 90;
    rect.width = 600;
    rect.height = 400;
    ice.fitCanvasToDisplaySize(600, 400);

    expect(ice.canvasBoundingClientRect.left).toBe(80);
    expect(ice.canvasBoundingClientRect.top).toBe(90);
    expect(ice.canvasBoundingClientRect.width).toBe(600);
    ice.destroy();
  });
});

describe('fitCanvasToDisplaySize：不传尺寸', () => {
  it('从内容盒读（等价于 getBoundingClientRect 的尺寸）', () => {
    const { el } = makeCanvas({ left: 5, top: 5, width: 777, height: 333 });
    const ice: any = new ICE().init(el);

    const changed = ice.fitCanvasToDisplaySize();

    expect(changed).toBe(true);
    expect(el.width).toBe(777);
    expect(el.height).toBe(333);
    ice.destroy();
  });

  it('没有 getBoundingClientRect 时退回画布当前的逻辑尺寸', () => {
    // 小程序那类宿主：canvas 节点只有 width/height/getContext，没有布局信息。
    // 此时不能让方法返回 0 或抛异常 —— 退化成「按现有尺寸重算」是安全的。
    const { el } = makeCanvas(null);
    const ice: any = new ICE().init(el, { dpr: 2 });

    // init 的 dpr 路径没布局信息可用，box.width 为 0 → 退回 el.width(=400) 当逻辑尺寸
    expect(el.width).toBe(800);

    // 之后显式把尺寸改成 400 逻辑宽，应能正确回到 800 backing（幂等，无变化返回 false）
    expect(ice.fitCanvasToDisplaySize(400, 300)).toBe(false);
    ice.destroy();
  });

  it('尺寸没变时返回 false，且不碰任何字段', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el);

    expect(ice.fitCanvasToDisplaySize(CSS_W, CSS_H)).toBe(false);
    expect(ice.fitCanvasToDisplaySize(CSS_W, CSS_H)).toBe(false);
    ice.destroy();
  });

  it('init 之后幂等：再调一次返回 false（dpr=2 也一样）', () => {
    for (const dpr of [1, 2, 3]) {
      const { el } = makeCanvas();
      const ice: any = new ICE().init(el, { dpr });

      expect(ice.fitCanvasToDisplaySize(CSS_W, CSS_H)).toBe(false);
      ice.destroy();
    }
  });

  it('只改一个维度也算变了', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el);

    expect(ice.fitCanvasToDisplaySize(CSS_W, CSS_H + 50)).toBe(true);
    expect(ice.fitCanvasToDisplaySize(CSS_W, CSS_H + 50)).toBe(false);
    ice.destroy();
  });
});

describe('fitCanvasToDisplaySize：改完尺寸要自己安排重绘', () => {
  /**
   * 给 canvas 的 `width` / `height` 赋值会**清空画布** —— 所以"尺寸变了"这件事
   * 天然带着"必须重画"的义务。既然清空是引擎干的，补画的义务就属于引擎。
   *
   * 漏掉的症状是**静默白屏**：画面已画完 → 空闲停帧（帧循环停了）→ 容器尺寸变化 →
   * 调用方调本方法 → 画布被清空，而没有任何人会再画一次。
   * 实测来源：`ice-agent-console` 的表单层在窗口变窄后整块变白。
   * 它当时能画出来纯属巧合 —— `setWidth()` 里的 `doLayout()` 顺手置了脏。
   */
  function renderOnce(ice: any) {
    ice.dirty = true;
    ice.renderer.frameEvtHandler();
  }

  it('渲染过一轮（空闲停帧）之后再 fit，会把脏置回去', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el);
    ice.addChild(new ICERect({ left: 10, top: 20, width: 30, height: 40 }));

    renderOnce(ice);
    // 前置条件：画完了，帧循环可以停了
    expect(ice.dirty).toBe(false);
    expect(ice.needsFrame()).toBe(false);

    expect(ice.fitCanvasToDisplaySize(640, 480)).toBe(true);

    // 少了这一条，宿主看到的是一张白画布
    expect(ice.dirty).toBe(true);
    expect(ice.needsFrame()).toBe(true);
    ice.destroy();
  });

  it('尺寸没变时**不**置脏（不能把停帧的省电效果抵消掉）', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el);
    ice.addChild(new ICERect({ left: 10, top: 20, width: 30, height: 40 }));

    renderOnce(ice);
    expect(ice.dirty).toBe(false);

    expect(ice.fitCanvasToDisplaySize(CSS_W, CSS_H)).toBe(false);

    // 无变化却置脏 = 每帧都重绘，停帧形同虚设
    expect(ice.dirty).toBe(false);
    expect(ice.needsFrame()).toBe(false);
    ice.destroy();
  });

  it('fit 之后跑一帧就回到不脏（置脏不是一次性的死循环）', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el);
    ice.addChild(new ICERect({ left: 10, top: 20, width: 30, height: 40 }));

    renderOnce(ice);
    ice.fitCanvasToDisplaySize(640, 480);

    renderOnce(ice);
    expect(ice.dirty).toBe(false);
    expect(ice.needsFrame()).toBe(false);
    ice.destroy();
  });
});

describe('fitCanvasToDisplaySize：边界', () => {
  it('没有画布（裸 context 兜底路径）时返回 false', () => {
    const { ctx } = makeCanvas();
    // 直接喂一个裸 ctx：init 走 else 分支，canvasEl 为 null
    const ice: any = new ICE().init(ctx);

    expect(ice.fitCanvasToDisplaySize(100, 100)).toBe(false);
    ice.destroy();
  });

  it('非法尺寸（0 / 负数 / NaN）不写入，返回 false', () => {
    const { el } = makeCanvas(null);
    const ice: any = new ICE().init(el);
    const before = { w: el.width, h: el.height };

    // 没有 rect 时，非法入参会让它退回到 el.width/dpr —— 尺寸相同即无变化
    expect(ice.fitCanvasToDisplaySize(0, 0)).toBe(false);
    expect(ice.fitCanvasToDisplaySize(-5, NaN)).toBe(false);
    expect(el.width).toBe(before.w);
    expect(el.height).toBe(before.h);
    ice.destroy();
  });

  it('显式传尺寸时，非法值不会覆盖成 0（退回画布逻辑尺寸）', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el);

    // 只给宽度、且非法 → 宽度退回逻辑尺寸，高度用传入值
    expect(ice.fitCanvasToDisplaySize(0, 500)).toBe(true);
    expect(el.width).toBe(CSS_W);
    expect(el.height).toBe(500);
    ice.destroy();
  });
});

describe('init 的 dpr 路径（委托后的回归）', () => {
  it('dpr=2 时 init 的结果与既有契约一致', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el, { dpr: 2 });

    expect(el.width).toBe(CSS_W * 2);
    expect(el.height).toBe(CSS_H * 2);
    expect(el.style.width).toBe(CSS_W + 'px');
    expect(el.style.height).toBe(CSS_H + 'px');
    expect(ice.canvasWidth).toBe(CSS_W * 2);
    expect(ice.canvasHeight).toBe(CSS_H * 2);
    // 命中检测用的矩形仍是 CSS 尺寸
    expect(ice.canvasBoundingClientRect.width).toBe(CSS_W);
    ice.destroy();
  });

  it('dpr=1 时不碰 backing store（既有行为：init 不做任何缩放）', () => {
    const { el } = makeCanvas();
    const ice: any = new ICE().init(el);

    expect(el.width).toBe(CSS_W);
    expect(el.height).toBe(CSS_H);
    // dpr=1 时 init 不写 style（保持 `width:100%` 这类应用侧布局不被覆盖）
    expect(el.style.width).toBeUndefined();
    ice.destroy();
  });
});
