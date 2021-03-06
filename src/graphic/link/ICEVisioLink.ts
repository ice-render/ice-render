/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import isNil from 'lodash/isNil';
import GeoLine from '../../geometry/GeoLine';
import GeoPoint from '../../geometry/GeoPoint';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import ICEPolyLine from './ICEPolyLine';

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
    props = { escapeDistance: 30, ...props };
    return props;
  }

  /**
   * ICEVisioLink 有自己特殊的计算方式。
   *
   * @overwrite
   * @returns
   */
  protected calcDots() {
    let solutions = this.interpolate();
    let { left, top } = this.state;
    let arr = solutions[0][2];
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
   * 在起点和终点之间插值。
   *
   * @returns
   */
  protected interpolate() {
    let len = this.state.points.length;
    let startX = this.state.points[0][0];
    let startY = this.state.points[0][1];
    let endX = this.state.points[len - 1][0];
    let endY = this.state.points[len - 1][1];

    let startPoint = new GeoPoint(startX, startY);
    let endPoint = new GeoPoint(endX, endY);

    let potentialExits = [];
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
    let s = [startPoint];
    if (startExitPoint) {
      s.push(startExitPoint);
      gapIndex = 1;
    }
    endExitPoint && s.push(endExitPoint);
    s.push(endPoint);

    //SO - no additional points
    let s0 = GeoPoint.cloneArray(s);
    solutions.push(['s0', 's0', s0]);

    //S1
    let s1 = GeoPoint.cloneArray(s);

    //first variant
    let s1_1 = GeoPoint.cloneArray(s1);
    s1_1.splice(gapIndex + 1, 0, new GeoPoint(s1_1[gapIndex].x, s1_1[gapIndex + 1].y));
    solutions.push(['s1', 's1_1', s1_1]);

    //second variant
    let s1_2 = GeoPoint.cloneArray(s1);
    s1_2.splice(gapIndex + 1, 0, new GeoPoint(s1_2[gapIndex + 1].x, s1_2[gapIndex].y));
    solutions.push(['s1', 's1_2', s1_2]);

    //S2
    //Variant I
    let s2_1 = GeoPoint.cloneArray(s1);
    let s2_1_1 = new GeoPoint((s2_1[gapIndex].x + s2_1[gapIndex + 1].x) / 2, s2_1[gapIndex].y);
    let s2_1_2 = new GeoPoint((s2_1[gapIndex].x + s2_1[gapIndex + 1].x) / 2, s2_1[gapIndex + 1].y);
    s2_1.splice(gapIndex + 1, 0, s2_1_1, s2_1_2);
    solutions.push(['s2', 's2_1', s2_1]);

    //Variant II
    let s2_2 = GeoPoint.cloneArray(s1);
    let s2_2_1 = new GeoPoint(s2_2[gapIndex].x, (s2_2[gapIndex].y + s2_2[gapIndex + 1].y) / 2);
    let s2_2_2 = new GeoPoint(s2_2[gapIndex + 1].x, (s2_2[gapIndex].y + s2_2[gapIndex + 1].y) / 2);
    s2_2.splice(gapIndex + 1, 0, s2_2_1, s2_2_2);
    solutions.push(['s2', 's2_2', s2_2]);

    //Variant III
    let s2_3 = GeoPoint.cloneArray(s1);
    //find the amount (stored in delta) of pixels we need to move right so no intersection with a figure will be present
    //add points X coordinates to be able to generate Variant III even in the absence of figures :p
    let eastExits = [s2_3[gapIndex].x + 20, s2_3[gapIndex + 1].x + 20];
    if (startBounding) {
      eastExits.push(startBounding.br[0] + 20);
    }
    if (endBounding) {
      eastExits.push(endBounding.br[0] + 20);
    }
    let eastExit = this.max(eastExits);
    let s2_3_1 = new GeoPoint(eastExit, s2_3[gapIndex].y);
    let s2_3_2 = new GeoPoint(eastExit, s2_3[gapIndex + 1].y);
    s2_3.splice(gapIndex + 1, 0, s2_3_1, s2_3_2);
    solutions.push(['s2', 's2_3', s2_3]);

    //Variant IV
    let s2_4 = GeoPoint.cloneArray(s1);
    //find the amount (stored in delta) of pixels we need to move up so no intersection with a figure will be present
    //add points y coordinates to be able to generate Variant III even in the absence of figures :p
    let northExits = [s2_4[gapIndex].y - 20, s2_4[gapIndex + 1].y - 20];
    if (startBounding) {
      northExits.push(startBounding.tl[1] - 20);
    }
    if (endBounding) {
      northExits.push(endBounding.tl[1] - 20);
    }
    let northExit = this.min(northExits);
    let s2_4_1 = new GeoPoint(s2_4[gapIndex].x, northExit);
    let s2_4_2 = new GeoPoint(s2_4[gapIndex + 1].x, northExit);
    s2_4.splice(gapIndex + 1, 0, s2_4_1, s2_4_2);
    solutions.push(['s2', 's2_4', s2_4]);

    //Variant V
    let s2_5 = GeoPoint.cloneArray(s1);
    //find the amount (stored in delta) of pixels we need to move left so no intersection with a figure will be present
    //add points x coordinates to be able to generate Variant III even in the absence of figures :p
    let westExits = [s2_5[gapIndex].x - 20, s2_5[gapIndex + 1].x - 20];
    if (startBounding) {
      westExits.push(startBounding.tl[0] - 20);
    }
    if (endBounding) {
      westExits.push(endBounding.tl[0] - 20);
    }
    let westExit = this.min(westExits);
    let s2_5_1 = new GeoPoint(westExit, s2_5[gapIndex].y);
    let s2_5_2 = new GeoPoint(westExit, s2_5[gapIndex + 1].y);
    s2_5.splice(gapIndex + 1, 0, s2_5_1, s2_5_2);
    solutions.push(['s2', 's2_5', s2_5]);

    //Variant VI
    let s2_6 = GeoPoint.cloneArray(s1);
    //find the amount (stored in delta) of pixels we need to move down so no intersection with a figure will be present
    //add points y coordinates to be able to generate Variant III even in the absence of figures :p
    let southExits = [s2_6[gapIndex].y + 20, s2_6[gapIndex + 1].y + 20];
    if (startBounding) {
      southExits.push(startBounding.tl[1] + startBounding.height + 20);
    }
    if (endBounding) {
      southExits.push(endBounding.tl[1] + endBounding.height + 20);
    }
    let southExit = this.max(southExits);
    let s2_6_1 = new GeoPoint(s2_6[gapIndex].x, southExit);
    let s2_6_2 = new GeoPoint(s2_6[gapIndex + 1].x, southExit);
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
    let orthogonalSolution = [];
    for (let i = 0; i < solutions.length; i++) {
      let solution = solutions[i][2];
      if (this.orthogonalPath(solution)) {
        orthogonalSolution.push(solutions[i]);
      }
    }
    solutions = orthogonalSolution;

    //2. filter backward solutions, do not allow start and end points to coincide - ignore them
    if (!startPoint.equals(endPoint)) {
      let forwardSolutions = [];
      for (let i = 0; i < solutions.length; i++) {
        let solution = solutions[i][2];
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
    let nonIntersectionSolutions = [];
    for (let i = 0; i < solutions.length; i++) {
      let solution = solutions[i][2];
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

    let firstSolution = solutions[0][2]; //pick first solution
    let nrOfPoints = firstSolution.length;
    let sameNrPointsSolution = [];
    for (let i = 0; i < solutions.length; i++) {
      let solution = solutions[i][2];
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
        let l = l1;
        l1 = l2;
        l2 = l;
      }
      // finding intersection of 'infinite' lines
      // equation of the first line is y = ax + b, second: x = c
      let a = (l1.endPoint.y - l1.startPoint.y) / (l1.endPoint.x - l1.startPoint.x);
      let b = l1.startPoint.y - a * l1.startPoint.x;
      let x0 = l2.startPoint.x;
      let y0 = a * x0 + b;
      return l1.contains(x0, y0) && l2.contains(x0, y0);
    }
    // check normal case - both lines are not vertical
    else {
      //line equation is : y = a*x + b, b = y - a * x
      let a1 = (l1.endPoint.y - l1.startPoint.y) / (l1.endPoint.x - l1.startPoint.x);
      let b1 = l1.startPoint.y - a1 * l1.startPoint.x;
      let a2 = (l2.endPoint.y - l2.startPoint.y) / (l2.endPoint.x - l2.startPoint.x);
      let b2 = l2.startPoint.y - a2 * l2.startPoint.x;

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
        let x0 = (b2 - b1) / (a1 - a2);
        let y0 = a1 * x0 + b1;
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
    let lines = [];

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
      let tempLine = new GeoLine(points[k], points[k + 1]);
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
      let tempLine1 = new GeoLine(points[points.length - 1], points[0]);
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
      var m = v[0];
      for (var i = 0; i < v.length; i++) {
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
      var m = v[0];
      for (var i = 0; i < v.length; i++) {
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
