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

/**
 * 布局**不继承**（2026-09-15 改，对齐 Java Swing 的 `Container.setLayout`）：
 * 父容器设布局只影响自己怎么摆子项，子容器用**自己的**策略排自己的子项；
 * 父布局只负责给子容器摆位置（Swing 里 `layout()` 只调 `layoutContainer(this)`）。
 *
 * 旧实现会把父层策略递归灌给所有后代，等于把父容器的排版规则套进子组件内部
 * （按钮文字、输入框前后缀都会被重摆）—— 见 `layout-swing-semantics.test.ts`。
 */
describe('layout 不继承（各容器持自己的策略）', () => {
  it('子容器不继承父层布局', () => {
    const parent = new ICEGroup({ width: 500, height: 200 });
    const child = new ICEGroup({ width: 400, height: 100 });
    parent.addChild(child);

    parent.setLayout(new ICEFlowLayout({ gap: 10 }));

    expect(parent.layoutManager).toBeTruthy();
    expect(child.layoutManager).toBe(null);
  });

  it('子容器要排自己的子项，得自己 setLayout', () => {
    const parent = new ICEGroup({ width: 500, height: 200 });
    const child = new ICEGroup({ width: 400, height: 100 });
    const leaf = new ICERect({ width: 30, height: 10 });
    const leaf2 = new ICERect({ width: 30, height: 10 });
    parent.addChild(child);
    child.addChildren([leaf, leaf2]);
    parent.setLayout(new ICEFlowLayout({ gap: 10 }));

    // 父层布局只管摆 child 自己的位置，不会替它排内部
    expect(leaf2.state.left).toBe(0);

    const childLayout = new ICEFlowLayout({ gap: 5 });
    child.setLayout(childLayout);
    expect(child.layoutManager).toBe(childLayout);
    expect(leaf2.state.left).toBe(35);
  });

  it('嵌套容器：孙容器不继承祖父布局', () => {
    const grand = new ICEGroup({ width: 500, height: 300 });
    const parent = new ICEGroup({ width: 400, height: 200 });
    const child = new ICEGroup({ width: 300, height: 100 });
    grand.addChild(parent);
    parent.addChild(child);

    grand.setLayout(new ICEFlowLayout({ gap: 10 }));

    expect(parent.layoutManager).toBe(null);
    expect(child.layoutManager).toBe(null);
  });
});

describe('layout 接管：禁用后代手动变换和拖动', () => {
  it('setLayout 后子组件 transformable=false 且 draggable=false', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    const rect = new ICERect({ width: 100, height: 40 });
    group.addChild(rect);
    expect(rect.state.transformable).toBe(true); // 默认可变换
    expect(rect.state.draggable).toBe(true); // 默认可拖动

    group.setLayout(new ICEFlowLayout({ gap: 10 }));
    expect(rect.state.transformable).toBe(false); // 布局接管
    expect(rect.state.draggable).toBe(false); // 也不能拖动
  });

  it('任意层级：孙组件也被禁用（transformable + draggable）', () => {
    const grand = new ICEGroup({ width: 500, height: 300 });
    const parent = new ICEGroup({ width: 400, height: 200 });
    const rect = new ICERect({ width: 100, height: 40 });
    grand.addChild(parent);
    parent.addChild(rect);

    grand.setLayout(new ICEFlowLayout({ gap: 10 }));
    expect(rect.state.transformable).toBe(false); // 孙组件
    expect(rect.state.draggable).toBe(false);
  });

  it('setLayout 之后 addChild 的新子组件也被禁用', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    group.setLayout(new ICEFlowLayout({ gap: 10 }));

    const rect = new ICERect({ width: 100, height: 40 });
    group.addChild(rect);
    expect(rect.state.transformable).toBe(false);
    expect(rect.state.draggable).toBe(false);
  });

  it('未设置 layout 的容器，子组件保持可变换可拖动', () => {
    const group = new ICEGroup({ width: 500, height: 200 });
    const rect = new ICERect({ width: 100, height: 40 });
    group.addChild(rect);
    expect(rect.state.transformable).toBe(true);
    expect(rect.state.draggable).toBe(true);
  });
});
