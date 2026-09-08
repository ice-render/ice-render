/**
 * 变换与包围盒边界用例回归测试。
 *
 * 覆盖之前完全没有自动化断言的：
 *  - 旋转下的 min/max 包围盒（AABB 宽高互换）；
 *  - 组合变换（rotate+scale+skew）不产生 NaN；
 *  - 深嵌套（>3 层）的绝对线性矩阵正确累积祖先缩放。
 */
jest.mock('../ICE', () => ({ __esModule: true, default: class ICE {} }));
jest.mock('../cross-platform/root', () => ({ __esModule: true, default: {} }));
jest.mock('../event/EventBus', () => ({ __esModule: true, default: class EventBus {} }));

global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
};

import ICEGroup from './container/ICEGroup';
import ICERect from './shape/ICERect';

describe('变换与包围盒边界用例', () => {
  it('矩形旋转 90° 后最大包围盒宽高互换（100x50 → 50x100）', () => {
    const rect = new ICERect({
      width: 100,
      height: 50,
      transform: { translate: [0, 0], scale: [1, 1], skew: [0, 0], rotate: 90 },
    });
    rect.composeMatrix();
    const box = rect.getMaxBoundingBox();
    const { minX, minY, maxX, maxY } = box.getMinAndMaxPoint();
    expect(maxX - minX).toBeCloseTo(50, 3);
    expect(maxY - minY).toBeCloseTo(100, 3);
  });

  it('组合变换（rotate+scale+skew）下 composedMatrix 有限且不 NaN', () => {
    const rect = new ICERect({
      width: 100,
      height: 50,
      transform: { translate: [10, 20], scale: [1.5, 0.8], skew: [15, 0], rotate: 30 },
    });
    const m: any = rect.composeMatrix();
    expect(m).toBeTruthy();
    for (let i = 0; i < 6; i++) {
      expect(Number.isFinite(m[i])).toBe(true);
    }
  });

  it('深嵌套（>3 层）absoluteLinearMatrix 正确累积祖先缩放', () => {
    const root = new ICEGroup({
      width: 100,
      height: 100,
      transform: { translate: [0, 0], scale: [2, 2], skew: [0, 0], rotate: 0 },
    });
    const l1 = new ICEGroup({
      width: 50,
      height: 50,
      transform: { translate: [0, 0], scale: [3, 3], skew: [0, 0], rotate: 0 },
    });
    const l2 = new ICEGroup({
      width: 20,
      height: 20,
      transform: { translate: [0, 0], scale: [4, 4], skew: [0, 0], rotate: 0 },
    });
    const leaf = new ICERect({ width: 5, height: 5 });
    root.addChild(l1);
    l1.addChild(l2);
    l2.addChild(leaf);

    leaf.composeMatrix();
    const abs = leaf.state.absoluteLinearMatrix as number[];
    expect(abs[0]).toBeCloseTo(2 * 3 * 4, 6); // scaleX = 24
    expect(abs[3]).toBeCloseTo(2 * 3 * 4, 6); // scaleY = 24
  });
});
