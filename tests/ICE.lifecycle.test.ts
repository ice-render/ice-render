/**
 * ICE 生命周期：init 幂等、接受 HTMLCanvasElement / CanvasRenderingContext2D、
 * destroy 释放全局资源（Manager / 全局总线 / canvas 事件）并支持重新 init。
 *
 * 背景：React（StrictMode 双挂载、路由切换、HMR）会反复挂载卸载，
 * 必须能安全 init/destroy 而不累积全局监听与帧循环。
 *
 * 这里把各 Manager 用 jest.mock 替换成轻量替身，只验证生命周期编排本身。
 */

jest.mock('../src/renderer/CanvasRenderer', () => {
  return class MockCanvasRenderer {
    static instances: any[] = [];
    stop = jest.fn();
    start() {
      return this;
    }
    constructor() {
      (this.constructor as any).instances.push(this);
    }
  };
});

jest.mock('../src/animation/AnimationManager', () => {
  return class MockAnimationManager {
    static instances: any[] = [];
    stop = jest.fn();
    start() {
      return this;
    }
    constructor() {
      (this.constructor as any).instances.push(this);
    }
  };
});

jest.mock('../src/control-panel/ICEControlPanelManager', () => {
  return class MockControlPanelManager {
    static instances: any[] = [];
    stop = jest.fn();
    start() {
      return this;
    }
    constructor() {
      (this.constructor as any).instances.push(this);
    }
  };
});

jest.mock('../src/graphic/link/ICELinkSlotManager', () => {
  return class MockLinkSlotManager {
    static instances: any[] = [];
    stop = jest.fn();
    start() {
      return this;
    }
    constructor() {
      (this.constructor as any).instances.push(this);
    }
  };
});

jest.mock('../src/control-panel/AlignmentGuideManager', () => {
  return class MockAlignmentGuideManager {
    constructor() {}
  };
});

jest.mock('../src/event/DOMEventDispatcher', () => {
  return class MockDOMEventDispatcher {
    static instances: any[] = [];
    stopped = false;
    start() {
      return this;
    }
    constructor() {
      (this.constructor as any).instances.push(this);
    }
  };
});

jest.mock('../src/persistence/Serializer', () => class MockSerializer {});
jest.mock('../src/persistence/Deserializer', () => class MockDeserializer {});
jest.mock('../src/util/ImageCache', () => class MockImageCache {});

import ICE from '../src/ICE';
import FrameManager from '../src/FrameManager';
import DOMEventInterceptor from '../src/event/DOMEventInterceptor';

// mock 工厂直接把类作为模块导出（源码侧经 babel interop 拿到 default），因此这里直接 require 类本身
const CanvasRenderer: any = require('../src/renderer/CanvasRenderer');
const AnimationManager: any = require('../src/animation/AnimationManager');
const ControlPanelManager: any = require('../src/control-panel/ICEControlPanelManager');
const LinkSlotManager: any = require('../src/graphic/link/ICELinkSlotManager');
const DOMEventDispatcher: any = require('../src/event/DOMEventDispatcher');

const globalRoot: any = global;

function makeCanvas() {
  const ctx = { clearRect: jest.fn() };
  return {
    width: 800,
    height: 600,
    oncontextmenu: null as any,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
}

function resetAll() {
  globalRoot.requestFrame = jest.fn();
  globalRoot.addEventListener = jest.fn();
  globalRoot.removeEventListener = jest.fn();
  FrameManager.evtBuses.length = 0;
  FrameManager.stopped = false;
  DOMEventInterceptor.evtBuses.length = 0;
  DOMEventInterceptor.__handlers = null;
  [CanvasRenderer, AnimationManager, ControlPanelManager, LinkSlotManager, DOMEventDispatcher].forEach((Mock: any) => {
    Mock.instances.length = 0;
  });
}

describe('ICE.init / destroy 生命周期', () => {
  beforeEach(resetAll);

  it('init 接受 HTMLCanvasElement 并完成基础配置', () => {
    const canvas = makeCanvas();
    const ice: any = new ICE();

    const returned = ice.init(canvas);

    expect(returned).toBe(ice);
    expect(ice.canvasEl).toBe(canvas);
    expect(ice.canvasWidth).toBe(800);
    expect(ice.canvasHeight).toBe(600);
    expect(typeof canvas.oncontextmenu).toBe('function'); // 屏蔽原生右键菜单
    expect(FrameManager.evtBuses).toContain(ice.evtBus);
    expect(DOMEventInterceptor.evtBuses).toContain(ice.evtBus);
  });

  it('init 接受 CanvasRenderingContext2D', () => {
    const canvas = makeCanvas();
    const fakeCtx = { canvas }; // 2d context 自身不暴露 getContext
    const ice: any = new ICE();

    ice.init(fakeCtx);

    expect(ice.canvasEl).toBe(canvas);
    expect(ice.ctx).toBe(canvas.getContext('2d'));
  });

  it('init 幂等：同一 canvas 重复 init 不重复创建 Manager（StrictMode 双挂载场景）', () => {
    const canvas = makeCanvas();
    const ice: any = new ICE();

    expect(ice.init(canvas)).toBe(ice);
    expect(ice.init(canvas)).toBe(ice);

    expect(CanvasRenderer.instances.length).toBe(1);
    expect(AnimationManager.instances.length).toBe(1);
    expect(ControlPanelManager.instances.length).toBe(1);
    expect(LinkSlotManager.instances.length).toBe(1);
    expect(FrameManager.evtBuses.length).toBe(1);
    expect(DOMEventInterceptor.evtBuses.length).toBe(1);
  });

  it('已初始化后再 init 到另一个 canvas 会抛错（需先 destroy）', () => {
    const ice: any = new ICE();
    ice.init(makeCanvas());

    expect(() => ice.init(makeCanvas())).toThrow();
  });

  it('destroy 停止各 Manager、注销全局总线、解绑 canvas 事件', () => {
    const canvas = makeCanvas();
    const ice: any = new ICE();
    ice.init(canvas);

    const renderer = CanvasRenderer.instances[0];
    const animationManager = AnimationManager.instances[0];
    const controlPanelManager = ControlPanelManager.instances[0];
    const linkSlotManager = LinkSlotManager.instances[0];
    const dispatcher = DOMEventDispatcher.instances[0];
    const bus = ice.evtBus;

    ice.destroy();

    expect(renderer.stop).toHaveBeenCalled();
    expect(animationManager.stop).toHaveBeenCalled();
    expect(controlPanelManager.stop).toHaveBeenCalled();
    expect(linkSlotManager.stop).toHaveBeenCalled();
    expect(dispatcher.stopped).toBe(true);

    expect(FrameManager.evtBuses).not.toContain(bus);
    expect(DOMEventInterceptor.evtBuses).not.toContain(bus);
    expect(FrameManager.stopped).toBe(true); // 没有总线了，帧循环要停
    expect(canvas.oncontextmenu).toBeNull();
    expect(ice.ctx).toBeNull();
    expect(ice.canvasEl).toBeNull();
  });

  it('destroy 之后可以重新 init（React 重新挂载）', () => {
    const canvas = makeCanvas();
    const ice: any = new ICE();
    ice.init(canvas);
    ice.destroy();

    expect(() => ice.init(canvas)).not.toThrow();
    expect(FrameManager.evtBuses).toContain(ice.evtBus);
    expect(FrameManager.stopped).toBe(false);
    expect(CanvasRenderer.instances.length).toBe(2);
  });

  it('未初始化时 destroy 是安全的空操作', () => {
    const ice: any = new ICE();
    expect(() => ice.destroy()).not.toThrow();
  });
});
