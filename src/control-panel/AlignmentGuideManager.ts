/**
 * 对齐吸附管理器（smart guides + snapping）。
 *
 * 拖拽组件时，把「被拖组件的关键坐标」与「其他组件的关键坐标」做最近匹配，
 * 命中阈值内自动吸附，并在工具层显示提示线。默认禁用，应用层显式 enable 后才生效。
 *
 * 性能设计（保证拖拽顺滑）：
 *   1. mousedown 时缓存所有目标组件的世界盒，拖拽过程复用（目标组件不移动，不重复 compose）；
 *   2. 提示线是两根复用的隐藏 ICERect，只改坐标 + display，不 addTool/removeTool，不重建渲染队列；
 *   3. 滞回（hysteresis）：已吸附的轴用更大的脱离阈值，避免阈值边界来回抖。
 */
import ICE from '../ICE';
import { token } from '../theme/ICETheme';
import ICERect from '../graphic/shape/ICERect';
import ICEComponent from '../graphic/ICEComponent';

export interface SnapBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

/**
 * 候选线在**源盒**上的锚点。
 *
 * 粘性目标（见 `computeSnap` 的 `locked` 参数）靠它每帧重算 delta：
 * 记住"这条线对的是源盒的哪条边"，就能在源盒移动后继续用同一条目标线，
 * 而不是重新去全局挑一条最近的。
 */
export type SnapAnchor = 'minX' | 'maxX' | 'centerX' | 'minY' | 'maxY' | 'centerY';

/** 某一轴上的源盒锚点候选（顺序即"优先匹配"顺序）。 */
function anchorsOf(axis: 'x' | 'y'): SnapAnchor[] {
  return axis === 'x' ? ['minX', 'maxX', 'centerX'] : ['minY', 'maxY', 'centerY'];
}

/**
 * 从候选自身的 `delta` / `guideValue` 反推「源盒锚点 + 目标盒」，供粘性目标逐帧重算。
 *
 * 为什么反推而不是让每个候选显式带上：候选是在 `computeSnap` 里批量生成的（每个目标 4 条边
 * 候选 + 中心 + 等间距），显式传递要改十几处构造点；反推只依赖候选已有的三个数字，
 * 且用两个 Map 缓存，实测开销可忽略（候选 ~400 个、目标 33 个）。
 */
function attachIdentity(
  candidate: SnapResult,
  source: SnapBox,
  targets: SnapBox[],
  anchorCache: Map<string, SnapAnchor>,
  targetCache: Map<string, SnapBox | null>
): void {
  const axis = candidate.axis;
  const anchors = anchorsOf(axis);

  const anchorKey = `${axis}:${candidate.guideValue}:${candidate.delta}`;
  let anchor = anchorCache.get(anchorKey);
  if (!anchor) {
    anchor = anchors.find((k) => Math.abs(candidate.guideValue - source[k] - candidate.delta) < 1e-6) || anchors[2];
    anchorCache.set(anchorKey, anchor);
  }
  candidate.anchor = anchor;

  const boxKey = `${axis}:${candidate.guideValue}`;
  if (!targetCache.has(boxKey)) {
    const keys = anchors;
    let found: SnapBox | null = null;
    for (const t of targets) {
      if (keys.some((k) => Math.abs(t[k] - candidate.guideValue) < 1e-6)) {
        found = t;
        break;
      }
    }
    targetCache.set(boxKey, found);
  }
  candidate.targetBox = targetCache.get(boxKey) || null;
}

/**
 * 用**当前**源盒刷新一条已锁定的候选：目标线不动，delta 与提示线跨度跟着源盒重算。
 * （提示线跨度永远覆盖"源盒 ∪ 目标盒"，所以拖到哪儿线都不会跟元素脱开。）
 */
