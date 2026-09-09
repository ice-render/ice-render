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
 * @class ICECardLayout 卡片布局
 *
 * 对齐 Java Swing 的 CardLayout：一次只显示一个子组件（卡片），其余隐藏。
 * 通过 show(index) / next() / previous() 切换当前显示的卡片。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICECardLayout extends ICELayoutManager {
  private currentIndex = 0;
  private container: ICEGroup | null = null;

  constructor(props: { currentIndex?: number } = {}) {
    super();
    this.currentIndex = props.currentIndex || 0;
  }

  /**
   * @overwrite
   * 只显示当前卡片（display=true），其余隐藏（display=false），当前卡片对齐到左上角。
   */
  layoutContainer(container: ICEGroup): void {
    this.container = container;
    container.childNodes.forEach((child, i) => {
      child.setState({ display: i === this.currentIndex, left: 0, top: 0 });
    });
  }

  /**
   * 切换到指定卡片。
   */
  public show(index: number): void {
    this.currentIndex = index;
    if (this.container) {
      this.layoutContainer(this.container);
    }
  }

  public next(): void {
    this.show(this.currentIndex + 1);
  }

  public previous(): void {
    this.show(this.currentIndex - 1);
  }
}

export default ICECardLayout;
