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
    const jsonObj = JSON.parse(jsonStr);
    console.log(jsonObj);

    const childNodes = jsonObj.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      this.decodeRecursively(this.ice, childNodes[i]);
    }
  }

  //递归
  private decodeRecursively(parentNode, nodeData) {
    const Clazz = componentTypeMap[nodeData.type];
    const state = nodeData.state;
    const instance = new Clazz(state);
    parentNode.addChild(instance);

    let childNodes = nodeData.childNodes;
    if (childNodes && childNodes.length) {
      for (let i = 0; i < childNodes.length; i++) {
        this.decodeRecursively(instance, childNodes[i]);
      }
    }
  }
}
