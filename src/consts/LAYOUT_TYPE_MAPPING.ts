/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEFlowLayout from '../layout/ICEFlowLayout';
import ICEGridLayout from '../layout/ICEGridLayout';
import ICEBorderLayout from '../layout/ICEBorderLayout';
import ICEBoxLayout from '../layout/ICEBoxLayout';
import ICECardLayout from '../layout/ICECardLayout';
import ICEOverlayLayout from '../layout/ICEOverlayLayout';
import ICELayeredLayout from '../layout/ICELayeredLayout';

/**
 * 内置**布局**的类型条目表（与 `COMPONENT_TYPE_MAPPING` 同构，注册进同一个类型注册表）。
 *
 * 为什么布局也要注册：布局是"怎么排"，属于文档内容。快照往返时容器的策略要能按
 * `layout: { type, props }` 原样重建（见 `Serializer` / `Deserializer`），
 * 而"重建"依赖 `ice.getType(typeId)` —— 所以内置布局与内置组件一样，在 `ICE` 构造时注册。
 *
 * 第三方布局用 `ice.registerType('your-namespace:MyLayout', MyLayout)` 注册 + 实现 `toJSON()`。
 */
export const layoutTypeEntries: Array<{ typeId: string; ctor: new (...args: any[]) => any }> = [
  { typeId: 'ice-render:ICEFlowLayout', ctor: ICEFlowLayout },
  { typeId: 'ice-render:ICEGridLayout', ctor: ICEGridLayout },
  { typeId: 'ice-render:ICEBorderLayout', ctor: ICEBorderLayout },
  { typeId: 'ice-render:ICEBoxLayout', ctor: ICEBoxLayout },
  { typeId: 'ice-render:ICECardLayout', ctor: ICECardLayout },
  { typeId: 'ice-render:ICEOverlayLayout', ctor: ICEOverlayLayout },
  { typeId: 'ice-render:ICELayeredLayout', ctor: ICELayeredLayout },
];

export default layoutTypeEntries;
