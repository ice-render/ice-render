/**
 * CanvasRenderer 渲染队列缓存（性能优化）回归测试。
 *
 * 验证：
 *  - 结构变更（addChild / removeChild）后队列会重建并包含最新组件；
 *  - 结构未变时稳态刷新复用同一队列数组（不重新 flattenTree），降低每帧开销；
 *  - zIndex 发生变化时队列会重新排序，绘制顺序始终正确。
 *
 * 引擎目标：高性能 canvas 绘图引擎，需兼容 WEB 与各类小程序。
 */
// node 测试环境无 window，将跨平台 root 替换为桩，避免加载 DOM/Canvas 依赖。
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

// 部分图元（ICEPath 子类）构造时会 new Path2D()，node 环境需提供桩。
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  addPath() {}
  roundRect() {}
};

import EventBus from '../../src/event/EventBus';
import ICE from '../../src/ICE';
import ICEComponent from '../../src/graphic/ICEComponent';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';

function makeIce(): ICE {
  const ice = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.dirty = true;
  ice.renderer = new CanvasRenderer(ice);
  ice.renderer.start();
  return ice;
}

describe('CanvasRenderer 渲染队列缓存', () => {
  it('addChild 后队列重建并包含所有组件', () => {
    const ice = makeIce();
    const a = new ICEComponent({ width: 10, height: 10 });
    const b = new ICEComponent({ width: 10, height: 10 });
    ice.addChild(a);
    ice.addChild(b);

    (ice.renderer as any).refreshQueue();
    const q = (ice.renderer as any).componentQueue;
    expect(q.length).toBe(2);
    expect(q).toContain(a);
    expect(q).toContain(b);
    // 默认 zIndex 随构造顺序递增，队列按 zIndex 升序
    expect(q[0].state.zIndex).toBeLessThanOrEqual(q[1].state.zIndex);
  });

  it('结构未变时稳态刷新复用同一队列数组（不重新 flatten），zIndex 变化时才重排序', () => {
    const ice = makeIce();
    const a = new ICEComponent({ width: 10, height: 10 });
    const b = new ICEComponent({ width: 10, height: 10 });
    ice.addChild(a);
    ice.addChild(b);

    (ice.renderer as any).refreshQueue();
    const arrBefore = (ice.renderer as any).componentQueue;
    // 稳态再刷新：无结构变化、无 zIndex 变化，应命中缓存（同一数组引用）
    (ice.renderer as any).refreshQueue();
    expect((ice.renderer as any).componentQueue).toBe(arrBefore);

    // 改变 a 的 zIndex，应触发重排序（a 排到末尾）
    a.setState({ zIndex: 99999 });
    (ice.renderer as any).refreshQueue();
    const q2 = (ice.renderer as any).componentQueue;
    expect(q2[1]).toBe(a);
    expect(q2[0]).toBe(b);
  });

  it('removeChild 后队列重建不再包含被移除组件', () => {
    const ice = makeIce();
    const a = new ICEComponent({ width: 10, height: 10 });
    const b = new ICEComponent({ width: 10, height: 10 });
    ice.addChild(a);
    ice.addChild(b);

    (ice.renderer as any).refreshQueue();
    ice.removeChild(a);
    (ice.renderer as any).refreshQueue();
    const q = (ice.renderer as any).componentQueue;
    expect(q.length).toBe(1);
    expect(q).toContain(b);
    expect(q).not.toContain(a);
  });

  it('ICEGroup 内 addChild 也会标记队列 dirty', () => {
    const ice = makeIce();
    const group = new ICEGroup({ width: 50, height: 50 });
    ice.addChild(group); // group.ice 被注入
    (ice.renderer as any).refreshQueue();
    const before = (ice.renderer as any).componentQueue.length;

    const child = new ICEComponent({ width: 10, height: 10 });
    group.addChild(child); // group.ice 已存在，应触发 markQueueDirty
    (ice.renderer as any).refreshQueue();
    const after = (ice.renderer as any).componentQueue.length;
    expect(after).toBe(before + 1);
    expect((ice.renderer as any).componentQueue).toContain(child);
  });
});
