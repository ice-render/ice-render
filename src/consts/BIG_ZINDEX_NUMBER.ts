/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * zIndex 最大值，这里使用一千万是安全的，在一张画布上渲染一千万个图形的可能性很小
 * zIndex 用来控制组件在画布中的堆叠次序
 * @see ICEComponent.state.zIndex
 */
const bigZIndexNum: number = 10000000;
export default bigZIndexNum;
