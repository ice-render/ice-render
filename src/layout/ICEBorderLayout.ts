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
    this.gap = props.gap ?? 5;
  }

  /**
   * @overwrite
   * 五区落位。方位从 `constraintOf()` 读（非法值会提示一次并落到 center）。
   * 五个区域都在**内容盒**里排（容器 `padding` 之内），north/south 横向拉满、east/west 纵向拉满。
   */
  layoutContainer(container: ICEGroup): void {
    const children = this.layoutChildren(container);
    const box = this.contentBox(container);
    const W = box.width;
    const H = box.height;

    let north: any = null;
    let south: any = null;
    let east: any = null;
    let west: any = null;
    let center: any = null;
    children.forEach((child: any) => {
      const pos = this.constraintOf(child);
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
      this.placeChildSized(north, box.left, box.top, W);
      top = north.state.height + this.gap;
    }
    if (south) {
      this.placeChildSized(south, box.left, box.top + H - south.state.height, W);
      bottom = H - south.state.height - this.gap;
    }
    if (east) {
      this.placeChildSized(east, box.left + W - east.state.width, box.top + top, undefined, bottom - top);
      right = W - east.state.width - this.gap;
    }
    if (west) {
      this.placeChildSized(west, box.left, box.top + top, undefined, bottom - top);
      left = west.state.width + this.gap;
    }
    if (center) {
      this.placeChildSized(center, box.left + left, box.top + top, right - left, bottom - top);
    }
  }

  /** 内容首选尺寸：南北叠高 × （西 + 中 + 东）取宽。 */
  getPreferredSize(container: ICEGroup): [number, number] {
    const pad = this.paddingOf(container);
    let north = 0;
    let south = 0;
    let west = 0;
    let east = 0;
    let centerW = 0;
    let centerH = 0;
    for (const child of this.layoutChildren(container)) {
      const [w, h] = this.outerSizeOf(child);
      const pos = this.constraintOf(child);
      if (pos === 'north') north = Math.max(north, h);
      else if (pos === 'south') south = Math.max(south, h);
      else if (pos === 'west') west = Math.max(west, w);
      else if (pos === 'east') east = Math.max(east, w);
      else {
        centerW = Math.max(centerW, w);
        centerH = Math.max(centerH, h);
      }
    }
    const width = Math.max(
      west + centerW + east + (west && centerW ? this.gap : 0) + (centerW && east ? this.gap : 0),
      0
    );
    const height = north + centerH + south + (north && centerH ? this.gap : 0) + (centerH && south ? this.gap : 0);
    return [width + pad.left + pad.right, height + pad.top + pad.bottom];
  }
}

export default ICEBorderLayout;
