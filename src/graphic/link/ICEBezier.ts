/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEPolyLine from './ICEPolyLine';

/**
 * @class ICEBezier 贝塞尔曲线
 *
 * 复用 ICEPolyLine 的 curveType 曲线绘制能力：
 * - curveType='quadratic'（默认）：startPoint + controlPoint + endPoint 三点二次贝塞尔。
 * - curveType='cubic'：startPoint + controlPoint1 + controlPoint2 + endPoint 四点三次贝塞尔。
 * - 也可直接传 points（3 点二次 / 4 点三次）进行完全控制。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ICEBezier extends ICEPolyLine {
  constructor(props: any = {}) {
    props = ICEBezier.arrangeParam(props);
    super(props);
  }

  protected static arrangeParam(props: any = {}): any {
    const curveType = props.curveType === 'cubic' ? 'cubic' : 'quadratic';
    const points = props.points && props.points.length ? props.points : ICEBezier.buildDefaultPoints(props, curveType);
    return { ...props, curveType, points };
  }

  private static buildDefaultPoints(props: any, curveType: string): number[][] {
    const start = props.startPoint || [0, 0];
    const end = props.endPoint || [10, 10];
    if (curveType === 'cubic') {
      const controlPoint1 = props.controlPoint1 || [5, -5];
      const controlPoint2 = props.controlPoint2 || [5, 5];
      return [start, controlPoint1, controlPoint2, end];
    }
    const controlPoint = props.controlPoint || [5, -5];
    return [start, controlPoint, end];
  }
}
