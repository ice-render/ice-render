/**
 * 嵌套坐标系矩阵运算 bug 回归测试。
 *
 * 复现条件：子组件在父组件尚未计算/缓存变换矩阵之前调用 composeMatrix()，
 * 或者父组件变换矩阵是上一帧残留的脏值。
 *
 * 引擎目标：高性能 canvas 绘图引擎，需兼容 WEB 与各类小程序，
 * 因此矩阵组合逻辑必须自洽、不依赖祖先节点的缓存时机。
 */
import { mat2d } from 'gl-matrix';

// 在 node 测试环境下把重型的跨平台/引擎模块替换为桩，避免加载 DOM/Canvas 依赖。
jest.mock('../../src/ICE', () => ({ __esModule: true, default: class ICE {} }));
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});
jest.mock('../../src/event/EventBus', () => ({ __esModule: true, default: class EventBus {} }));

import ICEComponent from '../../src/graphic/ICEComponent';

function isMatrixFinite(m: number[]): boolean {
  return Array.isArray(m) && m.length >= 6 && m.every((v) => Number.isFinite(v));
}

describe('嵌套坐标系矩阵组合', () => {
  it('父组件矩阵未初始化时，子组件 absoluteLinearMatrix 仍应包含父组件的缩放', () => {
    const parent = new ICEComponent({
      width: 100,
      height: 100,
      transform: { translate: [0, 0], scale: [2, 2], skew: [0, 0], rotate: 0 },
    });
    const child = new ICEComponent({ width: 20, height: 20 });
    child.parentNode = parent;

    // 关键：没有经过任何渲染帧，parent.state.linearMatrix 仍是默认的空数组 []
    child.composeMatrix();

    const abs = child.state.absoluteLinearMatrix as number[];
    expect(isMatrixFinite(abs)).toBe(true); // 当前 bug：这里会是 NaN
    expect(abs[0]).toBeCloseTo(2, 6);
    expect(abs[3]).toBeCloseTo(2, 6);
  });

  it('父组件矩阵未初始化时，子组件 composedMatrix 不应为 NaN 且应继承父组件缩放', () => {
    const parent = new ICEComponent({
      width: 100,
      height: 100,
      transform: { translate: [0, 0], scale: [2, 2], skew: [0, 0], rotate: 0 },
    });
    const child = new ICEComponent({ width: 20, height: 20 });
    child.parentNode = parent;

    const composed = child.composeMatrix() as number[];

    expect(isMatrixFinite(composed)).toBe(true); // 当前 bug：NaN
    expect(composed[0]).toBeCloseTo(2, 6); // 继承父缩放
  });

  it('父组件旋转应正确传播到子组件的线性矩阵 (rotate 90deg)', () => {
    const parent = new ICEComponent({
      width: 100,
      height: 100,
      transform: { translate: [0, 0], scale: [1, 1], skew: [0, 0], rotate: 90 },
    });
    const child = new ICEComponent({ width: 20, height: 20 });
    child.parentNode = parent;

    // 父组件的自身线性矩阵即子组件应继承的复合线性矩阵（子组件无自身变换）
    parent.composeMatrix();
    const parentLinear = parent.calcLinearMatrix() as number[];

    child.composeMatrix();
    const abs = child.state.absoluteLinearMatrix as number[];
    expect(isMatrixFinite(abs)).toBe(true);
    // 子组件 absoluteLinearMatrix 必须等于 父组件线性矩阵 · 子组件线性矩阵(单位阵)
    expect(abs[0]).toBeCloseTo(parentLinear[0], 6);
    expect(abs[1]).toBeCloseTo(parentLinear[1], 6);
    expect(abs[2]).toBeCloseTo(parentLinear[2], 6);
    expect(abs[3]).toBeCloseTo(parentLinear[3], 6);
  });

  it('父组件变换发生变更后，子组件重新组合应反映最新父矩阵 (避免脏值)', () => {
    const parent = new ICEComponent({
      width: 100,
      height: 100,
      transform: { translate: [0, 0], scale: [2, 2], skew: [0, 0], rotate: 0 },
    });
    const child = new ICEComponent({ width: 20, height: 20 });
    child.parentNode = parent;

    child.composeMatrix();
    expect((child.state.absoluteLinearMatrix as number[])[0]).toBeCloseTo(2, 6);

    // 父组件缩放改为 3，且不经由渲染帧直接重新组合子组件
    parent.setState({ transform: { scale: [3, 3] } });
    child.composeMatrix();

    const abs = child.state.absoluteLinearMatrix as number[];
    expect(isMatrixFinite(abs)).toBe(true);
    expect(abs[0]).toBeCloseTo(3, 6);
  });

  it('父组件旋转场景下 localToGlobal/globalToLocal 应互逆且坐标正确', () => {
    const parent = new ICEComponent({
      width: 100,
      height: 100,
      transform: { translate: [0, 0], scale: [1, 1], skew: [0, 0], rotate: 90 },
    });
    const child = new ICEComponent({ width: 20, height: 20 });
    child.parentNode = parent;

    child.composeMatrix();
    const g0 = child.localToGlobal(0, 0) as number[];
    expect(Number.isFinite(g0[0])).toBe(true);
    expect(Number.isFinite(g0[1])).toBe(true);

    const back = child.globalToLocal(g0[0], g0[1]) as number[];
    expect(back[0]).toBeCloseTo(0, 6);
    expect(back[1]).toBeCloseTo(0, 6);
  });
});
