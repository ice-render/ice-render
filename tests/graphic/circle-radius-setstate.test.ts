/**
 * `ICECircle.setState({ radius })` 必须**真的改画出来的圆**（2026-09-20 修）。
 *
 * 背景：`radius` 只在构造函数里被翻译成 `radiusX/radiusY`，而绘制读的是后者。
 * 运行时只写 `radius` 的结果是「state 说半径 40、画出来还是 28」—— 属性改了画面不动。
 * 这个缺陷由 worker 镜像回归抓出来：镜像按文档重建会走构造函数（按 40 画），
 * 与主线程的"只改了 state.radius"两边对不上，像素差 2655 个。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});
global.Path2D = class {
  ellipse() {}
  arc() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  rect() {}
} as any;

import ICECircle from '../../src/graphic/shape/ICECircle';

describe('ICECircle 半径的运行时写值', () => {
  it('setState({ radius })：radiusX/radiusY/width/height 一起走，命令流真的换半径', () => {
    const circle = new ICECircle({ left: 0, top: 0, radius: 28 });
    expect(circle.state.radiusX).toBe(28);

    circle.setState({ radius: 40 });

    expect(circle.state.radius).toBe(40);
    expect(circle.state.radiusX).toBe(40);
    expect(circle.state.radiusY).toBe(40);
    expect(circle.state.width).toBe(80);
    expect(circle.state.height).toBe(80);

    // 命令流里也必须是 40（绘制读的就是它）
    const path: any = (circle as any).createPathObject();
    expect(path._commands[0]).toEqual(['ellipse', 40, 40, 40, 40, 0, 0, Math.PI * 2, true]);
  });

  it('setState({ width })：反推 radius，仍然是正圆（与构造期 width 写法等价）', () => {
    const circle = new ICECircle({ left: 0, top: 0, radius: 10 });
    circle.setState({ width: 100 });
    expect(circle.state.radius).toBe(50);
    expect(circle.state.radiusX).toBe(50);
    expect(circle.state.radiusY).toBe(50);
    expect(circle.state.height).toBe(100);
  });

  it('setState({ height }) 同理', () => {
    const circle = new ICECircle({ left: 0, top: 0, radius: 10 });
    circle.setState({ height: 60 });
    expect(circle.state.radius).toBe(30);
    expect(circle.state.radiusY).toBe(30);
    expect(circle.state.width).toBe(60);
  });

  it('椭圆式的 radiusX/radiusY 写法仍然可用（父类负责 width/height 换算）', () => {
    const circle = new ICECircle({ left: 0, top: 0, radius: 10 });
    circle.setState({ radiusX: 30 });
    expect(circle.state.radiusX).toBe(30);
    expect(circle.state.width).toBe(60);
    // 只改 radiusX 时 radiusY 保持原值（正方形被打破，这是调用方明确要的）
    expect(circle.state.radiusY).toBe(10);
  });
});
