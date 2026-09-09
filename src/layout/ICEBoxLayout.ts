/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type ICEGroup from '../graphic/container/ICEGroup';
import ICELayoutManager from './ICELayoutManager';

/**
 * @class ICEBoxLayout 箱式布局
 *
 * 对齐 Java Swing 的 BoxLayout：子组件沿单轴（横向 x / 纵向 y）依次排列，不换行。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEBoxLayout extends ICELayoutManager {
  private axis: 'x' | 'y';
  private gap: number;

  constructor(props: { axis?: 'x' | 'y'; gap?: number } = {}) {
    super();
    this.axis = props.axis || 'x';
    this.gap = props.gap || 5;
  }

  /**
   * @overwrite
   * 沿单轴依次排列，横向时 left 递增，纵向时 top 递增。
   */
  layoutContainer(container: ICEGroup): void {
    let offset = 0;
    for (const child of container.childNodes) {
      if (this.axis === 'x') {
        child.setState({ left: offset, top: 0 });
        offset += child.state.width + this.gap;
      } else {
        child.setState({ left: 0, top: offset });
        offset += child.state.height + this.gap;
      }
    }
  }
}

export default ICEBoxLayout;
