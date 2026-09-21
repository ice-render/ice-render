/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEGroup from './ICEGroup';

/**
 * **虚拟层**：一个把自己交给 `VirtualChildSource` 的容器。
 *
 * 它就是 `new ICEGroup({ childSource })` 的一层薄壳（同一套机制，见 `ICEGroup.doRender` 里的
 * `paintVirtualWindow`），存在的意义是**可发现性**：告诉读代码的人"这一层不按子组件绘制"。
 *
 * 什么时候用它（`plans/virtual-child-source.md` 的形态 B）：
 * - 文档里图元很多、屏幕上只看得到一小块（工艺图 / 管网图 / 地图 / 大画布编辑器）；
 * - 简单图元可以批量落墨（`source.paint`），复杂图元（文字 / 图片 / 自定义子类）在窗口内
 *   `materialize()` 成真组件挂进来 —— 真子项由 `IGGroup.doRender` 的常规路径画在批量层之上。
 *
 * 默认 `origin: 'top-left'`：这样**局部坐标 == 容器左上角起算的坐标**，文档用世界坐标就能直接用。
 * 需要别的原点/变换也可以传（引擎会把可见窗口经逆合成矩阵变换到局部坐标，见 `visibleLocalRect`）。
 *
 * ```ts
 * const layer = new ICEVirtualLayer({ left: 0, top: 0, width: WORLD_W, height: WORLD_H, childSource: doc.source });
 * ice.addChild(layer);
 * ```
 */
class ICEVirtualLayer extends ICEGroup {
  constructor(props: any = {}) {
    super({ origin: 'top-left', ...props });
  }
}

export default ICEVirtualLayer;
