/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { glMatrix } from 'gl-matrix';
import isNil from 'lodash/isNil';
import ICEDotPath from '../ICEDotPath';

/**
 *
 * @class ICEIsogon
 *
 * 正N边形
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEIsogon extends ICEDotPath {
  /**
   * @method constructor
   * radius, edges 会暴露给 AnimationManager ，可能会动态变化。
   * @param props
   */
  constructor(props: any = {}) {
    let param = {
      radius: 10, //外接圆的半径
      edges: 3, //边数 N ，正整数
      startAngle: 90, //开始点的角度
      ...props,
    };
    param.width = param.radius * 2;
    param.height = param.radius * 2;

    super(param);
  }

  /**
   * @overwrite
   * @method calcDots
   *
   * 计算路径上的关键点:
   * - 默认的坐标原点是 (0,0) 位置。
   * - 这些点没有经过 transform 矩阵变换。
   *
   * @returns
   */
  protected calcDots() {
    this.state.dots = [];
    let avgAngle = (2 * Math.PI) / this.state.edges;
    //求正 N 边形的顶点坐标，极坐标法。
    let radius = this.state.radius;
    for (let i = 0; i < this.state.edges; i++) {
      let currentAngel = avgAngle * i - glMatrix.toRadian(this.state.startAngle);
      let x = Math.floor(radius * Math.cos(currentAngel) + radius);
      let y = Math.floor(radius * Math.sin(currentAngel) + radius);
      this.state.dots.push([x, y]);
    }
    return this.state.dots;
  }

  /**
   * @overwrite
   * @method calcComponentParams
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
   * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * @returns
   */
  public calcComponentParams() {
    if (!this.dirty) {
      return { width: this.state.width, height: this.state.height };
    }

    //DotPath 需要先计算每个点的坐标，然后才能计算 width/height
    this.calcDots();
    this.state.width = this.state.radius * 2;
    this.state.height = this.state.radius * 2;
    return { width: this.state.width, height: this.state.height };
  }

  /**
   * @overwrite
   * @method setState
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   *
   * Ellipse 有自己特殊的处理方法：
   *
   * - 如果 setState 时指定了 radius 参数，则 width 会被重新计算，如果指定了 radius 参数则 height 会被重新计算。
   * - 如果 setState 时仅仅指定 width 参数，则 radius 会被重新计算，如果仅仅指定了 height 参数，则 radius 会被重新计算。
   * @param newState
   */
  public setState(newState: any) {
    if (!isNil(newState.radius)) {
      newState.width = 2 * newState.radius;
      newState.height = 2 * newState.radius;
    } else if (!isNil(newState.width)) {
      newState.radius = newState.width / 2;
    } else if (!isNil(newState.height)) {
      newState.radius = newState.height / 2;
    }
    super.setState(newState);
  }
}
export default ICEIsogon;