function refreshSnap(held: SnapResult, source: SnapBox): SnapResult {
  const anchor: SnapAnchor = held.anchor || anchorsOf(held.axis)[2];
  const next: SnapResult = { ...held, delta: held.guideValue - source[anchor] };
  const target = held.targetBox;
  if (held.axis === 'x') {
    next.guideStart = target ? Math.min(source.minY, target.minY) : Math.min(source.minY, held.guideStart);
    next.guideEnd = target ? Math.max(source.maxY, target.maxY) : Math.max(source.maxY, held.guideEnd);
  } else {
    next.guideStart = target ? Math.min(source.minX, target.minX) : Math.min(source.minX, held.guideStart);
    next.guideEnd = target ? Math.max(source.maxX, target.maxX) : Math.max(source.maxX, held.guideEnd);
  }
  return next;
}
export interface SnapResult {
  axis: 'x' | 'y';
  type: 'edge' | 'center' | 'spacing';
  /** 对齐目标坐标 - 源坐标，吸附时应加到 left/top。 */
  delta: number;
  /** 对齐线的世界坐标（X 对齐是 x 值，Y 对齐是 y 值）。 */
  guideValue: number;
  /** 提示线在另一轴上的起点/终点（世界坐标）。 */
  guideStart: number;
  guideEnd: number;
  /** 源盒锚点（粘性目标重算 delta 用；内部生成，不传则视为中心）。 */
  anchor?: SnapAnchor;
  /** 对齐目标盒（粘性目标重算提示线跨度用；等间距候选存的是两端盒的并集）。 */
  targetBox?: SnapBox | null;
}

export interface SnapAxes {
  x: SnapResult | null;
  y: SnapResult | null;
}

export interface AlignmentGuideOptions {
  /** 磁吸阈值（屏幕像素），默认 3。 */
  threshold?: number;
  /** 滞回余量（屏幕像素）：已吸附轴脱离阈值 = threshold + hysteresis，默认 1。 */
  hysteresis?: number;
  /** 边缘对齐，默认 true。 */
  edge?: boolean;
  /** 中心对齐，默认 true。 */
  center?: boolean;
  /**
   * 等间距对齐，**默认 false**（2.11.1 起的默认，本次未改）。
   *
   * 语义是「让源盒居中在 a、b 两个目标之间」，用来把一列/一行元素排均匀。
   *
   * 为什么默认关：候选是「任意两个目标中心的中点」这种**全图级别**的线，O(n²)。
   * 实测（34 个单元的工艺图、阈值 2 屏幕 px）：拖动路径上平均**每一步有 183 条**中点候选，
   * 24 步里有 7 步会撞上某个中点（开启后吸附步数 11/24 → 13/24、换线 8 → 12）。
   * 抖动指标不受影响（相邻步最大位移变化 6.1、单步最大修正 4.4 与关闭时一致 —— 那是
   * "命中即锁定"的功劳），所以**是否开启按场景决定**：需要"排匀一列元素"的编辑器显式
   * `spacing: true` 即可，密集的工程图建议保持默认关闭。
   *
   * **判据带间隙门控**（2026-09-15 修）：只有源盒真的塞得进 a、b 之间那道空隙时才产生候选 ——
   * 挡住"两个紧挨着的图元的中点"这类放不下当前元素的无意义线。注意它**不负责压低整体密度**
   * （工艺图上只筛掉 183 条里的 5 条），密度得靠 threshold / proximity / 这个开关来控制。
   */
  spacing?: boolean;
  /**
   * 「相关性门控」的半径（**屏幕像素**，**默认 0 = 关闭**）：只在**另一轴**上与源盒相距不超过它的目标之间找对齐。
   *
   * 目的：让候选线只来自"看起来跟当前元素有关系"的那些对象。工艺图那种几十个图元的密集版面里，
   * 把全图所有图元的边/中心都当候选会让指针经常处在某条线的阈值内 ——
   * 实测 34 个单元的工艺图（阈值 2 屏幕 px）：候选沿拖动路径"≤4 世界 px"的概率，
   * **不限距离 44%（等于一直在吸附）**、门控 120 → 32%、**门控 80 → 23%**、门控 60 → 21%。
   * 但它**默认关闭**，因为它会挡掉合法的远距离对齐 —— 实测两处真实用法都需要 ≥105 屏幕 px：
   * 引擎 `examples/alignment/alignment-snap.html`（两个矩形 Y 相距 120px，缩放 1×）与
   * `ice-entity-designer` 的流程图对齐回归（两节点 Y 相距 130px，缩放 1.232×）。
   * 也就是说：只有在"版面极密、且确认不需要跨行对齐"的场景才值得打开（工艺图实测 80 → 吸附步数 11/24 → 7/24）。
   * 关掉时它的收益由 threshold / spacing 两项承担，见上面两条。
   * 传 0 表示不限距离（退回旧行为）。
   */
  proximity?: number;
  /** 提示线完整样式（透传给 canvas ctx），默认跟随主题的 chrome.guide.color。 */
  guideStyle?: Record<string, any>;
  /** 提示线 zIndex，默认在控制面板之上。 */
  guideZIndex?: number;
  /** 提示线宽（屏幕像素，按视口换算），默认 1。 */
  guideWidth?: number;
}

