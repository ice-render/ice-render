/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import ICEGroup from '../graphic/container/ICEGroup';
import ICEVirtualLayer from '../graphic/container/ICEVirtualLayer';
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
 * key 是**稳定的类型名（typeId）**，格式为 `namespace:Type`，与类的 JS 名解耦：序列化时由构造函数
 * 反查这张表得到 typeId，因此压缩/改名（terser mangle）不会破坏已存数据；只有**未注册**的类型
 * 才回退到 `constructor.name`（此时 `Serializer.unregisteredTypes` 会记录并告警）。
 *
 * 注意：工具层组件（ICELinkSlot / ICELinkHook / 各类 ControlPanel）不进这张表，它们不被序列化。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export interface ComponentTypeEntry {
  typeId: string;
  ctor: any;
}

/**
 * 内置类型的注册表：typeId 统一为 `ice-render:Type`（引擎自己的 namespace）。
 */
export const componentTypeEntries: ComponentTypeEntry[] = [
  { typeId: 'ice-render:Rect', ctor: ICERect },
  { typeId: 'ice-render:Circle', ctor: ICECircle },
  { typeId: 'ice-render:Ellipse', ctor: ICEEllipse },
  { typeId: 'ice-render:Star', ctor: ICEStar },
  { typeId: 'ice-render:Isogon', ctor: ICEIsogon },
  { typeId: 'ice-render:Rose', ctor: ICERose },
  { typeId: 'ice-render:Text', ctor: ICEText },
  { typeId: 'ice-render:Image', ctor: ICEImage },
  { typeId: 'ice-render:Group', ctor: ICEGroup },
  // 虚拟层：子项由 `childSource` 描述（文档是应用的数据，不进快照）；这里登记是为了往返时可重建
  { typeId: 'ice-render:VirtualLayer', ctor: ICEVirtualLayer },
  { typeId: 'ice-render:VisioLink', ctor: ICEVisioLink },
  { typeId: 'ice-render:PolyLine', ctor: ICEPolyLine },
  { typeId: 'ice-render:Bezier', ctor: ICEBezier },
];

const componentTypeMap: Record<string, any> = {};
for (let i = 0; i < componentTypeEntries.length; i++) {
  const entry = componentTypeEntries[i];
  componentTypeMap[entry.typeId] = entry.ctor;
}

export default componentTypeMap;
