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
  /**
   * @required
   * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
   */
  public static type: string = 'ICEStar';

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
        this.path2D.moveTo(v1.x, v1.y);
        this.path2D.lineTo(v2.x, v2.y);
      } else {
        this.path2D.lineTo(v2.x, v2.y);
      }
      i = j;
      counter++;
    }
    this.path2D.closePath();
    return this.path2D;
  }

  public toJSON(): object {
    let result = { ...super.toJSON(), type: ICEStar.type };
    return result;
  }
}

export default ICEStar;
