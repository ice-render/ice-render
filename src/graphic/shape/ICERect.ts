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

  /**
   * @overwrite
   * 命令流的输入只有「宽 / 高 / 圆角 / 本地原点 / 是否闭合」这几项（见 `createPathObject`），
   * 因此可以用来判定「几何没变」——平移/旋转变换不进签名，它们由 CTM 承担。
   */
  protected __pathSignature(out: any[]): any[] | null {
    const s: any = this.state;
    const o = s.localOrigin;
    out.push(s.width, s.height, s.radius, o ? o[0] : 0, o ? o[1] : 0, s.closePath);
    return out;
  }

  protected createPathObject(): any {
    this.path2D = root.createPath2D();
    const x = 0 - this.state.localOrigin[0];
    const y = 0 - this.state.localOrigin[1];
    const w = this.state.width;
    const h = this.state.height;
    const r = Math.min(this.state.radius || 0, w / 2, h / 2);

    if (r > 0) {
      /**
       * 圆角矩形走平台的 `roundRect`（2021 年进入 Canvas 2D 规范）。
       *
       * 改造前这里是 4 次 `arcTo` 手撸（10 条命令 + 每角一次三角函数），
       * 注释写着「兼容所有环境，不依赖较新的 roundRect」—— 那是小程序时代的顾虑。
       * 现在：命令流 1 条、原生调用 1 次，没有原生 `roundRect` 的运行时由
       * `Path2DRecorder` 展开成等价的 `arcTo` 序列（逐像素一致，见 recorder 的注释）。
       */
      this.path2D.roundRect(x, y, w, h, r);
    } else {
      this.path2D.rect(x, y, w, h);
    }
    return this.path2D;
  }
}

export default ICERect;
