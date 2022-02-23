/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEBaseComponent from '../graphic/ICEBaseComponent';
import ICE from '../ICE';

/**
 * @class Serializer
 *
 * 把图形序列化成 JSON 字符串。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class Serializer {
  private ice: ICE;

  constructor(ice) {
    this.ice = ice;
  }

  /**
   * 把对象序列化成 JSON 字符串：
   * - 容器型组件需要负责子节点的序列化操作
   * - 如果组件不需要序列化，需要返回 null
   * @returns JSONObject
   */
  public toJSON(): string {
    let result = { time: new Date().toLocaleString(), childNodes: [] };
    this.ice.childNodes.forEach((child: ICEBaseComponent) => {
      if (child.toJSON()) {
        result.childNodes.push(child.toJSON());
      }
    });
    console.log(result);
    return JSON.stringify(result);
  }
}
