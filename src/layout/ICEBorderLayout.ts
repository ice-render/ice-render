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
 * @class ICEBorderLayout 五区域布局
 *
 * 对齐 Java Swing 的 BorderLayout：把容器分成五个区域——north(上)/south(下)/east(右)/west(左)/center(中)。
 * 子组件通过 state.layoutConstraint 指定所属区域（默认 'center'）：
 *
 * ```
 * new ICERect({ layoutConstraint: 'north', ... })  // 顶部
 * ```
 *
 * 规则：north/south 占满整宽、高度取自身；east/west 占左右剩余高度；center 填充中间剩余区域。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEBorderLayout extends ICELayoutManager {
  private gap: number;

  constructor(props: { gap?: number } = {}) {
    super();
    this.gap = props.gap || 5;
  }

  /**
   * @overwrite
   */
  layoutContainer(container: ICEGroup): void {
    const children = container.childNodes;
    const W = container.state.width;
    const H = container.state.height;

    let north: any = null;
    let south: any = null;
    let east: any = null;
    let west: any = null;
    let center: any = null;
    children.forEach((child: any) => {
      const pos = child.state.layoutConstraint || 'center';
      if (pos === 'north') north = child;
      else if (pos === 'south') south = child;
      else if (pos === 'east') east = child;
      else if (pos === 'west') west = child;
      else center = child;
    });

    let top = 0;
    let bottom = H;
    let left = 0;
    let right = W;

    if (north) {
      north.setState({ left: 0, top: 0, width: W });
      top = north.state.height + this.gap;
    }
    if (south) {
      south.setState({ left: 0, top: H - south.state.height, width: W });
      bottom = H - south.state.height - this.gap;
    }
    if (east) {
      east.setState({ left: W - east.state.width, top, height: bottom - top });
      right = W - east.state.width - this.gap;
    }
    if (west) {
      west.setState({ left: 0, top, height: bottom - top });
      left = west.state.width + this.gap;
    }
    if (center) {
      center.setState({ left, top, width: right - left, height: bottom - top });
    }
  }
}

export default ICEBorderLayout;
