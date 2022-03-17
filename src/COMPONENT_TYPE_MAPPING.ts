/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import ICEGroup from './graphic/container/ICEGroup';
import ICEImage from './graphic/ICEImage';
import ICEPolyLine from './graphic/line/ICEPolyLine';
import ICEVisioLink from './graphic/link/ICEVisioLink';
import ICECircle from './graphic/shape/ICECircle';
import ICEEllipse from './graphic/shape/ICEEllipse';
import ICEIsogon from './graphic/shape/ICEIsogon';
import ICERect from './graphic/shape/ICERect';
import ICEStar from './graphic/shape/ICEStar';
import ICEText from './graphic/text/ICEText';

/**
 * 组件名称和构造函数引用之间的映射关系，把序列化之后的 JSON 字符串重新解析成图形时需要用到此映射关系。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 *
 * //FIXME:需要扩展一个注册方法，让外部使用方把自己扩展的组件注册进来，否则无法序列化和反解析。
 */
const componentTypeMap = Object.fromEntries(
  new Map([
    ['ICERect', ICERect],
    ['ICECircle', ICECircle],
    ['ICEEllipse', ICEEllipse],
    ['ICEStar', ICEStar],
    ['ICEIsogon', ICEIsogon],
    ['ICEText', ICEText],
    ['ICEImage', ICEImage],
    ['ICEGroup', ICEGroup],
    ['ICEVisioLink', ICEVisioLink],
    ['ICEPolyLine', ICEPolyLine],
  ])
);

export default componentTypeMap;
