/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEGroup from './ICEGroup';

/**
 * @class ICECompositeComponent
 *
 * 组合型组件
 *
 * - 由多个组件组合在一起构成的组件，可以无限嵌套。
 * - 组合型组件内部可以带有装饰性的小组件。
 * - ICEBaseComponent 是简单的原子组件，内部不能容纳其它组件，也不能添加各种鼠标交互小工具。在 ICE 中，大多数组件都基于 ICECompositeComponent 进行组装。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ICECompositeComponent extends ICEGroup {
  constructor(props: any = {}) {
    super(props);
  }
}
