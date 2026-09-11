/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import { snapAngle } from './constraints';
import ICEEvent from '../../event/ICEEvent';
import GeoUtil from '../../geometry/GeoUtil';
import ICECircle from '../../graphic/shape/ICECircle';

/**
 * @class RotateControl 旋转操作手柄
 *
 * - 旋转手柄不能独立存在，只能依附在某个宿主对象上。
 * - 此手柄仅用来修改组件的旋转角度。
 */
export default class RotateControl extends ICECircle {
  constructor(props) {
    super({ ...props, linkable: false });
  }

  protected initEvents(): void {
    super.initEvents();
    this.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.rotateEvtHandler, this);
  }

  private rotateEvtHandler(evt): void {
    if (!this.parentNode) {
      //parentNode 是 TransformPanel
      return;
    }

    //计算手柄旋转角（实时重算面板原点，避免读取可能过期的缓存 absoluteOrigin）
    const parentOrigin = this.parentNode.calcAbsoluteOrigin();
    const rotateAngle = GeoUtil.calcRotateAngle(evt.offsetX, evt.offsetY, parentOrigin[0], parentOrigin[1]);

    //旋转手柄默认处于逆时针 90 度位置，这里加 90 度进行补偿。
    let rotate = rotateAngle + 90;
    // Shift：吸附到 15° 整数倍（吸附作用在补偿后的最终角度上）
    if (evt && evt.shiftKey) {
      rotate = snapAngle(rotate);
    }

    //parentNode 旋转角与手柄旋转角同步
    const param = {
      transform: {
        rotate,
      },
    };

    this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ROTATE, new ICEEvent(param));
    this.parentNode.setState(param);
    this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE, new ICEEvent(param));
  }
}
