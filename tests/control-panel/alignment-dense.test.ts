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

  it('等间距候选默认关闭：只在中点附近才命中（构造场景），且默认选项里它就是关的', () => {
    // 两个目标中心 250 / 550 → 中点 400；源中心贴近 400 时，只有"等间距"这一种关系会命中
    const targets = [box(200, 500, 300, 600), box(500, 500, 600, 600)];
    const source = box(352, 500, 452, 560); // centerX = 402
    expect(computeSnap(source, targets, 3, 3, defaults({ spacing: false, center: false })).x).toBeNull();
    const on = computeSnap(source, targets, 3, 3, defaults({ spacing: true, center: false })).x;
    expect(on && on.type).toBe('spacing');
  });

  it('管理器默认值：阈值 3 / 滞回 1 / 门控关 / 等间距关（后两项决定"不跳"）', () => {
    const manager: any = new AlignmentGuideManager({ evtBus: { on: () => undefined, off: () => undefined } });
    expect(manager.options.threshold).toBe(3); // 引擎默认不动（密集版面由应用侧收紧到 2）
    expect(manager.options.hysteresis).toBe(1);
    expect(manager.options.proximity).toBe(0); // 门控默认关（会挡掉合法的远距离对齐）
    expect(manager.options.spacing).toBe(false);
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
