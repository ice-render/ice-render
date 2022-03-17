/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEEvent from '../../event/ICEEvent';
import GeometryUtil from '../../geometry/GeoUtil';
import ICECircle from '../../graphic/shape/ICECircle';
import { ICE_EVENT_NAME_CONSTS } from '../../ICE_EVENT_NAME_CONSTS';

/**
 * @class RotateControl 旋转操作手柄
 *
 * - 旋转手柄不能独立存在，只能依附在某个宿主对象上。
 * - 此手柄仅用来修改组件的旋转角度。
 *
 * TODO: 补全 props 配置项
 * {
 * }
 */
export default class RotateControl extends ICECircle {
  constructor(props) {
    super({ props, linkable: false });
    this.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.rotateEvtHandler, this);
  }

  private rotateEvtHandler(evt) {
    if (!this.parentNode) {
      //parentNode 是 TransformPanel
      return;
    }

    //计算手柄旋转角
    let parentOrigin = this.parentNode.state.absoluteOrigin;
    let rotateAngle = GeometryUtil.calcRotateAngle(evt.offsetX, evt.offsetY, parentOrigin.x, parentOrigin.y);

    //parentNode 旋转角与手柄旋转角同步
    const param = {
      transform: {
        rotate: rotateAngle + 90, //旋转手柄默认处于逆时针 90 度位置，这里加 90 度进行补偿。
      },
    };

    this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ROTATE, new ICEEvent(param));
    this.parentNode.setState(param);
    this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE, new ICEEvent(param));
  }
}
