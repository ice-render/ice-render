/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import ICECircle from '../shape/ICECircle';
import ICEEllipse from '../shape/ICEEllipse';
import ICEIsogon from '../shape/ICEIsogon';
import ICERect from '../shape/ICERect';
import ICEStar from '../shape/ICEStar';
import ICELinkable from './ICELinkable';

/**
 *
 * 用 ICELinkable 装饰并导出所有可连接的组件。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html#constrained-mixins
 *
 */

export const ICELinkableRect = ICELinkable(ICERect);
//不能在 ICECircle 类内部直接使用 ICELinkable 来构造可连接的圆，因为 ICESlot 是 ICECircle 的子类，rollup 检测到循环依赖之后编译会报错。
export const ICELinkableCircle = ICELinkable(ICECircle);

export const ICELinkableEllipse = ICELinkable(ICEEllipse);
export const ICELinkableIsogon = ICELinkable(ICEIsogon);
export const ICELinkableStar = ICELinkable(ICEStar);
