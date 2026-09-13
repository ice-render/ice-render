/**
 * 运行期动画诊断（`AnimationManager.getDiagnostics()`）的回归。
 *
 * 与 `validateAnimations()`（运行前纯校验）的关系：**同一组稳定码**。
 * 这条链路让"跑起来才发现配置被跳过"也变成可读、可上报的结构化数据（而不是只进 console）。
 */
import AnimationManager from '../../src/animation/AnimationManager';
import { ICE_ANIMATION_DIAGNOSTIC_CODES as CODES } from '../../src/animation/validate-animations';

function makeManager() {
  const ice: any = { evtBus: { on: () => {}, off: () => {}, trigger: () => {} } };
  return new AnimationManager(ice);
}

function makeEl(animations: any) {
  return {
    props: { id: 'el-1', animations },
    state: { left: 0, top: 0, interactive: true },
    setState(newState: any) {
      Object.assign(this.state, newState);
    },
  };
}

describe('运行期动画诊断', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('非法取值被跳过时记一条 VALUE_NOT_INTERPOLATABLE（带 path）', () => {
    const mgr: any = makeManager();
    const el = makeEl({ 'style.fillStyle': { from: '#fff', to: '#000', duration: 100 } });
    mgr.add(el);
    mgr.tween(el);

    const diagnostics = mgr.getDiagnostics();
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].code).toBe(CODES.VALUE_NOT_INTERPOLATABLE);
    expect(diagnostics[0].path).toBe('style.fillStyle');
    expect(diagnostics[0].severity).toBe('error');
    expect(warn).toHaveBeenCalled();
  });

  it('非法 duration 记 DURATION_INVALID；非法 keyframes 记 KEYFRAMES_INVALID', () => {
    const mgr: any = makeManager();
    const el = makeEl({ left: { from: 0, to: 10, duration: 0 } });
    mgr.add(el);
    mgr.tween(el);
    expect(mgr.getDiagnostics().map((d: any) => d.code)).toEqual([CODES.DURATION_INVALID]);

    const mgr2: any = makeManager();
    const el2 = makeEl({ 'transform.scale': { keyframes: [{ value: [1, 1] }], duration: 100 } });
    mgr2.add(el2);
    mgr2.tween(el2);
    expect(mgr2.getDiagnostics().map((d: any) => d.code)).toEqual([CODES.KEYFRAMES_INVALID]);
    expect(mgr2.getDiagnostics()[0].path).toBe('transform.scale');
  });

  it('未知缓动回退 linear 时记 EASING_UNKNOWN（与编译期校验同码）', () => {
    const mgr: any = makeManager();
    const el = makeEl({ left: { from: 0, to: 10, duration: 100, easing: 'easeOutBack' } });
    mgr.add(el);
    mgr.tween(el, 0);
    mgr.tween(el, 50);
    const diagnostics = mgr.getDiagnostics();
    expect(diagnostics.map((d: any) => d.code)).toEqual([CODES.EASING_UNKNOWN]);
    expect(diagnostics[0].path).toBe('left');
  });

  it('同一配置每帧重复出错只记一条（按 code|path 去重）', () => {
    const mgr: any = makeManager();
    const el = makeEl({ left: { from: 'a', to: 'b', duration: 100 } });
    mgr.add(el);
    for (let i = 0; i < 5; i++) {
      mgr.tween(el, i);
    }
    expect(mgr.getDiagnostics().length).toBe(1);
  });

  it('clearDiagnostics() 清空；合法配置不产生诊断', () => {
    const mgr: any = makeManager();
    const bad = makeEl({ left: { from: 'a', to: 'b', duration: 100 } });
    mgr.add(bad);
    mgr.tween(bad, 0);
    expect(mgr.getDiagnostics().length).toBe(1);
    mgr.clearDiagnostics();
    expect(mgr.getDiagnostics()).toEqual([]);

    warn.mockClear(); // 上面那条非法配置已经 warn 过，这里只看"合法配置是否安静"
    const mgr2: any = makeManager();
    const good = makeEl({ left: { from: 0, to: 100, duration: 100, easing: 'out' } });
    mgr2.add(good);
    mgr2.tween(good, 0);
    mgr2.tween(good, 50);
    expect(mgr2.getDiagnostics()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});
