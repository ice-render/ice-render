/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEllipse from './ICEEllipse';
import { isNil } from '../../util/lang';

/**
 * @class ICECircle 正圆形
 *
 * 采用椭圆绘制方法，正圆形作为椭圆的特殊情况。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICECircle extends ICEEllipse {
  constructor(props: any = {}) {
    const param = { radius: 10, ...props };
    if (props.radius === undefined && props.width !== undefined) {
      param.radius = Number(props.width) / 2;
    } else if (props.radius === undefined && props.height !== undefined) {
      param.radius = Number(props.height) / 2;
    }
    param.radiusX = param.radius;
    param.radiusY = param.radius;

    super(param);
  }

  /**
   * @overwrite
   *
   * `radius` 是 ICECircle 的**主旋钮**，但它只在构造函数里被翻译成 `radiusX/radiusY`；
   * 运行时写 `setState({ radius })` 会只改 `state.radius`，而绘制读的是 `radiusX/radiusY`
   * —— 结果是「state 说半径 40、画出来还是 28」，属性改了画面不动（2026-09-20 由 worker 镜像
   * 回归抓出来：镜像按文档重建会走构造函数、于是按 40 画，两边就对不上了）。
   *
   * 规则与构造函数逐字对齐（也照 ICERose / ICEEllipse 的既有模式）：
   * - 给了 `radius` → 三个字段一起走（radiusX = radiusY = radius，width = height = 2r）；
   * - 只给 `width`（或只给 `height`）→ 反推 `radius`，仍然画正圆（与构造期 `width: 100` 等价）；
   * - 其余情况交给 `ICEEllipse.setState`（它负责 `radiusX/radiusY ↔ width/height` 的换算）。
   */
  public setState(newState: any, options?: { paramsDirty?: boolean }) {
    if (newState) {
      if (isNil(newState.radius)) {
        if (!isNil(newState.width)) {
          newState.radius = Number(newState.width) / 2;
        } else if (!isNil(newState.height)) {
          newState.radius = Number(newState.height) / 2;
        }
      }
      if (!isNil(newState.radius)) {
        newState.radiusX = newState.radius;
        newState.radiusY = newState.radius;
        newState.width = 2 * newState.radius;
        newState.height = 2 * newState.radius;
      }
    }
    super.setState(newState, options);
  }
}

export default ICECircle;
