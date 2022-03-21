/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEDotPath from '../ICEDotPath';

/**
 * i 代表角度 scale:放大比例
 */
class ICEHeart extends ICEDotPath {
  /**
   * @required
   * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
   */
  public static type: string = 'ICEHeart';

  constructor(props: any = {}) {
    let param = {
      scale: 2,
      ...props,
    };
    super(param);
  }

  protected calcDots() {
    this.state.dots = [];
    for (let i = 0; i < 2 * Math.PI; i += 0.01) {
      let scale = this.state.scale;
      let x = scale * (12 * Math.sin(i) - 4 * Math.sin(3 * i)) + this.state.width / 2;
      let y =
        -scale * (13 * Math.cos(i) - 5 * Math.cos(2 * i) - 2 * Math.cos(3 * i) - Math.cos(4 * i)) +
        this.state.height / 2;
      this.state.dots.push([x, y]);
    }
    return this.state.dots;
  }
}

export default ICEHeart;
