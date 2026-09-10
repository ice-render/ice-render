/**
 * 默认 props 原型共享（内存优化）的语义回归。
 *
 * 2026-09-10 把每实例的默认 props 大对象改为 Object.create(DEFAULT_PROPS) 原型继承，
 * 验证：默认值可读、用户字段写时复制、共享默认不被污染、state 仍是独立完整副本、id/zIndex 唯一。
 */
import ICERect from '../../src/graphic/shape/ICERect';

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

beforeAll(() => {
  const root = require('../../src/cross-platform/root').default;
  root.createPath2D = () => new FakePath2D();
});

describe('ICEComponent 默认 props 原型共享', () => {
  it('默认字段通过原型继承可读', () => {
    const r = new ICERect({});
    expect(r.props.style.fillStyle).toBe('red');
    expect(r.props.stroke).toBe(true);
    expect(r.props.transform.rotate).toBe(0);
    expect(r.props.display).toBe(true);
  });

  it('用户传入 style 不污染共享默认值', () => {
    const a = new ICERect({ style: { fillStyle: '#333333' } });
    expect(a.props.style.fillStyle).toBe('#333333');

    const b = new ICERect({});
    expect(b.props.style.fillStyle).toBe('red'); // 共享默认未被污染
  });

  it('state 是独立完整副本，修改 state 不影响 props', () => {
    const r = new ICERect({ style: { fillStyle: '#333333' } });
    expect(r.state.style.fillStyle).toBe('#333333');

    r.state.style.fillStyle = '#ffffff';
    expect(r.props.style.fillStyle).toBe('#333333');
  });

  it('id 每实例唯一，zIndex 随实例递增', () => {
    const a = new ICERect({});
    const b = new ICERect({});
    expect(a.props.id).not.toBe(b.props.id);
    expect(a.props.zIndex).not.toBe(b.props.zIndex);
  });

  it('蚂蚁线写 props.animations 只覆盖实例自身', () => {
    const a = new ICERect({});
    const b = new ICERect({});
    a.props.animations = { __flow: { from: 0, to: 1, loop: true } };
    expect(a.props.animations.__flow).toBeTruthy();
    expect(b.props.animations).toEqual({});
  });

  it('直接写 state 标量字段不污染 props 与共享默认', () => {
    const a = new ICERect({ width: 50, height: 30 });
    const b = new ICERect({});

    // 模拟 calcComponentParams/measureText 等直接写 state.width（不经 setState）
    a.state.width = 999;
    expect(a.props.width).toBe(50);
    expect(b.state.width).toBe(10); // 另一个实例不受影响
  });

  it('跨组件直接写 state 不污染 props', () => {
    const a = new ICERect({});
    // 模拟 AnimationManager / ICEGroup 直接写 el.state.interactive
    a.state.interactive = false;
    expect(a.props.interactive).toBe(true);
    const b = new ICERect({});
    expect(b.state.interactive).toBe(true);
  });
});
