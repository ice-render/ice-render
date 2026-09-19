/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * `zIndex` 的 **auto 哨兵**：`'auto'` —— 组件的默认值。
 *
 * 语义与 CSS 的 `z-index: auto` 同义：**排序时当 `0` 用**，且同层取值相等的兄弟
 * 按**加入顺序**决定先后（后加入的画在上面）。所以"没手工调过次序"的组件彼此平手，
 * 默认值不会像旧的"构造顺序计数器"那样随构造次数一路涨。
 *
 * 显式写数字就是**钉子**，一视同仁地参与比较：`-n` 在 auto 层**之下**（背景），
 * `+n` 在 auto 层**之上**（浮层）。
 *
 * ⚠️ 取数一律走 `util/data-util.ts` 的 `zIndexOf()`（它把 `'auto'` / 脏值都折成 0），
 * 不要自己写 `state.zIndex - 1` 这种算术 —— `'auto' - 1` 是 `NaN`，会让整层排序静默失效。
 *
 * @see ICEComponent.state.zIndex
 */
const zIndexAuto = 'auto';
export default zIndexAuto;
