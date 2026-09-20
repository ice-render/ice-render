/**
 * `ice.requestRepaint()`：应用层"手动请求重绘"的**公开表达**。
 *
 * 以前这类场景（自绘 painter 读了新数据 / 换视口 / 资源就绪）只能写 `ice.dirty = true` ——
 * 直接摸引擎内部字段。全家族实测有 60 处这种写法（smart-water 23 / game 32 / agent-console 5）。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});

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
} as any;

import EventBus from '../../src/event/EventBus';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import CanvasRenderer from '../../src/renderer/CanvasRenderer';

function makeIce() {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.renderer = new CanvasRenderer(ice);
  return ice;
}

describe('ice.requestRepaint()', () => {
  it('置脏 + 让渲染队列在下一帧重排（等价于原来手写的 ice.dirty = true）', () => {
    const ice = makeIce();
    const a = new ICERect({ width: 10, height: 10 });
    ice.addChild(a);
    ice.dirty = false;
    const spy = jest.spyOn(ice.renderer as any, 'markQueueDirty');

    const returned = ice.requestRepaint();

    expect(ice.dirty).toBe(true);
    expect(spy).toHaveBeenCalled();
    expect(returned).toBe(ice); // 可链式
  });

  it('幂等：连着调不报错、状态一致', () => {
    const ice = makeIce();
    ice.dirty = false;
    ice.requestRepaint();
    ice.requestRepaint();
    expect(ice.dirty).toBe(true);
  });

  it('没有渲染器（headless / 未 init）也能调', () => {
    const ice: any = new ICE();
    ice.evtBus = new EventBus();
    ice.childNodes = [];
    ice.toolNodes = [];
    ice.dirty = false;
    expect(() => ice.requestRepaint()).not.toThrow();
    expect(ice.dirty).toBe(true);
  });
});
