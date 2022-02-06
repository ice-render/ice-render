import ICEEllipse from './ICEEllipse';

/**
 * 采用椭圆绘制方法，正圆形作为椭圆的特殊情况处理。
 * @class ICECircle
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICECircle extends ICEEllipse {
  constructor(props: any = {}) {
    let param = { radius: 10, ...props };
    param.radiusX = param.radius;
    param.radiusY = param.radius;

    super(param);
  }
}
export default ICECircle;
