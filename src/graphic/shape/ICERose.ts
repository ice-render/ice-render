import ICEPath from '../ICEPath';

/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

const sin = Math.sin;
const cos = Math.cos;
const radian = Math.PI / 180;

class ICERose extends ICEPath {
  /**
   * @required
   * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
   */
  public static type: string = 'ICERose';

  constructor(props: any = {}) {
    super({ r: [10], n: 1, k: 0, ...props });
  }

  protected createPathObject(): Path2D {
    this.path2D = new Path2D();
    const R = this.state.r;
    const k = this.state.k;
    const n = this.state.n;
    const x0 = this.state.localOrigin.x;
    const y0 = this.state.localOrigin.y;
    let x;
    let y;
    let r;

    this.path2D.moveTo(x0, y0);
    for (let i = 0, len = R.length; i < len; i++) {
      r = R[i];
      for (let j = 0; j <= 360 * n; j++) {
        x = r * sin((((k / n) * j) % 360) * radian) * cos(j * radian) + x0;
        y = r * sin((((k / n) * j) % 360) * radian) * sin(j * radian) + y0;
        this.path2D.lineTo(x, y);
      }
    }

    this.path2D.closePath();
    return this.path2D;
  }

  public toJSON(): object {
    let result = { ...super.toJSON(), type: ICERose.type };
    return result;
  }
}

export default ICERose;
