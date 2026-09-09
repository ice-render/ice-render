/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import root from '../../cross-platform/root';
import ICEPath from '../ICEPath';

/**
 * @class ICERect 矩形
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICERect extends ICEPath {
  constructor(props: any = {}) {
    super({ width: 10, height: 10, ...props });
  }

  protected createPathObject(): any {
    this.path2D = root.createPath2D();
    const x = 0 - this.state.localOrigin[0];
    const y = 0 - this.state.localOrigin[1];
    const w = this.state.width;
    const h = this.state.height;
    const r = Math.min(this.state.radius || 0, w / 2, h / 2);

    if (r > 0) {
      // 圆角矩形：用 arcTo 手动绘制（兼容所有环境，不依赖较新的 roundRect）
      this.path2D.moveTo(x + r, y);
      this.path2D.lineTo(x + w - r, y);
      this.path2D.arcTo(x + w, y, x + w, y + r, r);
      this.path2D.lineTo(x + w, y + h - r);
      this.path2D.arcTo(x + w, y + h, x + w - r, y + h, r);
      this.path2D.lineTo(x + r, y + h);
      this.path2D.arcTo(x, y + h, x, y + h - r, r);
      this.path2D.lineTo(x, y + r);
      this.path2D.arcTo(x, y, x + r, y, r);
      this.path2D.closePath();
    } else {
      this.path2D.rect(x, y, w, h);
    }
    return this.path2D;
  }
}

export default ICERect;
