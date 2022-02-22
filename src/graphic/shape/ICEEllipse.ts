/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import isNil from 'lodash/isNil';
import ICEPath from '../ICEPath';

/**
 * @class ICEEllipse
 *
 * 椭圆形。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEEllipse extends ICEPath {
  /**
   * @required
   * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
   */
  public static type: string = 'ICEEllipse';

  //@see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/ellipse
  constructor(props: any = {}) {
    let param = {
      radiusX: 20,
      radiusY: 10,
      rotation: 0,
      startAngle: 0,
      endAngle: 2 * Math.PI,
      counterclockwise: true,
      ...props,
    };
    param.width = param.radiusX * 2;
    param.height = param.radiusY * 2;
    super(param);
  }

  /**
   * 所有坐标点的坐标都是相对于父层组件，而不是全局坐标。
   * @returns
   */
  protected createPathObject(): Path2D {
    this.path2D = new Path2D();
    this.path2D.ellipse(
      this.state.radiusX - this.state.localOrigin.x,
      this.state.radiusY - this.state.localOrigin.y,
      this.state.radiusX,
      this.state.radiusY,
      this.state.rotation,
      this.state.startAngle,
      this.state.endAngle,
      this.state.counterclockwise
    );
    this.path2D.closePath();
    return this.path2D;
  }

  /**
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
   *
   * Ellipse 有自己特殊的处理方法：
   *
   * - 如果 setState 时指定了 radiusX 参数，则 width 会被重新计算，如果指定了 radiusY 参数则 height 会被重新计算。
   * - 如果 setState 时仅仅指定 width 参数，则 radiusX 会被重新计算，如果仅仅指定了 height 参数，则 radiusY 会被重新计算。
   * @overwrite
   * @param newState
   */
  public setState(newState: any) {
    if (!isNil(newState.radiusX)) {
      newState.width = 2 * newState.radiusX;
    } else if (!isNil(newState.width)) {
      newState.radiusX = newState.width / 2;
    }

    if (!isNil(newState.radiusY)) {
      newState.height = 2 * newState.radiusY;
    } else if (!isNil(newState.height)) {
      newState.radiusY = newState.height / 2;
    }

    super.setState(newState);
  }

  public toJSON(): object {
    let result = { ...super.toJSON(), type: ICEEllipse.type };
    return result;
  }
}
export default ICEEllipse;
