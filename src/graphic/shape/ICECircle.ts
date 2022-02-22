/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEllipse from './ICEEllipse';

/**
 * @class ICECircle
 *
 * 正圆形，采用椭圆绘制方法，正圆形作为椭圆的特殊情况。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICECircle extends ICEEllipse {
  /**
   * @required
   * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
   */
  public static type: string = 'ICECircle';

  constructor(props: any = {}) {
    let param = { radius: 10, ...props };
    param.radiusX = param.radius;
    param.radiusY = param.radius;

    super(param);
  }

  public toJSON(): object {
    let result = { ...super.toJSON(), type: ICECircle.type };
    return result;
  }
}

export default ICECircle;
