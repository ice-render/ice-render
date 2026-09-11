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
}

export interface SnapAxes {
  x: SnapResult | null;
  y: SnapResult | null;
}

export interface AlignmentGuideOptions {
  /** 磁吸阈值（屏幕像素），默认 5。 */
  threshold?: number;
  /** 滞回余量（屏幕像素）：已吸附轴脱离阈值 = threshold + hysteresis，默认 2。 */
  hysteresis?: number;
  /** 边缘对齐，默认 true。 */
  edge?: boolean;
  /** 中心对齐，默认 true。 */
  center?: boolean;
  /** 等间距对齐，默认 true。 */
  spacing?: boolean;
  /** 提示线完整样式（透传给 canvas ctx），默认 { fillStyle: '#EC4899' }。 */
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
 */
export function computeSnap(
  source: SnapBox,
  targets: SnapBox[],
  thresholdX: number,
  thresholdY: number,
  options: Required<AlignmentGuideOptions>
): SnapAxes {
  const result: SnapAxes = { x: null, y: null };
  const consider = (candidate: SnapResult | null) => {
    if (!candidate) return;
    const slot = result[candidate.axis];
    if (!slot || Math.abs(candidate.delta) < Math.abs(slot.delta)) {
      result[candidate.axis] = candidate;
    }
  };

  for (const t of targets) {
    if (options.edge) {
      consider({
        axis: 'x',
        type: 'edge',
        delta: t.minX - source.minX,
        guideValue: t.minX,
        guideStart: Math.min(source.minY, t.minY),
        guideEnd: Math.max(source.maxY, t.maxY),
      });
      consider({
        axis: 'x',
        type: 'edge',
        delta: t.maxX - source.minX,
        guideValue: t.maxX,
        guideStart: Math.min(source.minY, t.minY),
        guideEnd: Math.max(source.maxY, t.maxY),
      });
      consider({
        axis: 'x',
        type: 'edge',
        delta: t.minX - source.maxX,
        guideValue: t.minX,
        guideStart: Math.min(source.minY, t.minY),
        guideEnd: Math.max(source.maxY, t.maxY),
      });
      consider({
        axis: 'x',
        type: 'edge',
        delta: t.maxX - source.maxX,
        guideValue: t.maxX,
        guideStart: Math.min(source.minY, t.minY),
        guideEnd: Math.max(source.maxY, t.maxY),
      });
      consider({
        axis: 'y',
        type: 'edge',
        delta: t.minY - source.minY,
        guideValue: t.minY,
        guideStart: Math.min(source.minX, t.minX),
        guideEnd: Math.max(source.maxX, t.maxX),
      });
      consider({
        axis: 'y',
        type: 'edge',
        delta: t.maxY - source.minY,
        guideValue: t.maxY,
        guideStart: Math.min(source.minX, t.minX),
        guideEnd: Math.max(source.maxX, t.maxX),
      });
      consider({
        axis: 'y',
        type: 'edge',
        delta: t.minY - source.maxY,
        guideValue: t.minY,
        guideStart: Math.min(source.minX, t.minX),
        guideEnd: Math.max(source.maxX, t.maxX),
      });
      consider({
        axis: 'y',
        type: 'edge',
        delta: t.maxY - source.maxY,
        guideValue: t.maxY,
        guideStart: Math.min(source.minX, t.minX),
        guideEnd: Math.max(source.maxX, t.maxX),
      });
    }
    if (options.center) {
      consider({
        axis: 'x',
        type: 'center',
        delta: t.centerX - source.centerX,
        guideValue: t.centerX,
        guideStart: Math.min(source.minY, t.minY),
        guideEnd: Math.max(source.maxY, t.maxY),
      });
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

  if (options.spacing) {
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i];
        const b = targets[j];
        const minX = Math.min(a.centerX, b.centerX);
        const maxX = Math.max(a.centerX, b.centerX);
        if (source.centerX > minX && source.centerX < maxX) {
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
        const minY = Math.min(a.centerY, b.centerY);
        const maxY = Math.max(a.centerY, b.centerY);
        if (source.centerY > minY && source.centerY < maxY) {
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

  result.x = result.x && Math.abs(result.x.delta) <= thresholdX ? result.x : null;
  result.y = result.y && Math.abs(result.y.delta) <= thresholdY ? result.y : null;
  return result;
}

class AlignmentGuideManager {
  private ice: ICE;
  private options: Required<AlignmentGuideOptions> = {
    threshold: 3,
    hysteresis: 1,
    edge: true,
    center: true,
    spacing: true,
    guideStyle: { fillStyle: '#EC4899' },
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
    // 滞回：未吸附轴用进入阈值(threshold)，已吸附轴用更大的脱离阈值(threshold+hysteresis)。
    const snap = computeSnap(
      source,
      this.cachedTargets,
      this.engagedX ? exit : enter,
      this.engagedY ? exit : enter,
      this.options
    );

    if (snap.x || snap.y) {
      // delta 取整：中心/等间距候选可能产生 0.5 之类的浮点，取整避免亚像素抖动。
      const snappedLeft = this.intentLeft + (snap.x ? Math.round(snap.x.delta) : 0);
      const snappedTop = this.intentTop + (snap.y ? Math.round(snap.y.delta) : 0);
      this.active.setState({ left: snappedLeft, top: snappedTop });
      this.engagedX = !!snap.x;
      this.engagedY = !!snap.y;
      this.__updateGuides(snap);
    } else {
      this.engagedX = false;
      this.engagedY = false;
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
    this.__hideGuides();
  }

  private __boxOf(component: ICEComponent): SnapBox | null {
    const box = component.getMaxBoundingBox(true);
    if (!box) return null;
    const mm = box.getMinAndMaxPoint();
    return toBox(mm.minX, mm.minY, mm.maxX, mm.maxY);
  }

  private __computeTargets(): SnapBox[] {
    // 只把顶层图元作为对齐目标，不展开容器内部子节点。
    // 否则拖拽 Entity 这类容器时，它内部的字段 ICEText 也会被当成候选目标，
    // 导致远离其它实体时仍出现引导线。
    const all = this.ice.childNodes;
    const out: SnapBox[] = [];
    for (const c of all) {
      if (c === this.active) continue;
      if (!this.__isAlignmentParticipant(c)) continue;
      const b = this.__boxOf(c);
      if (b) out.push(b);
    }
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
