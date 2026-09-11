/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import ICEGroup from '../graphic/container/ICEGroup';
import ICEImage from '../graphic/ICEImage';
import ICEBezier from '../graphic/link/ICEBezier';
import ICEPolyLine from '../graphic/link/ICEPolyLine';
import ICEVisioLink from '../graphic/link/ICEVisioLink';
import ICECircle from '../graphic/shape/ICECircle';
import ICEEllipse from '../graphic/shape/ICEEllipse';
import ICEIsogon from '../graphic/shape/ICEIsogon';
import ICERect from '../graphic/shape/ICERect';
import ICERose from '../graphic/shape/ICERose';
import ICEStar from '../graphic/shape/ICEStar';
import ICEText from '../graphic/text/ICEText';

/**
 * 组件名称和构造函数引用之间的映射关系，把序列化之后的 JSON 字符串重新解析成图形时需要用到此映射关系。
 *
 * key 是**稳定的类型名（typeId）**，与类的 JS 名解耦：序列化时由构造函数反查这张表得到 typeId，
 * 因此压缩/改名（terser mangle）不会破坏已存数据；只有**未注册**的类型才回退到 `constructor.name`。
 * 表里的 key 同时充当反序列化的查找键，所以旧数据里写类名的历史格式仍然能加载。
 *
 * 注意：工具层组件（ICELinkSlot / ICELinkHook / 各类 ControlPanel）不进这张表，它们不被序列化。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
const componentTypeMap = {
  ICERect: ICERect,
  ICECircle: ICECircle,
  ICEEllipse: ICEEllipse,
  ICEStar: ICEStar,
  ICEIsogon: ICEIsogon,
  ICERose: ICERose,
  ICEText: ICEText,
  ICEImage: ICEImage,
  ICEGroup: ICEGroup,
  ICEVisioLink: ICEVisioLink,
  ICEPolyLine: ICEPolyLine,
  ICEBezier: ICEBezier,
};

export default componentTypeMap;
