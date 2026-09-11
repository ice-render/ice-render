/**
 * ICE.addChild / addTool / removeChild / removeTool 的 O(1) 去重与语义回归。
 *
 * 2026-09-10 把 indexOf 去重换成 WeakSet，避免批量挂载时 O(n^2)。
 * 本测试锁定：重复添加只保留一次、删除后可重新添加、addTool 去重作用在工具集合。
 */
import ICE from '../src/ICE';
import ICERect from '../src/graphic/shape/ICERect';
import EventBus from '../src/event/EventBus';

class FakePath2D {
  _isPolyfill = true;
  _commands: any[] = [];
  moveTo(...a: any[]) {
    this._commands.push(['moveTo', ...a]);
  }
  lineTo(...a: any[]) {
    this._commands.push(['lineTo', ...a]);
  }
  rect(...a: any[]) {
    this._commands.push(['rect', ...a]);
  }
  closePath() {}
}

function makeICE() {
  const root = require('../src/cross-platform/root').default;
  root.createPath2D = () => new FakePath2D();

  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = root;
  ice.ctx = {};
  ice.evtBus = new EventBus();
  ice.dirty = true;
  // 桩必须反映真实 AnimationManager 的契约（destory 会调 remove 摘除动画）
  ice.animationManager = { add: jest.fn(), remove: jest.fn() };
  ice.renderer = { markQueueDirty: jest.fn() };
  return ice;
}

describe('ICE 挂载去重语义', () => {
  it('重复 addChild 同一组件只保留一次', () => {
    const ice = makeICE();
    const r = new ICERect({ width: 10, height: 10 });
    ice.addChild(r);
    ice.addChild(r);
    expect(ice.childNodes.length).toBe(1);
  });

  it('removeChild 后可重新 addChild', () => {
    const ice = makeICE();
    const r = new ICERect({ width: 10, height: 10 });
    ice.addChild(r);
    ice.removeChild(r);
    ice.addChild(r);
    expect(ice.childNodes.length).toBe(1);
  });

  it('removeChild 不存在的组件不误删数组末尾', () => {
    const ice = makeICE();
    const a = new ICERect({ width: 10, height: 10 });
    const b = new ICERect({ width: 10, height: 10 });
    ice.addChild(a);
    ice.addChild(b);
    const outsider = new ICERect({ width: 10, height: 10 });
    ice.removeChild(outsider);
    expect(ice.childNodes.length).toBe(2);
    expect(ice.childNodes[1]).toBe(b);
  });

  it('addTool 去重作用在工具集合', () => {
    const ice = makeICE();
    const t = new ICERect({ width: 10, height: 10 });
    ice.addTool(t);
    ice.addTool(t);
    expect(ice.toolNodes.length).toBe(1);
  });
});
