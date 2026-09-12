/**
 * ObjectCache 组件级离屏缓存单测（fake component，聚焦缓存策略）。
 *
 * 验证：静态命中不重建、纯平移复用位图、内容/线性变化重建、不可缓存组件降级、贴图参数。
 */
import ObjectCache from '../../src/renderer/ObjectCache';

class FakeComponent {
  state: any = {
    display: true,
    editing: false,
    text: 'hello',
    fill: true,
    stroke: true,
    lineDash: [],
    lineDashOffset: 0,
    lineDashFlow: false,
    lineBorder: false,
    lineBorderWidth: 0,
    lineBorderColor: '#999999',
    style: { fontSize: 12, fontWeight: 'normal', fontFamily: 'Arial' },
    composedMatrix: [1, 0, 0, 1, 10, 20],
  };
  dirty = true;
  paramsDirty = true;
  renderToCount = 0;
  lastBase: any = null;

  measureText() {}

  composeMatrix() {
    return this.state.composedMatrix;
  }

  calcComponentParams() {}

  /** 与真实组件一致：派生参数干净时跳过重算，算完清除标志。 */
  refreshParams() {
    if (!this.paramsDirty) return;
    this.calcComponentParams();
    this.paramsDirty = false;
  }

  getMaxBoundingBox() {
    return {
      getMinAndMaxPoint: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 30 }),
    };
  }

  renderTo(ctx: any, base: any) {
    this.renderToCount++;
    this.lastBase = base;
  }
}

class FakeDotPath {
  state: any = {
    display: true,
    lineDashFlow: false,
    closePath: true,
    fill: true,
    stroke: true,
    lineDash: [],
    lineDashOffset: 0,
    lineBorder: false,
    lineBorderWidth: 0,
    lineBorderColor: '#999999',
    style: { fillStyle: '#ff0000', strokeStyle: '#111111', lineWidth: 1 },
    composedMatrix: [1, 0, 0, 1, 10, 20],
    dots: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    width: 300,
    height: 300,
  };
  dirty = true;
  paramsDirty = true;
  renderToCount = 0;
  private __shiftX = 0;
  private __shiftY = 0;

  calcDots() {
    // 模拟子类：重置 dots 为「左上角原点」坐标（绝对坐标），并归零已应用平移量
    this.state.dots = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    this.__shiftX = 0;
    this.__shiftY = 0;
  }

  calcComponentParams() {
    this.calcDots();
    this.state.width = 300;
    this.state.height = 300;
  }

  /** 与真实组件一致：派生参数干净时跳过重算（祖先移动不再连带重算点集）。 */
  refreshParams() {
    if (!this.paramsDirty) return;
    this.calcComponentParams();
    this.paramsDirty = false;
  }

  composeMatrix() {
    // 模拟 ICEDotPath.calcLocalOrigin：把 dots 移到「以 origin 为原点」（origin=50,50）。
    // 与真实实现一致地**只补差额** → 重复 compose 幂等，不会累积偏移。
    const dx = -50 - this.__shiftX;
    const dy = -50 - this.__shiftY;
    if (dx !== 0 || dy !== 0) {
      this.state.dots = this.state.dots.map((d: number[]) => [d[0] + dx, d[1] + dy]);
      this.__shiftX = -50;
      this.__shiftY = -50;
    }
    return this.state.composedMatrix;
  }

  getMaxBoundingBox() {
    return {
      getMinAndMaxPoint: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 100 }),
    };
  }

  renderTo() {
    this.renderToCount++;
  }
}

class FakeTranslucentShape {
  state: any = {
    display: true,
    width: 100,
    height: 60,
    radius: 0,
    radiusX: 0,
    radiusY: 0,
    closePath: true,
    fill: true,
    stroke: false,
    lineDash: [],
    lineDashOffset: 0,
    lineDashFlow: false,
    lineBorder: false,
    lineBorderWidth: 0,
    lineBorderColor: '#999999',
    style: { fillStyle: 'rgba(0,0,0,0.5)', strokeStyle: '#111111', lineWidth: 1 },
    composedMatrix: [1, 0, 0, 1, 10, 20],
  };
  dirty = true;
  paramsDirty = true;
  renderToCount = 0;

  createPathObject() {}

  composeMatrix() {
    return this.state.composedMatrix;
  }

  calcComponentParams() {}

  refreshParams() {
    if (!this.paramsDirty) return;
    this.calcComponentParams();
    this.paramsDirty = false;
  }

  getMaxBoundingBox() {
    return {
      getMinAndMaxPoint: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 60 }),
    };
  }

  renderTo() {
    this.renderToCount++;
  }
}

function makeHarness() {
  const drawImages: any[] = [];
  const noop = () => {};
  const ctx: any = {
    save: noop,
    restore: noop,
    setTransform: noop,
    drawImage: (...a: any[]) => drawImages.push(a),
  };
  const offCtx: any = { scale: jest.fn(), setTransform: noop };
  const canvas: any = { offscreen: true, width: 0, height: 0 };

  const root = require('../../src/cross-platform/root').default;
  root.createOffscreenCanvas = jest.fn((w: number, h: number) => {
    canvas.width = w;
    canvas.height = h;
    return { canvas, ctx: offCtx };
  });
  root.devicePixelRatio = 1;

  const ice: any = { ctx, root };
  const cache = new ObjectCache(ice);
  return { cache, ctx, drawImages, offCtx, canvas };
}

