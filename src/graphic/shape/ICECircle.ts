/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEllipse from './ICEEllipse';

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
}

export default ICECircle;
