/**
 * 分层渲染的引擎原语（18 · 动画机制 §3.1 的落地形态）。
 *
 * 实测（2026-09-13）：10000 个静态元素 + 200 个动画标记，单画布 25.1ms/帧，
 * 双实例分层（静态层画一次 + 动画层）0.5ms/帧（**50×**）。分层由应用按配方组织
 * （层数 ≤2~3、上层 `pointer-events: none`、静态层只在内容变化时置 dirty），
 * 引擎提供两样必须的原语：
 *   ① `linkViewport(a, b)` / `ice.followViewport(source)` —— 两层视口必须一致；
 *   ② `ice.setInputPassthrough(true)` —— 覆盖层不吃指针事件，否则下层交互直接失效。
 */
import ICE from '../src/ICE';

class FakePath2D {
  _commands: any[] = [];
  moveTo() {}
  lineTo() {}
  rect() {}
  closePath() {}
}

function makeCanvasEl() {
  const style: any = {};
  return {
    width: 800,
    height: 600,
    style,
    listeners: {} as Record<string, any[]>,
    addEventListener(name: string, handler: any) {
      (this.listeners[name] = this.listeners[name] || []).push(handler);
    },
    removeEventListener() {},
    getContext: () => ({ measureText: () => ({ width: 10 }) }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    setAttribute() {},
  };
}

/** 造一个「已 init 的 ICE」：不接渲染器，只关心视口与输入原语。 */
function makeIce() {
  const root = require('../src/cross-platform/root').default;
  root.createPath2D = () => new FakePath2D();
  const el = makeCanvasEl();
  const ice: any = new ICE();
  ice.canvasEl = el;
  ice.ctx = el.getContext('2d');
  ice.childNodes = [];
  ice.toolNodes = [];
  return { ice, el };
}

describe('分层原语 ①：linkViewport / followViewport', () => {
  it('双向 linkViewport：任一侧 setViewport 都同步到另一侧', () => {
    const a = makeIce().ice;
    const b = makeIce().ice;
    const unlink = (ICE as any).linkViewport(a, b);

    a.setViewport(2, 100, 50);
    expect(b.viewport).toEqual({ scale: 2, tx: 100, ty: 50 });

    b.setViewport(0.5, 10, 20);
    expect(a.viewport).toEqual({ scale: 0.5, tx: 10, ty: 20 });

    unlink();
    a.setViewport(3, 0, 0);
    expect(b.viewport).toEqual({ scale: 0.5, tx: 10, ty: 20 }); // 解绑后不再跟随
  });

  it('zoomAt 也走同步（它内部经 setViewport）', () => {
    const a = makeIce().ice;
    const b = makeIce().ice;
    ICE.linkViewport(a, b);
    a.zoomAt(400, 300, 2);
    expect(b.viewport).toEqual(a.viewport);
  });

  it('单向 followViewport：follower 跟随 leader，但 follower 自己改不回灌', () => {
    const leader = makeIce().ice;
    const follower = makeIce().ice;
    const unlink = follower.followViewport(leader);

    leader.setViewport(1.5, 20, 30);
    expect(follower.viewport).toEqual({ scale: 1.5, tx: 20, ty: 30 });

    follower.setViewport(4, 0, 0); // 自己改
    expect(leader.viewport).toEqual({ scale: 1.5, tx: 20, ty: 30 }); // leader 不受影响

    unlink();
    leader.setViewport(2, 0, 0);
    expect(follower.viewport).toEqual({ scale: 4, tx: 0, ty: 0 });
  });

  it('同步不会无限回环：链式三方两两相连也能收敛', () => {
    const a = makeIce().ice;
    const b = makeIce().ice;
    const c = makeIce().ice;
    ICE.linkViewport(a, b);
    ICE.linkViewport(b, c);
    a.setViewport(2, 5, 5);
    expect(b.viewport).toEqual({ scale: 2, tx: 5, ty: 5 });
    expect(c.viewport).toEqual({ scale: 2, tx: 5, ty: 5 });
  });

  it('销毁时自动解绑（dangling follower 不会拖住已销毁的实例）', () => {
    const a = makeIce().ice;
    const b = makeIce().ice;
    ICE.linkViewport(a, b);
    b.destroy();
    expect(() => a.setViewport(2, 1, 1)).not.toThrow();
  });
});

describe('分层原语 ②：setInputPassthrough', () => {
  it('开启后 canvas 元素 pointer-events: none（覆盖层不吃事件）', () => {
    const { ice, el } = makeIce();
    ice.setInputPassthrough(true);
    expect(el.style.pointerEvents).toBe('none');
    expect(ice.isInputPassthrough()).toBe(true);
  });

  it('关闭时还原（默认为空，不强行写 auto，避免覆盖应用的样式）', () => {
    const { ice, el } = makeIce();
    ice.setInputPassthrough(true);
    ice.setInputPassthrough(false);
    expect(el.style.pointerEvents).toBe('');
    expect(ice.isInputPassthrough()).toBe(false);
  });

  it('无 canvasEl / 无 style 的宿主（headless / 测试桩）不抛错', () => {
    const ice: any = new ICE();
    expect(() => ice.setInputPassthrough(true)).not.toThrow();
    expect(ice.isInputPassthrough()).toBe(true);
  });
});