function toBox(minX: number, minY: number, maxX: number, maxY: number): SnapBox {
  return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

/**
 * 纯几何吸附计算：X/Y 两轴各自返回 |delta| 最小的命中候选。
 * thresholdX / thresholdY 分别是两轴的世界坐标阈值（调用方按视口与滞回换算）。
 *
 * **粘性目标（`locked`）**：传入上一帧已吸附的候选时，只要它还在阈值内就**继续用它**，
 * 不再回头去全局挑"当前最近"的那条。这是"密集场景下引导线与图元乱跳"的根因修复：
 * 目标一多，候选线就密（实测 34 个单元的工艺图上有 102 条 X 候选线、中位间距仅 2px，
 * 而阈值折合 12px），"每帧重挑最近"会让选中的目标线每步换一条 —— 引导线跳几十像素、
 * 图元被正负交替地拽 ±8px。
 */
export function computeSnap(
  source: SnapBox,
  targets: SnapBox[],
  thresholdX: number,
  thresholdY: number,
  options: Required<AlignmentGuideOptions>,
  locked?: SnapAxes | null,
  proximity: { x: number; y: number } = { x: Infinity, y: Infinity }
): SnapAxes {
  const result: SnapAxes = { x: null, y: null };

  // ① 粘性：已吸附的轴先看"还锁得住吗"，锁得住就定了（下面的全局挑选会跳过该轴）
  if (locked) {
    (['x', 'y'] as const).forEach((axis) => {
      const held = locked[axis];
      if (!held) return;
      const refreshed = refreshSnap(held, source);
      const threshold = axis === 'x' ? thresholdX : thresholdY;
      if (Math.abs(refreshed.delta) <= threshold) {
        result[axis] = refreshed;
      }
    });
  }

  const anchorCache = new Map<string, SnapAnchor>();
  const targetCache = new Map<string, SnapBox | null>();
  // 注意：粘性锁定与"该轴已选中"是两件事 —— 下面的 consider 仍要按 |delta| 最小挑，
  // 只有**已被粘性锁定**的轴才跳过全局挑选（否则会退化成"第一条候选胜出"）。
  const stickyLocked = { x: !!result.x, y: !!result.y };
  const consider = (candidate: SnapResult | null) => {
    if (!candidate) return;
    if (stickyLocked[candidate.axis]) return;
    attachIdentity(candidate, source, targets, anchorCache, targetCache);
    const slot = result[candidate.axis];
    if (!slot || Math.abs(candidate.delta) < Math.abs(slot.delta)) {
      result[candidate.axis] = candidate;
    }
  };

  for (const t of targets) {
    // 相关性门控：X 轴对齐只考虑"在 Y 上与源盒相近"的目标，Y 轴对齐同理。
    // 没有这道门控，图上另一头、与当前元素毫无关系的单元也会贡献候选线 ——
    // 实测 34 个单元的工艺图上有 102 条 X 候选线（中位间距仅 2px），而阈值折合 12px，
    // 于是指针**每一步**都会经过另一条候选线的窗口，元素被一颗颗"钉子"挨个吸住。
    const nearForX = t.maxY >= source.minY - proximity.y && t.minY <= source.maxY + proximity.y;
    const nearForY = t.maxX >= source.minX - proximity.x && t.maxX <= source.maxX + proximity.x;
    if (options.edge) {
      if (nearForX) {
        // 4 种"边对边"关系：目标左/右边 × 源左/右边（语义与历史一致）
        for (const targetEdge of [t.minX, t.maxX]) {
          for (const sourceEdge of [source.minX, source.maxX]) {
            consider({
              axis: 'x',
              type: 'edge',
              delta: targetEdge - sourceEdge,
              guideValue: targetEdge,
              guideStart: Math.min(source.minY, t.minY),
              guideEnd: Math.max(source.maxY, t.maxY),
            });
          }
        }
      }
      if (nearForY) {
        for (const targetEdge of [t.minY, t.maxY]) {
          for (const sourceEdge of [source.minY, source.maxY]) {
            consider({
              axis: 'y',
              type: 'edge',
              delta: targetEdge - sourceEdge,
              guideValue: targetEdge,
              guideStart: Math.min(source.minX, t.minX),
              guideEnd: Math.max(source.maxX, t.maxX),
            });
          }
        }
      }
    }
    if (options.center) {
      if (nearForX) {
        consider({
          axis: 'x',
          type: 'center',
          delta: t.centerX - source.centerX,
          guideValue: t.centerX,
          guideStart: Math.min(source.minY, t.minY),
          guideEnd: Math.max(source.maxY, t.maxY),
        });
      }
      if (nearForY) {
        consider({
          axis: 'y',
          type: 'center',
          delta: t.centerY - source.centerY,
          guideValue: t.centerY,
          guideStart: Math.min(source.minX, t.minX),
          guideEnd: Math.max(source.maxX, t.maxX),
        });
      }
    }
  }

  if (options.spacing) {
    // 等间距候选：「让源盒正好落在 a、b 两个目标中心的中点」。
    //
    // 但**只有源盒真的塞得进 a、b 之间的空隙**时才给这条候选。原实现不检查空隙，
    // 于是任意一对目标都贡献一条中点线（O(n²)），指针每挪一步都能撞上一条 ——
    // 而"两个紧挨着的图元的中点"根本放不下当前元素，那条线没有任何指导意义。
    // 实测（34 个单元的水务工艺图、阈值 2 屏幕 px）：不检查空隙时"≤4px 命中候选线"的概率
    // 从 36% 抬到 49%，这也是 2.11.1 一度把等间距默认关掉的原因。
    // 加上间隙门控后，功能保留（左右邻居之间确实有空位才出现），噪声回到边/中心同一量级。
    const sourceW = source.maxX - source.minX;
    const sourceH = source.maxY - source.minY;
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i];
        const b = targets[j];
        const minX = Math.min(a.centerX, b.centerX);
        const maxX = Math.max(a.centerX, b.centerX);
        // 空隙 = 左边那个的右边缘 → 右边那个的左边缘。
        const leftX = a.centerX <= b.centerX ? a : b;
        const rightX = leftX === a ? b : a;
        const gapX = rightX.minX - leftX.maxX;
        if (source.centerX > minX && source.centerX < maxX && gapX + 0.5 >= sourceW) {
          // 等间距候选同样过门控：两端都要与源盒在 Y 上相近，否则那是"全图中点"，没有指导意义
          const pairTop = Math.min(a.minY, b.minY);
          const pairBottom = Math.max(a.maxY, b.maxY);
          if (pairBottom >= source.minY - proximity.y && pairTop <= source.maxY + proximity.y) {
            const midX = (a.centerX + b.centerX) / 2;
            consider({
              axis: 'x',
              type: 'spacing',
              delta: midX - source.centerX,
              guideValue: midX,
              guideStart: Math.min(source.minY, a.minY, b.minY),
              guideEnd: Math.max(source.maxY, a.maxY, b.maxY),
            });
          }
        }
        const minY = Math.min(a.centerY, b.centerY);
        const maxY = Math.max(a.centerY, b.centerY);
        const leftY = a.centerY <= b.centerY ? a : b;
        const rightY = leftY === a ? b : a;
        const gapY = rightY.minY - leftY.maxY;
        if (source.centerY > minY && source.centerY < maxY && gapY + 0.5 >= sourceH) {
          const pairLeft = Math.min(a.minX, b.minX);
          const pairRight = Math.max(a.maxX, b.maxX);
          if (pairRight >= source.minX - proximity.x && pairLeft <= source.maxX + proximity.x) {
            const midY = (a.centerY + b.centerY) / 2;
            consider({
              axis: 'y',
              type: 'spacing',
              delta: midY - source.centerY,
              guideValue: midY,
              guideStart: Math.min(source.minX, a.minX, b.minX),
              guideEnd: Math.max(source.maxX, a.maxX, b.maxX),
            });
          }
        }
      }
    }
  }

  result.x = result.x && Math.abs(result.x.delta) <= thresholdX ? result.x : null;
  result.y = result.y && Math.abs(result.y.delta) <= thresholdY ? result.y : null;
  return result;
}

