import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEFlowLayout from '../../src/layout/ICEFlowLayout';

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
};

describe('ICEFlowLayout（对齐 Swing FlowLayout）', () => {
  it('left 对齐：子组件从左到右横向排列', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    const r2 = new ICERect({ width: 80, height: 40 });
    const r3 = new ICERect({ width: 60, height: 40 });
    group.addChild(r1);
    group.addChild(r2);
    group.addChild(r3);

    group.setLayout(new ICEFlowLayout({ gap: 10 }));

    expect(r1.state.left).toBe(0);
    expect(r2.state.left).toBe(110); // 100 + 10
    expect(r3.state.left).toBe(200); // 110 + 80 + 10
    expect(r1.state.top).toBe(0);
    expect(r2.state.top).toBe(0);
    expect(r3.state.top).toBe(0);
  });

  it('换行：超出容器宽度时换到下一行', () => {
    const group = new ICEGroup({ width: 150, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    const r2 = new ICERect({ width: 100, height: 40 });
    group.addChild(r1);
    group.addChild(r2);

    group.setLayout(new ICEFlowLayout({ gap: 10 }));

    expect(r1.state.left).toBe(0);
    expect(r1.state.top).toBe(0);
    expect(r2.state.left).toBe(0); // 换行
    expect(r2.state.top).toBe(50); // 40 + 10
  });

  it('center 对齐', () => {
    const group = new ICEGroup({ width: 300, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    group.addChild(r1);

    group.setLayout(new ICEFlowLayout({ gap: 10, align: 'center' }));

    expect(r1.state.left).toBe(100); // (300 - 100) / 2
  });

  it('right 对齐', () => {
    const group = new ICEGroup({ width: 300, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    group.addChild(r1);

    group.setLayout(new ICEFlowLayout({ gap: 10, align: 'right' }));

    expect(r1.state.left).toBe(200); // 300 - 100
  });

  it('doLayout 手动触发布局', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    const r1 = new ICERect({ width: 100, height: 40 });
    group.addChild(r1);

    group.setLayout(new ICEFlowLayout({ gap: 10 }));
    r1.setState({ left: 999 }); // 手动打乱
    group.doLayout(); // 重新布局

    expect(r1.state.left).toBe(0); // 恢复布局位置
  });
});

describe('layout 继承（子容器默认继承父层布局）', () => {
  it('子容器默认继承父层布局（同一实例）', () => {
    const parent = new ICEGroup({ width: 500, height: 200 });
    const child = new ICEGroup({ width: 400, height: 100 });
    parent.addChild(child);

    const layout = new ICEFlowLayout({ gap: 10 });
    parent.setLayout(layout);

    expect(child.layoutManager).toBe(layout); // 继承同一实例
  });

  it('子容器显式设置布局后，不继承父层', () => {
    const parent = new ICEGroup({ width: 500, height: 200 });
    const child = new ICEGroup({ width: 400, height: 100 });
    parent.addChild(child);

    const childLayout = new ICEFlowLayout({ gap: 30 });
    child.setLayout(childLayout); // 子容器显式设置

    const parentLayout = new ICEFlowLayout({ gap: 10 });
    parent.setLayout(parentLayout); // 父设置，但子已显式，不覆盖

    expect(child.layoutManager).toBe(childLayout); // 子保持自己的
    expect(parent.layoutManager).toBe(parentLayout);
  });

  it('嵌套容器：孙容器默认递归继承祖父布局', () => {
    const grand = new ICEGroup({ width: 500, height: 300 });
    const parent = new ICEGroup({ width: 400, height: 200 });
    const child = new ICEGroup({ width: 300, height: 100 });
    grand.addChild(parent);
    parent.addChild(child);

    const layout = new ICEFlowLayout({ gap: 10 });
    grand.setLayout(layout);

    expect(parent.layoutManager).toBe(layout); // 父继承
    expect(child.layoutManager).toBe(layout); // 孙递归继承
  });

  it('显式布局的子容器，其后代继承它的布局而非祖父的', () => {
    const grand = new ICEGroup({ width: 500, height: 300 });
    const parent = new ICEGroup({ width: 400, height: 200 });
    const child = new ICEGroup({ width: 300, height: 100 });
    grand.addChild(parent);
    parent.addChild(child);

    const parentLayout = new ICEFlowLayout({ gap: 30 });
    parent.setLayout(parentLayout); // parent 显式

    const grandLayout = new ICEFlowLayout({ gap: 10 });
    grand.setLayout(grandLayout); // grand 设置，parent 已显式跳过

    expect(parent.layoutManager).toBe(parentLayout); // parent 保持显式
    expect(child.layoutManager).toBe(parentLayout); // child 继承 parent 的（而非 grand）
  });
});

describe('layout 接管：禁用后代手动变换（transformable=false）', () => {
  it('setLayout 后子组件 transformable=false', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    const rect = new ICERect({ width: 100, height: 40 });
    group.addChild(rect);
    expect(rect.state.transformable).toBe(true); // 默认可变换

    group.setLayout(new ICEFlowLayout({ gap: 10 }));
    expect(rect.state.transformable).toBe(false); // 布局接管
  });

  it('任意层级：孙组件也被禁用', () => {
    const grand = new ICEGroup({ width: 500, height: 300 });
    const parent = new ICEGroup({ width: 400, height: 200 });
    const rect = new ICERect({ width: 100, height: 40 });
    grand.addChild(parent);
    parent.addChild(rect);

    grand.setLayout(new ICEFlowLayout({ gap: 10 }));
    expect(rect.state.transformable).toBe(false); // 孙组件
  });

  it('setLayout 之后 addChild 的新子组件也被禁用', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    group.setLayout(new ICEFlowLayout({ gap: 10 }));

    const rect = new ICERect({ width: 100, height: 40 });
    group.addChild(rect);
    expect(rect.state.transformable).toBe(false);
  });

  it('未设置 layout 的容器，子组件保持可变换', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    const rect = new ICERect({ width: 100, height: 40 });
    group.addChild(rect);
    expect(rect.state.transformable).toBe(true);
  });
});
