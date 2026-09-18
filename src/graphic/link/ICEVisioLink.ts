/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { isNil, round } from '../../util/lang';
import GeoLine from '../../geometry/GeoLine';
import GeoPoint from '../../geometry/GeoPoint';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import { flattenAllComponents, isEffectivelyVisible } from '../../util/data-util';
import ICEPolyLine from './ICEPolyLine';

/**
 * 贝塞尔形态（`linkShape: 'bezier'`）的参数。
 *
 * - 控制点沿两端**插槽外法线**伸出，长度 = 两端直线距离 × `BEZIER_OFFSET_RATIO`，并取下限 `BEZIER_MIN_OFFSET`；
 * - 曲线等分采样成密集折线（段数按距离自适应并夹在 [MIN, MAX]），复用既有的折线渲染/箭头/命中/包围盒通路。
 */
const BEZIER_OFFSET_RATIO = 0.45;
const BEZIER_MIN_OFFSET = 24;
const BEZIER_SEGMENT_LENGTH = 12;
const BEZIER_MIN_SEGMENTS = 8;
const BEZIER_MAX_SEGMENTS = 24;

/**
 * 避障参数（正交折线）。
 *
 * 走廊 = 两端点围成的矩形再外扩 `ROUTE_CORRIDOR_PAD`。只把**落在走廊里**的图元当障碍：
 * 离这条线很远的图元既不可能被穿到，让它参与判定只是白算。
 *
 * 两个上限是**成本闸**：候选生成与相交判定各吃一份障碍清单。
 * 没有它们的话，一张 1 万图元的图里每建一条线都要对 1 万个盒子做候选级的两两比较
 * （候选数 ≈ 4 × 障碍数，是平方级的）。
 */
const ROUTE_CORRIDOR_PAD = 28;
const ROUTE_OBSTACLE_LIMIT = 10;
const ROUTE_OBSTACLE_CHECK_LIMIT = 24;

