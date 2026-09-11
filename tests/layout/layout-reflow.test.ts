/**
 * 布局重排契约：随增删自动重排 + 布局前测量。
 *
 * 契约：
 * - `addChild` / `removeChild` 后立即重排（旧实现只在 `setLayout()` 时排一次，
 *   之后增删都不重排 → 加进去的子组件位置全错、删掉后留下空位）
 * - `addChildren` / `removeChildren` 批量操作只在结束后排一次（避免逐个重排的 O(n²)）
 * - 排布前先测量子组件：布局读的是 `child.state.width/height`，而它们要等首次渲染才算出来
 *   （文本更要量测字形），旧实现不测量 → 首次布局拿到的全是 0/哨兵值
 * - 新增的容器型子组件继承父层布局（与 setLayout 的传播规则一致）
 * - 未设置布局时增删不改变子组件位置
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEText from '../../src/graphic/text/ICEText';
import ICEBoxLayout from '../../src/layout/ICEBoxLayout';
import ICEGridLayout from '../../src/layout/ICEGridLayout';

function makeGroup(width = 400, height = 200) {
  return new ICEGroup({ left: 0, top: 0, width, height });
}

describe('布局随增删自动重排', () => {
  it('addChild 后立即重排（BoxLayout 沿 x 依次排列）', () => {
    const group: any = makeGroup();
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));

    const a: any = new ICERect({ width: 40, height: 20 });
    const b: any = new ICERect({ width: 50, height: 20 });
    group.addChild(a);
    expect(a.state.left).toBe(0);

    group.addChild(b);
    expect(a.state.left).toBe(0);
    expect(b.state.left).toBe(50); // 40 + gap 10

    const c: any = new ICERect({ width: 30, height: 20 });
    group.addChild(c);
    expect(c.state.left).toBe(110); // 50 + 50 + 10
  });

  it('addChildren 批量后重排一次，最终位置正确', () => {
    const group: any = makeGroup();
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 5 }));

    const rects = [10, 20, 30].map((w) => new ICERect({ width: w, height: 10 }));
    group.addChildren(rects as any);

    expect(rects.map((r: any) => r.state.left)).toEqual([0, 15, 40]);
  });

  it('removeChild 后重排，后面的组件前移（不留空位）', () => {
    const group: any = makeGroup();
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    const a: any = new ICERect({ width: 40, height: 20 });
    const b: any = new ICERect({ width: 50, height: 20 });
    const c: any = new ICERect({ width: 30, height: 20 });
    group.addChildren([a, b, c] as any);
    expect(c.state.left).toBe(110);

    group.removeChild(b);

    expect(a.state.left).toBe(0);
    expect(c.state.left).toBe(50); // 40 + 10
  });

  it('removeChildren 批量删除后重排一次', () => {
    const group: any = makeGroup();
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    const rects = [10, 20, 30, 40].map((w) => new ICERect({ width: w, height: 10 }));
    group.addChildren(rects as any);

    group.removeChildren([rects[0], rects[2]] as any);

    expect(rects[1].state.left).toBe(0);
    expect(rects[3].state.left).toBe(30); // 20 + 10
  });

  it('未设置布局时增删不改变子组件位置', () => {
    const group: any = makeGroup();
    const a: any = new ICERect({ left: 77, top: 88, width: 40, height: 20 });
    group.addChild(a);
    expect(a.state.left).toBe(77);
    expect(a.state.top).toBe(88);

    group.removeChild(a);
    expect(a.state.left).toBe(77);
  });
});

describe('布局前测量', () => {
  it('文本子组件用真实量测宽度参与布局（不必等一帧渲染）', () => {
    const group: any = makeGroup(600, 200);
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));

    const text: any = new ICEText({ text: 'hello' });
    // 桩 ctx：等宽 10px/字符，字形高 10px
    text.ctx = {
      font: '',
      measureText: (s: string) => ({ width: s.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    };

    const box: any = new ICERect({ width: 40, height: 20 });
    group.addChildren([text, box] as any);

    // 文本宽 50（5 字符 × 10），因此第二个组件应从 50 + 10 开始
    expect(text.state.width).toBe(50);
    expect(box.state.left).toBe(60);
  });

  it('未量测的文本（无 ctx）不会让布局崩掉', () => {
    const group: any = makeGroup();
    group.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));
    const text: any = new ICEText({ text: 'hello' });
    const box: any = new ICERect({ width: 40, height: 20 });

    expect(() => group.addChildren([text, box] as any)).not.toThrow();
    expect(Number.isFinite(box.state.left)).toBe(true);
  });
});

describe('嵌套容器继承布局', () => {
  it('setLayout 时传播给已有子容器，且子容器内的子组件被排布', () => {
    const outer: any = makeGroup(600, 300);
    const inner: any = makeGroup(200, 100);
    outer.addChild(inner); // 先加，后设布局

    outer.setLayout(new ICEBoxLayout({ axis: 'x', gap: 10 }));

    const a: any = new ICERect({ width: 30, height: 10 });
    const b: any = new ICERect({ width: 20, height: 10 });
    inner.addChildren([a, b] as any);

    expect(inner.layoutManager).toBe(outer.layoutManager);
    expect(a.state.left).toBe(0);
    expect(b.state.left).toBe(40); // 30 + 10
  });

  it('setLayout 之后新增的子容器也继承布局，其子组件被排布', () => {
    const outer: any = makeGroup(600, 300);
    outer.setLayout(new ICEGridLayout({ cols: 2, gapX: 10, gapY: 10 }));

    const later: any = makeGroup(200, 100);
    outer.addChild(later); // setLayout 之后才加入

    const a: any = new ICERect({ width: 30, height: 10 });
    later.addChild(a);

    expect(later.layoutManager).toBe(outer.layoutManager);
    expect(a.state.left).toBe(0);
    expect(a.state.top).toBe(0);
  });

  it('子容器显式设置自己的布局时不被父层覆盖', () => {
    const outer: any = makeGroup(600, 300);
    const inner: any = makeGroup(200, 100);
    const ownLayout = new ICEGridLayout({ cols: 3 });
    inner.setLayout(ownLayout);
    outer.addChild(inner);
    outer.setLayout(new ICEBoxLayout({ axis: 'y' }));

    expect(inner.layoutManager).toBe(ownLayout);
  });
});
