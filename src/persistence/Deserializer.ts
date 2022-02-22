/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import componentTypeMap from '../COMPONENT_TYPE_MAPPING';
import ICE from '../ICE';

/**
 * @class Deserializer
 *
 * 把 JSON 字符串反解析成图形。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class Deserializer {
  private ice: ICE;

  constructor(ice) {
    this.ice = ice;
  }

  public fromJSON(jsonStr: string) {
    console.log(componentTypeMap);
    console.log(jsonStr);
    return {};
  }
}
