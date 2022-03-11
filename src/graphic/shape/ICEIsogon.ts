/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEDotPath from '../ICEDotPath';

/**
 *
 * FIXME: 需要默认把正多边形的其中一个顶点或者边固定在屏幕上方90度位置。
 *
 * @class ICEIsogon
 *
 * 正多边形
 *
 * 用宽高描述法描述正多边形，方便传参。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEIsogon extends ICEDotPath {
  /**
   * @required
   * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
   */
  public static type: string = 'ICEIsogon';

  //外接圆的半径
  public radius: number = 10;
  //边数 N ，正整数
  public edges: number = 3;

  /**
   * radius, edges 会暴露给 AnimationManager ，可能会动态变化。
   * @param props
   */
  constructor(props: any = {}) {
    let param = {
      radius: 10,
      edges: 3,
      ...props,
    };
    param.width = param.radius * 2;
    param.height = param.radius * 2;

    super(param);

    this.radius = this.props.radius; //FIXME:delete?
    this.edges = this.props.edges; //FIXME:delete?
  }

  /**
   * 计算路径上的关键点:
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   * @returns
   */
  protected calcDots(): Array<DOMPoint> {
    //求正 N 边形的顶点坐标，极坐标法。
    this.state.dots = [];
    let avgAngle = (2 * Math.PI) / this.state.edges;

    //FIXME: 需要默认把正多边形的其中一个顶点或者边固定在屏幕上方90度位置。
    //FIXME:这里需要重新设置起始角度
    //FIXME:当边数为奇数时，把一个顶点放在正上方90度位置，当边数为偶数时，把一条边与 X 轴平行
    for (let i = 0; i < this.state.edges; i++) {
      let currentAngel = avgAngle * i;
      let radius = this.state.radius;
      let x = Math.floor(radius * Math.cos(currentAngel) + radius);
      let y = Math.floor(radius * Math.sin(currentAngel) + radius);
      this.state.dots.push(new DOMPoint(x, y));
    }
    return this.state.dots;
  }

  /**
   * 把对象序列化成 JSON 字符串：
   * - 容器型组件需要负责子节点的序列化操作
   * - 如果组件不需要序列化，需要返回 null
   * @returns JSONObject
   */
  public toJSON(): object {
    let result = { ...super.toJSON(), type: ICEIsogon.type };
    return result;
  }
}
export default ICEIsogon;
