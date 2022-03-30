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
 * @class ICEStar
 *
 * 正 N 角星
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEStar extends ICEDotPath {
  constructor(props: any = {}) {
    let param = {
      outerRadius: 50, //外圆半径
      innerRadius: 20, //内圆半径
      startAngle: 90, //起始角度
      spikes: 5,
      ...props,
    };
    param.spikes = Math.floor(param.spikes >= 1 ? param.spikes : 1);
    param.width = param.outerRadius * 2;
    param.height = param.outerRadius * 2;
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

    let radian = glMatrix.toRadian(this.state.startAngle); //弧度
    let step = Math.PI / this.state.spikes;
    let outerRadius = this.state.outerRadius;
    let innerRadius = this.state.innerRadius;
    let x, y;
    for (let i = 0; i < this.state.spikes; i++) {
      x = Math.cos(radian) * outerRadius + outerRadius;
      y = Math.sin(radian) * outerRadius + outerRadius;
      this.state.dots.push([x, y]);
      radian += step;

      x = Math.cos(radian) * innerRadius + outerRadius;
      y = Math.sin(radian) * innerRadius + outerRadius;
      this.state.dots.push([x, y]);
      radian += step;
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
  protected calcComponentParams() {
    if (!this.dirty) {
      return { width: this.state.width, height: this.state.height };
    }

    this.calcDots();

    //DotPath 需要先计算每个点的坐标，然后才能计算 width/height
    this.state.width = this.state.outerRadius * 2;
    this.state.height = this.state.outerRadius * 2;

    return { width: this.state.width, height: this.state.height };
  }

  /**
   * @overwrite
   * @method setState
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   *
   * - 如果 setState 时指定了 radius 参数，则 width 会被重新计算，如果指定了 radius 参数则 height 会被重新计算。
   * - 如果 setState 时仅仅指定 width 参数，则 radius 会被重新计算，如果仅仅指定了 height 参数，则 radius 会被重新计算。
   * @param newState
   */
  public setState(newState: any) {
    if (!isNil(newState.outerRadius)) {
      newState.width = 2 * newState.outerRadius;
      newState.height = 2 * newState.outerRadius;
    } else if (!isNil(newState.width)) {
      newState.outerRadius = newState.width / 2;
    } else if (!isNil(newState.height)) {
      newState.outerRadius = newState.height / 2;
    }
    super.setState(newState);
  }
}

export default ICEStar;