/**
 * ! FIXME: 删掉对 GeoPoint/GeoLine/GeoUtil 的依赖
 * @class ICEVisioLink
 *
 * Visio 型的连接线
 *
 * 模拟 Microsoft Visio 中的折线算法，此实现从 diagramo 改进而来：http://diagramo.com/ 。
 *
 * 基本特性：
 *
 * - ICEVisioLink 只有 2 个端点，起点和终点。
 * - 除起始点和终点坐标之外，其它点会自动插值计算。
 * - ICEVisioLink 只能连接 2 个非线条类的组件。
 * - 线条互相之间不能连接，在 ICE 引擎中，不能用线条连接线条。
 * - 每一个可以被连接的组件上都有 4 个插槽（Slot），4 个插槽分布在组件最小边界盒子 4 条边的几何中点位置上。
 * - ICEVisioLink 的端点在移动时会判断是否与某个插槽发生碰撞，如果与某个插槽发生碰撞， ICEVisioLink 会连接到插槽所在的组件上。
 * - 同一个插槽（Slot）上可以连 N 根线，Slot 与 ICEVisioLink 之间的关系是 1->N 。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ICEVisioLink extends ICEPolyLine {
  /**
   * FIXME:补全 props 配置项的描述
   */
  constructor(props: any = {}) {
    props = ICEVisioLink.arrangeParam(props);
    super(props);
  }

  protected static arrangeParam(props) {
    if (isNil(props.startPoint)) {
      props.startPoint = [0, 0];
    }
    if (isNil(props.endPoint)) {
      props.endPoint = [10, 10];
    }
    props.points = [[...props.startPoint], [...props.endPoint]];

    //escapeDistance 疏散距离，是 4 个距离边界盒子边缘的点，线条从组件上出来时会首先经过这些点。
    //linkShape 连线形态：visio=正交折线（默认，与历史行为一致），bezier=普通贝塞尔曲线。
    props = { escapeDistance: 30, linkShape: 'visio', ...props };

    //bezier 走「采样成折线」的绘制通路，与 curveType 的 cubic/quadratic 互斥：
    //后者会把 dots[1]/dots[2] 当控制点，而箭头三角面顶点也插在 dots 两端 → 必然画错。
    if (props.linkShape === 'bezier') {
      props.curveType = 'straight';
    }
    return props;
  }

  /**
   * ICEVisioLink 有自己特殊的计算方式。
   *
   * @overwrite
   * @returns
   */
  protected __calcDots() {
    if (this.state.linkShape === 'bezier') {
      return this.__calcBezierDots();
    }
    const solutions = this.interpolate();
    // 无解兜底：极端布局（两端节点重叠、端口背对……）会让下面的过滤器把候选全删掉，
    // 此时 `solutions[0]` 是 undefined，读 `[2]` 就抛 pageerror —— 而 `__calcDots` 在**渲染**与
    // **命中**两条路径上都会被调用，一抛异常整帧就崩（2026-09-15 实测：撤销/重做后移动一次鼠标即触发）。
    // 保留上一次的几何即可：线先不更新，总比整页报错强。
    if (!solutions || !solutions.length || !solutions[0] || !solutions[0][2] || !solutions[0][2].length) {
      return this.state.dots;
    }
    const { left, top } = this.state;
    const arr = solutions[0][2];
    this.state.points = [];
    this.state.dots = [];

    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      this.state.points.push([item.x, item.y]);
      this.state.dots.push([item.x - left, item.y - top]);
    }

    this.calcArrowPoints();

    return this.state.dots;
  }

  /**
   * 贝塞尔形态：从两端点与插槽法线构造三次贝塞尔，等分采样后写回 points/dots。
   *
   * **为什么要把采样点写回 `state.points`**（而不是只算 dots）：`ICEPolyLine.isDotsOnSameLine()`
   * 与 `getLabelPosition()` 都只读 `state.points`。若 points 只剩首尾两点会被判「共线」，
   * 包围盒就会走 `splitEndpointsTo4Points()`、只按线宽沿弦外扩 → 曲线鼓出的部分落在盒外
   * → dirty-rect 上屏快照盒偏小、局部重绘会把曲线裁掉。写回之后包围盒/标签/命中都自然正确。
   *
   * @returns
   */
  protected __calcBezierDots() {
    const points = this.state.points;
    const start = [...points[0]];
    const end = [...points[points.length - 1]];
    const { left, top } = this.state;

    const sampled = this.buildBezierPoints(start, end);
    this.state.points = sampled.map((p) => [...p]);
    this.state.dots = sampled.map((p) => [p[0] - left, p[1] - top]);
    //运行期兜底：即使有人事后 setState 把 curveType 改成 cubic，也不至于把采样点当控制点画
    this.state.curveType = 'straight';

    this.calcArrowPoints();
    return this.state.dots;
  }

  /**
   * 由两端点构造三次贝塞尔并等分采样（世界坐标）。
   *
   * 控制点：`C1 = start + dir(start 插槽) * offset`、`C2 = end + dir(end 插槽) * offset`，
   * `offset = max(|end-start| * 0.45, 24)`，方向为插槽**外法线**（与正交布线的语义一致）。
   */
  protected buildBezierPoints(start: number[], end: number[]): number[][] {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) {
      //零长退化（两端点完全重合）：直接给两点，避免除零与 NaN
      return [[...start], [...end]];
    }

    const chord = [dx / dist, dy / dist];
    const offset = Math.max(dist * BEZIER_OFFSET_RATIO, BEZIER_MIN_OFFSET);
    const d1 = this.slotDirection('start', chord);
    const d2 = this.slotDirection('end', chord);
    const c1 = [start[0] + d1[0] * offset, start[1] + d1[1] * offset];
    const c2 = [end[0] + d2[0] * offset, end[1] + d2[1] * offset];

    const segments = Math.min(
      BEZIER_MAX_SEGMENTS,
      Math.max(BEZIER_MIN_SEGMENTS, Math.round(dist / BEZIER_SEGMENT_LENGTH))
    );
    const out: number[][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      const x = mt * mt * mt * start[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * end[0];
      const y = mt * mt * mt * start[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * end[1];
      out.push([round(x, 2), round(y, 2)]);
    }
    //去掉相邻重合点：箭头方向用的是「相邻两点之差」，重合会让归一化退化成 0/0
    return out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]);
  }

  /**
   * 某端插槽的外法线方向；C 槽 / 未连接 / 未知位置回落到弦方向。
   *
   * 注意 start 端用 `+chord`、end 端用 `-chord`（指向弦的内侧）：两端都取 `+chord` 的话，
   * 控制点会落在两端点连线之外，曲线会先冲出去再拐回来（终点被越过）。
   */
  protected slotDirection(terminal: string, chord: number[]): number[] {
    const link = this.state.links && this.state.links[terminal];
    const dir = ICEPolyLine.dirVector(link && link.position);
    if (dir[0] !== 0 || dir[1] !== 0) {
      return dir;
    }
    return terminal === 'start' ? chord : [-chord[0], -chord[1]];
  }

  /**
   * @overwrite
   * 贝塞尔形态不走正交路由。
   *
   * 应用层（如 ice-entity-designer 的 `routeRelations()`）会在布局后无条件把 `routeType` 设为
   * `'orthogonal'`；不拦掉的话每次布局/移动都会用正交折线整体覆盖 `state.points`：
   * 虽然下一帧 `__calcDots` 会把曲线重新采样回来，但语义错乱且白算一次。
   */
  protected recalculateRoute(): void {
    if (this.state.linkShape === 'bezier') {
      return;
    }
    super.recalculateRoute();
  }

  /**
   * 在起点和终点之间插值。
   *
   * @returns
   */
  protected interpolate() {
    const len = this.state.points.length;
    const startX = this.state.points[0][0];
    const startY = this.state.points[0][1];
    const endX = this.state.points[len - 1][0];
    const endY = this.state.points[len - 1][1];

    const startPoint = new GeoPoint(startX, startY);
    const endPoint = new GeoPoint(endX, endY);

    const potentialExits = [];
    let startExitPoint = null;
    let endExitPoint = null;
    let solutions = [];
    let startBounding = new ICEBoundingBox();
    let endBounding = new ICEBoundingBox();

    //find start exit point
    let startComponent;
    if (this.ice && this.state.links && this.state.links.start && this.state.links.start.id) {
      startComponent = this.ice.findComponent(this.state.links.start.id);
    }
    if (startComponent) {
      startBounding = startComponent.getMinBoundingBox();
      potentialExits[0] = new GeoPoint(startPoint.x, startBounding.tl[1] - this.state.escapeDistance); //north
      potentialExits[1] = new GeoPoint(startBounding.tr[0] + this.state.escapeDistance, startPoint.y); //east
      potentialExits[2] = new GeoPoint(startPoint.x, startBounding.br[1] + this.state.escapeDistance); //south
      potentialExits[3] = new GeoPoint(startBounding.tl[0] - this.state.escapeDistance, startPoint.y); //west
      //pick closest exit point
      startExitPoint = potentialExits[0];
      for (let i = 1; i < potentialExits.length; i++) {
        if (this.distance(startPoint, potentialExits[i]) < this.distance(startPoint, startExitPoint)) {
          startExitPoint = potentialExits[i];
        }
      }
    }

    //find end exit point
    let endComponent;
    if (this.ice && this.state.links && this.state.links.end && this.state.links.end.id) {
      endComponent = this.ice.findComponent(this.state.links.end.id);
    }
    if (endComponent) {
      endBounding = endComponent.getMinBoundingBox();
      potentialExits[0] = new GeoPoint(endPoint.x, endBounding.tl[1] - this.state.escapeDistance); //north
      potentialExits[1] = new GeoPoint(endBounding.tr[0] + this.state.escapeDistance, endPoint.y); //east
      potentialExits[2] = new GeoPoint(endPoint.x, endBounding.br[1] + this.state.escapeDistance); //south
      potentialExits[3] = new GeoPoint(endBounding.tl[0] - this.state.escapeDistance, endPoint.y); //west
      //pick closest exit point
      endExitPoint = potentialExits[0];
      for (let i = 1; i < potentialExits.length; i++) {
        if (this.distance(endPoint, potentialExits[i]) < this.distance(endPoint, endExitPoint)) {
          endExitPoint = potentialExits[i];
        }
      }
    }

    /**
     * 走廊里的**其他图元**。
     *
     * 老实现里"障碍"只有两端自己（`startBounding` / `endBounding`）：线会不会横穿
     * **第三个图元**，路由器根本不知道 —— 于是密集布局里就会看到线从方块中间穿过去
     * （给排水工艺图实测 37 条管线里 24 处穿越）。
     */
    const obstacles = this.collectRouteObstacles(startComponent, endComponent);

    //the index of the gap (where do we need to insert new points) DO NOT CHANGE IT
    let gapIndex = 0;

    //Basic solution
    const s = [startPoint];
    if (startExitPoint) {
      s.push(startExitPoint);
      gapIndex = 1;
    }
    endExitPoint && s.push(endExitPoint);
    s.push(endPoint);

    //SO - no additional points
    const s0 = GeoPoint.cloneArray(s);
    solutions.push(['s0', 's0', s0]);
    /**
     * 硬兜底：**保证 `interpolate()` 永远返回非空**。
     *
     * 后面三道过滤器（正交 / 不倒着走 / 不相交）都可能把候选删光 —— 极端布局下连最朴素的 s0 都
     * 过不了正交判定。调用方 `__calcDots` 会取 `solutions[0][2]`，空数组就是 `undefined[2]` → 抛异常，
     * 而它在**渲染**与**命中**两条路径上都被调用（实测：撤销/重做后移动鼠标即整页报错）。
     * 这里留一条最小的两点路径：画一条直连总比整帧崩掉强。
     */
    const hardFallback = [['fallback', 'fallback', [startPoint, endPoint]]];

    //S1
    const s1 = GeoPoint.cloneArray(s);

    //first variant
    const s1_1 = GeoPoint.cloneArray(s1);
    s1_1.splice(gapIndex + 1, 0, new GeoPoint(s1_1[gapIndex].x, s1_1[gapIndex + 1].y));
    solutions.push(['s1', 's1_1', s1_1]);

    //second variant
    const s1_2 = GeoPoint.cloneArray(s1);
    s1_2.splice(gapIndex + 1, 0, new GeoPoint(s1_2[gapIndex + 1].x, s1_2[gapIndex].y));
    solutions.push(['s1', 's1_2', s1_2]);

    //S2
    //Variant I
    const s2_1 = GeoPoint.cloneArray(s1);
    const s2_1_1 = new GeoPoint((s2_1[gapIndex].x + s2_1[gapIndex + 1].x) / 2, s2_1[gapIndex].y);
    const s2_1_2 = new GeoPoint((s2_1[gapIndex].x + s2_1[gapIndex + 1].x) / 2, s2_1[gapIndex + 1].y);
    s2_1.splice(gapIndex + 1, 0, s2_1_1, s2_1_2);
    solutions.push(['s2', 's2_1', s2_1]);

    //Variant II
    const s2_2 = GeoPoint.cloneArray(s1);
    const s2_2_1 = new GeoPoint(s2_2[gapIndex].x, (s2_2[gapIndex].y + s2_2[gapIndex + 1].y) / 2);
    const s2_2_2 = new GeoPoint(s2_2[gapIndex + 1].x, (s2_2[gapIndex].y + s2_2[gapIndex + 1].y) / 2);
    s2_2.splice(gapIndex + 1, 0, s2_2_1, s2_2_2);
    solutions.push(['s2', 's2_2', s2_2]);

    //Variant III
    const s2_3 = GeoPoint.cloneArray(s1);
    //find the amount (stored in delta) of pixels we need to move right so no intersection with a figure will be present
    //add points X coordinates to be able to generate Variant III even in the absence of figures :p
    const eastExits = [s2_3[gapIndex].x + 20, s2_3[gapIndex + 1].x + 20];
    if (startBounding) {
      eastExits.push(startBounding.br[0] + 20);
    }
    if (endBounding) {
      eastExits.push(endBounding.br[0] + 20);
    }
    const eastExit = this.max(eastExits);
    const s2_3_1 = new GeoPoint(eastExit, s2_3[gapIndex].y);
    const s2_3_2 = new GeoPoint(eastExit, s2_3[gapIndex + 1].y);
    s2_3.splice(gapIndex + 1, 0, s2_3_1, s2_3_2);
    solutions.push(['s2', 's2_3', s2_3]);

    //Variant IV
    const s2_4 = GeoPoint.cloneArray(s1);
    //find the amount (stored in delta) of pixels we need to move up so no intersection with a figure will be present
    //add points y coordinates to be able to generate Variant III even in the absence of figures :p
    const northExits = [s2_4[gapIndex].y - 20, s2_4[gapIndex + 1].y - 20];
    if (startBounding) {
      northExits.push(startBounding.tl[1] - 20);
    }
    if (endBounding) {
      northExits.push(endBounding.tl[1] - 20);
    }
    const northExit = this.min(northExits);
    const s2_4_1 = new GeoPoint(s2_4[gapIndex].x, northExit);
    const s2_4_2 = new GeoPoint(s2_4[gapIndex + 1].x, northExit);
    s2_4.splice(gapIndex + 1, 0, s2_4_1, s2_4_2);
    solutions.push(['s2', 's2_4', s2_4]);

    //Variant V
    const s2_5 = GeoPoint.cloneArray(s1);
    //find the amount (stored in delta) of pixels we need to move left so no intersection with a figure will be present
    //add points x coordinates to be able to generate Variant III even in the absence of figures :p
    const westExits = [s2_5[gapIndex].x - 20, s2_5[gapIndex + 1].x - 20];
    if (startBounding) {
      westExits.push(startBounding.tl[0] - 20);
    }
    if (endBounding) {
      westExits.push(endBounding.tl[0] - 20);
    }
    const westExit = this.min(westExits);
    const s2_5_1 = new GeoPoint(westExit, s2_5[gapIndex].y);
    const s2_5_2 = new GeoPoint(westExit, s2_5[gapIndex + 1].y);
    s2_5.splice(gapIndex + 1, 0, s2_5_1, s2_5_2);
    solutions.push(['s2', 's2_5', s2_5]);

    //Variant VI
    const s2_6 = GeoPoint.cloneArray(s1);
    //find the amount (stored in delta) of pixels we need to move down so no intersection with a figure will be present
    //add points y coordinates to be able to generate Variant III even in the absence of figures :p
    const southExits = [s2_6[gapIndex].y + 20, s2_6[gapIndex + 1].y + 20];
    if (startBounding) {
      southExits.push(startBounding.tl[1] + startBounding.height + 20);
    }
    if (endBounding) {
      southExits.push(endBounding.tl[1] + endBounding.height + 20);
    }
    const southExit = this.max(southExits);
    const s2_6_1 = new GeoPoint(s2_6[gapIndex].x, southExit);
    const s2_6_2 = new GeoPoint(s2_6[gapIndex + 1].x, southExit);
    s2_6.splice(gapIndex + 1, 0, s2_6_1, s2_6_2);
    solutions.push(['s2', 's2_6', s2_6]);

    /**
     * 绕障候选：绕到走廊里每个图元的**外侧**。
     *
     * 上面那六条 s2 变体只会绕**两端自己**（逃逸线取的是两端包围盒外 20px），
     * 中间挡着的图元它们看不见 —— 这就是"线从方块里穿过去"的来源。
     * 这里按障碍逐个补候选：向左/右让开它的竖边、向上/下让开它的横边，
     * 四条都是两段正交折线，和既有候选同格式、走同一套过滤与打分。
     */
    const detourCount = Math.min(obstacles.length, ROUTE_OBSTACLE_LIMIT);
    for (let i = 0; i < detourCount; i++) {
      const ob = obstacles[i];
      solutions = solutions.concat(this.detourCandidates(startPoint, endPoint, ob, `route${i}`));
    }

    //FILTER solutions
    /*
     * Algorithm
     * 0. solutions are ordered from minimmun nr of points to maximum >:)
     * 1. remove all solutions that are not orthogonal (mainly s0 solution)
     * 2. remove all solutions that go backward (we will not need them ever)
     * 3. remove all solutions with intersections
     * 4. pick first class of solutions with same nr of points (ex: 2)
     * 5. pick the first solution with 90 degree angles (less turnarounds)
     * (not interesteted) sort by length :p
     */
    //1. filter non ortogonal solutions
    const orthogonalSolution = [];
    for (let i = 0; i < solutions.length; i++) {
      const solution = solutions[i][2];
      if (this.orthogonalPath(solution)) {
        orthogonalSolution.push(solutions[i]);
      }
    }
    solutions = orthogonalSolution;

    // 第一道过滤后"能画出来"的候选快照；下面的过滤器把候选删光时退回这里（再不行就退到硬兜底）。
    const basicSolutions = solutions.length ? solutions.slice(0, 3) : hardFallback;

    //2. filter backward solutions, do not allow start and end points to coincide - ignore them
    if (!startPoint.equals(endPoint)) {
      const forwardSolutions = [];
      for (let i = 0; i < solutions.length; i++) {
        const solution = solutions[i][2];
        if (this.forwardPath(solution)) {
          forwardSolutions.push(solutions[i]);
        }
      }
      solutions = forwardSolutions;
      if (solutions.length == 0) {
        // 全被判成"倒着走"：宁可画一条不理想的路径，也不能没有路径
        solutions = basicSolutions.slice();
      }
    }

    //3. Filter non intersecting solutions
    const nonIntersectionSolutions = [];
    for (let i = 0; i < solutions.length; i++) {
      const solution = solutions[i][2];
      let intersect = false;
      let innerLines = solution.slice(); //just a shallow copy

      /*
       * If any bounds just trim the solution. So we avoid the strange case when a connection
       * startes from a point on a figure and ends inside of the same figure, but not on a connection point.
       */
      if (endBounding || startBounding) {
        //i0nnerLines = innerLines.slice(0, innerLines.length - 1);
        innerLines = innerLines.slice(1, innerLines.length - 1);
      }

      //now test for intersection
      if (startBounding) {
        intersect = intersect || this.polylineIntersectsRectangle(innerLines, startBounding);
      }

      if (endBounding) {
        intersect = intersect || this.polylineIntersectsRectangle(innerLines, endBounding);
      }

      if (!intersect) {
        nonIntersectionSolutions.push(solutions[i]);
      }
    }

    //If all solutions intersect than this is destiny  :) and just ignore the intersection filter
    if (nonIntersectionSolutions.length != 0) {
      //reasign to solutions
      solutions = nonIntersectionSolutions;
    }

    /**
     * 3b. 过滤"穿过**其他图元**"的候选。
     *
     * 与上面那条（两端自己的盒子）不同，这一条是**软约束**：
     * 密集布局里确实存在"怎么绕都得压一个"的情况，硬删会退化成直连（比穿图元更难看）。
     * 所以取**穿过最少**的那一档：零穿越优先，退而求其次也把穿越压到最少。
     *
     * ⚠️ 这一步必须排在下面"取点数最少的那一档"**之前** ——
     * 否则一条"短一点但横穿方块"的候选会先把零穿越的候选淘汰掉，避障等于白做。
     */
    if (obstacles.length) {
      let scored = this.scoreObstacleCrossings(solutions, obstacles);

      /**
       * 一轮不够就再来一轮：**绕"挡路的那些图元"的并集**。
       *
       * 只绕单个障碍处理不了"一条线要横穿一整排图元"（给排水图上最常见：
       * 事故池到厌氧池那条要跨过缺氧池/好氧池/二沉池三个盒子）。
       * 把当前最优路径穿过的那些盒子合成一个并集，再从并集的外侧让开 ——
       * 这正是人在图上画走线时的做法：不绕某一个方块，而是绕开**那一排**。
       *
       * 上限两轮：每轮只增 4 条候选，成本可控；两轮还绕不开就认了（下面取穿越最少的那档），
       * 不为了绕路把线画到图外去。
       */
      for (let round = 0; round < 2; round++) {
        let best = scored[0].crossings;
        for (let i = 1; i < scored.length; i++) {
          if (scored[i].crossings < best) best = scored[i].crossings;
        }
        if (best === 0) break;
        const worst = scored.find((item) => item.crossings === best);
        const blockers = this.obstaclesCrossedBy(worst.solution[2], obstacles);
        if (!blockers.length) break;
        const union = {
          x1: Math.min(...blockers.map((b) => b.x1)),
          y1: Math.min(...blockers.map((b) => b.y1)),
          x2: Math.max(...blockers.map((b) => b.x2)),
          y2: Math.max(...blockers.map((b) => b.y2)),
        };
        const extra = this.detourCandidates(startPoint, endPoint, union, `union${round}`);
        if (!extra.length) break;
        solutions = solutions.concat(extra);
        scored = this.scoreObstacleCrossings(solutions, obstacles);
      }

      let best = scored[0].crossings;
      for (let i = 1; i < scored.length; i++) {
        if (scored[i].crossings < best) best = scored[i].crossings;
      }
      const kept = scored.filter((item) => item.crossings === best).map((item) => item.solution);
      if (kept.length) {
        solutions = kept;
      }
    }

    //4. get first class of solutions with same nr of points
    if (solutions.length == 0) {
      // 交集过滤之外的兜底（例如 startPoint 与 endPoint 重合、或所有候选都是自交的）
      solutions = basicSolutions.slice();
    }
    if (solutions.length == 0) {
      // 连 basicSolutions 都空了（第一道正交过滤就清空）→ 用硬兜底，保证下面不读 undefined[2]
      solutions = hardFallback.slice();
    }

    const firstSolution = solutions[0][2]; //pick first solution
    const nrOfPoints = firstSolution.length;
    const sameNrPointsSolution = [];
    for (let i = 0; i < solutions.length; i++) {
      const solution = solutions[i][2];
      if (solution.length == nrOfPoints) {
        sameNrPointsSolution.push(solutions[i]);
      }
    }
    solutions = sameNrPointsSolution;

    /*
     * 5.Pick the first solution with 90 degree angles (less turnarounds)
     * in case we have more than one solution in our class.
     */
    let solIndex = 0;
    for (let i = 0; i < solutions.length; i++) {
      if (this.scorePath(solutions[solIndex][2]) < this.scorePath(solutions[i][2])) {
        solIndex = i;
      }
    }
    solutions = [solutions[solIndex]];
    return solutions;
  }

  /**
   * Tests if a vector of points is an orthogonal path (moving in multiples of 90 degrees).
   *
   *
   * 正交判定。Visio 连接线上的每一段要么平行于 X 轴，要么平行于 Y 轴。
   * @param {Array} v - an {Array} of {Point}s
   * @return {Boolean} - true if path is valid, false otherwise
   */
  private orthogonalPath(v) {
    if (v.length <= 1) {
      return true;
    }
    for (let i = 0; i < v.length - 1; i++) {
      if (v[i].x != v[i + 1].x && v[i].y != v[i + 1].y) {
        return false;
      }
    }
    return true;
  }

  /**
   * FIXME: 用更好的数学方法进行计算。
   * Test to see if 2 {Line}s intersects. They are considered finite segments
   * and not the infinite lines from geometry
   * @param {Line} l1 - fist line/segment
   * @param {Line} l2 - last line/segment
   * @return {Boolean} true - if the lines intersect or false if not
   */
  private lineIntersectsLine(l1, l2) {
    // check for two vertical lines
    if (l1.startPoint.x == l1.endPoint.x && l2.startPoint.x == l2.endPoint.x) {
      return l1.startPoint.x == l2.startPoint.x // if 'infinite 'lines do coincide,
        ? // then check segment bounds for overlapping
          l1.contains(l2.startPoint.x, l2.startPoint.y) || l1.contains(l2.endPoint.x, l2.endPoint.y)
        : // lines are paralel
          false;
    }
    // if one line is vertical, and another line is not vertical
    else if (l1.startPoint.x == l1.endPoint.x || l2.startPoint.x == l2.endPoint.x) {
      // let assume l2 is vertical, otherwise exchange them
      if (l1.startPoint.x == l1.endPoint.x) {
        const l = l1;
        l1 = l2;
        l2 = l;
      }
      // finding intersection of 'infinite' lines
      // equation of the first line is y = ax + b, second: x = c
      const a = (l1.endPoint.y - l1.startPoint.y) / (l1.endPoint.x - l1.startPoint.x);
      const b = l1.startPoint.y - a * l1.startPoint.x;
      const x0 = l2.startPoint.x;
      const y0 = a * x0 + b;
      return l1.contains(x0, y0) && l2.contains(x0, y0);
    }
    // check normal case - both lines are not vertical
    else {
      //line equation is : y = a*x + b, b = y - a * x
      const a1 = (l1.endPoint.y - l1.startPoint.y) / (l1.endPoint.x - l1.startPoint.x);
      const b1 = l1.startPoint.y - a1 * l1.startPoint.x;
      const a2 = (l2.endPoint.y - l2.startPoint.y) / (l2.endPoint.x - l2.startPoint.x);
      const b2 = l2.startPoint.y - a2 * l2.startPoint.x;

      if (a1 == a2) {
        //paralel lines
        return b1 == b2
          ? // for coincide lines, check for segment bounds overlapping
            l1.contains(l2.startPoint.x, l2.startPoint.y) || l1.contains(l2.endPoint.x, l2.endPoint.y)
          : // not coincide paralel lines have no chance to intersect
            false;
      } else {
        //usual case - non paralel, the 'infinite' lines intersects...we only need to know if inside the segment
        /*
         * if one of the lines are vertical, then x0 is equal to their x,
         * otherwise:
         * y1 = a1 * x + b1
         * y2 = a2 * x + b2
         * => x0 = (b2 - b1) / (a1 - a2)
         * => y0 = a1 * x0 + b1
         */
        const x0 = (b2 - b1) / (a1 - a2);
        const y0 = a1 * x0 + b1;
        return l1.contains(x0, y0) && l2.contains(x0, y0);
      }
    }
  }

  /**
   * Tests if a a polyline defined by a set of points intersects a rectangle
   * @param {Array} points - and {Array} of {Point}s
   * @param {Array} boundingRect - the boundingRect
   * @param {Boolean} closedPolyline - incase polyline is closed figure then true, else false
   * @return true - if line intersects the rectangle, false - if not
   */
  private polylineIntersectsRectangle(points, boundingRect, closedPolyline: boolean = false) {
    //get the 4 lines/segments represented by the boundingRect
    const lines = [];

    lines.push(
      new GeoLine(new GeoPoint(boundingRect.x1, boundingRect.y1), new GeoPoint(boundingRect.x2, boundingRect.y1))
    );
    lines.push(
      new GeoLine(new GeoPoint(boundingRect.x2, boundingRect.y1), new GeoPoint(boundingRect.x2, boundingRect.y2))
    );
    lines.push(
      new GeoLine(new GeoPoint(boundingRect.x2, boundingRect.y2), new GeoPoint(boundingRect.x1, boundingRect.y2))
    );
    lines.push(
      new GeoLine(new GeoPoint(boundingRect.x1, boundingRect.y2), new GeoPoint(boundingRect.x1, boundingRect.y1))
    );

    for (let k = 0; k < points.length - 1; k++) {
      //create a line out of each 2 consecutive points
      const tempLine = new GeoLine(points[k], points[k + 1]);
      //see if that line intersect any of the line on boundingRect border
      for (let i = 0; i < lines.length; i++) {
        if (this.lineIntersectsLine(tempLine, lines[i])) {
          return true;
        }
      }
    }

    //check the closed figure - that is last point connected to the first
    if (closedPolyline) {
      //create a line out of each 2 consecutive points
      const tempLine1 = new GeoLine(points[points.length - 1], points[0]);
      //see if that line intersect any of the line on boundingRect border
      for (let j = 0; j < lines.length; j++) {
        if (this.lineIntersectsLine(tempLine1, lines[j])) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 收集**这条线可能穿到**的图元（走廊里的障碍）。
   *
   * 取的是 `getMinBoundingBox()`（组件自己的盒子，**不含**子节点）：
   * 位号/名称那些文字盒是刻意画在盒子外面的，且相邻图元的文字盒本来就大面积交叠，
   * 拿它当障碍会让绝大多数正交解都被判"穿过"（实测那样做反而退化成直连），
   * 而用户说的"线穿过了图元"指的是**形状**被穿过。
   *
   * 排除三类：自己、两端（线本来就要从它们身上接出来）、其他线条
   * （线压线在给排水图纸里是常态，不构成观感缺陷，也避免两条线互相把对方挤走）。
   */
  private collectRouteObstacles(startComponent: any, endComponent: any) {
    const obstacles = [];
    if (!this.ice || (!startComponent && !endComponent)) {
      return obstacles;
    }
    const points = this.state.points;
    if (!points || points.length < 2) {
      return obstacles;
    }
    const startX = points[0][0];
    const startY = points[0][1];
    const endX = points[points.length - 1][0];
    const endY = points[points.length - 1][1];
    const corridorMinX = Math.min(startX, endX) - ROUTE_CORRIDOR_PAD;
    const corridorMaxX = Math.max(startX, endX) + ROUTE_CORRIDOR_PAD;
    const corridorMinY = Math.min(startY, endY) - ROUTE_CORRIDOR_PAD;
    const corridorMaxY = Math.max(startY, endY) + ROUTE_CORRIDOR_PAD;

    const all = flattenAllComponents(this.ice);
    /**
     * 两端自己的祖先容器（泳道、画布分组）**不是障碍**：我们就待在里面，
     * 绕开它等于绕开整张图。它们也不算"已收下"，否则里面的节点会被一并跳过
     * —— BPMN 那种"泳道里放节点"的图就再也避不了障了。
     */
    const containersOfEndpoints: any[] = [];
    [startComponent, endComponent].forEach((node: any) => {
      let parent = node && node.parentNode;
      while (parent) {
        containersOfEndpoints.push(parent);
        parent = parent.parentNode;
      }
    });
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    for (let i = 0; i < all.length; i++) {
      const component = all[i];
      if (!component || component === this || component === startComponent || component === endComponent) continue;
      if (containersOfEndpoints.indexOf(component) !== -1) continue;
      /**
       * ⚠️ 只认"图元本身"，不认它的**内部零件**。
       *
       * `flattenAllComponents()` 给的是整棵树（含子节点），而一个工艺符号是一个容器
       * 加一堆子组件拼出来的：位号文字、名称文字、内部装饰……实测一条管线的走廊里
       * 24 个"障碍"里 20 个是这些零件 —— 真正挡路的符号反而被上限挤掉了，
       * 于是避障看着在跑、实际没绕开任何东西（这也是第一版"改了跟没改一样"的原因之一）。
       *
       * 判定**用组件自己的声明**（`hasDerivedChildren()`：子节点是按 state 派生的装饰，
       * 见 `ICEComponent.hasDerivedChildren` 的注释），而不是按盒子大小或"有没有子节点"去猜
       * —— 文字盒比形状盒还宽（阀门那种窄符号的位号盒有 90px 宽），猜必然猜错。
       *
       * 代价：既是复合图元、又真的装着业务子节点的那种组件（BPMN 的池/泳道），
       * 它的子节点会被一并跳过 —— 那种图里"绕开泳道"本来也没有意义（泳道大到无法绕），
       * 而泳道里真正的节点仍会作为独立障碍参与判定（它们不是派生节点）。
       */
      let ancestor = component.parentNode;
      let derived = false;
      while (ancestor) {
        if (typeof ancestor.hasDerivedChildren === 'function' && ancestor.hasDerivedChildren()) {
          derived = true;
          break;
        }
        ancestor = ancestor.parentNode;
      }
      if (derived) continue;
      // 控制面板是覆盖在目标上的工具层，其他线条同理：都不是"图元"
      if (component.isControlPanel || component instanceof ICEPolyLine) continue;
      if (typeof component.getMinBoundingBox !== 'function') continue;
      if (!isEffectivelyVisible(component)) continue;
      /**
       * ⚠️ 必须 `refresh = true`（现场重算矩阵）。
       *
       * `getMinBoundingBox()` 读的是 `state.composedMatrix`，而那个值**只有渲染过才有**
       * ——建图阶段（首帧之前）或纯 headless 里它是空数组，算出来的盒子全是 NaN。
       * 第一次实现就栽在这里：NaN 与任何数比较都是 false，于是"障碍"看着收了一堆、
       * 相交判定却永远返回 false，避障形同虚设（症状是改了跟没改一样）。
       * `getMaxBoundingBox(true)` 是应用层 `autoPorts()` 的同款用法，口径一致。
       */
      const box = component.getMinBoundingBox(true).getMinAndMaxPoint();
      if (box.maxX < corridorMinX || box.minX > corridorMaxX || box.maxY < corridorMinY || box.minY > corridorMaxY) {
        continue;
      }
      obstacles.push({
        id: String((component.state && component.state.id) || ''),
        x1: box.minX,
        y1: box.minY,
        x2: box.maxX,
        y2: box.maxY,
        // 离这条线越近越该先绕它：候选生成有数量上限，得按相关性取舍
        distance: Math.hypot((box.minX + box.maxX) / 2 - midX, (box.minY + box.maxY) / 2 - midY),
      });
    }

    // 稳定排序（距离优先、同距按 id）—— 路由结果必须可复现，否则同样的图两次跑出来的折线不一样
    obstacles.sort((a, b) =>
      a.distance === b.distance ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.distance - b.distance
    );
    return obstacles.slice(0, ROUTE_OBSTACLE_CHECK_LIMIT);
  }

  /**
   * 绕着一个盒子生成 4 条候选（左/右让开竖边、上/下让开横边）。
   *
   * 让开距离取 `escapeDistance × 0.4` 与 8px 的较大者：太小会贴着障碍蹭过去
   * （下一帧坐标一变就又压上了），太大则把线甩得离图很远、看起来像画错了。
   * 盒子里没有"哪个是障碍"的语义，它可以是单个图元，也可以是**一排图元的并集**。
   */
  private detourCandidates(startPoint: any, endPoint: any, box: any, tag: string) {
    const margin = Math.max(8, Math.round(this.state.escapeDistance * 0.4));
    const raw: Array<[string, any[]]> = [
      [`${tag}-w`, [new GeoPoint(box.x1 - margin, startPoint.y), new GeoPoint(box.x1 - margin, endPoint.y)]],
      [`${tag}-e`, [new GeoPoint(box.x2 + margin, startPoint.y), new GeoPoint(box.x2 + margin, endPoint.y)]],
      [`${tag}-n`, [new GeoPoint(startPoint.x, box.y1 - margin), new GeoPoint(endPoint.x, box.y1 - margin)]],
      [`${tag}-s`, [new GeoPoint(startPoint.x, box.y2 + margin), new GeoPoint(endPoint.x, box.y2 + margin)]],
    ];
    const out = [];
    for (let k = 0; k < raw.length; k++) {
      const [name, mids] = raw[k];
      const path = [startPoint, ...mids, endPoint];
      // 让开线正好落在端点那一行/列上时会插入重复点：连着两个相同的点会让
      // orthogonalPath / forwardPath / scorePath 都算出别扭的结果（甚至自交），先剔掉。
      const deduped = [path[0]];
      for (let j = 1; j < path.length; j++) {
        const prev = deduped[deduped.length - 1];
        if (prev.x !== path[j].x || prev.y !== path[j].y) {
          deduped.push(path[j]);
        }
      }
      if (deduped.length >= 3) {
        out.push([name, name, deduped]);
      }
    }
    return out;
  }

  /** 给每条候选记一笔"穿过了几个障碍"。 */
  private scoreObstacleCrossings(solutions: any[], obstacles: any[]) {
    const scored = [];
    for (let i = 0; i < solutions.length; i++) {
      scored.push({ solution: solutions[i], crossings: this.countObstacleCrossings(solutions[i][2], obstacles) });
    }
    return scored;
  }

  /** 这条路径具体穿过了哪几个障碍（用于把"挡路的那些"合成并集再绕一次）。 */
  private obstaclesCrossedBy(points: any, obstacles: any[]) {
    const crossed = [];
    for (let i = 0; i < obstacles.length; i++) {
      const ob = obstacles[i];
      if (this.polylineIntersectsRectangle(points, this.insetBox(ob))) {
        crossed.push(ob);
      }
    }
    return crossed;
  }

  /**
   * 障碍盒向内缩 1px。
   *
   * 贴着边走、擦着角过不算穿越 —— 那种情形只有 1px 的观感差异，
   * 却会让"零穿越"这个判据几乎永远无法满足（相邻图元之间的通道本来就只有十几像素）。
   */
  private insetBox(ob: any) {
    const inset = 1;
    return { x1: ob.x1 + inset, y1: ob.y1 + inset, x2: ob.x2 - inset, y2: ob.y2 - inset };
  }

  /** 一条候选路径穿过了几个障碍。 */
  private countObstacleCrossings(points: any, obstacles: any[]): number {
    const limit = Math.min(obstacles.length, ROUTE_OBSTACLE_CHECK_LIMIT);
    let count = 0;
    for (let i = 0; i < limit; i++) {
      if (this.polylineIntersectsRectangle(points, this.insetBox(obstacles[i]))) {
        count++;
      }
    }
    return count;
  }

  /**
   * Score a ortogonal path made out of Points
   * Iterates over a set of points (minimum 3)
   * For each 3 points (i, i+1, i+2) :
   *  - if the 3rd one is after the 2nd on the same line we add +1
   *  - if the 3rd is up or down related to the 2nd we do not do anything +0
   *  - if the 3rd goes back we imediatelly return -1
   * @param {Array} v - an array of {Point}s
   * @return {Number} - -1 if the path is wrong (goes back) or something >= 0 if is fine.The bigger the number the smooth the path is.
   */
  private scorePath(v) {
    if (v.length <= 2) {
      return -1;
    }
    let score = 0;
    for (let i = 1; i < v.length - 1; i++) {
      if (v[i - 1].x == v[i].x && v[i].x == v[i + 1].x) {
        //on the same vertical
        if (this.signum(v[i + 1].y - v[i].y) == this.signum(v[i].y - v[i - 1].y)) {
          //same direction
          score++;
        } else {
          //going back - no good
          return -1;
        }
      } else if (v[i - 1].y == v[i].y && v[i].y == v[i + 1].y) {
        //on the same horizontal
        if (this.signum(v[i + 1].x - v[i].x) == this.signum(v[i].x - v[i - 1].x)) {
          //same direction
          score++;
        } else {
          //going back - no good
          return -1;
        }
      } else {
        //not on same vertical nor horizontal
        score--;
      }
    }
    return score;
  }

  /**
   * Returns the sign of a number
   * @param {Number} x - the number
   * @returns {Number}
   * @see <a href="http://en.wikipedia.org/wiki/Sign_function">http://en.wikipedia.org/wiki/Sign_function</a>
   */
  private signum(x) {
    if (x > 0) return 1;
    else if (x < 0) return -1;
    else return 0;
  }

  /**
   * Tests if a vector of points is a valid path (not going back)
   * There are a few problems here. If you have p1, p2, p3 and p4 and p2 = p3 you need to ignore that
   * @param {Array} v - an {Array} of {Point}s
   * @return {Boolean} - true if path is valid, false otherwise
   */
  private forwardPath(v) {
    if (v.length <= 2) {
      return true;
    }
    for (let i = 0; i < v.length - 2; i++) {
      if (v[i].x == v[i + 1].x && v[i + 1].x == v[i + 2].x) {
        //on the same vertical
        if (this.signum(v[i + 1].y - v[i].y) != 0) {
          //test only we have a progressing path
          if (this.signum(v[i + 1].y - v[i].y) == -1 * this.signum(v[i + 2].y - v[i + 1].y)) {
            //going back (ignore zero)
            return false;
          }
        }
      } else if (v[i].y == v[i + 1].y && v[i + 1].y == v[i + 2].y) {
        //on the same horizontal
        if (this.signum(v[i + 1].x - v[i].x) != 0) {
          //test only we have a progressing path
          if (this.signum(v[i + 1].x - v[i].x) == -1 * this.signum(v[i + 2].x - v[i + 1].x)) {
            //going back (ignore zero)
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * @method distance
   * Calculate the distance between two points.
   *
   *
   * 计算两点之间的距离。
   * @param {Point} p1 - first {Point}
   * @param {Point} p2 - second {Point}
   * @return {Number} - the distance between those 2 points. It is always positive.
   */
  private distance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  /**
   * Returns the max of a vector
   * @param {Array} v - vector of {Number}s
   * @return {Number} - the maximum number from the vector or NaN if vector is empty
   */
  private max(v) {
    if (v.lenght == 0) {
      return NaN;
    } else {
      let m = v[0];
      for (let i = 0; i < v.length; i++) {
        if (m < v[i]) {
          m = v[i];
        }
      }
      return m;
    }
  }

  /**
   * Returns the min of a vector
   * @param {Array} v - vector of {Number}s
   * @return {Number} - the minimum number from the vector or NaN if vector is empty
   * @author alex@scriptoid.com
   */
  private min(v) {
    if (v.lenght == 0) {
      return NaN;
    } else {
      let m = v[0];
      for (let i = 0; i < v.length; i++) {
        if (m > v[i]) {
          m = v[i];
        }
      }
      return m;
    }
  }

  /**
   * ICEVisioLink 中的点都是自动计算出来的，手动添加点没有意义。
   * @overwrite
   * @param point
   * @param index
   */
  public addDot(point: [number, number], index: number): void {
    throw new Error('Can NOT add dot to ICEVisioLink mannually.');
  }

  /**
   * ICEVisioLink 中的点都是自动计算出来的，手动删除点没有意义。
   * @overwrite
   * @param index
   */
  public rmDot(index: number): boolean {
    throw new Error('Can NOT remove dot from ICEVisioLink mannually.');
  }
}
