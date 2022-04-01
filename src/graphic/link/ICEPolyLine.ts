/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { glMatrix, vec2 } from 'gl-matrix';
import isNil from 'lodash/isNil';
import merge from 'lodash/merge';
import round from 'lodash/round';
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from '../../event/ICEEvent';
import GeoUtil from '../../geometry/GeoUtil';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import ICEComponent from '../ICEComponent';
import ICEDotPath from '../ICEDotPath';

/**
 *
 * @class ICEPolyLine  折线
 *
 * 基本特征：
 *
 * - ICEPolyLine 上至少存在 2 个点，否则 ICEPolyLine 自动填充。
 * - ICEPolyLine 由多个点构成，如果折线上的所有点共线，则折线在外观上退化成直线。如果点数恰好为 2 ，折线退化成一条直线。
 * - ICEPolyLine 以及所有子类不能进行 transform 操作，在 ICE 中，对线条进行矩阵变换是没有意义的。
 * - ICEPolyLine 以及所有子类的 left/top 总是被设置为第 0 个点。
 * - ICEPolyLine 以及所有子类的原点都在第 0 个点上，而不在几何中心点，这一特性与普通的 Component 不同。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEPolyLine extends ICEDotPath {
  /**
   * 类型标识
   * 用来解决 TypeScript 的 instanceof 兼容性问题， https://github.com/microsoft/TypeScript/issues/22585
   * 仅供内部使用，业务代码不可依赖此属性
   */
  public isLine = true;

  /**
   * 数据结构：
   * {
   *  start:{componnet:ICEComponent,position:'T'},
   *  end:{component:ICEComponent,position:'B'}
   * }
   * !注意：此结构与 state 上的 links 结构不同，state.links 只存 id，position 信息，而且会被序列化，此结构不会被序列化。
   */
  protected links: any = { start: {}, end: {} }; //记录连接到了哪个组件上

  /**
   * @cfg
   * {
   *   lineType: 'solid',         //可能的取值：solid, dashed
   *   arrow: 'none',             //可能的取值：none, start, end ,both
   *   arrowLength: 15,           //箭头长度
   *   arrowAngel: 30,            //箭头角度
   *   lineWidth:2,               //线条宽度
   *   closePath:false,           //连线默认不闭合路径
   *   points:[],                 //线条上所有点的坐标
   *   links:{                    //如果传递了连接关系参数，则在渲染器完成一轮渲染之后，会自动与指定的组件建立连接关系。
   *     start:{id,position},
   *     end:{id,position}
   *   }
   * }
   *
   * @param props
   */
  constructor(props: any = {}) {
    let param = ICEPolyLine.arrangeParam(props);
    super(param);
  }

  /**
   *
   * 整理并校验构造参数。
   *
   * @static
   * @param props
   * @returns
   */
  protected static arrangeParam(props): any {
    //dots 是内部计算使用的属性，外部传参用 points 属性
    //points 是一个数组，用来描述一系列的坐标点，这些点会被按照顺序连接起来，example: [[0,0],[10,10],[20,20],[30,30]]
    let param = merge(
      {},
      {
        lineType: 'solid',
        lineWidth: 1,
        arrow: 'none',
        arrowLength: 15,
        arrowAngel: glMatrix.toRadian(30),
        points: [],
        showMinBoundingBox: false,
        showMaxBoundingBox: false,
        links: {},
        style: {
          lineJoin: 'round',
        },
      },
      props,
      {
        linkable: false, //所有线条类型的组件 linkable 都为 false ，因为在 ICE 中，用线条连接线条是没有意义的，线条之间不能互相连接。
        closePath: false, //线条不是闭合的，不能连接到自己的起点
        fill: false, //线条不需要填充
      }
    );

    //线段至少有2个点，如果点数少于2个，自动填充。
    let len = param.points.length;
    if (len < 2) {
      if (len === 0) {
        param.points.push([0, 0]);
        param.points.push([10, 10]);
      } else if (len === 1) {
        param.points.push([10, 10]);
      }
    }

    //ICEPolyLine 的参数需要特殊处理，总是把 left/top 移动到第 0 个点的位置，外部传递的 left/top ， translate[0]/translate[1] 都无效。
    param = {
      ...param,
      ...{
        left: props.points[0][0],
        top: props.points[0][1],
        transform: {
          translate: [0, 0],
          scale: [1, 1],
          skew: [0, 0],
          rotate: 0, //degree
        },
      },
    };

    //保证 lineWidth 不小于1
    if (param.style.lineWidth < 1) {
      param.style.lineWidth = 1;
    }

    return param;
  }

  /**
   * @overwrite
   */
  protected initEvents() {
    super.initEvents();

    //如果 props 里面的 links 数据结构不为空，在渲染器完成一轮渲染之后，自动建立连接关系。
    //在反序列化时需要进行此操作。
    this.once(ICE_EVENT_NAME_CONSTS.AFTER_ADD, this.afterAddHandler, this);
  }

  protected afterAddHandler(evt?: ICEEvent) {
    //连接线的两端分别与一个组件关联，因此需要等待渲染器完成一轮渲染之后才能建立连接，否则需要连接的对象可能还没有渲染出来。
    this.evtBus.once(ICE_EVENT_NAME_CONSTS.ROUND_FINISH, this.makeConnection, this);
  }

  protected makeConnection() {
    const links = this.state.links;
    if (links) {
      if (links.start) {
        const id = links.start.id;
        const position = links.start.position;
        if (id && position) {
          const component = this.ice.findComponent(id);
          this.setLink('start', component, position);
        }
      }
      if (links.end) {
        const id = links.end.id;
        const position = links.end.position;
        if (id && position) {
          const component = this.ice.findComponent(id);
          this.setLink('end', component, position);
        }
      }
    }

    this.ice.dirty = true;
  }

  public setLink(terminal: string, component: ICEComponent, position: string) {
    this.removeLink(terminal, component, position);

    this.links[terminal] = { component: component, position: position };
    component.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.followComponent, this);
    component.on(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE, this.followComponent, this);
    component.on(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE, this.followComponent, this);
    component.once(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.followComponent, this);
    this.followComponent();

    //重新设置连接信息，连接线连接到组件上之后，自身不再能拖拽
    const _temp = {};
    for (let p in this.links) {
      let obj = this.links[p];
      if (obj.component && obj.position) {
        _temp[p] = { id: obj.component.props.id, position: obj.position };
      }
    }
    this.setState({
      links: { ..._temp },
      draggable: false,
    });
  }

  public removeLink(terminal: string, component: ICEComponent, position: string) {
    const _component = this.links[terminal].component;
    const _position = this.links[terminal].position;
    if (_component === component && _position === position) {
      _component && _component.off(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.followComponent, this);
      _component && _component.off(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE, this.followComponent, this);
      _component && _component.off(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE, this.followComponent, this);
      this.links[terminal] = {};
      this.state.links[terminal] = {};
    }

    //如果两端都没有连接的组件，连接线自身变成可拖动
    if (!this.links.start.component && !this.links.end.component) {
      this.setState({
        draggable: true,
      });
    }
  }

  /**
   * @method getLinkFromId
   * 获取起点组件 id ，如果没有建立连接，则返回 null
   * @returns
   */
  public getLinkFromId(): string {
    return this.state.links.start.id;
  }

  /**
   * @method getLinkToId
   * 获取终点组件 id ，如果没有建立连接，则返回 null
   * @returns
   */
  public getLinkToId(): string {
    return this.state.links.end.id;
  }

  /**
   * @method
   * 连接的组件位置发生移动之后，重新计算连接线的起点和终点。
   */
  private followComponent(evt?: ICEEvent) {
    for (let terminal in this.links) {
      const position = this.links[terminal].position;
      const component: ICEComponent = this.links[terminal].component;
      if (!position || !component) {
        continue;
      }

      const box = component.getMinBoundingBox();
      let temp = [0, 0];
      switch (position) {
        case 'T':
          temp = box.tc;
          break;
        case 'R':
          temp = box.rc;
          break;
        case 'B':
          temp = box.bc;
          break;
        case 'L':
          temp = box.lc;
          break;
        default:
          break;
      }

      switch (terminal) {
        case 'start':
          this.setState({
            startPoint: [...temp],
          });
          break;
        case 'end':
          this.setState({
            endPoint: [...temp],
          });
          break;
        default:
          break;
      }
    }
  }

  /**
   * ICEPolyLine 有自己的特殊处理，它的原点永远在 (0,0) 位置，而不在几何中点。
   * @overwrite
   * @returns
   */
  protected calcLocalOrigin() {
    let point = [0, 0];
    this.state.localOrigin = point;
    return point;
  }

  /**
   * @method calcDots
   * ICEPolyLine 有自己特殊的计算方式：
   * - 原点总是放在 startPoint 的位置。
   * - 数值相对于组件本地坐标系进行计算。
   * @overwrite
   * @returns
   */
  protected calcDots() {
    let left = this.state.left;
    let top = this.state.top;
    this.state.dots = [];
    for (let i = 0; i < this.state.points.length; i++) {
      const p = this.state.points[i];
      let x = p[0] - left;
      let y = p[1] - top;
      this.state.dots.push([x, y]);
    }

    this.calcArrowPoints();

    return this.state.dots;
  }

  /**
   * @method calcArrowPoints
   * 计算箭头坐标
   */
  protected calcArrowPoints() {
    //计算起点箭头坐标
    if (this.state.arrow === 'start' || this.state.arrow === 'both') {
      let firstPoint = [...this.state.dots[0]];
      let points = [[...this.state.dots[0]], [...this.state.dots[1]]];
      points = this.doCalcArrowPoints(points);
      this.state.dots.unshift(...points);
      this.state.dots.unshift([...firstPoint]);
    }
    //计算终点箭头坐标
    if (this.state.arrow === 'end' || this.state.arrow === 'both') {
      let len = this.state.dots.length;
      let lastPoint = [...this.state.dots[len - 1]];
      let points = [[...this.state.dots[len - 1]], [...this.state.dots[len - 2]]];
      points = this.doCalcArrowPoints(points);
      this.state.dots.push(...points);
      this.state.dots.push([...lastPoint]);
    }
  }

  protected doCalcArrowPoints(twoPoints) {
    let p1 = twoPoints[0];
    let p2 = twoPoints[1];

    p2[0] = p2[0] - p1[0];
    p2[1] = p2[1] - p1[1];

    //极坐标计算箭头的两个点
    let cosp2 = p2[0] / Math.hypot(...p2);
    let sinp2 = p2[1] / Math.hypot(...p2);

    let cosArrow = Math.cos(this.state.arrowAngel);
    let sinArrow = Math.sin(this.state.arrowAngel);

    let x1 = this.state.arrowLength * (cosp2 * cosArrow - sinp2 * sinArrow);
    let y1 = this.state.arrowLength * (sinp2 * cosArrow + cosp2 * sinArrow);

    let x2 = this.state.arrowLength * (cosp2 * cosArrow + sinp2 * sinArrow);
    let y2 = this.state.arrowLength * (sinp2 * cosArrow - cosp2 * sinArrow);

    x1 += p1[0];
    y1 += p1[1];

    x2 += p1[0];
    y2 += p1[1];

    return [
      [x1, y1],
      [x2, y2],
    ];
  }

  /**
   * @method addDot 增加一个点
   *
   * 动态向线条上增加一个点。
   *
   * @param point
   * @param index
   */
  public addDot(point: [number, number], index: number): void {
    this.state.points.splice(index, 0, point);
    this.state.dots.splice(index, 0, [point[0], point[1]]);
  }

  /**
   * @method rmDot 删除一个点
   *
   * 从线条上删掉一个点，如果线条上的点数已经小于等于 2 ，则什么都不做。
   *
   * @param index
   */
  public rmDot(index: number): boolean {
    if (this.state.points.length < 3) {
      return false;
    }
    this.state.points.splice(index, 1);
    this.state.dots.splice(index, 1);
    return true;
  }

  /**
   * @method calcComponentParams
   *
   * - 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * - 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
   * - 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   *
   * @overwrite
   * @returns {ComponentParams}
   */
  protected calcComponentParams() {
    if (!this.dirty) {
      return { width: this.state.width, height: this.state.height };
    }

    this.calcDots();

    let points = this.calc4VertexPoints(); //最小包围盒的4个顶点
    let width = Math.abs(points[1][0] - points[0][0]); //maxX-minX
    let height = this.state.style.lineWidth;

    //先进行共线判断，如果所有点都在同一条直线上，那么边界盒子的整体高度就等于线条的粗细
    if (this.isDotsOnSameLine()) {
      this.state.width = width;
      this.state.height = height;
      return { width: this.state.width, height: this.state.height };
    } else {
      height = Math.abs(points[2][1] - points[0][1]); //maxY-minY
      this.state.width = width;
      this.state.height = height;
      return { width: this.state.width, height: this.state.height };
    }
  }

  /**
   * @method isDotsOnSameLine 是否所有点都在同一条直线上
   *
   * 进行共线判断，如果所有点都在同一条直线上，那么边界盒子的整体高度就等于线条的粗细。
   *
   * @returns
   */
  private isDotsOnSameLine(): boolean {
    let len = this.state.points.length;
    let startX = round(this.state.points[0][0], 2);
    let startY = round(this.state.points[0][1], 2);
    let endX = round(this.state.points[len - 1][0], 2);
    let endY = round(this.state.points[len - 1][1], 2);

    let counter = 0;
    let vector1 = [endX - startX, endY - startY]; //起点和终点构成的向量坐标
    for (let i = 0; i < len; i++) {
      let p = this.state.points[i];
      let vector2 = [p[0] - startX, p[1] - startY];
      //@ts-ignore
      let crossProduct = vec2.cross([], vector1, vector2)[2];
      if (crossProduct === 0) {
        counter++;
      }
    }

    //折线上的所有点都共线，外观上已经退化成一条直线
    if (counter === len) {
      return true;
    }

    return false;
  }

  /**
   * @method calc4VertexPoints 计算4个顶点
   *
   * - 相对于组件本地的坐标系，原点位于左上角，没有经过矩阵变换。
   * - 返回值用于计算组件的原始 width/height 。
   *
   * @returns {Array}
   */
  protected calc4VertexPoints() {
    if (this.isDotsOnSameLine()) {
      return this.splitEndpointsTo4Points();
    } else {
      return super.calc4VertexPoints();
    }
  }

  /**
   * @method splitEndpointsTo4Points 将线条的起点和终点分成4个点，用于计算组件的原始 width/height
   *
   * 把直线的2个端点分裂成4个点，把线条的粗细参数(lineWidth)当成高度看待，方便计算最小包围盒。
   *
   * @returns
   */
  protected splitEndpointsTo4Points() {
    let len = this.state.points.length;
    let startX = 0; //由于 ICEPolyLine 总是把 left/top 与起点重合，所以这里的 startX 总是为 0
    let startY = 0; //由于 ICEPolyLine 总是把 left/top 与起点重合，所以这里的 startY 总是为 0
    let endX = this.state.points[len - 1][0] - this.state.points[0][0];
    let endY = this.state.points[len - 1][1] - this.state.points[0][1];
    let angle = this.getRotateAngle();

    let height = this.state.height;
    let deltaX = (Math.cos((angle * Math.PI) / 180) * height) / 2;
    let deltaY = (Math.sin((angle * Math.PI) / 180) * height) / 2;
    deltaX = round(deltaX, 3);
    deltaY = round(deltaY, 3);

    //计算4个顶点，让边界盒子紧贴直线
    let point1 = [startX + deltaX, startY + deltaY];
    let point2 = [startX - deltaX, startY - deltaY];
    let point3 = [endX + deltaX, endY + deltaY];
    let point4 = [endX - deltaX, endY - deltaY];

    return [point1, point2, point3, point4];
  }

  /**
   * @method getMinBoundingBox  获取最小包围盒
   *
   * 此盒子的变换矩阵与组件自身的变换矩阵完全相同。
   *
   * @returns
   */
  public getMinBoundingBox(): ICEBoundingBox {
    //先基于组件本地坐标系进行计算
    let originX = this.state.localOrigin[0];
    let originY = this.state.localOrigin[1];
    let points = this.calc4VertexPoints();
    let boundingBox = new ICEBoundingBox([
      points[0][0] - originX,
      points[0][1] - originY,
      points[1][0] - originX,
      points[1][1] - originY,
      points[2][0] - originX,
      points[2][1] - originY,
      points[3][0] - originX,
      points[3][1] - originY,
      0,
      0,
    ]);

    //再用 composedMatrix 进行变换
    boundingBox = boundingBox.transform(this.state.composedMatrix);
    return boundingBox;
  }

  /**
   * @method setState  更新组件状态
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   *
   * ICEPolyLine 有自己特殊的处理方法：
   *
   * - ICEPolyLine 的 width/height 属性总是计算出来的，不能直接修改，不接受 width/height 配置项。
   * - ICEPolyLine ICEPolyLine 不能进行 transform 操作，不接受 transform 配置项。
   * - ICEPolyLine 可以直接修改 points 。
   * - ICEPolyLine 的 left/top 数值可以直接修改，修改 left/top 时，会重新计算起点和终点坐标，保证 left/top 与 startPoint 始终保持在同一个点上。
   *
   * @overwrite
   * @param newState 新的状态
   */
  public setState(newState: any) {
    //ICEPolyLine 的 width/height 属性总是计算出来的，不能直接修改，不接受 width/height 配置项。
    if (!isNil(newState.width)) {
      delete newState.width;
    }

    if (!isNil(newState.height)) {
      delete newState.height;
    }

    //ICEPolyLine 不能进行 transform 操作，不接受 transform 配置项。
    if (!isNil(newState.transform)) {
      delete newState.transform;
    }

    if (!isNil(newState.left)) {
      let deltaX = newState.left - this.state.points[0][0];
      for (let i = 0; i < this.state.points.length; i++) {
        this.state.points[i][0] += deltaX;
      }
    }

    if (!isNil(newState.top)) {
      let deltaY = newState.top - this.state.points[0][1];
      for (let i = 0; i < this.state.points.length; i++) {
        this.state.points[i][1] += deltaY;
      }
    }

    if (!isNil(newState.startPoint)) {
      this.state.points[0] = [...newState.startPoint];
      //对 ICEPolyLine 来说，需要保证 left/top 与起点始终重合。
      this.state.left = this.state.points[0][0];
      this.state.top = this.state.points[0][1];
    }

    if (!isNil(newState.endPoint)) {
      let len = this.state.points.length;
      this.state.points[len - 1] = [...newState.endPoint];
    }

    super.setState(newState);
  }

  /**
   * @method getRotateAngle 获取组件的旋转角度
   * @returns {number}
   */
  public getRotateAngle(): number {
    //先进行共线判断，如果所有点都共线，则旋转角等于直线斜率对应的旋转角。
    if (this.isDotsOnSameLine()) {
      let startX = 0; //由于 ICEPolyLine 总是把 left/top 与 startPoint 重合，所以这里的 startX 总是为 0
      let startY = 0; //由于 ICEPolyLine 总是把 left/top 与 startPoint 重合，所以这里的 startY 总是为 0
      let len = this.state.points.length;
      let endX = this.state.points[len - 1][0] - this.state.points[0][0];
      let endY = this.state.points[len - 1][1] - this.state.points[0][1];

      //计算直线的旋转角
      let angle = GeoUtil.calcRotateAngle(endX, endY, startX, startY);
      angle += 90; //加90度，法向

      return angle;
    } else {
      return super.getRotateAngle();
    }
  }

  /**
   * @method containsPoint 判断点是否在线上
   *
   * 计算方法：如果给点的坐标点到线段两端的距离之和等于线段长度，则表示点位于线段上，允许一定的误差范围，用 delta 参数进行调节。
   * 算法来源：http://www.jeffreythompson.org/collision-detection/line-point.php
   *
   * @param x
   * @param y
   * @returns {boolean}
   */
  public containsPoint(x: number, y: number): boolean {
    const errorRange = 3; //像素值，表示允许的浮点运算误差，正负区间内，调节此参数可以扩大或者缩小精确度。
    const lines = this.getLines();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const x1 = line.o[0];
      const y1 = line.o[1];
      const x2 = line.d[0];
      const y2 = line.d[1];
      const lineLength = Math.hypot(x2 - x1, y2 - y1);
      const len1 = Math.hypot(x1 - x, y1 - y);
      const len2 = Math.hypot(x2 - x, y2 - y);
      if (len1 + len2 >= lineLength - errorRange && len1 + len2 <= lineLength + errorRange) {
        return true;
      }
    }
    return false;
  }

  /**
   * @method getLines 获取线段数组
   * @returns {Array<any>}
   */
  private getLines(): Array<any> {
    const result = [];
    const dots = this.getTransformedDots();
    if (!dots || dots.length < 2) {
      return result;
    }
    for (let i = 0; i < dots.length - 1; i++) {
      const x1 = dots[i][0];
      const y1 = dots[i][1];
      const x2 = dots[i + 1][0];
      const y2 = dots[i + 1][1];
      const line = { o: [x1, y1], d: [x2, y2] }; //o:origin, d:destination
      result.push(line);
    }
    return result;
  }

  /**
   * @overwrite
   * @method destory
   */
  public destory(): void {
    if (this.links.start) {
      this.removeLink('start', this.links.start.component, this.links.start.position);
    }
    if (this.links.end) {
      this.removeLink('end', this.links.end.component, this.links.end.position);
    }
    super.destory();
  }
}

export default ICEPolyLine;
