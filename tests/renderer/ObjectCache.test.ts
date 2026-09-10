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
  renderToCount = 0;
  lastBase: any = null;

  measureText() {}

  composeMatrix() {
    return this.state.composedMatrix;
  }

  calcComponentParams() {}

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
  renderToCount = 0;

  calcDots() {
    // 模拟子类：每次重置 dots 为「左上角原点」坐标
    this.state.dots = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
  }

  calcComponentParams() {
    if (!this.dirty) return;
    this.calcDots();
    this.state.width = 300;
    this.state.height = 300;
  }

  composeMatrix() {
    // 模拟 ICEDotPath.calcLocalOrigin：把 dots 移到「以 origin 为原点」（origin=50,50）
    this.state.dots = this.state.dots.map((d: number[]) => [d[0] - 50, d[1] - 50]);
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
  renderToCount = 0;

  createPathObject() {}

  composeMatrix() {
    return this.state.composedMatrix;
  }

  calcComponentParams() {}

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
  const offCtx: any = { scale: jest.fn() };
  const canvas: any = { offscreen: true };

  const root = require('../../src/cross-platform/root').default;
  root.createOffscreenCanvas = jest.fn().mockReturnValue({ canvas, ctx: offCtx });
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
    expect(offCtx.scale).toHaveBeenCalledWith(1, 1);
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
    // 纯平移只改位置，宽高不变
    expect(drawImages[1][3]).toBe(drawImages[0][3]);
    expect(drawImages[1][4]).toBe(drawImages[0][4]);
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

  it('贴图使用含 pad 的世界盒与逻辑尺寸', () => {
    const { cache, drawImages } = makeHarness();
    const c: any = new FakeComponent();
    cache.render(c);

    // PAD_AA=2，世界盒 [0,0,100,30] → 贴图 [ -2, -2, 104, 34 ]
    const [img, x, y, w, h] = drawImages[0];
    expect(img.offscreen).toBe(true);
    expect(x).toBe(-2);
    expect(y).toBe(-2);
    expect(w).toBe(104);
    expect(h).toBe(34);
  });

  it('封闭 dot-path 可缓存，连线类（isLine）不可缓存', () => {
    const { cache } = makeHarness();
    const dot: any = new FakeDotPath();
    expect(cache.isCachable(dot)).toBe(true);
    expect(cache.isCachable({ state: { display: true }, calcDots: () => {}, isLine: true })).toBe(false);
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

    // 模拟子类 calcDots 产出不同点集（如半径变化）
    c.calcDots = () => {
      c.state.dots = [
        [0, 0],
        [80, 0],
        [80, 80],
        [0, 80],
      ];
    };
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
