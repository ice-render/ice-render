/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * **工具层**（控制面板 / 手柄 / 连线插槽 / 对齐提示线）内部使用的 zIndex 起始号段：一千万。
 *
 * ⚠️ 它**不是**"比所有组件都大"的全局最大值 —— 工具层与组件层是**两条独立队列**
 * （`toolsQueue` 永远整体画在 `componentQueue` 之上，见「渲染顺序铁律」），
 * 所以这个数字只用来在**工具层内部**排序（面板本体 1e7+1、手柄 1e7+2 ……）。
 * 组件层写再大的 zIndex 也压不住工具层 —— 两层之间没有数字比较这回事。
 *
 * 约定：`zIndex >= 1e7` 是**保留号段**，组件层不要用。落在号段里的值不参与「默认 zIndex
 * 计数器」的同步（`ICEComponent.__syncInstanceCounter` 会跳过），免得建完一个控制面板之后，
 * 新建组件的默认 zIndex 直接跳到 10001003 这种天文数字。
 *
 * @see ICEComponent.state.zIndex
 */
const bigZIndexNum: number = 10000000;
export default bigZIndexNum;
