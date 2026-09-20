/**
 * 布局的「可组合」能力（2026-09-14 补齐）：
 *
 * 1. **按内容自适应**：`fitContent: true` 的容器把自身尺寸调成内容尺寸（`getPreferredSize`），
 *    而且是**自底向上**先量好再用 —— 父布局嵌一个子容器时读到的是它的自然尺寸，不是空盒子；
 * 2. **内外距**：容器的 `padding` + 子项的 `margin`，七个布局统一口径；
 * 3. **布局与交互可以共存**：`setLayout(manager, { disableTransform: false })` 不再关掉拖拽；
 * 4. **网格**：`rows` 反推列数 + `gridSpan` 跨格；**箱式**：`grow` 按比例吃剩余空间。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});

import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEFlowLayout from '../../src/layout/ICEFlowLayout';
import ICEBoxLayout from '../../src/layout/ICEBoxLayout';
import ICEGridLayout from '../../src/layout/ICEGridLayout';
import ICEBorderLayout from '../../src/layout/ICEBorderLayout';

describe('按内容自适应（fitContent）', () => {
  it('容器的尺寸由内容决定（FlowLayout 排成一行）', () => {
    const group: any = new ICEGroup({ fitContent: true });
    group.addChild(new ICERect({ width: 40, height: 20 }));
    group.addChild(new ICERect({ width: 60, height: 30 }));
    group.setLayout(new ICEFlowLayout({ gap: 10 }));

    expect(group.state.width).toBe(110); // 40 + 10 + 60
    expect(group.state.height).toBe(30);
  });

  it('自底向上：父布局读到的是子容器的自然尺寸（不是它的空盒子）', () => {
    // 子容器：按内容自适应（三块 20×10，横向 gap 5 → 70×10）
    const inner: any = new ICEGroup({ fitContent: true, left: 0, top: 0 });
    inner.addChild(new ICERect({ width: 20, height: 10 }));
    inner.addChild(new ICERect({ width: 20, height: 10 }));
    inner.addChild(new ICERect({ width: 20, height: 10 }));
    inner.setLayout(new ICEBoxLayout({ axis: 'x', gap: 5 }));
    expect(inner.state.width).toBe(70);

    // 父容器：纵向排列；子容器排第二，应该落在第一块（高 30）之下
    const outer: any = new ICEGroup({ width: 200, height: 200 });
    const head = new ICERect({ width: 100, height: 30 });
    outer.addChild(head);
    outer.addChild(inner);
    outer.setLayout(new ICEBoxLayout({ axis: 'y', gap: 10 }));

    expect(inner.state.top).toBe(40); // 30 + gap 10 —— 说明父布局用的是子容器的自然尺寸
  });

  it('padding 与 margin 一起进首选尺寸与落位', () => {
    const group: any = new ICEGroup({ fitContent: true, padding: 8 });
    const a = new ICERect({ width: 40, height: 20, margin: { left: 4, right: 6, top: 2, bottom: 3 } });
    group.addChild(a);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));

    // 内容盒外的 padding：宽 = 8 + (4+40+6) + 8 = 66；高 = 8 + (2+20+3) + 8 = 41
    expect(group.state.width).toBe(66);
    expect(group.state.height).toBe(41);
    // 落位带上 margin 偏移
    expect(a.state.left).toBe(12); // padding 8 + marginLeft 4
    expect(a.state.top).toBe(10); // padding 8 + marginTop 2
  });

  it('容器 padding 之内排布（Flow 换行宽度按内容盒算）', () => {
    const group: any = new ICEGroup({ width: 100, height: 100, padding: 10 });
    const a = new ICERect({ width: 40, height: 20 });
    const b = new ICERect({ width: 40, height: 20 });
    group.addChild(a);
    group.addChild(b);
    group.setLayout(new ICEFlowLayout({ gap: 10 }));

    expect(a.state.left).toBe(10);
    expect(a.state.top).toBe(10);
    // 内容盒宽 80：40 + 10 + 40 = 90 > 80 → b 换行到第二行
    expect(b.state.left).toBe(10);
    expect(b.state.top).toBe(40); // 10 + 20 + gap 10
  });
});

describe('布局与交互共存（disableTransform）', () => {
  it('默认接管交互：子项不再可拖拽 / 变换（保持历史行为）', () => {
    const group: any = new ICEGroup({ width: 200, height: 100 });
    const child = new ICERect({ width: 40, height: 20, draggable: true, transformable: true });
    group.addChild(child);
    group.setLayout(new ICEBoxLayout({ axis: 'x' }));

    expect(child.state.draggable).toBe(false);
    expect(child.state.transformable).toBe(false);
  });

  it('disableTransform: false → 布局照常摆位，但子项仍可拖拽', () => {
    const group: any = new ICEGroup({ width: 200, height: 100 });
    const child = new ICERect({ width: 40, height: 20, draggable: true });
    group.addChild(child);
    group.setLayout(new ICEBoxLayout({ axis: 'x' }), { disableTransform: false });

    expect(child.state.draggable).toBe(true);
    expect(child.state.left).toBe(0); // 布局依然生效

    // 之后新加的子项也不再被接管
    const later = new ICERect({ width: 30, height: 20, draggable: true });
    group.addChild(later);
    expect(later.state.draggable).toBe(true);
    expect(later.state.left).toBe(45); // 40 + 默认 gap 5
  });
});

describe('ICEGridLayout：rows 与跨格', () => {
  it('只给 rows 时按子项数量反推列数', () => {
    const group: any = new ICEGroup({ width: 400, height: 300 });
    const rects = [0, 1, 2, 3, 4, 5].map(() => new ICERect({ width: 50, height: 20 }));
    rects.forEach((r) => group.addChild(r));
    group.setLayout(new ICEGridLayout({ rows: 2, gapX: 10, gapY: 5 }));

    // 6 个 / 2 行 = 3 列 → 第 4 个（下标 3）在第 2 行第 1 列
    expect(rects[3].state.left).toBe(0);
    expect(rects[3].state.top).toBe(25); // 20 + gapY 5
  });

  it('gridSpan 跨列：表头占满一行，后续子项自动让位', () => {
    const group: any = new ICEGroup({ width: 400, height: 300 });
    const header = new ICERect({ width: 120, height: 20, gridSpan: { colSpan: 2 } });
    const a = new ICERect({ width: 50, height: 20 });
    const b = new ICERect({ width: 50, height: 20 });
    const c = new ICERect({ width: 50, height: 20 });
    [header, a, b, c].forEach((r) => group.addChild(r));
    group.setLayout(new ICEGridLayout({ cols: 2, gapX: 10, gapY: 5 }));

    // header 占第 0 行两列；a/b 落到第 1 行，c 落到第 2 行第 0 列
    expect(header.state.left).toBe(0);
    expect(header.state.top).toBe(0);
    expect(a.state.left).toBe(0);
    expect(a.state.top).toBe(25);
    // 列 0 宽 = max(表头 120/2=60, a/b/c 的 50) = 60 → 第 2 列从 70 开始
    expect(b.state.left).toBe(70);
    expect(c.state.left).toBe(0);
    expect(c.state.top).toBe(50); // 第 2 行
  });

  it('gridSpan 跨行：侧栏占两行', () => {
    const group: any = new ICEGroup({ width: 400, height: 300 });
    const side = new ICERect({ width: 40, height: 60, gridSpan: { rowSpan: 2 } });
    const a = new ICERect({ width: 50, height: 20 });
    const b = new ICERect({ width: 50, height: 20 });
    [side, a, b, new ICERect({ width: 50, height: 20 })].forEach((r) => group.addChild(r));
    group.setLayout(new ICEGridLayout({ cols: 2, gapX: 10, gapY: 5 }));

    expect(side.state.left).toBe(0);
    expect(side.state.top).toBe(0);
    // 列 0 宽 = max(侧栏 40, 第 3 行的 50) = 50 → 第 2 列从 60 开始（列宽全局对齐）
    expect(a.state.left).toBe(60);
    expect(b.state.left).toBe(60);
    // 第 0 行高 = max(跨两行的侧栏 60/2=30, a 的 20) = 30 → 第 2 行从 35 开始
    expect(b.state.top).toBe(35);
  });
});

describe('ICEBoxLayout：grow 分配剩余空间', () => {
  it('grow 按比例吃掉剩余空间（定宽侧栏 + 自适应内容区）', () => {
    const group: any = new ICEGroup({ width: 300, height: 100 });
    const fixed = new ICERect({ width: 80, height: 20 });
    const flexible = new ICERect({ width: 50, height: 20, grow: 1 });
    group.addChild(fixed);
    group.addChild(flexible);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));

    // 300 - (80 + 10 + 50) = 160 全给 flexible
    expect(fixed.state.left).toBe(0);
    expect(fixed.state.width).toBe(80); // 没声明 grow 的不变
    expect(flexible.state.left).toBe(90);
    expect(flexible.state.width).toBe(210); // 50 + 160
  });

  it('多个 grow 按权重分；容器比内容小的时候不压缩', () => {
    const group: any = new ICEGroup({ width: 300, height: 100 });
    const a = new ICERect({ width: 50, height: 20, grow: 1 });
    const b = new ICERect({ width: 50, height: 20, grow: 3 });
    group.addChild(a);
    group.addChild(b);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));
    expect(a.state.width).toBe(50 + 200 * 0.25); // 剩余 200：1:3
    expect(b.state.width).toBe(50 + 200 * 0.75);

    const tight: any = new ICEGroup({ width: 60, height: 100 });
    const c = new ICERect({ width: 50, height: 20, grow: 1 });
    const d = new ICERect({ width: 50, height: 20, grow: 1 });
    tight.addChild(c);
    tight.addChild(d);
    tight.setLayout(new ICEBoxLayout({ axis: 'x', gap: 0 }));
    expect(c.state.width).toBe(50);
    expect(d.state.width).toBe(50);
  });
});

describe('约束值非法时提示（不再静默落到 center）', () => {
  it('ICEBorderLayout 对未知区域给一条 warn，并按 center 处理', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const group: any = new ICEGroup({ width: 200, height: 100 });
    const child = new ICERect({ width: 40, height: 20, layoutConstraint: 'top' });
    group.addChild(child);
    group.setLayout(new ICEBorderLayout());

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('layoutConstraint');
    // 按 center 处理：被拉伸到整个内容盒
    expect(child.state.width).toBe(200);
    expect(child.state.height).toBe(100);

    // 再排一次不重复刷屏
    group.doLayout();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
