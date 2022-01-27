import ICELine from './ICELine';

/**
 * @class ICEBezier 贝塞尔曲线
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEBezier extends ICELine {
  constructor(props: any = { startPoint: [0, 0], endPoint: [10, 10] }) {
    super(props);
  }
}

export default ICEBezier;
