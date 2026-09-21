/**
 * `renderSubtreeTo()`：**把一棵子树渲染到指定上下文**。
 *
 * 背景（2026-09-21 真机复现两次的同一类事故）：`ICEComponent.renderTo()` 只画「组件自己」，
 * 子组件是渲染队列遍历着画的 —— 应用把复合组件（`ICEGroup` 子类）整个 `renderTo()` 进离屏画布时
 * 得到的是**空白位图**：容器自身不落墨，子组件一个都没画。IED 的虚拟文档批量精灵就这样产出
 * 21 张全空白的位图，画面上"只有管线、一个图元都没有"。
 *
 * 本文件钉住三件事：
 * 1. `renderTo(容器)` 确实什么都不画（保持引擎"逐组件"语义，`ObjectCache` / 静态层依赖它）；
 * 2. `renderSubtreeTo(容器, ctx)` 把整棵子树画出来，**且与渲染队列同源**（先父后子、同级派生件在前）；
 * 3. 基准矩阵对整棵子树一致（离屏出图的平移/缩放口径）。
 */
jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  class FakeNativePath2D {
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
  }
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder(new FakeNativePath2D()) } };
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

import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import { renderSubtreeTo } from '../../src/renderer/render-subtree';

/** 记录调用序列的 2D 上下文替身：任何未知成员都当方法，属性赋值原样收下。 */
function makeCtx() {
  const calls: string[] = [];
  const target: any = { calls, __transforms: [] as number[][] };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) {
        return obj[prop];
      }
      return (...args: any[]) => {
        calls.push(String(prop));
        if (prop === 'setTransform' || prop === 'transform') {
          obj.__transforms.push(args as number[]);
        }
      };
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    },
  });
}

/** 给组件的 `doRender` 挂一个可辨识的标签，记录"这一帧到底有哪些组件真的绘制了"。 */
function label(component: any, name: string, seen: string[]): void {
  const original = component.doRender.bind(component);
  component.doRender = function () {
    seen.push(name);
    return original();
  };
}

function makeTree() {
  const group = new ICEGroup({ left: 10, top: 20, width: 200, height: 100 });
  const outer = new ICERect({
    left: 0,
    top: 0,
    width: 120,
    height: 60,
    fill: true,
    stroke: false,
    style: { fillStyle: '#ff0000' },
  });
  const innerGroup = new ICEGroup({ left: 5, top: 5, width: 60, height: 40 });
  const inner = new ICERect({
    left: 0,
    top: 0,
    width: 30,
    height: 20,
    fill: true,
    stroke: false,
    style: { fillStyle: '#0000ff' },
  });
  innerGroup.addChild(inner);
  group.addChild(outer);
  group.addChild(innerGroup);
  group.composeMatrix();
  return { group, outer, innerGroup, inner };
}

describe('renderSubtreeTo：子树渲染', () => {
  it('`renderTo(容器)` 只画容器自己，一个子组件都不画（引擎的"逐组件"语义，别改）', () => {
    const { group, outer, innerGroup, inner } = makeTree();
    const ctx = makeCtx();
    const seen: string[] = [];
    label(group, 'group', seen);
    label(outer, 'outer', seen);
    label(innerGroup, 'innerGroup', seen);
    label(inner, 'inner', seen);

    group.renderTo(ctx, null);

    expect(seen).toEqual(['group']);
  });

  it('`renderSubtreeTo(容器)` 递归画出整棵子树（含两层嵌套）', () => {
    const { group, outer, innerGroup, inner } = makeTree();
    const ctx = makeCtx();
    const seen: string[] = [];
    label(group, 'group', seen);
    label(outer, 'outer', seen);
    label(innerGroup, 'innerGroup', seen);
    label(inner, 'inner', seen);

    renderSubtreeTo(group, ctx, null);

    // 先父后子；两个容器都不落墨，真正上屏的是两个矩形（各自的 doRender 会 fill）
    expect(seen).toEqual(['group', 'outer', 'innerGroup', 'inner']);
    expect((ctx.calls as string[]).filter((c) => c === 'fill').length).toBeGreaterThanOrEqual(2);
    expect((ctx.__transforms as number[][]).length).toBeGreaterThanOrEqual(3);
    expect(outer.path2D).toBeTruthy();
    expect(inner.path2D).toBeTruthy();
  });

  it('绘制次序与渲染队列同源：派生部件在前、真实子节点在后', () => {
    const group = new ICEGroup({ left: 0, top: 0, width: 100, height: 100 });
    const base = new ICERect({ left: 0, top: 0, width: 100, height: 100, fill: true, stroke: false, zIndex: 'auto' });
    const content = new ICERect({ left: 10, top: 10, width: 40, height: 40, fill: true, stroke: false, zIndex: -100 });
    group.addChild(base);
    group.addChild(content);
    // 声明 content 才是真实子节点 → base 属于"容器的底"，必须先画
    (group as any).getSerializableChildren = () => [content];
    group.composeMatrix();

    const ctx = makeCtx();
    const seen: string[] = [];
    label(group, 'group', seen);
    label(base, 'base', seen);
    label(content, 'content', seen);

    renderSubtreeTo(group, ctx, null);
    expect(seen).toEqual(['group', 'base', 'content']);
  });

  it('基准矩阵对整棵子树一致（离屏出图的平移口径）', () => {
    const { group } = makeTree();
    const ctx = makeCtx();
    const base = [2, 0, 0, 2, -40, -60];

    renderSubtreeTo(group, ctx, base);

    const transforms = ctx.__transforms as number[][];
    expect(transforms.length).toBeGreaterThanOrEqual(3);
    // 每个组件渲染时都应把 base 叠进 CTM（前两项为 base 的缩放）
    for (const m of transforms) {
      expect(m[0]).not.toBe(1);
    }
  });
});
