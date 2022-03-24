/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { vec2 } from 'gl-matrix';
import isNil from 'lodash/isNil';
import round from 'lodash/round';
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from '../../event/ICEEvent';
import GeoUtil from '../../geometry/GeoUtil';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
import ICEComponent from '../ICEComponent';
import ICEDotPath from '../ICEDotPath';

/**
 *
 * @class ICEPolyLine
 *
 * 折线
 *
 * 基本特征：
 *
 * - ICEPolyLine 由多个点构成，如果折线上的所有点共线，则折线在外观上退化成直线。
 * - ICEPolyLine 上至少存在 2 个点，否则无法画线。如果点数恰好为 2 ，折线退化成一条直线。
 * - ICEPolyLine 以及所有子类不能进行 transform 操作。
 * - ICEPolyLine 以及所有子类的 left/top 总是被设置为 startPoint 。
 * - ICEPolyLine 以及所有子类的原点都在 startPoint 上，而不在几何中心点。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEPolyLine extends ICEDotPath {
  /**
   * {
   *  start:{componnet:ICEComponent,position:'T'},
   *  end:{component:ICEComponent,position:'B'}
   * }
   */
  protected links: any = { start: {}, end: {} }; //记录连接到了哪个组件上

  /**
   * FIXME:编写完整的配置项描述
   * @cfg
   * {
   *  lineType: 'solid', //solid, dashed
   *  lineWidth:2,
   *  arrow: 'none',     //none, start, end ,both
   *  closePath:false,
   *  points:[],         //点的坐标
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
  public static arrangeParam(props): any {
    //dots 是内部计算使用的属性，外部传参用 points 属性
    //points 是一个数组，用来描述一系列的坐标点，这些点会被按照顺序连接起来，example: [[0,0],[10,10],[20,20],[30,30]]
    let param = {
      ...{
        linkable: false, //所有线条类型的组件 linkable 都为 false ，因为在 ICE 中，用线条连接线条是没有意义的，线条之间不能互相连接。
        lineType: 'solid',
        lineWidth: 2,
        arrow: 'none',
        closePath: false,
        points: [],
        showMinBoundingBox: false,
        showMaxBoundingBox: false,
      },
      ...props,
    };

    //至少有2个点，如果点数少于2个，自动填充。
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

    //保证 lineWidth 不小于0
    if (param.style.lineWidth <= 0) {
      param.style.lineWidth = 2;
    }

    return param;
  }

  /**
   * @override
   */
  protected initEvents() {
    super.initEvents();

    // //如果 props 里面的 startSlotId 和 endSlotId 不为空，在渲染器完成一轮渲染之后，自动建立连接关系。
    // this.once(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.afterAddHandler, this);
  }

  // protected afterAddHandler(evt: ICEEvent) {
  //   this.evtBus.once(ICE_EVENT_NAME_CONSTS.ROUND_FINISH, this.makeConnection, this);
  // }

  // protected makeConnection() {
  //   const { startSlotId, endSlotId } = this.props;
  //   if (startSlotId) {
  //     const startSlot = this.ice.findComponent(startSlotId);
  //     startSlot && this.setSlot(startSlot, 'start');
  //   }

  //   if (endSlotId) {
  //     const endSlot = this.ice.findComponent(endSlotId);
  //     endSlot && this.setSlot(endSlot, 'end');
  //   }
  // }

  public setLink(terminal: string = 'start', component: ICEComponent, position: string = 'T') {
    this.removeLink(terminal, component, position);

    this.links[terminal] = { component: component, position: position };
    component.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.followComponent, this);
    component.once(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.followComponent, this);

    //连接线连接到组件上之后，自身不再能拖拽
    this.setState({
      draggable: false,
    });

    //FIXME:在 this.state 上添加存储结构
  }

  public removeLink(terminal: string = 'start', component: ICEComponent, position: string = 'T') {
    const _component = this.links[terminal].component;
    const _position = this.links[terminal].position;
    if (_component === component && _position === position) {
      _component && _component.off(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.followComponent, this);
      this.links[terminal] = {};
    }

    //FIXME:更新 this.state 上的存储结构

    //如果两端都没有连接的组件，连接线自身变成可拖动
    if (!this.links.start.component && !this.links.end.component) {
      this.setState({
        draggable: true,
      });
    }
  }

  /**
   * @method
   * 连接的组件位置发生移动之后，重新计算连接线的起点和终点。
   */
  private followComponent(evt: ICEEvent) {
    for (let terminal in this.links) {
      const position = this.links[terminal].position;
      const component: ICEComponent = this.links[terminal].component;
      if (!position || !component) {
        continue;
      }

      const box = component.getMaxBoundingBox();
      let temp = [0, 0];
      switch (position) {
        case 'T':
          temp = box.topCenter;
          break;
        case 'R':
          temp = box.rightCenter;
          break;
        case 'B':
          temp = box.bottomCenter;
          break;
        case 'L':
          temp = box.leftCenter;
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
    return this.state.dots;
  }

  /**
   * 动态向线条上增加一个点
   * @param point
   * @param index
   */
  public addDot(point: [number, number], index: number): void {
    this.state.points.splice(index, 0, point);
    this.state.dots.splice(index, 0, [point[0], point[1]]);
  }

  /**
   * 从线条上删掉一个点，如果线条上的点数已经小于等于 2 ，则什么都不做。
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
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
   * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * @overwrite
   * @returns
   */
  public calcComponentParams() {
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
   * 进行共线判断，如果所有点都在同一条直线上，那么边界盒子的整体高度就等于线条的粗细
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
   * 计算4个顶点：
   * - 相对于组件本地的坐标系，原点位于左上角，没有经过矩阵变换。
   * - 返回值用于计算组件的原始 width/height 。
   * @returns
   */
  protected calc4VertexPoints() {
    if (this.isDotsOnSameLine()) {
      return this.splitEndpointsTo4Points();
    } else {
      return super.calc4VertexPoints();
    }
  }

  /**
   * 把直线的2个端点分裂成4个点，把线条的粗细参数(lineWidth)当成高度看待，方便计算最小包围盒。
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
   * 获取组件的最小包围盒，此盒子的变换矩阵与组件自身完全相同。
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
   * @param newState
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
      let offsetX = newState.left - this.state.points[0][0];
      for (let i = 0; i < this.state.points.length; i++) {
        this.state.points[i][0] += offsetX;
      }
    }

    if (!isNil(newState.top)) {
      let offsetY = newState.top - this.state.points[0][1];
      for (let i = 0; i < this.state.points.length; i++) {
        this.state.points[i][1] += offsetY;
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
   * 获取旋转角
   * @returns
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
   * 判断给定的坐标点是否位于线段上。
   * 计算方法：如果给点的坐标点到线段两端的距离之和等于线段长度，则表示点位于线段上，允许一定的误差范围，用 delta 参数进行调节。
   * 算法来源：http://www.jeffreythompson.org/collision-detection/line-point.php
   * @param x
   * @param y
   * @returns
   */
  public containsPoint(x: number, y: number): boolean {
    const delta = 3; //允许的浮点运算误差，正负区间内，调节此参数可以扩大或者缩小精确度。
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
      if (len1 + len2 >= lineLength - delta && len1 + len2 <= lineLength + delta) {
        return true;
      }
    }
    return false;
  }

  private getLines(): Array<any> {
    const result = [];
    const dots = this.state.transformedDots;
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
}

export default ICEPolyLine;