describe('ObjectCache 组件级离屏缓存', () => {
  it('不可缓存组件降级（返回 false）', () => {
    const { cache } = makeHarness();
    const plain = { state: { display: true } };
    expect(cache.render(plain)).toBe(false);
  });

  it('首次渲染建立位图，后续未脏帧直接贴图不重建', () => {
    const { cache, drawImages, offCtx, canvas } = makeHarness();
    const c: any = new FakeComponent();

    expect(cache.render(c)).toBe(true);
    expect(c.renderToCount).toBe(1);
    // 契约变更（2026-09-11）：不再依赖 ctx.scale(dpr,dpr) —— 那一句会被 renderTo() 内部的
    // setTransform() 整条覆盖，本来就是死代码。现在缩放直接编码进 base 矩阵。
    expect(offCtx.scale).not.toHaveBeenCalled();
    expect(c.lastBase).toEqual([1, 0, 0, 1, 3, 3]);
    expect(drawImages.length).toBe(1);

    // 位图内容未变、组件未脏 → 只贴图
    cache.render(c);
    expect(c.renderToCount).toBe(1);
    expect(drawImages.length).toBe(2);
    expect(drawImages[1][0]).toBe(canvas);
  });

  it('纯平移（left/top 变化）复用位图，只刷新贴图位置', () => {
    const { cache, drawImages } = makeHarness();
    const c: any = new FakeComponent();
    cache.render(c);
    expect(c.renderToCount).toBe(1);

    // 只改平移分量 e/f，内容与线性部分不变
    c.state.composedMatrix = [1, 0, 0, 1, 50, 80];
    c.dirty = true;
    cache.render(c);

    expect(c.renderToCount).toBe(1); // 位图未重建
    expect(drawImages.length).toBe(2);
    // 纯平移只改落点（1:1 贴回，无目标宽高）；平移的是 composedMatrix 的 e/f，不影响世界盒
    expect(drawImages[1][1]).toBe(drawImages[0][1]);
    expect(drawImages[1][2]).toBe(drawImages[0][2]);
    expect(drawImages[1][3]).toBeUndefined();
  });

  it('内容变化重建位图', () => {
    const { cache } = makeHarness();
    const c: any = new FakeComponent();
    cache.render(c);
    expect(c.renderToCount).toBe(1);

    c.state.text = 'changed';
    c.dirty = true;
    cache.render(c);
    expect(c.renderToCount).toBe(2);
  });

  it('文字颜色（fillStyle）变化重建位图', () => {
    const { cache } = makeHarness();
    const c: any = new FakeComponent();
    cache.render(c);
    expect(c.renderToCount).toBe(1);

    c.state.style.fillStyle = '#FF0000';
    c.dirty = true;
    cache.render(c);
    expect(c.renderToCount).toBe(2);
  });

  it('线性变换变化（缩放/旋转）重建位图', () => {
    const { cache } = makeHarness();
    const c: any = new FakeComponent();
    cache.render(c);
    expect(c.renderToCount).toBe(1);

    c.state.composedMatrix = [2, 0, 0, 2, 10, 20];
    c.dirty = true;
    cache.render(c);
    expect(c.renderToCount).toBe(2);
  });

  it('贴图用含 pad 的世界盒、整数设备像素落点、1:1 尺寸', () => {
    const { cache, drawImages } = makeHarness();
    const c: any = new FakeComponent();
    cache.render(c);

    // PAD_AA=2，世界盒 [0,0,100,30] → paint 盒 [-2,-2,102,32]
    // rs=1 / ox=oy=0 → dx = floor(-2) - 1 = -3；位图 = ceil(102)-(-3)+1 = 106 x 36
    const [img, x, y, w, h] = drawImages[0];
    expect(img.offscreen).toBe(true);
    expect(x).toBe(-3);
    expect(y).toBe(-3);
    // 1:1 贴回：不传目标宽高（传了就是在重采样）
    expect(w).toBeUndefined();
    expect(h).toBeUndefined();
    expect(img.width).toBe(106);
    expect(img.height).toBe(36);
  });

  it('封闭 dot-path 可缓存；连线类改为「按面积上限」决定（契约变更）', () => {
    const { cache } = makeHarness();
    const dot: any = new FakeDotPath();
    expect(cache.isCachable(dot)).toBe(true);

    // 契约变更（2026-09-11）：连线此前一律不缓存，代价是「干净但不可缓存的连线与脏区相交
    // → 回退全量」常态命中（连线横跨画布），富场景局部重绘因此 100% 失效。
    // 现改为按**设备像素面积**设上限；策略细节见 offscreen-line-cache.test.ts。
    const line = (w: number, h: number) => ({
      state: { display: true, width: w, height: h, lineDashFlow: false, style: {} },
      calcDots: () => {},
      isLine: true,
      __localBox: () => [0, 0, w, h],
    });
    expect(cache.isCachable(line(300, 200))).toBe(true);
    expect(cache.isCachable(line(3000, 3000))).toBe(false);
  });

  it('dot-path 纯平移复用位图且 dots 不累积偏移', () => {
    const { cache } = makeHarness();
    const c: any = new FakeDotPath();
    cache.render(c);
    expect(c.renderToCount).toBe(1);
    expect(c.state.dots[0]).toEqual([-50, -50]);

    c.state.composedMatrix = [1, 0, 0, 1, 50, 80]; // 仅平移分量变化
    c.dirty = true;
    cache.render(c);

    expect(c.renderToCount).toBe(1); // 位图复用
    expect(c.state.dots[0]).toEqual([-50, -50]); // 未累积成 [-100,-100]
  });

  it('dot-path 内容变化（dots 原始参数）重建位图', () => {
    const { cache } = makeHarness();
    const c: any = new FakeDotPath();
    cache.render(c);
    expect(c.renderToCount).toBe(1);

    // 模拟子类 calcDots 产出不同点集（如半径变化）：
    // 真实引擎里这类变化走 setState → 同时置 dirty 与 paramsDirty（本用例显式模拟这一点）
    c.calcDots = () => {
      c.state.dots = [
        [0, 0],
        [80, 0],
        [80, 80],
        [0, 80],
      ];
    };
    c.paramsDirty = true;
    c.dirty = true;
    cache.render(c);
    expect(c.renderToCount).toBe(2);
  });

  it('半透明普通 shape 可缓存，不透明 shape 不缓存', () => {
    const { cache } = makeHarness();
    const shape: any = new FakeTranslucentShape();
    expect(cache.isCachable(shape)).toBe(true);

    const opaque: any = new FakeTranslucentShape();
    opaque.state.style.fillStyle = '#ffffff';
    expect(cache.isCachable(opaque)).toBe(false);
  });

  /**
   * 祖先不透明度（子树淡入淡出）必须挡住离屏缓存。
   *
   * 背景（arcade 掌机实测）：位图是 `build() → renderTo()` 用**当时**的 effectiveOpacity 烤出来的，
   * 而贴图路径 `draw()` 只做 `drawImage`（不叠 alpha）。于是「面板先建位图、再淡入」会让子组件
   * 永远停在那一刻的透明度 —— 表现为「暂停提示的底板出来了，'已暂停'三个字却整条不见」。
   */
  it('祖先半透明时不进离屏缓存（位图会把当时的 alpha 烤死）', () => {
    const { cache } = makeHarness();
    const c: any = new FakeComponent();
    c.getEffectiveOpacity = () => 1;
    expect(cache.isCachable(c)).toBe(true);

    c.getEffectiveOpacity = () => 0.5;
    expect(cache.isCachable(c)).toBe(false);
    expect(cache.render(c)).toBe(false);

    c.getEffectiveOpacity = () => 0;
    expect(cache.render(c)).toBe(false);
  });

  it('组件自身 opacity ≠ 1 同样不缓存', () => {
    const { cache } = makeHarness();
    const c: any = new FakeComponent();
    c.state.opacity = 1;
    expect(cache.isCachable(c)).toBe(true);

    c.state.opacity = 0.25;
    expect(cache.isCachable(c)).toBe(false);
  });

  it('缓存过的组件变半透明 → 旧位图被丢弃，恢复不透明后重建（而不是贴回旧图）', () => {
    const { cache } = makeHarness();
    const c: any = new FakeComponent();
    let alpha = 1;
    c.getEffectiveOpacity = () => alpha;

    expect(cache.render(c)).toBe(true);
    expect(c.renderToCount).toBe(1);

    alpha = 0.4; // 祖先开始淡入淡出
    expect(cache.render(c)).toBe(false);
    expect(cache.has(c)).toBe(false); // 烤过旧 alpha 的位图必须丢掉

    alpha = 1; // 恢复不透明
    c.dirty = true;
    expect(cache.render(c)).toBe(true);
    expect(c.renderToCount).toBe(2); // 重新光栅化，而不是复用旧位图
  });

  it('半透明 shape 纯平移复用位图', () => {
    const { cache } = makeHarness();
    const c: any = new FakeTranslucentShape();
    cache.render(c);
    expect(c.renderToCount).toBe(1);

    c.state.composedMatrix = [1, 0, 0, 1, 80, 120];
    c.dirty = true;
    cache.render(c);
    expect(c.renderToCount).toBe(1);
  });

  it('半透明 shape 颜色变化重建位图', () => {
    const { cache } = makeHarness();
    const c: any = new FakeTranslucentShape();
    cache.render(c);
    expect(c.renderToCount).toBe(1);

    c.state.style.fillStyle = 'rgba(255,0,0,0.8)';
    c.dirty = true;
    cache.render(c);
    expect(c.renderToCount).toBe(2);
  });
});
