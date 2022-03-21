/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEIsogon from './ICEIsogon';

/**
 * @class ICEStar 五角星
 * TODO:实现正 N 角星
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEStar extends ICEIsogon {
  constructor(props: any = {}) {
    super({ radius: 10, edges: 5, ...props });
  }

  protected doCreatePath(): Path2D {
    this.path2D = new Path2D();
    let counter = 0;
    let i = 0;
    while (counter < this.state.edges) {
      let j = (i + 2) % this.state.edges;
      let v1 = this.state.dots[i];
      let v2 = this.state.dots[j];
      if (counter == 0) {
        this.path2D.moveTo(v1[0], v1[1]);
        this.path2D.lineTo(v2[0], v2[1]);
      } else {
        this.path2D.lineTo(v2[0], v2[1]);
      }
      i = j;
      counter++;
    }
    this.path2D.closePath();
    return this.path2D;
  }
}

export default ICEStar;
