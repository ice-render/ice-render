/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { paintOrderChildrenOf } from '../util/data-util';

/**
 * 把**一棵子树**渲染到指定上下文（离屏出图 / 服务端出图 / 应用自己做批量精灵）。
 *
 * ⚠️ 为什么需要它：`ICEComponent.renderTo()` 只画「组件自己」—— 子组件是渲染队列遍历着画的
 *   （`ObjectCache` / 静态层都是**逐组件**调用 `renderTo`）。所以对一个**复合组件**只调一次
 *   `renderTo()` 什么也画不出来（容器自己不落墨），而这是很自然、也很容易写错的用法；
 *   IED 的虚拟文档批量精灵就这样踩过：21 张精灵位图全空白，画面上"只有管线、一个符号都没有"。
 *
 * 绘制次序与渲染队列 / SVG 导出**同源**（都用 `paintOrderChildrenOf`：先父后子、同级派生件在前、
 * 各自按 `state.zIndex` 升序），因此离屏结果与上屏结果逐像素一致。
 *
 * @param component 子树根（可以是复合组件，也可以是叶子组件 —— 叶子等价于直接 `renderTo`）
 * @param ctx 目标上下文
 * @param baseMatrix 叠加在组件自身 `composedMatrix` 之前的基准矩阵（把世界盒平移进离屏画布用），
 *   与 `renderTo()` 的第二个参数同一套约定：最终 CTM = baseMatrix · composedMatrix
 */
export function renderSubtreeTo(component: any, ctx: any, baseMatrix: number[] | null = null): void {
  if (!component || !ctx) {
    return;
  }
  component.renderTo(ctx, baseMatrix);
  const children = paintOrderChildrenOf(component);
  for (let i = 0; i < children.length; i++) {
    renderSubtreeTo(children[i], ctx, baseMatrix);
  }
}
