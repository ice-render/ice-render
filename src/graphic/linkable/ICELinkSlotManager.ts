/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE from '../../ICE';

/**
 * @class ICELinkSlotManager
 *
 * 连接插槽管理器
 *
 * @see ICE
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ICELinkSlotManager {
  private ice: ICE;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    console.log('ICELinkSlotManager start...');
    return this;
  }

  //FIXME:
  stop() {}
}
