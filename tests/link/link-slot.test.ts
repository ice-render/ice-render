import ICELinkSlot from '../../src/graphic/link/ICELinkSlot';
import ICERect from '../../src/graphic/shape/ICERect';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

describe('ICELinkSlot 插槽位置', () => {
  it('updatePosition 实时重算宿主矩阵，不读过期缓存', () => {
    const host = new ICERect({ left: 10, top: 10, width: 40, height: 30 });
    host.getMinBoundingBox(true); // 生成缓存（位于 left=10/top=10）
    host.setState({ left: 100, top: 100 }); // 移动但未渲染，缓存过期

    const slot = new ICELinkSlot({ position: 'T', radius: 5 });
    slot.hostComponent = host;
    (slot as any).updatePosition();

    // 宿主顶边中点在全局坐标 (120, 100)，减去半径 5 后为 (115, 95)
    expect(slot.state.left).toBeCloseTo(115, 5);
    expect(slot.state.top).toBeCloseTo(95, 5);
  });
});