class AlignmentGuideManager {
  private ice: ICE;
  private options: Required<AlignmentGuideOptions> = {
    /**
     * 磁吸阈值（屏幕像素），默认 3。
     *
     * 阈值是**吸附半径**：它必须明显小于"候选线沿拖动路径的间距"，否则指针永远处在某条线的
     * 吸附带里（实测 34 个单元的水务工艺图：X 候选线沿路径间距约 14 世界 px，而阈值 6 屏幕 px
     * 在 0.5× 缩放下是 12 世界 px → 24 步里 19 步在吸附、相邻步位移变化最大 18px）。
     * 密集版面（领域设计器那种）请由应用显式收紧到 2，见 `ice-entity-designer` 的
     * `enableDesignerAlignmentGuides()`；**引擎默认值不动**（改成 2 会打破既有示例的合法吸附距离）。
     */
    threshold: 3,
    /**
     * 脱离阈值 = threshold + hysteresis：比进入阈值大一点，避免刚吸附就掉。
     * 保持 1（合计 3 屏幕 px）：这个"合计值"才是**拖动时元素最多偏离指针多少**，
     * 它直接决定"跳"的幅度 —— 实测 6 屏幕 px 合计时相邻步位移变化 18 世界 px，收到 3 屏幕 px 后是 6 世界 px。
     */
    hysteresis: 1,
    edge: true,
    center: true,
    /**
     * 等间距（居中在 a、b 之间）：默认关（见 `AlignmentGuideOptions.spacing` 的实测），
     * 开启时带间隙门控。抖动由"命中即锁定 + 不取整"保证，与这一项无关。
     */
    spacing: false,
    proximity: 0,
    guideStyle: { fillStyle: token('chrome.guide.color') },
    guideZIndex: 10000010,
    guideWidth: 1,
  };
  private enabled = false;
  private active: ICEComponent | null = null;
  private snapping = false;
  private intentLeft = 0;
  private intentTop = 0;
  private cachedTargets: SnapBox[] = [];
  private engagedX = false;
  private engagedY = false;
  /**
   * 当前**锁定的**对齐候选（每轴一条）：粘性目标的载体。
   *
   * 命中后一直沿用它，直到源盒移出 `threshold + hysteresis` —— 这样"哪条线"在拖动过程中是稳定的，
   * 不会因为旁边又出现一条更近的线就改主意（那正是密集场景下乱跳的来源）。
   */
  private lockedX: SnapResult | null = null;
  private lockedY: SnapResult | null = null;
  private guideX: ICERect | null = null;
  private guideY: ICERect | null = null;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  public enable(options: AlignmentGuideOptions = {}): this {
    this.options = { ...this.options, ...options };
    if (this.enabled) return this;
    this.enabled = true;
    this.ice.evtBus.on('mousedown', this.__onMouseDown, this);
    this.ice.evtBus.on('mouseup', this.__onMouseUp, this);
    return this;
  }

