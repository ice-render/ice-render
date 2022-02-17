/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEPath from './ICEPath';

export default class ICESVGPath extends ICEPath {
  constructor(props) {
    super(props);
  }

  protected createPathObject(): Path2D {
    this.path2D = new Path2D();
    return this.path2D;
  }
}
