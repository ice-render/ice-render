/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * @class ICEAddonComponent
 *
 * 附属组件
 *
 * - 附属组件一般用来装饰其它组件。
 * - 附属组件必须依附在某个宿主组件上，不能单独存在。
 *
 * @abstract
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default abstract class ICEAddonComponent {
  hostComponent;

  hostMoveHandler(evt) {
    console.log('host moving...');
    //FIXME:宿主发生移动之后，附属组件更新自己的位置
  }

  setHostComponent(component) {
    this.hostComponent = component;
    if (this.hostComponent) {
      this.hostComponent.on('after-move', this.hostMoveHandler, this);
    } else {
      this.hostComponent.off('after-move', this.hostMoveHandler, this);
    }
  }
}
