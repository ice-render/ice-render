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
        //nothing to do...
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

    //4. get first class of solutions with same nr of points
    if (solutions.length == 0) {
      //nothing to do...
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