  public disable(): this {
    if (!this.enabled) return this;
    this.enabled = false;
    this.ice.evtBus.off('mousedown', this.__onMouseDown, this);
    this.ice.evtBus.off('mouseup', this.__onMouseUp, this);
    this.__detach();
    return this;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setOptions(options: AlignmentGuideOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  private __onMouseDown(evt: any): void {
    const c = evt && evt.target;
    if (!this.__isAlignmentParticipant(c)) return;
    this.__detach();
    this.active = c;
    this.intentLeft = c.state.left;
    this.intentTop = c.state.top;
    // 目标组件在拖拽期间不移动，mousedown 时一次算好并缓存。
    this.cachedTargets = this.__computeTargets();
    this.engagedX = false;
    this.engagedY = false;
    this.__ensureGuides();
    // 监听被拖组件自己的 mousemove（在引擎 moveGlobalPosition 之后执行），
    // 用独立的「意图位置」累计鼠标位移，避免吸附把 state.left 污染后反复拉回。
    c.on('mousemove', this.__onDrag, this);
  }

  private __onDrag(evt: any): void {
    if (!this.active || this.snapping) return;
    const dx = evt && typeof evt.movementX === 'number' ? evt.movementX : 0;
    const dy = evt && typeof evt.movementY === 'number' ? evt.movementY : 0;
    const scale = this.ice.viewport ? this.ice.viewport.scale : 1;
    this.intentLeft += dx / scale;
    this.intentTop += dy / scale;

    // 先归位到意图位置，再算吸附；吸附只是显示偏移，不污染意图位置。
    this.snapping = true;
    this.active.setState({ left: this.intentLeft, top: this.intentTop });
    const source = this.__boxOf(this.active);
    this.snapping = false;
    if (!source) return;

    // 滞回：已吸附轴用更大的脱离阈值，避免边界抖动。
    const enter = this.options.threshold / scale;
    const exit = (this.options.threshold + this.options.hysteresis) / scale;
    // 未吸附轴用进入阈值(threshold)，已吸附轴用更大的脱离阈值(threshold+hysteresis)；
    // 并把上一帧锁定的候选传进去 —— 只要它还在这条线上，就继续用它（粘性目标）。
    const snap = computeSnap(
      source,
      this.cachedTargets,
      this.engagedX ? exit : enter,
      this.engagedY ? exit : enter,
      this.options,
      { x: this.engagedX ? this.lockedX : null, y: this.engagedY ? this.lockedY : null },
      // 相关性门控半径：屏幕像素 → 世界坐标（与阈值同一套换算口径）
      this.options.proximity > 0
        ? { x: this.options.proximity / scale, y: this.options.proximity / scale }
        : { x: Infinity, y: Infinity }
    );

    if (snap.x || snap.y) {
      // 直接用连续 delta：以前这里 `Math.round()`（本意是防亚像素抖动）会把连续的目标切换
      // 放大成整数级跳变（实测修正量在 8 / -4 / 4 / -2 之间反复），是"图元跳来跳去"的第二个来源。
      const snappedLeft = this.intentLeft + (snap.x ? snap.x.delta : 0);
      const snappedTop = this.intentTop + (snap.y ? snap.y.delta : 0);
      this.active.setState({ left: snappedLeft, top: snappedTop });
      this.engagedX = !!snap.x;
      this.engagedY = !!snap.y;
      this.lockedX = snap.x;
      this.lockedY = snap.y;
      this.__updateGuides(snap);
    } else {
      this.engagedX = false;
      this.engagedY = false;
      this.lockedX = null;
      this.lockedY = null;
      this.__hideGuides();
    }
  }

  private __onMouseUp(): void {
    this.__detach();
  }

  private __detach(): void {
    if (this.active) {
      this.active.off('mousemove', this.__onDrag, this);
    }
    this.active = null;
    this.intentLeft = 0;
    this.intentTop = 0;
    this.cachedTargets = [];
    this.engagedX = false;
    this.engagedY = false;
    this.lockedX = null;
    this.lockedY = null;
    this.__hideGuides();
  }

  private __boxOf(component: ICEComponent): SnapBox | null {
    const box = component.getMaxBoundingBox(true);
    if (!box) return null;
    const mm = box.getMinAndMaxPoint();
    return toBox(mm.minX, mm.minY, mm.maxX, mm.maxY);
  }

  private __computeTargets(): SnapBox[] {
    // 目标是「除被拖组件自己以外，所有参与对齐的图元」——**包括别人容器里的子节点**。
    //
    // 为什么必须展开子树：编辑器里"能自由拖动的图元"大多长在容器里 —— BPMN 的池/泳道、
    // 状态图的复合状态、二次回路的端子、甘特图的任务条。早先只取 `ice.childNodes`（顶层），
    // 结果是这些场景**一个可用目标都没有**：实测 BPMN 示例 18 个可拖图元里 15 个在泳道内，
    // 拖动它们时提示线数量恒为 0（"发卡"拖到"申请结束"左边缘差 3.6px 也不吸附）；
    // 而顶层只剩池子这种包住整张图的容器，它的边永远不在阈值内。
    //
    // 排除**自己的整棵子树**同样是必须的：子组件与父组件一起平移，把它们当候选等于"自己对自己
    // 吸附"——命中后每帧给出同一个固定偏移（子树相对父级的固定间距），父组件会一直偏着指针走。
    const out: SnapBox[] = [];
    const visit = (nodes: any[]) => {
      for (const c of nodes || []) {
        // 被拖组件连同子树一起移动 —— 跳过它，并且**不再往下递归**。
        if (c === this.active) continue;
        if (this.__isAlignmentParticipant(c)) {
          const b = this.__boxOf(c);
          if (b) out.push(b);
        }
        if (c.childNodes && c.childNodes.length) visit(c.childNodes);
      }
    };
    visit(this.ice.childNodes);
    return out;
  }

  /**
   * 判断组件是否可以参与对齐决策。
   * 排除：连接线、控制面板、变换手柄、不可交互组件、不可拖动组件。
   */
  private __isAlignmentParticipant(c: any): boolean {
    if (!c || !c.state || !c.state.interactive || !c.state.draggable) return false;
    if (c.isLine) return false;
    if (c.isControlPanel) return false;
    if (c.parentNode && c.parentNode.isControlPanel) return false;
    return true;
  }

  private __ensureGuides(): void {
    const style = { ...this.options.guideStyle };
    if (!this.guideX) {
      this.guideX = new ICERect({
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        display: false,
        zIndex: this.options.guideZIndex,
        origin: 'top-left',
        stroke: false,
        style,
      });
      this.ice.addTool(this.guideX);
    }
    if (!this.guideY) {
      this.guideY = new ICERect({
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        display: false,
        zIndex: this.options.guideZIndex,
        origin: 'top-left',
        stroke: false,
        style,
      });
      this.ice.addTool(this.guideY);
    }
  }

  private __updateGuides(snap: SnapAxes): void {
    const w = this.options.guideWidth / (this.ice.viewport ? this.ice.viewport.scale : 1);
    const [worldMinX, worldMinY] = this.ice.screenToWorld(0, 0);
    const [worldMaxX, worldMaxY] = this.ice.screenToWorld(this.ice.canvasWidth, this.ice.canvasHeight);
    if (snap.x && this.guideX) {
      this.guideX.setState({
        display: true,
        left: snap.x.guideValue - w / 2,
        top: worldMinY,
        width: w,
        height: worldMaxY - worldMinY,
      });
    } else if (this.guideX) {
      this.guideX.setState({ display: false });
    }
    if (snap.y && this.guideY) {
      this.guideY.setState({
        display: true,
        left: worldMinX,
        top: snap.y.guideValue - w / 2,
        width: worldMaxX - worldMinX,
        height: w,
      });
    } else if (this.guideY) {
      this.guideY.setState({ display: false });
    }
  }

  private __hideGuides(): void {
    if (this.guideX) this.guideX.setState({ display: false });
    if (this.guideY) this.guideY.setState({ display: false });
  }
}

export default AlignmentGuideManager;
