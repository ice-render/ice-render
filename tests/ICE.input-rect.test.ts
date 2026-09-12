/**
 * 输入矩形缓存（`getInputRect` / `refreshInputRect`）。
 *
 * 契约：
 * - `updateCanvasBoundingRect()`：完整刷新（重读 rect + 重算 border/padding 补偿）；
 * - `refreshInputRect()`：轻量刷新（只重读 rect；尺寸没变就平移内容盒，不读 computedStyle）；
 * - 尺寸变化时必须退回完整刷新，否则画布被缩放后 border/padding 补偿会失真。
 *
 * 背景（真实缺陷）：图表创建之后，页面在画布**上方**插入内容会把画布往下推，
 * 而移动事件以前复用缓存 → 之后每一次 mousemove 的坐标都偏移同样的距离，
 * 悬停、命中、拖拽全部错位，直到用户点一下或滚一格。
 */
import ICE from '../src/ICE';
import root from '../src/cross-platform/root';

const CSS_W = 400;
const CSS_H = 300;

function makeCtx() {
  const noop = () => {};
  return {
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

function makeCanvas(rect: any) {
  const el: any = {
    width: CSS_W,
    height: CSS_H,
    style: {},
    oncontextmenu: null,
    getContext: () => makeCtx(),
    getBoundingClientRect: () => rect,
  };
  return el;
}

const originalRequestFrame = root.requestFrame;
const originalGetComputedStyle = root.getComputedStyle;

beforeEach(() => {
  root.requestFrame = () => 0; // 阻止真实 rAF 循环
});

afterEach(() => {
  root.requestFrame = originalRequestFrame;
  root.getComputedStyle = originalGetComputedStyle;
});

describe('ICE 输入矩形缓存', () => {
  it('refreshInputRect：位置变化时平移内容盒（不读 computedStyle）', () => {
    const rect: any = { left: 100, top: 50, width: CSS_W, height: CSS_H };
    const el = makeCanvas(rect);
    const ice: any = new ICE().init(el);
    ice.updateCanvasBoundingRect();
    expect(ice.getInputRect()).toMatchObject({ left: 100, top: 50, width: CSS_W, height: CSS_H });

    // 画布上方插入内容：整体下移 26px（尺寸不变）
    let styleReads = 0;
    root.getComputedStyle = ((...args: any[]) => {
      styleReads++;
      // Node 下 root.getComputedStyle 本来是 undefined：桩只需计数，返回 null 让补偿为 0
      return typeof originalGetComputedStyle === 'function'
        ? originalGetComputedStyle.apply(root as any, args as any)
        : null;
    }) as any;
    rect.top = 76;
    ice.refreshInputRect();

    expect(ice.getInputRect()).toMatchObject({ left: 100, top: 76, width: CSS_W, height: CSS_H });
    expect(styleReads).toBe(0); // 轻量路径的关键：不读 computedStyle
    ice.destroy();
  });

  it('refreshInputRect：尺寸变化时退回完整刷新（border/padding 补偿要重算）', () => {
    const rect: any = { left: 0, top: 0, width: CSS_W, height: CSS_H };
    const el = makeCanvas(rect);
    const ice: any = new ICE().init(el);
    ice.updateCanvasBoundingRect();

    let styleReads = 0;
    root.getComputedStyle = ((...args: any[]) => {
      styleReads++;
      return typeof originalGetComputedStyle === 'function'
        ? originalGetComputedStyle.apply(root as any, args as any)
        : null;
    }) as any;
    rect.width = 500;
    rect.height = 340;
    ice.refreshInputRect();

    expect(styleReads).toBeGreaterThan(0); // 尺寸变了 → 走完整补偿
    expect(ice.getInputRect()).toMatchObject({ width: 500, height: 340 });
    ice.destroy();
  });

  it('连续两次 refreshInputRect 用同一块内容盒对象（稳态零分配）', () => {
    const rect: any = { left: 0, top: 0, width: CSS_W, height: CSS_H };
    const el = makeCanvas(rect);
    const ice: any = new ICE().init(el);
    ice.updateCanvasBoundingRect();
    const box = ice.getInputRect();

    rect.left = 10;
    ice.refreshInputRect();
    rect.left = 20;
    ice.refreshInputRect();

    expect(ice.getInputRect()).toBe(box);
    expect(box.left).toBe(20);
    ice.destroy();
  });
});
