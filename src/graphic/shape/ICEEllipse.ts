/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { isNil } from '../../util/lang';
import ICEPath from '../ICEPath';

/**
 * @class ICEEllipse 椭圆形
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEEllipse extends ICEPath {
  //@see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/ellipse
  constructor(props: any = {}) {
    const param = {
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
      this.state.radiusX - this.state.localOrigin[0],
      this.state.radiusY - this.state.localOrigin[1],
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
   * 精确命中判定：点是否位于椭圆内部（圆心为本地原点）。
   * 圆作为椭圆的特例（radiusX === radiusY）自动继承此实现。
   * @overwrite
   */
  protected containsLocalPoint(localX: number, localY: number): boolean {
    const rx = this.state.radiusX;
    const ry = this.state.radiusY;
    if (!rx || !ry) return false;

    let px = localX;
    let py = localY;
    const rotation = this.state.rotation || 0;
    if (rotation) {
      // 椭圆自身带 rotation 时，把点反向旋转回未旋转空间再判定
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      px = localX * cos + localY * sin;
      py = -localX * sin + localY * cos;
    }

    const nx = px / rx;
    const ny = py / ry;
    return nx * nx + ny * ny <= 1;
  }

  /**
   * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
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
}
export default ICEEllipse;
