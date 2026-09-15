/**
 * 密集版面下的对齐稳定性（2026-09-15 修复「拖动时引导线 / 图元乱跳」）。
 *
 * 现场：ice-smart-water 的工艺流程图有 34 个单元，拖动任一单元时引导线每步换一条、
 * 图元被拽得正负交替（实测 24 步里 19 步在吸附、单步位移变化最大 18 世界 px）。
 * 三条根因与对策：
 *   ① 每帧重挑"最近候选" → **粘性目标**（命中即锁定，超出 threshold + hysteresis 才重挑）
 *   ② 候选来自**全图所有**图元（含另一轴上毫无关系的） → **相关性门控**（proximity）
 *   ③ 等间距候选是「任意两个目标中心的中点」这种全图级别的线，最密也最不可预期 → **默认关闭**
 *
 * 这里用"网格版面 + 横穿拖动"复刻那个量级，把三条都钉住。
 */
import AlignmentGuideManager, { computeSnap } from '../../src/control-panel/AlignmentGuideManager';

function box(minX: number, minY: number, maxX: number, maxY: number) {
  return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

/** 与生产默认值一致的选项（threshold 3 / hysteresis 1 / spacing false / proximity 0 = 关）。 */
function defaults(over = {}) {
  return {
    threshold: 3,
    hysteresis: 1,
    edge: true,
    center: true,
    spacing: false,
    proximity: 80,
    guideStyle: {},
    guideZIndex: 1,
    guideWidth: 1,
    ...over,
  } as any;
}

describe('密集版面下的对齐稳定性', () => {
  /**
   * 造一个假组件：只满足 `AlignmentGuideManager.__computeTargets` 需要的表面
   * （state / 世界包围盒 / 子节点）。
   */
  function fakeComponent(opts: any = {}) {
    const {
      id,
      minX = 0,
      minY = 0,
      maxX = 10,
      maxY = 10,
      draggable = true,
      interactive = true,
      children = [],
      isLine = false,
    } = opts;
    const c: any = {
      state: { id, draggable, interactive },
      isLine,
      isControlPanel: false,
      parentNode: null,
      childNodes: [],
      getMaxBoundingBox: () => ({ getMinAndMaxPoint: () => ({ minX, minY, maxX, maxY }) }),
    };
    c.childNodes = children;
    children.forEach((k: any) => {
      k.parentNode = c;
    });
    return c;
  }

  it('候选目标：展开别人容器里的子节点，但排除被拖组件自己的子树', () => {
    // 容器结构：池 > 泳道 > 任务；另有独立顶层节点
    const task = fakeComponent({ id: 'task', minX: 20, maxX: 30 });
    const lane = fakeComponent({ id: 'lane', minX: 10, maxX: 10.5, children: [task] });
    const pool = fakeComponent({ id: 'pool', minX: 0, maxX: 0.5, children: [lane] });
    const standalone = fakeComponent({ id: 'standalone', minX: 500, maxX: 510 });
    const manager: any = new AlignmentGuideManager({ evtBus: { on: () => undefined, off: () => undefined } });
    manager.ice = { childNodes: [pool, standalone] };

    // ① 拖泳道内的任务：目标 = 池 + 泳道 + 独立节点。
    //    早先只取顶层时，这里只剩「池」（包住整张图，边永远不在阈值内）→ 提示线恒为 0。
    manager.active = task;
    expect(manager.__computeTargets().map((b: any) => b.minX)).toEqual([0, 10, 500]);

    // ② 拖池：它自己连同整棵子树（泳道、任务）都随它平移，一个都不能当目标
    //    （否则会命中"子树相对父级的固定间距"，父组件永远偏着指针走）
    manager.active = pool;
    expect(manager.__computeTargets().map((b: any) => b.minX)).toEqual([500]);
  });

  it('粘性目标：连续拖动不再"每步换一条对齐线"', () => {
    // 两条线相距 3px（`100` / `103`），都在阈值内 —— 密集版面的最小复现
    const targets = [box(100, 0, 140, 40), box(103, 0, 143, 40)];
    const at100 = box(100, 0, 120, 20); // 左边缘 100：贴住第一条线
    const at102 = box(102, 0, 122, 20); // 右移 2px：离第一条 2px、离第二条 1px

    const first = computeSnap(at100, targets, 3, 3, defaults());
    expect(first.x.guideValue).toBe(100);

    // 旧行为（不传 locked）：改挑"当前最近"的那条线 → 引导线跳到 103
    const withoutSticky = computeSnap(at102, targets, 3, 3, defaults());
    expect(withoutSticky.x.guideValue).toBe(103);

    // 新行为（把上一帧结果作为 locked 传回）：只要没超出 threshold+hysteresis=3，就**继续锁在 100**
    const sticky = computeSnap(at102, targets, 3, 3, defaults(), first);
    expect(sticky.x.guideValue).toBe(100);
    expect(sticky.x.delta).toBeCloseTo(-2, 6);
  });

  it('相关性门控：另一轴上相距很远的目标不再产生吸附（它带来横跨全屏的误导性引导线）', () => {
    const source = box(100, 0, 180, 36);
    const farAway = box(102, 2000, 260, 2036); // 边缘落在阈值内，但 Y 上离了 2000

    // 旧行为（不限距离）：吸附到 2000 之外那条边，且提示线会从 y=0 拉到 y=2036
    const ungated = computeSnap(source, [farAway], 3, 3, defaults(), null, { x: Infinity, y: Infinity });
    expect(ungated.x.guideValue).toBe(102);
    expect(ungated.x.guideEnd).toBeGreaterThan(2000);

    // 新行为（门控 160 世界 px ≈ 当前 0.5× 缩放下的 80 屏幕 px）：这条边不参与
    const gated = computeSnap(source, [farAway], 3, 3, defaults(), null, { x: 160, y: 160 });
    expect(gated.x).toBeNull();
  });

  it('等间距：应用显式开启、且源盒塞得进空隙时才给出候选', () => {
    // 两个目标中心 250 / 550，边缘之间空隙 200px；源盒宽 100px → 放得下
    const targets = [box(200, 500, 300, 600), box(500, 500, 600, 600)];
    const source = box(352, 500, 452, 560); // centerX = 402，中点 400
    const on = computeSnap(source, targets, 3, 3, defaults({ spacing: true, center: false })).x;
    expect(on && on.type).toBe('spacing');
    // 默认（关闭）下没有这条候选：这是 2.11.1 起的生产默认，2.11.2 没改
    expect(computeSnap(source, targets, 3, 3, defaults({ center: false })).x).toBeNull();
  });

  it('等间距的间隙门控：源盒塞不进空隙就不给候选（密集版面的噪声来源）', () => {
    // 两个目标紧挨着：边缘之间只剩 20px 空隙，中心中点 310
    const targets = [box(200, 500, 300, 600), box(320, 500, 420, 600)];
    const only = defaults({ spacing: true, edge: false, center: false }); // 显式开启，且只看 spacing 一种关系

    // 源盒宽 100px，塞不进 20px 的空隙 → 旧实现照样给"中点线"，现在不给
    const wide = box(260, 500, 360, 560); // centerX = 310 = 中点
    expect(computeSnap(wide, targets, 3, 3, only).x).toBeNull();

    // 换成塞得进去的窄盒（宽 20px = 空隙），同一条中点候选就回来了
    const narrow = box(300, 500, 320, 560); // centerX = 310 = 中点
    const hit = computeSnap(narrow, targets, 3, 3, only).x;
    expect(hit && hit.type).toBe('spacing');
    expect(hit && hit.guideValue).toBe(310);
  });

  it('管理器默认值：阈值 3 / 滞回 1 / 门控关 / 等间距关（2.11.2 未改已发布的默认）', () => {
    const manager: any = new AlignmentGuideManager({ evtBus: { on: () => undefined, off: () => undefined } });
    expect(manager.options.threshold).toBe(3); // 引擎默认不动（密集版面由应用侧收紧到 2）
    expect(manager.options.hysteresis).toBe(1);
    expect(manager.options.proximity).toBe(0); // 门控默认关（会挡掉合法的远距离对齐）
    expect(manager.options.spacing).toBe(false); // 等间距默认关（工艺图实测：路径上平均 183 条中点候选）
    expect(manager.options.edge).toBe(true);
    expect(manager.options.center).toBe(true);
  });

  it('粘性目标逐帧重算 delta：元素"钉"在目标线上，而不是跟着指针漂', () => {
    const targets = [box(100, 0, 140, 40)];
    const first = computeSnap(box(101, 0, 121, 20), targets, 3, 3, defaults());
    expect(first.x.delta).toBeCloseTo(-1, 6);
    // 指针继续右移 2：仍然锁在同一条线（x=100），delta 随之增长 —— 元素位置不变
    const second = computeSnap(box(103, 0, 123, 20), targets, 3, 3, defaults(), first);
    expect(second.x.guideValue).toBe(100);
    expect(second.x.delta).toBeCloseTo(-3, 6);
    // 再移 2（|delta|=5 > threshold+hysteresis=3）→ 解锁，不再吸附
    const third = computeSnap(box(105, 0, 125, 20), targets, 3, 3, defaults(), second);
    expect(third.x).toBeNull();
  });
});
