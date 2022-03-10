/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import isNil from 'lodash/isNil';
import merge from 'lodash/merge';
import round from 'lodash/round';
import GeometryUtil from '../../geometry/GeoUtil';
import ICEBoundingBox from '../../geometry/ICEBoundingBox';
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
   * @required
   * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
   */
  public static type: string = 'ICEPolyLine';

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
    let param = merge(
      {
        lineType: 'solid',
        lineWidth: 2,
        arrow: 'none',
        closePath: false,
        points: [],
        showMinBoundingBox: false,
        showMaxBoundingBox: false,
      },
      props
    );

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

    //ICEPolyLine 的参数需要特殊处理，总是把 left/top 移动到第 0 个点的位置，外部传递的 left/top ， translate.x/translate.y 都无效。
    param = merge(param, {
      left: props.points[0][0],
      top: props.points[0][1],
      transform: {
        translate: [0, 0],
        scale: [1, 1],
        skew: [0, 0],
        rotate: 0, //degree
      },
    });

    //保证 lineWidth 不小于0
    if (param.style.lineWidth <= 0) {
      param.style.lineWidth = 2;
    }

    return param;
  }

  /**
   * ICEPolyLine 有自己的特殊处理，它的原点永远在 (0,0) 位置，而不在几何中点。
   * @overwrite
   * @returns
   */
  protected calcLocalOrigin(): DOMPoint {
    let point = new DOMPoint(0, 0);
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
  protected calcDots(): Array<DOMPoint> {
    let left = this.state.left;
    let top = this.state.top;
    this.state.dots = [];
    this.state.points.forEach((p) => {
      let x = p[0] - left;
      let y = p[1] - top;
      this.state.dots.push(new DOMPoint(x, y));
    });
    return this.state.dots;
  }

  /**
   * 动态向线条上增加一个点
   * @param point
   * @param index
   */
  public addDot(point: [number, number], index: number): void {
    this.state.points.splice(index, 0, point);
    this.state.dots.splice(index, 0, new DOMPoint(point[0], point[1]));
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
  public calcOriginalDimension() {
    this.calcDots();

    let points = this.calc4VertexPoints(); //最小包围盒的4个顶点
    let width = Math.abs(points[1].x - points[0].x); //maxX-minX
    let height = this.state.style.lineWidth;

    //先进行共线判断，如果所有点都在同一条直线上，那么边界盒子的整体高度就等于线条的粗细
    if (this.isDotsOnSameLine()) {
      this.state.width = width;
      this.state.height = height;
      return { width: this.state.width, height: this.state.height };
    } else {
      height = Math.abs(points[2].y - points[0].y); //maxY-minY
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
      let crossProduct = GeometryUtil.crossProduct(vector1[0], vector1[1], vector2[0], vector2[1]);
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
   * @returns Array<DOMPoint>
   */
  protected calc4VertexPoints(): Array<DOMPoint> {
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
  protected splitEndpointsTo4Points(): Array<DOMPoint> {
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
    let point1 = new DOMPoint(startX + deltaX, startY + deltaY);
    let point2 = new DOMPoint(startX - deltaX, startY - deltaY);
    let point3 = new DOMPoint(endX + deltaX, endY + deltaY);
    let point4 = new DOMPoint(endX - deltaX, endY - deltaY);

    return [point1, point2, point3, point4];
  }

  /**
   * 获取组件的最小包围盒，此盒子的变换矩阵与组件自身完全相同。
   * @returns
   */
  public getMinBoundingBox(): ICEBoundingBox {
    //先基于组件本地坐标系进行计算
    let originX = this.state.localOrigin.x;
    let originY = this.state.localOrigin.y;
    let points = this.calc4VertexPoints();
    let boundingBox = new ICEBoundingBox([
      points[0].x - originX,
      points[0].y - originY,
      points[1].x - originX,
      points[1].y - originY,
      points[2].x - originX,
      points[2].y - originY,
      points[3].x - originX,
      points[3].y - originY,
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
      let angle = GeometryUtil.calcRotateAngle(endX, endY, startX, startY);
      angle += 90; //加90度，法向

      return angle;
    } else {
      return super.getRotateAngle();
    }
  }

  //FIXME:对于线条类的组件，需要更精确的判定方法来判断指定的坐标点是否位于线条上
  public containsPoint(x: number, y: number): boolean {
    return super.containsPoint(x, y);
  }

  /**
   * 把对象序列化成 JSON 字符串：
   * - 容器型组件需要负责子节点的序列化操作
   * - 如果组件不需要序列化，需要返回 null
   * @returns JSONObject
   */
  public toJSON(): object {
    let result = { ...super.toJSON(), type: ICEPolyLine.type };
    return result;
  }
}

export default ICEPolyLine;
