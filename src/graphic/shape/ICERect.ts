/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEPath from '../ICEPath';

/**
 * @class ICERect 矩形
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICERect extends ICEPath {
  constructor(props: any = {}) {
    super({ width: 10, height: 10, ...props });
  }

  protected createPathObject(): Path2D {
    this.path2D = new Path2D();
    this.path2D.rect(0 - this.state.localOrigin[0], 0 - this.state.localOrigin[1], this.state.width, this.state.height);
    return this.path2D;
  }
}

export default ICERect;
